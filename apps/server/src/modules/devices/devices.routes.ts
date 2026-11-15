import { Router } from 'express';
import { z } from 'zod';
import { createMemorySchema, type MemoryCardDto } from '@living-draft/contracts';
import { toThirdPerson } from '@living-draft/engine';
import { run } from '../../db/database';
import { body, notFound, param } from '../../lib/http';
import { askWithAi } from '../ai/ask';
import { findJob, startTask, understandingContext } from '../ai/jobs';
import { ai } from '../ai/runner';
import { discoverThreads } from '../ai/threads';
import { understandNotes } from '../ai/understand';
import { Archive } from '../archive/snapshot';
import { startPairing } from '../auth/account.service';
import { analyzeCapture, createMemory } from '../capture/capture.service';
import { ask } from '../insight/insight.service';
import { saveUnderstanding } from '../memories/understanding.repository';
import { memoryDetail } from '../memories/memory.service';
import { findProfile } from '../profile/profile.repository';

export const devicesRouter = Router();

function spoken(memoryId: string): string {
  const detail = memoryDetail(memoryId);
  const profile = findProfile();
  const story =
    profile?.narrativeVoice === 'third'
      ? toThirdPerson(detail.readingCopy, {
          name: profile.preferredName,
          pronouns: profile.pronouns,
        })
      : detail.readingCopy;
  return `${detail.title}. ${detail.temporal.label}. ${story}`;
}

function brief(card: MemoryCardDto) {
  return {
    id: card.id,
    title: card.title,
    when: card.temporal.label,
    feelings: card.emotions.filter((e) => e.phase === 'then').map((e) => e.tag),
    people: card.people.slice(0, 3).map((p) => p.name),
  };
}

devicesRouter.post('/devices/pair', (_req, res) => {
  res.json(startPairing());
});

devicesRouter.get('/devices/today', (_req, res) => {
  const cards = Archive.load()
    .cards()
    .filter((m) => !m.sensitive);
  if (!cards.length) {
    res.json({ memory: null, name: findProfile()?.preferredName ?? null });
    return;
  }
  const today = new Date();
  const onThisDay = cards.filter(
    (m) => m.temporal.month === today.getMonth() + 1 && m.temporal.day === today.getDate(),
  );
  const pool = onThisDay.length ? onThisDay : cards;
  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  res.json({
    memory: { ...brief(pick), speech: spoken(pick.id), onThisDay: onThisDay.length > 0 },
    name: findProfile()?.preferredName ?? null,
  });
});

devicesRouter.get('/devices/recent', (_req, res) => {
  const cards = Archive.load()
    .cards()
    .filter((m) => !m.sensitive)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);
  res.json(cards.map(brief));
});

devicesRouter.get('/devices/memories/:id', (req, res) => {
  const id = param(req, 'id');
  const card = Archive.load().cards([id]).at(0);
  if (!card) throw notFound('Memory');
  res.json({ ...brief(card), speech: spoken(id), summary: card.summary ?? card.excerpt });
});

async function tidyInBackground(memoryId: string, versionId: string, text: string) {
  const notes = await understandNotes(text, understandingContext(memoryId), false);
  if (notes.title.trim()) run('UPDATE memories SET title = ? WHERE id = ?', notes.title, memoryId);
  saveUnderstanding(memoryId, versionId, {
    summary: notes.summary || null,
    time: notes.time.kind === 'unclear' ? null : notes.time,
    themes: notes.themes.map((t) => ({ theme: t.theme, evidence: t.because })),
    followups: notes.questions.map((question) => ({ question, answer: null })),
    places: notes.places.map((p) => ({ name: p.name, kind: p.kind })),
  });
  await discoverThreads([memoryId]);
}

devicesRouter.post('/devices/memories', (req, res) => {
  const { text } = body(
    req,
    z.object({
      text: z.string().trim().min(3, 'Say a little more first.').max(20000),
      source: z.enum(['watch', 'phone', 'glasses']).optional(),
    }),
  );
  const analysis = analyzeCapture({ text, kind: 'memory' });
  const created = createMemory(
    createMemorySchema.parse({
      title: analysis.title,
      originalText: text,
      readingCopy: analysis.readingCopy,
      sourceKind: 'speech',
      temporal: { ...analysis.temporal, confirmed: false },
      people: analysis.people.map((p) => ({
        label: p.suggestion?.name ?? p.label,
        surfaces: p.surfaces,
        characterId: p.suggestion?.characterId ?? null,
        relationship: p.relationship,
        role: p.role,
        roleEvidence: p.roleEvidence,
        addAlias: true,
      })),
      emotions: analysis.emotions.map((e) => ({
        tag: e.tag,
        phase: e.phase,
        source: 'suggested',
        evidence: e.quote,
      })),
    }),
  );
  const tidying = ai.available();
  if (tidying) startTask(() => tidyInBackground(created.memoryId, created.versionId, text));
  res.status(201).json({ id: created.memoryId, title: analysis.title, tidying });
});

devicesRouter.post('/devices/ask', async (req, res) => {
  const { question } = body(req, z.object({ question: z.string().trim().min(3).max(500) }));
  if (ai.available()) {
    res.status(202).json({ job: startTask(() => askWithAi(question)).id });
    return;
  }
  const answer = ask({ question, scope: {} });
  res.json({
    lines: answer.lines.map((l) => l.text),
    sources: answer.citations.map((c) => c.title),
  });
});

devicesRouter.get('/devices/ask/:job', (req, res) => {
  const job = findJob(param(req, 'job'));
  if (!job) throw notFound('Question');
  if (job.status === 'working') {
    res.json({ working: true });
    return;
  }
  if (job.status === 'failed') {
    res.json({ error: job.error ?? 'That one got away. Try asking again.' });
    return;
  }
  const answer = job.result as {
    lines: Array<{ text: string }>;
    citations: Array<{ title: string }>;
  };
  res.json({
    lines: answer.lines.map((l) => l.text),
    sources: [...new Set(answer.citations.map((c) => c.title))],
  });
});
