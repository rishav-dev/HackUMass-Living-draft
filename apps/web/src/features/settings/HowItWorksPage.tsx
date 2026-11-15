import { motion } from 'motion/react';
import { ArrowDown, Check, Database, Globe, Mic, Server, X } from 'lucide-react';
import { useEvaluation } from '../../api/hooks';
import { PaperLoading } from '../../components/ui/states';
import { useScene } from '../../lib/sound/SoundProvider';

const STAGES = [
  [
    'Capture',
    'Your voice is recorded in the browser and, where the browser allows, transcribed live. Typing works everywhere. The original words are stored untouched.',
  ],
  [
    'Reading copy',
    'Fillers like “um” and stutters are removed, capitals and full stops added. Nothing else changes, and every change shows up in a word-level diff.',
  ],
  [
    'Details',
    'Rules pull out ages, grades, seasons, months, dates, “before my brother was born” style anchors, people and their roles, and feelings named in the text, each with the exact phrase it came from.',
  ],
  [
    'Placement',
    'Clues are combined into an age range. Grades are treated as hints, conflicts are reported, and nothing gets a precise date unless you gave one.',
  ],
  [
    'Matching',
    'A new account is scored against existing memories on shared words, people, ages and season. It suggests “same memory?” but never merges on its own.',
  ],
  [
    'Evolution',
    'When you retell a memory, the tellings are aligned clause by clause and each difference is labelled: new, left out, changed, contradictory, less certain, corrected or seen differently.',
  ],
  [
    'Connections',
    'Pairs of memories are checked for five patterns (full circle, repeating pattern, breaking a pattern, wish fulfilled, relationship change), each with a quote from both sides.',
  ],
  [
    'Answers',
    'Questions are routed to the right kind of answer, built only from retrieved memories, with every line citing its sources and a note on what’s missing.',
  ],
  ['You decide', 'Every suggestion waits for you. Accept, edit, dismiss or leave it for later.'],
];

export default function HowItWorksPage() {
  const { data, isLoading } = useEvaluation();
  useScene('quiet');
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:px-8">
      <p className="eyebrow">under the cover</p>
      <h1 className="text-4xl font-semibold sm:text-5xl">How it works</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        The Living Draft runs entirely on your computer and costs nothing to run. The language work
        is done by small, testable rules rather than a large model, so every suggestion can point to
        the words it came from.
      </p>

      <section className="mt-10" aria-labelledby="architecture">
        <h2 id="architecture" className="mb-4 text-2xl font-semibold">
          The pieces
        </h2>
        <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.3fr_auto_1fr]">
          <Box
            icon={<Globe className="size-5" />}
            title="Browser"
            lines={[
              'React app',
              'Microphone + MediaRecorder',
              'Speech recognition (browser)',
              'Web Audio soundscape',
            ]}
          />
          <Arrow />
          <Box
            icon={<Server className="size-5" />}
            title="Local server"
            lines={[
              'Express API with zod contracts',
              'Text engine (TypeScript)',
              'Placement · people · feelings',
              'Matching · evolution · answers',
            ]}
            highlight
          />
          <Arrow />
          <Box
            icon={<Database className="size-5" />}
            title="On disk"
            lines={[
              'SQLite database',
              'Every version, append-only',
              'Photos, video, recordings',
              'Export as .zip, delete for real',
            ]}
          />
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
          <Mic className="size-4" /> The only thing that can leave the computer is live
          speech-to-text in Chrome or Edge. Typing never does.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="stages">
        <h2 id="stages" className="mb-4 text-2xl font-semibold">
          What happens to a memory
        </h2>
        <ol className="flex flex-col gap-2">
          {STAGES.map(([title, body], i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="paper flex gap-4 rounded-2xl p-4"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-abyss">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-ink-soft">{body}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="eval">
        <h2 id="eval" className="text-2xl font-semibold">
          How well it does, honestly
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Measured live against a small, hand-labelled, fictional test set. It's small, so read it
          as a sanity check, not a benchmark. Misses are listed, not hidden.
        </p>
        {isLoading || !data ? (
          <PaperLoading rows={1} />
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Stat
              label="Same-memory suggestions"
              value={`${data.matching.correctSame}/${data.matching.predictedSame}`}
              detail={`correct when it said “same memory” (${pct(data.matching.precision)}). It found ${data.matching.correctSame} of ${data.matching.expectedSame} real matches (${pct(data.matching.recall)}), and kept ${data.matching.separateKeptSeparate} of ${data.matching.expectedSeparate} separate events apart.`}
            />
            <Stat
              label="Version changes"
              value={`${data.changes.correct}/${data.changes.total}`}
              detail={`pairs given the expected label (${pct(data.changes.accuracy)}).`}
            />
            <Stat
              label="Placement"
              value={`${data.temporal.correct}/${data.temporal.total}`}
              detail={`accounts placed at the expected ages (${pct(data.temporal.accuracy)}).`}
            />
          </div>
        )}
        {data && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="paper rounded-3xl p-5">
              <h3 className="mb-2 font-semibold">Where matching missed</h3>
              <p className="mb-3 text-xs text-ink-soft">
                It leans toward keeping things separate. It would rather miss a match than merge two
                different summers.
              </p>
              <ul className="space-y-1.5 text-sm">
                {data.matching.misses.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span>{m.label}</span>
                    <span className="text-xs text-ink-soft">
                      expected {m.expected ?? 'separate'}, got {m.got ?? 'separate'}
                    </span>
                  </li>
                ))}
                {!data.matching.misses.length && <li>No misses on this set.</li>}
              </ul>
            </div>
            <div className="paper rounded-3xl p-5">
              <h3 className="mb-3 font-semibold">Version change cases</h3>
              <ul className="space-y-1.5 text-sm">
                {data.changes.rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    {r.ok ? (
                      <Check className="size-4 text-sage-deep" aria-label="correct" />
                    ) : (
                      <X className="size-4 text-rose-deep" aria-label="wrong" />
                    )}
                    <span className="flex-1">{r.label}</span>
                    <span className="text-xs text-ink-soft">
                      {r.ok ? r.got : `${r.expected} → ${r.got}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Box({
  icon,
  title,
  lines,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-3xl p-5 ${highlight ? 'bg-ink text-abyss shadow-lift' : 'paper'}`}>
      <p className="flex items-center gap-2 font-display text-xl font-semibold">
        {icon}
        {title}
      </p>
      <ul className={`mt-2 space-y-1 text-sm ${highlight ? 'text-snow/80' : 'text-ink-soft'}`}>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-ink-faint" aria-hidden="true">
      <ArrowDown className="size-6 md:-rotate-90" />
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="paper rounded-3xl p-5">
      <p className="text-sm font-bold text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-4xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-ink-soft">{detail}</p>
    </div>
  );
}
