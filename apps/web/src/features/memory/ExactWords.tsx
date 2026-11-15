import { useState } from 'react';
import { Maximize2, MessageCircleQuestion, Quote, Sparkles } from 'lucide-react';
import type { MemoryDetailDto } from '@living-draft/contracts';
import { aiUsable, understand, useAiStatus } from '../../api/ai';
import { api } from '../../api/client';
import { useInvalidateArchive } from '../../api/hooks';
import { AudioPlayer } from '../../components/media/AudioPlayer';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/format';
import { MODE_LABELS } from '../../lib/meta';

const TELLINGS = new Set(['original', 'addition', 'retelling', 'correction']);

function preview(text: string, words = 60): string {
  const parts = text.trim().split(/\s+/);
  return parts.length <= words ? text.trim() : `${parts.slice(0, words).join(' ')}…`;
}

export function ExactWords({ memory }: { memory: MemoryDetailDto }) {
  const [open, setOpen] = useState(false);
  const tellings = memory.versions.filter((v) => TELLINGS.has(v.mode));
  const first = tellings[0];
  if (!first) return null;
  const waiting = memory.questions.filter((q) => !q.answer).length;

  return (
    <section aria-labelledby="exact-words" className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 id="exact-words" className="flex items-center gap-2 text-lg font-semibold">
          <Quote className="size-4 text-lavender-deep" /> Your exact words
        </h2>
        <span className="text-xs font-semibold text-ink-soft">
          {tellings.length} {tellings.length === 1 ? 'telling' : 'tellings'}
          {memory.questions.length ? ` · ${memory.questions.length} follow-up questions` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-3 block w-full rounded-3xl bg-cream/70 p-5 text-left transition hover:bg-cream"
      >
        <p className="font-display text-lg italic leading-relaxed text-ink-soft">
          {preview(first.originalText)}
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-lavender-deep group-hover:underline">
          <Maximize2 className="size-4" /> Read everything as you said it
          {waiting > 0 ? ` · ${waiting} question${waiting === 1 ? '' : 's'} waiting` : ''}
        </span>
      </button>
      {open && <ExactWordsDialog memory={memory} onClose={() => setOpen(false)} />}
    </section>
  );
}

function ExactWordsDialog({ memory, onClose }: { memory: MemoryDetailDto; onClose: () => void }) {
  const tellings = memory.versions.filter((v) => TELLINGS.has(v.mode));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const { data: ai } = useAiStatus();

  const saveAnswers = async () => {
    setBusy(true);
    try {
      for (const [id, answer] of Object.entries(answers))
        if (answer.trim()) await api.put(`/memories/${memory.id}/questions/${id}`, { answer });
      setAnswers({});
      invalidate();
      toast('Answers kept with this memory.');
    } finally {
      setBusy(false);
    }
  };

  const rewrite = async () => {
    setRewriting(true);
    try {
      const latest = tellings[tellings.length - 1]!;
      const started = await understand({
        text: latest.originalText,
        memoryId: memory.id,
        notes: false,
      });
      let result = await api.get<{
        status: string;
        narrative: string | null;
        error: string | null;
      }>(`/ai/jobs/${started.id}`);
      while (result.status === 'working') {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        result = await api.get(`/ai/jobs/${started.id}`);
      }
      if (!result.narrative) throw new Error(result.error ?? 'No new version came back.');
      await api.post(`/memories/${memory.id}/versions`, {
        originalText: latest.originalText,
        readingCopy: result.narrative,
        sourceKind: 'typing',
        mode: 'edit',
        note: 'Rewritten with your answers to follow-up questions',
      });
      invalidate();
      toast('The version you read now includes your answers.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That rewrite did not work.', 'error');
    } finally {
      setRewriting(false);
    }
  };

  const typed = Object.values(answers).some((a) => a.trim());
  const answered = memory.questions.some((q) => q.answer);

  return (
    <Dialog open onClose={onClose} title="Your exact words" width="max-w-4xl">
      <div className="max-h-[75vh] overflow-y-auto pr-1">
        <p className="text-sm text-ink-soft">
          Every telling is kept exactly as you said or typed it. Nothing here is ever corrected.
        </p>
        {tellings.map((telling, i) => (
          <article key={telling.id} className="mt-6 rounded-3xl bg-cream/60 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              {tellings.length > 1 ? `Telling ${i + 1} · ` : ''}
              {MODE_LABELS[telling.mode] ?? 'Telling'} · {formatDate(telling.recordedAt)}
            </p>
            <p className="mt-3 whitespace-pre-wrap font-display text-lg leading-relaxed text-ink">
              {telling.originalText}
            </p>
            {telling.audio && (
              <div className="mt-4">
                <AudioPlayer media={telling.audio} label="As you said it" />
              </div>
            )}
          </article>
        ))}

        {memory.questions.length > 0 && (
          <section className="mt-8" aria-labelledby="followups">
            <h3 id="followups" className="flex items-center gap-2 text-lg font-semibold">
              <MessageCircleQuestion className="size-5 text-lavender-deep" /> Follow-up questions
            </h3>
            <ul className="mt-3 flex flex-col gap-4">
              {memory.questions.map((q) => (
                <li key={q.id} className="rounded-2xl border border-ink/10 p-4">
                  <p className="font-semibold">{q.question}</p>
                  {q.answer ? (
                    <p className="mt-2 whitespace-pre-wrap font-display text-lg text-ink">
                      {q.answer}
                    </p>
                  ) : (
                    <TextArea
                      aria-label={q.question}
                      rows={2}
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((all) => ({ ...all, [q.id]: e.target.value }))}
                      placeholder="Answer whenever you like, or leave it"
                      className="mt-2 text-sm"
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {typed && (
                <Button size="sm" onClick={saveAnswers} disabled={busy}>
                  {busy ? 'Saving…' : 'Keep these answers'}
                </Button>
              )}
              {answered && aiUsable(ai) && (
                <Button
                  size="sm"
                  variant="soft"
                  icon={<Sparkles className="size-4" />}
                  onClick={rewrite}
                  disabled={rewriting || typed}
                >
                  {rewriting ? 'Rewriting… this takes a minute' : 'Work my answers into the story'}
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}
