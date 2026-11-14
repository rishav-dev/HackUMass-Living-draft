import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Bookmark, GitCompare, Link2, Pin, Search, X } from 'lucide-react';
import type { ComparisonDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import {
  useCompare,
  useCompareQuestions,
  useInvalidateArchive,
  useMemories,
} from '../../api/hooks';
import { CertaintyMark, EmotionChip, Portrait, RoleBadge } from '../../components/memory/bits';
import { MarkedText } from '../../components/memory/MemoryText';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { connectionMeta } from '../../lib/meta';
import { useScene, useSound } from '../../lib/sound/SoundProvider';
import { ConnectDialog } from '../map/MemoryMapPage';

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const selected = useMemo(() => (params.get('ids') ?? '').split(',').filter(Boolean), [params]);
  const [query, setQuery] = useState('');
  const [question, setQuestion] = useState('');
  const { data: memories } = useMemories({ q: query || undefined });
  const { data: questions } = useCompareQuestions();
  const compare = useCompare();
  const { play } = useSound();
  useScene('studio');

  const setSelected = (ids: string[]) =>
    setParams(ids.length ? { ids: ids.join(',') } : {}, { replace: true });
  const toggle = (id: string) => {
    play('tap');
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : selected.length >= 6
          ? selected
          : [...selected, id],
    );
  };

  const run = (q = question) => {
    play('shift');
    compare.mutate({ memoryIds: selected, question: q || undefined });
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8">
      <p className="eyebrow">compare and connect</p>
      <h1 className="text-4xl font-semibold sm:text-5xl">Hold two moments side by side</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Pick two to six different memories. Everything I point out is quoted from what you recorded,
        so you can see exactly where it came from.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="paper h-fit rounded-3xl p-4 lg:sticky lg:top-20">
          <label className="relative block">
            <Search
              className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <TextInput
              aria-label="Find memories"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find memories"
              className="pl-10"
            />
          </label>
          <ul className="mt-3 flex max-h-[26rem] flex-col gap-1 overflow-y-auto pr-1">
            {memories?.map((m) => {
              const on = selected.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(m.id)}
                    className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition ${on ? 'bg-lavender/35' : 'hover:bg-ink/4'}`}
                  >
                    <span
                      className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${on ? 'border-lavender-deep bg-lavender-deep text-abyss' : 'border-ink/25'}`}
                    >
                      {on ? selected.indexOf(m.id) + 1 : ''}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{m.title}</span>
                      <span className="text-xs text-ink-soft">{m.temporal.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div>
          <div className="paper rounded-3xl p-5">
            <div className="flex flex-wrap gap-2">
              {selected.length === 0 && <p className="text-ink-soft">Nothing picked yet.</p>}
              {selected.map((id, i) => {
                const m =
                  memories?.find((x) => x.id === id) ??
                  compare.data?.memories.find((x) => x.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-2 rounded-full bg-cream py-1 pl-3 pr-1 text-sm font-semibold"
                  >
                    <span className="text-lavender-deep">{i + 1}</span> {m?.title ?? 'Memory'}
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      aria-label="Remove"
                      className="rounded-full p-1 hover:bg-linen"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {questions?.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={selected.length < 2}
                  onClick={() => {
                    setQuestion(q);
                    run(q);
                  }}
                  className="rounded-full bg-linen/70 px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-linen hover:text-ink disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <TextInput
                aria-label="Your own question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Or ask your own question…"
              />
              <Button
                type="submit"
                icon={<GitCompare className="size-4" />}
                disabled={selected.length < 2 || compare.isPending}
                sound={false}
              >
                Compare
              </Button>
            </form>
          </div>

          {compare.data && <Results data={compare.data} question={question} />}
        </div>
      </div>
    </div>
  );
}

function highlight(quote: string, term: string) {
  const at = quote.toLowerCase().indexOf(term.toLowerCase().slice(0, Math.max(3, term.length - 2)));
  if (at < 0) return [];
  const end = quote.slice(at).search(/[^A-Za-z']/);
  return [{ start: at, end: end < 0 ? quote.length : at + end }];
}

function Results({ data, question }: { data: ComparisonDto; question: string }) {
  const [connecting, setConnecting] = useState(false);
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const { play } = useSound();
  const many = data.memories.length > 2;
  const emotionsFor = (id: string) => data.emotions.find((e) => e.memoryId === id);
  const onlyFor = (id: string) => data.onlyIn.find((o) => o.memoryId === id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 flex flex-col gap-6"
    >
      <section className="paper rounded-3xl p-6">
        <p className="eyebrow">{question || 'what stands out'}</p>
        <ul className="mt-2 space-y-2 text-[1.05rem]">
          {data.summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Bookmark className="size-4" />}
            onClick={async () => {
              await api.post('/analyses', {
                kind: 'compare',
                question: question || 'Comparison',
                scope: { memoryIds: data.memories.map((m) => m.id) },
                result: data,
              });
              toast('Saved to your notes.');
            }}
          >
            Save this
          </Button>
          <Button
            size="sm"
            variant="soft"
            icon={<Link2 className="size-4" />}
            onClick={() => setConnecting(true)}
          >
            Connect them myself
          </Button>
        </div>
      </section>

      {many ? (
        <div className="paper overflow-x-auto rounded-3xl p-2">
          <table className="w-full min-w-[40rem] border-separate border-spacing-2 text-sm">
            <thead>
              <tr>
                <th className="w-28" />
                {data.memories.map((m) => (
                  <th key={m.id} className="text-left align-bottom">
                    <Link
                      to={`/memories/${m.id}`}
                      viewTransition
                      className="ink-link font-display text-base font-semibold"
                    >
                      {m.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  'When',
                  (id: string) => (
                    <CertaintyMark
                      temporal={data.memories.find((m) => m.id === id)!.temporal}
                      compact
                    />
                  ),
                ],
                [
                  'People',
                  (id: string) =>
                    data.memories
                      .find((m) => m.id === id)!
                      .people.map((p) => p.name)
                      .join(', ') || '—',
                ],
                [
                  'Felt then',
                  (id: string) => (
                    <div className="flex flex-wrap gap-1">
                      {emotionsFor(id)?.then.map((t) => (
                        <EmotionChip key={t} tag={t} size="sm" />
                      )) ?? '—'}
                    </div>
                  ),
                ],
                [
                  'Feels now',
                  (id: string) => (
                    <div className="flex flex-wrap gap-1">
                      {emotionsFor(id)?.now.map((t) => (
                        <EmotionChip key={t} tag={t} size="sm" />
                      ))}
                    </div>
                  ),
                ],
                ['Only here', (id: string) => onlyFor(id)?.terms.join(', ') || '—'],
              ].map(([label, cell]) => (
                <tr key={label as string}>
                  <th
                    scope="row"
                    className="rounded-xl bg-cream px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink-soft"
                  >
                    {label as string}
                  </th>
                  {data.memories.map((m) => (
                    <td key={m.id} className="rounded-xl bg-paper px-3 py-2 align-top">
                      {(cell as (id: string) => React.ReactNode)(m.id)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.memories.map((m, i) => (
            <motion.article
              key={m.id}
              initial={{ opacity: 0, rotate: i ? 1.5 : -1.5, y: 10 }}
              animate={{ opacity: 1, rotate: i ? 0.6 : -0.6, y: 0 }}
              className="paper rounded-3xl p-5"
            >
              <CertaintyMark temporal={m.temporal} compact />
              <Link
                to={`/memories/${m.id}`}
                viewTransition
                className="ink-link mt-2 block font-display text-2xl font-semibold"
              >
                {m.title}
              </Link>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {emotionsFor(m.id)?.then.map((t) => (
                  <EmotionChip key={t} tag={t} size="sm" />
                ))}
                {emotionsFor(m.id)?.now.map((t) => (
                  <EmotionChip key={`now-${t}`} tag={t} phase="now" size="sm" />
                ))}
              </div>
              {onlyFor(m.id) &&
                (onlyFor(m.id)!.terms.length > 0 || onlyFor(m.id)!.people.length > 0) && (
                  <p className="mt-3 text-sm text-ink-soft">
                    Only here: {[...onlyFor(m.id)!.people, ...onlyFor(m.id)!.terms].join(', ')}
                  </p>
                )}
            </motion.article>
          ))}
        </div>
      )}

      {data.sharedPeople.length > 0 && (
        <section className="paper rounded-3xl p-6">
          <h2 className="mb-3 text-lg font-semibold">The same people, in different roles</h2>
          <ul className="flex flex-col gap-3">
            {data.sharedPeople.map((p) => (
              <li key={p.characterId} className="flex flex-wrap items-center gap-3">
                <Portrait name={p.name} size={32} />
                <span className="font-semibold">{p.name}</span>
                {data.memories.map((m, i) => {
                  const role = p.roles.find((r) => r.memoryId === m.id)?.role;
                  return (
                    <span key={m.id} className="inline-flex items-center gap-1.5 text-sm">
                      <span className="text-ink-faint">{i + 1}</span>
                      {role ? (
                        <RoleBadge role={role as 'central'} />
                      ) : (
                        <span className="text-xs text-ink-faint">not there</span>
                      )}
                    </span>
                  );
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.sharedTerms.length > 0 && (
        <section className="paper rounded-3xl p-6">
          <h2 className="mb-3 text-lg font-semibold">Where they overlap</h2>
          <div className="flex flex-col gap-4">
            {data.sharedTerms.map((t) => (
              <div key={t.term}>
                <p className="mb-1.5 inline-block rounded-full bg-gold/35 px-3 py-0.5 text-sm font-bold">
                  {t.term}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {t.quotes.map((q) => (
                    <blockquote
                      key={q.memoryId}
                      className="rounded-2xl bg-cream/60 p-3 text-sm italic"
                    >
                      <span className="mr-1 font-bold not-italic text-lavender-deep">
                        {data.memories.findIndex((m) => m.id === q.memoryId) + 1}
                      </span>
                      <MarkedText text={q.quote} marks={highlight(q.quote, t.term)} />
                    </blockquote>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.suggestions.length > 0 && (
        <section aria-labelledby="links">
          <h2 id="links" className="mb-3 text-lg font-semibold">
            Possible links
          </h2>
          <div className="flex flex-col gap-3">
            {data.suggestions.map((s) => {
              const meta = connectionMeta(s.type);
              return (
                <div
                  key={`${s.type}-${s.memoryIds.join()}`}
                  className="paper rounded-3xl border-l-[6px] p-5"
                  style={{ borderLeftColor: meta.color }}
                >
                  <p className="text-sm font-bold" style={{ color: meta.color }}>
                    {meta.glyph} {s.label}
                  </p>
                  <p className="mt-1">{s.explanation}</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    icon={<Pin className="size-4" />}
                    sound={false}
                    onClick={async () => {
                      await api.post('/connections', {
                        type: s.type,
                        memoryIds: s.memoryIds,
                        explanation: s.explanation,
                        evidence: s.evidence,
                        status: 'confirmed',
                      });
                      play('pluck');
                      invalidate();
                      toast('Pinned to your Memory Map.');
                    }}
                  >
                    Pin to the map
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {connecting && (
        <ConnectDialog
          memoryIds={data.memories.map((m) => m.id)}
          onClose={() => setConnecting(false)}
        />
      )}
    </motion.div>
  );
}
