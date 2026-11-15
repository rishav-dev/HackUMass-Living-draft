import type { AiJobDto } from '@living-draft/contracts';
import { all } from '../../db/database';
import { newId } from '../../lib/http';
import { listCharacters } from '../characters/character.service';
import { findProfile } from '../profile/profile.repository';
import { rewriteNarrative, understandNotes, type UnderstandContext } from './understand';

const jobs = new Map<
  string,
  AiJobDto & { createdAt: number; waiters: Array<(job: AiJobDto) => void> }
>();

function sweep() {
  const old = Date.now() - 30 * 60_000;
  for (const [id, job] of jobs) if (job.createdAt < old) jobs.delete(id);
}

export function understandingContext(
  memoryId?: string,
  answers: UnderstandContext['answers'] = [],
): UnderstandContext {
  const profile = findProfile();
  const earlier = memoryId
    ? all<{ original_text: string; recorded_at: string }>(
        'SELECT original_text, recorded_at FROM memory_versions WHERE memory_id = ? ORDER BY recorded_at',
        memoryId,
      ).map((v) => ({
        text: v.original_text,
        when: new Date(v.recorded_at).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
      }))
    : [];
  const asked = memoryId
    ? all<{ question: string; answer: string }>(
        'SELECT question, answer FROM memory_questions WHERE memory_id = ? AND answer IS NOT NULL ORDER BY asked_at',
        memoryId,
      )
    : [];
  return {
    narratorName: profile?.preferredName ?? 'the narrator',
    pronouns: profile?.pronouns ?? null,
    ageNow: profile?.currentAge ?? 30,
    people: listCharacters().map((c) => ({
      name: c.name,
      relationship: c.relationship,
      aliases: c.aliases,
    })),
    earlier,
    answers: [...asked, ...(answers ?? [])],
  };
}

export function startUnderstanding(input: {
  text: string;
  memoryId?: string;
  answers?: UnderstandContext['answers'];
  notes?: boolean;
  urgent?: boolean;
}): AiJobDto {
  sweep();
  const job = {
    id: newId(),
    status: 'working' as const,
    stage: 'waiting' as const,
    notes: null,
    narrative: null,
    draft: null,
    result: null,
    error: null,
    createdAt: Date.now(),
    waiters: [] as Array<(job: AiJobDto) => void>,
  } as AiJobDto & { createdAt: number; waiters: Array<(job: AiJobDto) => void> };
  jobs.set(job.id, job);
  const context = understandingContext(input.memoryId, input.answers);
  const urgent = input.urgent ?? true;
  void (async () => {
    try {
      if (input.notes !== false) {
        job.stage = 'notes';
        job.notes = await understandNotes(input.text, context, urgent);
      }
      job.stage = 'narrative';
      job.narrative = await rewriteNarrative(input.text, context, urgent, (soFar) => {
        job.draft = soFar;
      });
      job.stage = 'done';
      job.status = 'done';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'The AI could not read this one.';
    }
    for (const waiter of job.waiters.splice(0)) waiter(publicJob(job));
  })();
  return publicJob(job);
}

function publicJob(job: AiJobDto): AiJobDto {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    notes: job.notes,
    narrative: job.narrative,
    draft: job.narrative ? null : job.draft,
    result: job.result,
    error: job.error,
  };
}

export function findJob(id: string): AiJobDto | null {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

export function whenJobDone(id: string, then: (job: AiJobDto) => void): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status !== 'working') then(publicJob(job));
  else job.waiters.push(then);
  return true;
}

export function startTask(work: () => Promise<unknown>): AiJobDto {
  sweep();
  const job = {
    id: newId(),
    status: 'working' as AiJobDto['status'],
    stage: 'waiting' as AiJobDto['stage'],
    notes: null,
    narrative: null,
    draft: null as string | null,
    result: null as unknown,
    error: null as string | null,
    createdAt: Date.now(),
    waiters: [] as Array<(job: AiJobDto) => void>,
  };
  jobs.set(job.id, job);
  void work()
    .then(
      (result) => {
        job.result = result;
        job.status = 'done';
        job.stage = 'done';
      },
      (error: unknown) => {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'That did not work this time.';
      },
    )
    .finally(() => {
      for (const waiter of job.waiters.splice(0)) waiter(publicJob(job));
    });
  return publicJob(job);
}
