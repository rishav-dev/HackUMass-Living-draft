import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Columns2, RotateCcw, TextQuote } from 'lucide-react';
import type { DetailChangeDto, MemoryDetailDto, ReviewItemDto } from '@living-draft/contracts';
import { CHANGE_LABELS } from '@living-draft/engine';
import { api } from '../../api/client';
import { useInvalidateArchive, useMemory, useVersionComparison } from '../../api/hooks';
import { AudioPlayer } from '../../components/media/AudioPlayer';
import { MarkedText, type TextMark } from '../../components/memory/MemoryText';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Segmented } from '../../components/ui/controls';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { formatDateTime } from '../../lib/format';
import { MODE_LABELS, SOURCE_META } from '../../lib/meta';
import { useScene, useSound } from '../../lib/sound/SoundProvider';

const KIND_STYLE: Record<string, string> = {
  consistent: 'bg-transparent',
  new: 'bg-sage/40 underline decoration-dashed decoration-sage-deep decoration-2 underline-offset-4',
  omitted:
    'bg-mist/30 underline decoration-dotted decoration-mist-deep decoration-2 underline-offset-4',
  changed:
    'bg-gold/35 underline decoration-solid decoration-gold-deep decoration-2 underline-offset-4',
  contradictory:
    'bg-rose/50 underline decoration-wavy decoration-rose-deep decoration-2 underline-offset-4',
  uncertain:
    'bg-lavender/45 underline decoration-dotted decoration-lavender-deep decoration-[3px] underline-offset-4',
  corrected:
    'bg-peach/55 underline decoration-double decoration-peach-deep decoration-2 underline-offset-4',
  reflected:
    'bg-mist/45 underline decoration-solid decoration-mist-deep decoration-1 underline-offset-4',
};

const LEGEND = [
  'new',
  'changed',
  'contradictory',
  'uncertain',
  'corrected',
  'reflected',
  'omitted',
];

export default function EvolutionPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useMemory(id);
  if (isLoading) return <PaperLoading label="Laying the tellings side by side…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;
  return <EvolutionView memory={data} />;
}

