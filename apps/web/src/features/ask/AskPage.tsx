import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowUp, Bookmark, Info, Trash2 } from 'lucide-react';
import type { AnswerDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import {
  useAnalyses,
  useAsk,
  useCharacters,
  useCuratedQuestions,
  useProfile,
} from '../../api/hooks';
import { Core } from '../../components/core/Core';
import { Button } from '../../components/ui/Button';
import { Select, TextInput, Toggle } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/format';
import { BASE_EMOTION_TAGS, emotionMeta, hashNumber } from '../../lib/meta';
import { useScene, useSound } from '../../lib/sound/SoundProvider';
import { useQueryClient } from '@tanstack/react-query';

interface Scope {
  characterId: string;
  emotion: string;
  ageMin: string;
  ageMax: string;
  centralOnly: boolean;
  includeDifficult: boolean;
}

export default function AskPage() {
  const [params] = useSearchParams();
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const [asked, setAsked] = useState<string | null>(() => params.get('q'));
  const started = useRef(false);
  const [scope, setScope] = useState<Scope>({
    characterId: params.get('person') ?? '',
    emotion: '',
    ageMin: '',
    ageMax: '',
    centralOnly: false,
    includeDifficult: false,
  });
  const { data: curated } = useCuratedQuestions();
  const { data: people } = useCharacters();
  const { data: profile } = useProfile();
  const ask = useAsk();
  const { play } = useSound();
  const answerRef = useRef<HTMLElement>(null);
  useScene('night');

  const run = (q: string) =>
    ask.mutate(
      {
        question: q.trim(),
        scope: {
          characterId: scope.characterId || undefined,
          emotion: scope.emotion || undefined,
          ageMin: scope.ageMin ? Number(scope.ageMin) : undefined,
          ageMax: scope.ageMax ? Number(scope.ageMax) : undefined,
          centralOnly: scope.centralOnly || undefined,
          includeDifficult: scope.includeDifficult || undefined,
        },
      },
      {
        onSuccess: () => {
          play('chime');
          window.setTimeout(() => answerRef.current?.focus(), 300);
        },
      },
    );

  const submit = (q = question) => {
    if (!q.trim()) return;
    play('shift');
    setAsked(q.trim());
    run(q.trim());
  };

  useEffect(() => {
    const initial = params.get('q');
    if (initial && !started.current) {
      started.current = true;
      run(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] bg-[linear-gradient(180deg,#2a2540_0%,#3a3152_340px,var(--color-ivory)_760px)]">
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-12 sm:px-8">
        <div className="flex items-end gap-4 text-snow">
          <Core state={ask.isPending ? 'organizing' : 'ready'} size={96} />
          <div>
            <p className="eyebrow">ask my story</p>
            <h1 className="text-4xl font-semibold sm:text-5xl">
              What would you like to look back on?
            </h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-snow/75">
          Answers come only from what you've recorded, with every line pointing back to the memory
          it came from. If there isn't enough to go on, I'll say so instead of guessing.
        </p>

        <form
          className="relative mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <TextInput
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="How has my relationship with Mom changed?"
            className="h-16 rounded-3xl pl-6 pr-16 font-display text-xl shadow-lift"
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={!question.trim() || ask.isPending}
            className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full btn-aurora disabled:opacity-40"
          >
            <ArrowUp className="size-5" />
          </button>
        </form>

        <details className="paper mt-4 rounded-3xl px-5 py-3">
          <summary className="cursor-pointer text-sm font-bold text-ink-soft">
            Narrow it down
          </summary>
          <div className="mt-4 grid gap-4 pb-2 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Person
              <Select
                value={scope.characterId}
                onChange={(e) => setScope({ ...scope, characterId: e.target.value })}
                className="mt-1.5"
              >
                <option value="">Anyone</option>
                {people?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-bold">
              Feeling
              <Select
                value={scope.emotion}
                onChange={(e) => setScope({ ...scope, emotion: e.target.value })}
                className="mt-1.5"
              >
                <option value="">Any feeling</option>
                {BASE_EMOTION_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {emotionMeta(t).label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex items-end gap-2 text-sm font-bold">
              <label className="flex-1">
                From age
                <TextInput
                  inputMode="numeric"
                  value={scope.ageMin}
                  onChange={(e) =>
                    setScope({ ...scope, ageMin: e.target.value.replace(/\D/g, '') })
                  }
                  className="mt-1.5"
                  placeholder="0"
                />
              </label>
              <label className="flex-1">
                to
                <TextInput
                  inputMode="numeric"
                  value={scope.ageMax}
                  onChange={(e) =>
                    setScope({ ...scope, ageMax: e.target.value.replace(/\D/g, '') })
                  }
                  className="mt-1.5"
                  placeholder={String(profile?.currentAge ?? '')}
                />
              </label>
            </div>
            <div>
              <Toggle
                checked={scope.centralOnly}
                onChange={(v) => setScope({ ...scope, centralOnly: v })}
                label="Only where they're central"
              />
              <Toggle
                checked={scope.includeDifficult}
                onChange={(v) => setScope({ ...scope, includeDifficult: v })}
                label="Include memories I've kept quiet"
              />
            </div>
          </div>
        </details>

        {!asked && curated && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {curated.map((q, i) => (
              <motion.li
                key={q}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(q);
                    submit(q);
                  }}
                  className="paper relative h-full w-full rounded-2xl border-t-4 border-t-mist p-4 pt-5 text-left font-display text-lg transition hover:-translate-y-1 hover:shadow-lift"
                  style={{ rotate: `${(hashNumber(q) - 0.5) * 3}deg` }}
                >
                  <span className="absolute right-3 top-2 text-xs font-bold text-ink-faint">
                    № {i + 1}
                  </span>
                  {q}
                </button>
              </motion.li>
            ))}
          </ul>
        )}

        {ask.isPending && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-10 text-center eyebrow"
            role="status"
          >
            Looking through your pages…
          </motion.p>
        )}
        {ask.data && asked && !ask.isPending && (
          <motion.section
            key={asked}
            ref={answerRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
            aria-label="Answer"
          >
            <Answer question={asked} answer={ask.data} scope={scope} />
          </motion.section>
        )}

        <SavedAnswers />
      </div>
    </div>
  );
}

function Answer({
  question,
  answer,
  scope,
}: {
  question: string;
  answer: AnswerDto;
  scope: Scope;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const indexFor = (memoryId: string) =>
    answer.citations.findIndex((c) => c.memoryId === memoryId) + 1;

  return (
    <div>
      <article className="paper relative rounded-[2rem] p-7 sm:p-10">
        <span className="washi -top-3 left-10" aria-hidden="true" />
        <p className="eyebrow">{question}</p>
        <div className="mt-4 space-y-4 font-display text-[1.2rem] leading-relaxed">
          {answer.lines.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.35, duration: 0.8 }}
            >
              {line.text}
              {line.memoryIds
                .map(indexFor)
                .filter((n) => n > 0)
                .map((n) => (
                  <a
                    key={n}
                    href={`#cite-${n}`}
                    className="ml-0.5 align-super font-sans text-xs font-bold text-lavender-deep hover:underline"
                  >
                    [{n}]
                  </a>
                ))}
            </motion.p>
          ))}
        </div>
        <p className="mt-6 text-xs text-ink-soft">
          Based on {answer.consideredCount} {answer.consideredCount === 1 ? 'memory' : 'memories'}{' '}
          in scope · {answer.citations.length} cited
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Bookmark className="size-4" />}
            onClick={async () => {
              await api.post('/analyses', { kind: 'ask', question, scope, result: answer });
              void client.invalidateQueries({ queryKey: ['analyses'] });
              toast('Saved. You can find it below.');
            }}
          >
            Keep this answer
          </Button>
        </div>
      </article>

      {answer.limitations.length > 0 && (
        <aside className="mt-4 flex gap-3 rounded-3xl border-2 border-dashed border-ink/15 p-5 text-sm text-ink-soft">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold text-ink">What this can't tell you</p>
            <ul className="mt-1 space-y-1">
              {answer.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </aside>
      )}

      {answer.citations.length > 0 && (
        <section className="mt-8" aria-labelledby="sources">
          <h2 id="sources" className="mb-3 text-xl font-semibold">
            Where that comes from
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {answer.citations.map((c, i) => (
              <li key={`${c.memoryId}-${i}`} id={`cite-${i + 1}`}>
                <Link
                  to={`/memories/${c.memoryId}`}
                  viewTransition
                  className="paper block h-full rounded-2xl p-4 transition hover:-translate-y-0.5"
                >
                  <span className="text-xs font-bold text-lavender-deep">
                    [{i + 1}] {c.ageLabel}
                  </span>
                  <span className="mt-0.5 block font-display text-lg font-semibold">{c.title}</span>
                  <span className="mt-1 block text-sm italic text-ink-soft">“{c.quote}”</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function SavedAnswers() {
  const { data } = useAnalyses();
  const client = useQueryClient();
  if (!data?.length) return null;
  return (
    <section className="mt-14" aria-labelledby="saved">
      <h2 id="saved" className="mb-3 text-xl font-semibold">
        Kept answers
      </h2>
      <ul className="flex flex-col gap-2">
        {data.map((a) => (
          <li key={a.id} className="paper flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="rounded-full bg-linen px-2 py-0.5 text-xs font-bold text-ink-soft">
              {a.kind === 'ask' ? 'Answer' : 'Comparison'}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">{a.question}</span>
            <span className="text-xs text-ink-faint">{formatDate(a.createdAt)}</span>
            <button
              type="button"
              aria-label="Delete saved answer"
              onClick={async () => {
                await api.delete(`/analyses/${a.id}`);
                void client.invalidateQueries({ queryKey: ['analyses'] });
              }}
              className="rounded-full p-1.5 text-ink-faint hover:text-rose-deep"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
