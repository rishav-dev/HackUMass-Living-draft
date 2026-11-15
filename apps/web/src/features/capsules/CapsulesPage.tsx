import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flag, Mail, Plus } from 'lucide-react';
import type { CapsuleDto, MilestoneDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useCapsules, useInvalidateArchive, useMilestones } from '../../api/hooks';
import { MilestoneDialog } from '../../components/milestones/MilestoneDialog';
import { formatMilestoneDate } from '../../lib/format';
import { Ambience } from '../../components/decor/Ambience';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea } from '../../components/ui/controls';
import { PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { formatDate, untilDate } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { useScene, useSound } from '../../lib/sound/SoundProvider';
import { Reflections } from './Reflections';

export default function CapsulesPage() {
  const { data: capsules, isLoading } = useCapsules();
  const { data: milestones } = useMilestones();
  const [opening, setOpening] = useState<CapsuleDto | null>(null);
  useScene('night');

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-[30rem] bg-gradient-to-b from-abyss/60 to-transparent"
        aria-hidden="true"
      >
        <Ambience kind="stars" density={1.2} />
      </div>
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8">
        <p className="eyebrow">letters that wait</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-semibold text-snow sm:text-5xl">Time capsules</h1>
          <ButtonLink
            to="/capture?type=capsule"
            variant="secondary"
            icon={<Mail className="size-4" />}
          >
            Write one
          </ButtonLink>
        </div>
        <p className="mt-2 max-w-xl text-snow/75">
          Notes to a future you. They stay sealed until their day comes, and they never pretend to
          be something that already happened.
        </p>

        {isLoading ? (
          <PaperLoading />
        ) : (
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {capsules?.map((capsule, i) => (
              <motion.li
                key={capsule.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Envelope capsule={capsule} onOpen={() => setOpening(capsule)} />
              </motion.li>
            ))}
            {!capsules?.length && (
              <li className="paper rounded-3xl p-8 text-center text-ink-soft sm:col-span-2 lg:col-span-3">
                No capsules yet. Write one for a birthday, a year from now, or the day something
                finally happens.
              </li>
            )}
          </ul>
        )}

        <Reflections />

        <Milestones milestones={milestones ?? []} />
      </div>
      {opening && <OpenCapsule capsule={opening} onClose={() => setOpening(null)} />}
    </div>
  );
}

function Envelope({ capsule, onOpen }: { capsule: CapsuleDto; onOpen: () => void }) {
  const invalidate = useInvalidateArchive();
  const { play } = useSound();
  const ready = capsule.unlocked;
  const opened = !!capsule.openedAt;

  return (
    <div className={`relative ${ready && !opened ? 'anim-float' : ''}`}>
      <button
        type="button"
        onClick={() => {
          if (!ready) {
            play('tap');
            haptic('warn');
            return;
          }
          onOpen();
        }}
        aria-label={ready ? `Open “${capsule.title}”` : `“${capsule.title}” is sealed`}
        className={`group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#f3e6cc] text-left shadow-lift transition ${ready && !opened ? 'anim-glow hover:-translate-y-1' : ''}`}
      >
        <span
          className="absolute inset-0 bg-[linear-gradient(155deg,transparent_49.5%,rgb(53_47_68/0.08)_50%,transparent_50.5%),linear-gradient(25deg,transparent_49.5%,rgb(53_47_68/0.08)_50%,transparent_50.5%)]"
          aria-hidden="true"
        />
        <span
          className="absolute inset-x-0 top-0 h-1/2 origin-top bg-[#ead9b8] transition-transform duration-700 [clip-path:polygon(0_0,100%_0,50%_100%)] group-hover:[transform:rotateX(18deg)]"
          style={{ transform: opened ? 'rotateX(180deg)' : undefined }}
          aria-hidden="true"
        />
        {!opened && (
          <span className="seal absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-display text-xl text-snow/85">
            ✦
          </span>
        )}
        {opened && (
          <span className="absolute inset-x-6 bottom-4 top-10 rotate-1 bg-paper p-3 eyebrow shadow">
            {capsule.body?.slice(0, 90)}…
          </span>
        )}
      </button>
      <div className="mt-3 px-1">
        <p className="font-display text-xl font-semibold">{capsule.title}</p>
        <p className="text-sm text-ink-soft">
          Written at {capsule.authoredAge} · {formatDate(capsule.authoredAt)}
        </p>
        <p className={`mt-1 text-sm font-bold ${ready ? 'text-sage-deep' : 'text-ink-soft'}`}>
          {opened
            ? `Opened ${formatDate(capsule.openedAt!)}`
            : capsule.unlockKind === 'date'
              ? untilDate(capsule.unlockDate!)
              : ready
                ? 'Ready to open'
                : `Opens when: ${capsule.unlockMilestone}`}
        </p>
        {capsule.unlockKind === 'milestone' && !ready && (
          <button
            type="button"
            className="ink-link mt-1 text-sm font-semibold"
            onClick={async () => {
              await api.post(`/capsules/${capsule.id}/milestone-reached`);
              play('chime');
              invalidate();
            }}
          >
            This happened
          </button>
        )}
      </div>
    </div>
  );
}

function OpenCapsule({ capsule, onClose }: { capsule: CapsuleDto; onClose: () => void }) {
  const [stage, setStage] = useState<'sealed' | 'open'>(capsule.openedAt ? 'open' : 'sealed');
  const [reflection, setReflection] = useState(capsule.reflection?.body ?? '');
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const { play } = useSound();

  const breakSeal = async () => {
    play('unseal');
    haptic('saved');
    setStage('open');
    await api.post(`/capsules/${capsule.id}/open`, {});
    invalidate();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={capsule.title}
      description={`From you at ${capsule.authoredAge}, ${formatDate(capsule.authoredAt)}`}
      width="max-w-xl"
    >
      <AnimatePresence mode="wait">
        {stage === 'sealed' ? (
          <motion.div
            key="sealed"
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex flex-col items-center py-6"
          >
            <motion.button
              type="button"
              onClick={() => void breakSeal()}
              whileHover={{ scale: 1.06, rotate: -4 }}
              whileTap={{ scale: 0.9 }}
              className="seal flex size-24 items-center justify-center rounded-full font-display text-3xl text-snow/90"
              aria-label="Break the seal"
            >
              ✦
            </motion.button>
            <p className="mt-4 eyebrow">break the seal</p>
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={{ y: 40, opacity: 0, rotate: -2 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          >
            <div className="ruled rounded-2xl bg-cream/70 px-5 py-3 font-display text-lg">
              {capsule.body}
            </div>
            <label htmlFor="capsule-reflection" className="mt-6 block eyebrow">
              and now? what do you think, reading it today?
            </label>
            <TextArea
              id="capsule-reflection"
              rows={4}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="mt-2"
            />
            <div className="mt-4 flex justify-end">
              <Button
                disabled={!reflection.trim()}
                onClick={async () => {
                  await api.post(`/capsules/${capsule.id}/open`, { reflection });
                  invalidate();
                  toast('Your answer is kept next to the letter.');
                  onClose();
                }}
              >
                Keep my answer
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

function Milestones({ milestones }: { milestones: MilestoneDto[] }) {
  const [editing, setEditing] = useState<MilestoneDto | 'new' | null>(null);
  return (
    <section className="mt-20" aria-labelledby="milestones">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">the big markers</p>
          <h2 id="milestones" className="text-3xl font-semibold">
            Milestones
          </h2>
          <p className="mt-1 text-ink-soft">
            Anchors like a move, a graduation or a birth. Memories can hang off them, and “before my
            brother was born” can use them to find a date.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<Plus className="size-4" />}
          onClick={() => setEditing('new')}
        >
          Add
        </Button>
      </div>
      <ol className="relative mt-8 flex flex-col gap-3 border-l-2 border-dashed border-peach-deep/40 pl-6">
        {milestones.map((m) => (
          <li key={m.id} className="relative">
            <span className="absolute -left-[2.05rem] top-3 flex size-6 items-center justify-center rounded-full bg-peach-deep text-xs text-abyss">
              <Flag className="size-3" />
            </span>
            <button
              type="button"
              onClick={() => setEditing(m)}
              className="paper flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition hover:-translate-y-0.5"
            >
              <span className="w-16 font-display text-xl font-semibold text-peach-deep">
                {m.ageMin ?? '?'}
              </span>
              {m.date && (
                <span className="hidden text-xs font-semibold text-ink-soft sm:inline">
                  {formatMilestoneDate(m.date)}
                </span>
              )}
              <span className="flex-1 font-semibold">{m.title}</span>
              <span className="text-sm text-ink-soft">
                {m.memoryIds.length} {m.memoryIds.length === 1 ? 'memory' : 'memories'}
              </span>
            </button>
          </li>
        ))}
        {!milestones.length && <li className="text-ink-soft">None yet.</li>}
      </ol>
      {editing && (
        <MilestoneDialog
          key={editing === 'new' ? 'new' : editing.id}
          milestone={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