function EvolutionView({ memory }: { memory: MemoryDetailDto }) {
  const versions = memory.versions;
  const [a, setA] = useState<string | null>(
    versions.length > 1 ? versions[versions.length - 2]!.id : null,
  );
  const [b, setB] = useState<string | null>(versions[versions.length - 1]?.id ?? null);
  const [view, setView] = useState<'side' | 'diff'>('side');
  const [reviewing, setReviewing] = useState<ReviewItemDto | null>(null);
  const { data: comparison } = useVersionComparison(memory.id, a, b);
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const { play } = useSound();
  useScene('studio');

  useEffect(() => {
    if (memory.pendingReview[0] && !reviewing) {
      const timer = window.setTimeout(() => setReviewing(memory.pendingReview[0]!), 700);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (versionId: string) => {
    play('tap');
    if (versionId === a || versionId === b) return;
    const seq = (id: string | null) => versions.find((v) => v.id === id)?.seq ?? 0;
    const clicked = versions.find((v) => v.id === versionId)!.seq;
    if (clicked < seq(b)) setA(versionId);
    else setB(versionId);
  };

  const restore = async (versionId: string) => {
    await api.post(`/memories/${memory.id}/versions/${versionId}/restore`);
    invalidate();
    toast('Restored. The version you replaced is still in the history.');
  };

  const earlierMarks: TextMark[] = (comparison?.changes ?? [])
    .filter((c) => c.earlier && c.kind !== 'consistent')
    .map((c) => ({
      start: c.earlier!.start,
      end: c.earlier!.end,
      className: `rounded px-0.5 ${KIND_STYLE[c.kind]}`,
      label: c.label,
    }));
  const laterMarks: TextMark[] = (comparison?.changes ?? [])
    .filter((c) => c.later && c.kind !== 'consistent')
    .map((c) => ({
      start: c.later!.start,
      end: c.later!.end,
      className: `rounded px-0.5 ${KIND_STYLE[c.kind]}`,
      label: c.label,
    }));
  const versionA = versions.find((v) => v.id === a);
  const versionB = versions.find((v) => v.id === b);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8">
      <Link
        to={`/memories/${memory.id}`}
        viewTransition
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" /> {memory.title}
      </Link>
      <p className="mt-6 eyebrow">memory evolution</p>
      <h1 className="text-4xl font-semibold sm:text-5xl">How “{memory.title}” has changed</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Each time you tell it, the telling is kept exactly as it was. Nothing is overwritten.
        Differences aren't mistakes, they're just differences, and you decide what they mean.
      </p>

      {memory.pendingReview.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {memory.pendingReview.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setReviewing(item)}
              className="flex items-center gap-3 rounded-3xl bg-peach/45 p-4 text-left transition hover:bg-peach/60"
            >
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${KIND_STYLE[item.kind]}`}
              >
                {item.label}
              </span>
              <span className="min-w-0 flex-1 truncate">
                “{item.later?.text ?? item.earlier?.text}”
              </span>
              <span className="text-sm font-bold text-peach-deep">Decide</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <ol
          className="relative flex flex-col gap-3 before:absolute before:bottom-4 before:left-[1.05rem] before:top-4 before:w-0.5 before:bg-ink/10"
          aria-label="Tellings"
        >
          {versions.map((v) => {
            const Icon = SOURCE_META[v.sourceKind]?.icon ?? TextQuote;
            const role = v.id === a ? 'A' : v.id === b ? 'B' : null;
            return (
              <li key={v.id} className="relative pl-11">
                <span
                  className={`absolute left-0 top-3 flex size-9 items-center justify-center rounded-full border-2 font-bold ${role ? 'border-ink bg-ink text-abyss' : 'border-ink/15 bg-paper text-ink-soft'}`}
                >
                  {role ?? <Icon className="size-4" />}
                </span>
                <button
                  type="button"
                  onClick={() => select(v.id)}
                  className={`paper w-full rounded-2xl p-3 text-left transition hover:-translate-y-0.5 ${role ? 'ring-2 ring-ink' : ''}`}
                >
                  <span className="block text-xs font-bold uppercase tracking-wider text-ink-soft">
                    {MODE_LABELS[v.mode] ?? v.mode}
                    {v.id === memory.currentVersionId && (
                      <span className="ml-2 rounded-full bg-sage/45 px-2 py-0.5 text-sage-deep">
                        current
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold">
                    {formatDateTime(v.recordedAt)}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">
                    {v.originalText}
                  </span>
                </button>
                {v.audio && (
                  <div className="mt-2">
                    <AudioPlayer media={v.audio} label="This telling" />
                  </div>
                )}
                {v.id !== memory.currentVersionId && (
                  <button
                    type="button"
                    onClick={() => void restore(v.id)}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink"
                  >
                    <RotateCcw className="size-3" /> Make this the current version
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        <div>
          {versions.length < 2 ? (
            <div className="paper rounded-3xl p-8 text-center text-ink-soft">
              This memory has only been told once. When you tell it again, the tellings will line up
              here.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented
                  label="View"
                  value={view}
                  onChange={setView}
                  options={[
                    {
                      value: 'side',
                      label: (
                        <span className="inline-flex items-center gap-1.5">
                          <Columns2 className="size-4" /> Side by side
                        </span>
                      ),
                    },
                    { value: 'diff', label: 'Word by word' },
                  ]}
                />
                <ul className="flex flex-wrap gap-1.5 text-xs font-bold" aria-label="Legend">
                  {LEGEND.map((kind) => (
                    <li key={kind} className={`rounded-full px-2 py-0.5 ${KIND_STYLE[kind]}`}>
                      {CHANGE_LABELS[kind as keyof typeof CHANGE_LABELS]}
                    </li>
                  ))}
                </ul>
              </div>

              {comparison && view === 'side' && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    {
                      label: 'A',
                      version: versionA,
                      text: comparison.earlierText,
                      marks: earlierMarks,
                    },
                    {
                      label: 'B',
                      version: versionB,
                      text: comparison.laterText,
                      marks: laterMarks,
                    },
                  ].map((col) => (
                    <motion.div
                      key={col.label + (col.version?.id ?? '')}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="paper rounded-3xl p-6"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                        {col.label} ·{' '}
                        {col.version
                          ? `${MODE_LABELS[col.version.mode] ?? ''}, ${formatDateTime(col.version.recordedAt)}`
                          : ''}
                      </p>
                      {col.label === 'B' && versionB?.mode === 'addition' && (
                        <p className="mt-1 text-xs text-ink-soft">Just what was added this time</p>
                      )}
                      <p className="mt-3 whitespace-pre-wrap font-display text-lg leading-relaxed">
                        <MarkedText text={col.text} marks={col.marks} />
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}

              {comparison && view === 'diff' && (
                <div className="paper mt-5 rounded-3xl p-6 font-display text-lg leading-relaxed">
                  {comparison.diff.map((segment, i) =>
                    segment.type === 'same' ? (
                      <span key={i}>{segment.text}</span>
                    ) : segment.type === 'added' ? (
                      <ins
                        key={i}
                        className="rounded bg-sage/40 underline decoration-sage-deep decoration-2"
                        title="Added in B"
                      >
                        {segment.text}
                      </ins>
                    ) : (
                      <del
                        key={i}
                        className="text-ink-faint decoration-rose-deep decoration-2"
                        title="Not in B"
                      >
                        {segment.text}
                      </del>
                    ),
                  )}
                </div>
              )}

              {comparison && (
                <section className="mt-6" aria-labelledby="changes-title">
                  <h2 id="changes-title" className="mb-3 text-xl font-semibold">
                    What shifted
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {comparison.changes
                      .filter((c) => c.kind !== 'consistent')
                      .map((change, i) => (
                        <ChangeRow key={i} change={change} />
                      ))}
                    {comparison.changes.every((c) => c.kind === 'consistent') && (
                      <li className="text-ink-soft">These two tellings say the same things.</li>
                    )}
                  </ul>
                  <p className="mt-3 text-xs text-ink-soft">
                    {comparison.counts.consistent ?? 0}{' '}
                    {comparison.counts.consistent === 1 ? 'detail stayed' : 'details stayed'} the
                    same. Similarity {Math.round(comparison.similarity * 100)}%.
                  </p>
                </section>
              )}
            </>
          )}

          {memory.resolutions.length > 0 && (
            <section className="mt-10" aria-labelledby="decisions">
              <h2 id="decisions" className="mb-3 text-xl font-semibold">
                What you decided
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                {memory.resolutions.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-2 rounded-2xl bg-cream/70 p-3">
                    <Check className="size-4 text-sage-deep" />
                    <span className="font-bold">
                      {RESOLUTION_LABELS[r.resolution] ?? r.resolution}
                    </span>
                    <span className="text-ink-soft">“{r.laterText ?? r.earlierText}”</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {reviewing && (
        <ReviewDialog memory={memory} item={reviewing} onClose={() => setReviewing(null)} />
      )}
    </div>
  );
}

function ChangeRow({ change }: { change: DetailChangeDto }) {
  return (
    <li className="paper rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${KIND_STYLE[change.kind]}`}>
          {change.label}
        </span>
        <span className="text-sm text-ink-soft">{change.note}</span>
      </div>
      <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
        {change.earlier && <p className="italic text-ink-soft">A: “{change.earlier.text}”</p>}
        {change.later && <p className="italic">B: “{change.later.text}”</p>}
      </div>
    </li>
  );
}

function trimEnd(text: string | undefined) {
  return (text ?? '…').replace(/[.!?,;]+$/, '');
}

const RESOLUTION_LABELS: Record<string, string> = {
  keep_both: 'Kept both',
  prefer_later: 'The newer telling is right',
  prefer_earlier: 'The earlier telling is right',
  mark_uncertain: 'Marked as uncertain',
  separate: 'Split into a separate memory',
  dismissed: 'Dismissed',
};

function ReviewDialog({
  memory,
  item,
  onClose,
}: {
  memory: MemoryDetailDto;
  item: ReviewItemDto;
  onClose: () => void;
}) {
  const invalidate = useInvalidateArchive();
  const navigate = useNavigate();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const earlier = memory.versions.find((v) => v.id === item.earlierVersionId);
  const later = memory.versions.find((v) => v.id === item.laterVersionId);

  const resolve = async (resolution: keyof typeof RESOLUTION_LABELS) => {
    setSaving(true);
    try {
      const result = await api.post<{ splitMemoryId: string | null }>(
        `/memories/${memory.id}/resolutions`,
        {
          reviewItemId: item.id,
          earlierVersionId: item.earlierVersionId,
          laterVersionId: item.laterVersionId,
          changeKind: item.kind,
          earlierText: item.earlier?.text ?? null,
          laterText: item.later?.text ?? null,
          resolution,
        },
      );
      invalidate();
      toast(RESOLUTION_LABELS[resolution]);
      onClose();
      if (result.splitMemoryId)
        void navigate(`/memories/${result.splitMemoryId}`, { viewTransition: true });
    } finally {
      setSaving(false);
    }
  };

  const options: Array<[keyof typeof RESOLUTION_LABELS, string]> = [
    ['keep_both', 'Keep both as they are'],
    ['prefer_later', 'The newer one is right'],
    ['prefer_earlier', 'The earlier one is right'],
    ['mark_uncertain', 'Mark this detail as uncertain'],
    ['separate', 'These are separate memories'],
    ['dismissed', 'Dismiss'],
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.kind === 'uncertain' ? 'You sound less sure now' : 'These details seem different'}
      width="max-w-2xl"
    >
      <p className="text-lg">
        Earlier you remembered{' '}
        <span className="font-semibold">“{trimEnd(item.earlier?.text)}”</span>; now you remember{' '}
        <span className="font-semibold">“{trimEnd(item.later?.text)}”</span>. These details seem
        different. How would you like to preserve them?
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <blockquote className="rounded-2xl bg-cream p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {earlier ? formatDateTime(earlier.recordedAt) : 'Earlier'}
          </p>
          <p className="mt-1 font-display text-lg italic">“{item.earlier?.text}”</p>
        </blockquote>
        <blockquote className="rounded-2xl bg-lavender/30 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            {later ? formatDateTime(later.recordedAt) : 'Now'}
          </p>
          <p className="mt-1 font-display text-lg italic">“{item.later?.text}”</p>
        </blockquote>
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        {item.note} Memories shift for all kinds of reasons. Neither one is being called wrong.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {options.map(([value, label], i) => (
          <Button
            key={value}
            variant={i === 0 ? 'primary' : value === 'dismissed' ? 'ghost' : 'secondary'}
            disabled={saving}
            onClick={() => void resolve(value)}
            autoFocus={i === 0}
          >
            {label}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
