import { useState } from 'react';
import { motion } from 'motion/react';
import { Feather, Mail } from 'lucide-react';
import type { CaptureAnalysisDto } from '@living-draft/contracts';
import { useMemories } from '../../api/hooks';
import { Button } from '../../components/ui/Button';
import { Field, Segmented, TextArea, TextInput } from '../../components/ui/controls';
import { useSound } from '../../lib/sound/SoundProvider';

export function ReviewReflection({
  analysis,
  saving,
  onSave,
  onBack,
}: {
  analysis: CaptureAnalysisDto;
  saving: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const [body, setBody] = useState(analysis.readingCopy);
  const [query, setQuery] = useState('');
  const [linked, setLinked] = useState<string[]>(() =>
    analysis.matches.slice(0, 1).map((m) => m.memoryId),
  );
  const { data: memories } = useMemories({ q: query || undefined });
  const { play } = useSound();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6 sm:px-6">
      <div className="paper rounded-[2rem] p-6 sm:p-8">
        <p className="eyebrow">a reflection, written today</p>
        <h2 className="mt-1 text-3xl font-semibold">How you see it now</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Reflections are dated today, not placed in the past. A new way of seeing something isn't
          treated as a contradiction.
        </p>
        <TextArea
          aria-label="Reflection"
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-5 font-display text-lg"
        />
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold">Is it about any memories? (optional)</p>
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your memories"
            aria-label="Search memories to link"
          />
          <div className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {memories?.slice(0, 12).map((m) => {
              const on = linked.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition ${on ? 'bg-lavender/30' : 'hover:bg-ink/4'}`}
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={on}
                    onChange={() => {
                      play('tap');
                      setLinked((list) =>
                        on ? list.filter((id) => id !== m.id) : [...list, m.id],
                      );
                    }}
                  />
                  <span className="font-semibold">{m.title}</span>
                  <span className="text-sm text-ink-soft">{m.temporal.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          icon={<Feather className="size-5" />}
          disabled={saving || !body.trim()}
          onClick={() => onSave({ readingCopy: body.trim(), memoryIds: linked })}
          sound={false}
        >
          {saving ? 'Saving…' : 'Keep this reflection'}
        </Button>
      </div>
    </div>
  );
}

export function ReviewCapsule({
  analysis,
  saving,
  onSave,
  onBack,
}: {
  analysis: CaptureAnalysisDto;
  saving: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  const [{ nextYear, tomorrow, today }] = useState(() => {
    const now = Date.now();
    return {
      nextYear: new Date(now + 365 * 864e5).toISOString().slice(0, 10),
      tomorrow: new Date(now + 864e5).toISOString().slice(0, 10),
      today: new Date(now).toISOString().slice(0, 10),
    };
  });
  const [title, setTitle] = useState('For future me');
  const [body, setBody] = useState(analysis.readingCopy);
  const [unlockKind, setUnlockKind] = useState<'date' | 'milestone'>('date');
  const [date, setDate] = useState(nextYear);
  const [milestone, setMilestone] = useState('');
  const [sealing, setSealing] = useState(false);
  const { play } = useSound();
  const valid =
    body.trim() && title.trim() && (unlockKind === 'date' ? date > today : milestone.trim());

  const seal = () => {
    setSealing(true);
    play('seal');
    window.setTimeout(
      () =>
        onSave({
          title: title.trim(),
          readingCopy: body.trim(),
          unlockKind,
          unlockDate: unlockKind === 'date' ? date : null,
          unlockMilestone: unlockKind === 'milestone' ? milestone.trim() : null,
        }),
      1100,
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6 sm:px-6">
      <motion.div
        animate={
          sealing
            ? { rotateX: 75, y: 40, opacity: 0.3, scale: 0.9 }
            : { rotateX: 0, y: 0, opacity: 1, scale: 1 }
        }
        transition={{ duration: 1, ease: [0.65, 0, 0.35, 1] }}
        style={{ transformPerspective: 1200, transformOrigin: 'bottom center' }}
        className="paper relative rounded-[2rem] p-6 sm:p-8"
      >
        <p className="eyebrow">a letter that waits</p>
        <TextInput
          aria-label="Capsule title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-2 font-display text-2xl font-semibold"
        />
        <TextArea
          aria-label="Your note"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="ruled mt-4 font-display text-lg"
        />
        <div className="mt-6 space-y-4">
          <Segmented
            label="Opens"
            value={unlockKind}
            onChange={setUnlockKind}
            options={[
              { value: 'date', label: 'On a date' },
              { value: 'milestone', label: 'When something happens' },
            ]}
          />
          {unlockKind === 'date' ? (
            <Field label="Open it on" htmlFor="unlock-date">
              <TextInput
                id="unlock-date"
                type="date"
                min={tomorrow}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          ) : (
            <Field
              label="Open it when"
              htmlFor="unlock-milestone"
              hint="You'll tell me when it happens. I won't assume."
            >
              <TextInput
                id="unlock-milestone"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                placeholder="I finish my degree"
              />
            </Field>
          )}
        </div>
      </motion.div>
      {sealing && (
        <motion.div
          initial={{ scale: 2.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.5 }}
          className="seal mx-auto -mt-24 flex size-20 items-center justify-center rounded-full font-display text-2xl text-snow/90"
        >
          ✦
        </motion.div>
      )}
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={sealing}>
          Back
        </Button>
        <Button
          size="lg"
          icon={<Mail className="size-5" />}
          disabled={saving || sealing || !valid}
          onClick={seal}
          sound={false}
        >
          Seal it
        </Button>
      </div>
    </div>
  );
}
