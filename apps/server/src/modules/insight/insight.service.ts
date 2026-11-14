import type { AnswerDto, AskInput, ComparisonDto, SavedAnalysisDto } from '@living-draft/contracts';
import {
  answerQuestion,
  compareMemories,
  compareVersions,
  connectionLabel,
} from '@living-draft/engine';
import { all, run } from '../../db/database';
import { json, newId, notFound, now } from '../../lib/http';
import { Archive } from '../archive/snapshot';
import { versionsOf } from '../capture/capture.service';

export function ask(input: AskInput): AnswerDto {
  const archive = Archive.load();
  const memories = archive.docs().map((doc) => {
    const versions = versionsOf(doc.id);
    const changeKinds: string[] = [];
    for (let i = 1; i < versions.length; i += 1) {
      const earlier = versions[i - 1]!;
      const later = versions[i]!;
      const result =
        later.mode === 'addition'
          ? compareVersions(earlier.composed_text, later.reading_copy, 'addition')
          : compareVersions(earlier.composed_text, later.composed_text, 'retelling');
      changeKinds.push(...result.changes.map((c) => c.kind));
    }
    return { ...doc, changeKinds };
  });
  return answerQuestion(
    input.question,
    {
      memories,
      connections: archive.connections.map((c) => ({
        type: c.type,
        memoryIds: archive.connectionMemoryIds(c.id),
        explanation: c.explanation,
        status: c.status,
      })),
      characters: archive.characters.map((c) => ({
        id: c.id,
        name: c.name,
        aliases: archive.aliases(c.id),
      })),
    },
    input.scope,
  );
}

export function compare(memoryIds: string[], question?: string): ComparisonDto {
  const archive = Archive.load();
  const docs = memoryIds.map((id) => {
    if (!archive.memory(id)) throw notFound('Memory');
    return archive.doc(id);
  });
  const result = compareMemories(docs, question);
  return {
    memories: archive.cards(memoryIds),
    sharedPeople: result.sharedPeople,
    onlyIn: result.onlyIn,
    sharedTerms: result.sharedTerms,
    emotions: result.emotions,
    summary: result.summary,
    suggestions: result.suggestions.map((s) => ({
      type: s.type,
      label: connectionLabel(s.type),
      memoryIds: s.memoryIds,
      explanation: s.explanation,
      evidence: s.evidence,
    })),
  };
}

export function saveAnalysis(input: {
  kind: string;
  question: string;
  scope: Record<string, unknown>;
  result: unknown;
}): SavedAnalysisDto {
  const id = newId();
  const createdAt = now();
  run(
    'INSERT INTO analyses (id, kind, question, scope_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    input.kind,
    input.question,
    JSON.stringify(input.scope),
    JSON.stringify(input.result),
    createdAt,
  );
  return { id, kind: input.kind, question: input.question, createdAt, result: input.result };
}

export function listAnalyses(): SavedAnalysisDto[] {
  return all<{
    id: string;
    kind: string;
    question: string;
    result_json: string;
    created_at: string;
  }>('SELECT * FROM analyses ORDER BY created_at DESC').map((r) => ({
    id: r.id,
    kind: r.kind,
    question: r.question,
    createdAt: r.created_at,
    result: json(r.result_json, null),
  }));
}

export function deleteAnalysis(id: string) {
  run('DELETE FROM analyses WHERE id = ?', id);
}
