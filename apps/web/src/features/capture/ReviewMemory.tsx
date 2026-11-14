import { useMemo, useState } from 'react';
import { BookCopy, Check, Eye, EyeOff, Plus, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import type {
  CaptureAnalysisDto,
  PersonDecision,
  Role,
  TemporalDto,
} from '@living-draft/contracts';
import { useCharacters, useMilestones } from '../../api/hooks';
import { EmotionChip, Portrait } from '../../components/memory/bits';
import { Button } from '../../components/ui/Button';
import { Segmented, Select, TextArea, TextInput, Toggle } from '../../components/ui/controls';
import { BASE_EMOTION_TAGS, emotionMeta } from '../../lib/meta';
import { useSound } from '../../lib/sound/SoundProvider';
import type { Attachment } from './useCaptureDraft';
import { PlacementEditor } from './PlacementEditor';
import { finalizeTemporal } from './placement';

export interface ReviewResult {
  target: 'new' | { memoryId: string; mode: 'addition' | 'retelling' };
  title: string;
  readingCopy: string;
  temporal: TemporalDto;
  people: PersonDecision[];
  emotions: Array<{
    tag: string;
    phase: 'then' | 'now';
    source: 'suggested' | 'user';
    evidence: string | null;
  }>;
  milestoneIds: string[];
  newMilestones: Array<{ title: string; ageMin: number | null; ageMax: number | null }>;
  place: string | null;
  sensitive: boolean;
}

interface PersonRow {
  key: string;
  include: boolean;
  characterId: string | null;
  name: string;
  role: Role;
  surfaces: string[];
  relationship: string | null;
  evidence: string;
  reason: string | null;
}

function Card({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="paper rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ReviewMemory({
  original,
  analysis,
  attachments,
  presetAge,
  presetMemoryId,
  saving,
  onSave,
  onBack,
}: {
  original: string;
  analysis: CaptureAnalysisDto;
  attachments: Attachment[];
  presetAge: number | null;
  presetMemoryId: string | null;
  saving: boolean;
  onSave: (result: ReviewResult) => void;
  onBack: () => void;
}) {
  const { play } = useSound();
  const { data: characters } = useCharacters();
  const { data: milestones } = useMilestones();

  const [title, setTitle] = useState(analysis.title);
  const [readingCopy, setReadingCopy] = useState(analysis.readingCopy);
  const [showChanges, setShowChanges] = useState(true);
  const [temporal, setTemporal] = useState<TemporalDto>(() => {
    if (presetAge !== null && analysis.temporal.ageMin === null && !analysis.temporal.year) {
      return finalizeTemporal({
        ...analysis.temporal,
        ageMin: presetAge,
        ageMax: presetAge,
        approximate: true,
        explanation: `You started this from Chapter ${presetAge}, so it's placed there. Change it if that's not right.`,
      });
    }
    return analysis.temporal;
  });
  const [people, setPeople] = useState<PersonRow[]>(() =>
    analysis.people.map((p) => ({
      key: p.key,
      include: true,
      characterId: p.suggestion?.characterId ?? null,
      name: p.label,
      role: p.role,
      surfaces: p.surfaces,
      relationship: p.relationship,
      evidence: p.roleEvidence,
      reason: p.suggestion?.reason ?? null,
    })),
  );
  const [emotions, setEmotions] = useState(() =>
    analysis.emotions.map((e) => ({
      tag: e.tag,
      phase: e.phase,
      include: e.confidence >= 0.6,
      quote: e.quote,
      basis: e.basis,
      source: 'suggested' as const,
    })),
  );
  const [customTag, setCustomTag] = useState('');
  const [customPhase, setCustomPhase] = useState<'then' | 'now'>('then');
  const [milestoneIds, setMilestoneIds] = useState<string[]>(() =>
    analysis.milestones.map((m) => m.existing?.id).filter((id): id is string => !!id),
  );
  const [newMilestones, setNewMilestones] = useState<string[]>([]);
  const likely = analysis.matches.find((m) => m.verdict === 'likely_same');
  const [target, setTarget] = useState<string>(presetMemoryId ?? 'new');
  const [mode, setMode] = useState<'addition' | 'retelling'>(() =>
    original.length < 400 ? 'addition' : 'retelling',
  );
  const [place, setPlace] = useState('');
  const [sensitive, setSensitive] = useState(false);

  const hedges = useMemo(() => analysis.hedges, [analysis.hedges]);
  const attaching = target !== 'new';

  const setPerson = (key: string, patch: Partial<PersonRow>) =>
    setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const save = () => {
    const chosen = people.filter((p) => p.include);
    onSave({
      target: attaching ? { memoryId: target, mode } : 'new',
      title: title.trim() || analysis.title,
      readingCopy: readingCopy.trim(),
      temporal: { ...temporal, confirmed: true },
      people: chosen.map((p) => ({
        label: p.characterId
          ? (characters?.find((c) => c.id === p.characterId)?.name ?? p.name)
          : p.name.trim() || p.surfaces[0]!,
        surfaces: p.surfaces,
        characterId: p.characterId,
        relationship: p.relationship,
        role: p.role,
        roleEvidence: p.evidence,
        addAlias: true,
      })),
      emotions: emotions
        .filter((e) => e.include)
        .map((e) => ({ tag: e.tag, phase: e.phase, source: e.source, evidence: e.quote || null })),
      milestoneIds,
      newMilestones: newMilestones.map((t) => ({
        title: t,
        ageMin: temporal.ageMin,
        ageMax: temporal.ageMax,
      })),
      place: place.trim() || null,
      sensitive,
    });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-32 pt-6 lg:grid-cols-[1.05fr_1fr] lg:gap-7 sm:px-6">
      <div className="flex flex-col gap-5">
        <Card
          title="What you said"
          aside={
            <button
              type="button"
              onClick={() => setShowChanges((s) => !s)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              {showChanges ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {showChanges ? 'Hide' : 'Show'} tidy-ups
            </button>
          }
        >
          <p className="ruled rounded-xl bg-paper px-1 font-display text-[1.08rem] text-ink">
            {showChanges
              ? analysis.diff.map((segment, i) =>
                  segment.type === 'same' ? (
                    <span key={i}>{segment.text}</span>
                  ) : segment.type === 'removed' ? (
                    <del
                      key={i}
                      className="text-ink-faint decoration-rose-deep/60"
                      title="Left out of the reading copy"
                    >
                      {segment.text}
                    </del>
                  ) : (
                    <ins
                      key={i}
                      className="rounded bg-sage/35 no-underline"
                      title="Added for readability"
                    >
                      {segment.text}
                    </ins>
                  ),
                )
              : original}
          </p>
          <p className="mt-3 text-xs text-ink-soft">
            Your exact words are kept forever as the original.{' '}
            {analysis.removedFillers + analysis.removedRepeats > 0
              ? `The reading copy drops ${analysis.removedFillers} filler ${analysis.removedFillers === 1 ? 'word' : 'words'} and ${analysis.removedRepeats} repeat${analysis.removedRepeats === 1 ? '' : 's'}, nothing else.`
              : 'Nothing needed tidying.'}
            {hedges.length > 0 &&
              ` You sounded unsure in ${hedges.length} ${hedges.length === 1 ? 'place' : 'places'}, and that's kept.`}
          </p>
        </Card>

        <Card
          title="Reading copy"
          aside={
            readingCopy !== analysis.readingCopy ? (
              <button
                type="button"
                onClick={() => setReadingCopy(analysis.readingCopy)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
              >
                <Undo2 className="size-4" /> Undo my edits
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReadingCopy(original.trim())}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
              >
                <RotateCcw className="size-4" /> Use my exact words
              </button>
            )
          }
        >
          <label htmlFor="title" className="mb-1.5 block text-sm font-bold">
            Title
          </label>
          <TextInput
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-display text-lg font-semibold"
          />
          <label htmlFor="reading" className="mb-1.5 mt-4 block text-sm font-bold">
            The version you'll read later
          </label>
          <TextArea
            id="reading"
            rows={Math.min(14, Math.max(5, Math.ceil(readingCopy.length / 70)))}
            value={readingCopy}
            onChange={(e) => setReadingCopy(e.target.value)}
            className="font-display text-[1.05rem]"
          />
        </Card>

        {attachments.length > 0 && (
          <Card title="Kept with it">
            <div className="flex flex-wrap gap-3">
              {attachments.map((a) => (
                <div key={a.localId} className="w-28 bg-paper p-1.5 pb-3 shadow-paper">
                  {a.kind === 'photo' ? (
                    <img src={a.previewUrl} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-dusk text-xs font-bold text-snow">
                      {a.kind === 'video' ? 'Video' : 'Audio'}
                    </div>
                  )}
                  <p className="mt-1 truncate text-xs text-ink-soft">{a.error ?? a.name}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {analysis.matches.length > 0 && !presetMemoryId && (
          <Card title={likely ? 'This sounds familiar' : 'Might be related'}>
            <div
              role="radiogroup"
              aria-label="Where should this go?"
              className="flex flex-col gap-2"
            >
              {analysis.matches.map((match) => (
                <label
                  key={match.memoryId}
                  className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${target === match.memoryId ? 'border-lavender-deep bg-lavender/20' : 'border-ink/10 hover:border-ink/25'}`}
                >
                  <input
                    type="radio"
                    name="target"
                    className="mt-1.5 size-4"
                    checked={target === match.memoryId}
                    onChange={() => {
                      play('tap');
                      setTarget(match.memoryId);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-lavender-deep">
                      Add to this memory
                    </span>
                    <span className="block font-display text-lg font-semibold">{match.title}</span>
                    <span className="block text-sm text-ink-soft">{match.temporalLabel}</span>
                    <span className="mt-1 block text-sm text-ink-soft">
                      {match.reasons.join(' · ')}
                    </span>
                  </span>
                </label>
              ))}
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${target === 'new' ? 'border-lavender-deep bg-lavender/20' : 'border-ink/10 hover:border-ink/25'}`}
              >
                <input
                  type="radio"
                  name="target"
                  className="size-4"
                  checked={target === 'new'}
                  onChange={() => {
                    play('tap');
                    setTarget('new');
                  }}
                />
                <span>
                  <span className="block font-bold">Keep it as a new memory</span>
                  <span className="text-sm text-ink-soft">
                    Two summers can sound alike and still be different. Your call.
                  </span>
                </span>
              </label>
            </div>
          </Card>
        )}

        {attaching && (
          <Card title="How does this fit?">
            <Segmented
              label="Kind of telling"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'addition', label: 'It adds details' },
                { value: 'retelling', label: 'It retells the whole thing' },
              ]}
            />
            <p className="mt-3 text-sm text-ink-soft">
              Either way, the earlier telling stays exactly as it was. If something seems to differ,
              I'll show you both and ask how to keep them.
            </p>
          </Card>
        )}

        {!attaching && (
          <Card title="When was this?">
            <PlacementEditor
              value={temporal}
              onChange={setTemporal}
              conflicts={analysis.conflicts}
            />
          </Card>
        )}

        <Card
          title="People in it"
          aside={<span className="text-xs font-semibold text-ink-soft">Tap a name to fix it</span>}
        >
          {people.length === 0 && (
            <p className="text-sm text-ink-soft">I didn't spot anyone. That's fine.</p>
          )}
          <ul className="flex flex-col gap-4">
            {people.map((person) => (
              <li
                key={person.key}
                className={`rounded-2xl p-3 transition ${person.include ? 'bg-cream/60' : 'opacity-50'}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Portrait
                    name={
                      person.characterId
                        ? (characters?.find((c) => c.id === person.characterId)?.name ??
                          person.name)
                        : person.name
                    }
                    size={36}
                  />
                  <div className="min-w-[10rem] flex-1">
                    <Select
                      aria-label={`Who is “${person.surfaces[0]}”?`}
                      value={person.include ? (person.characterId ?? 'new') : 'skip'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'skip') setPerson(person.key, { include: false });
                        else
                          setPerson(person.key, {
                            include: true,
                            characterId: v === 'new' ? null : v,
                          });
                      }}
                    >
                      <option value="new">New person: {person.name}</option>
                      {characters?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.relationship ? ` (${c.relationship})` : ''}
                        </option>
                      ))}
                      <option value="skip">Not a person / leave out</option>
                    </Select>
                  </div>
                  <Segmented
                    size="sm"
                    label={`${person.name}'s role`}
                    value={person.role}
                    onChange={(role) => setPerson(person.key, { role })}
                    options={[
                      { value: 'central', label: 'Central', hint: 'Drove what happened' },
                      { value: 'supporting', label: 'Supporting', hint: 'Part of it' },
                      { value: 'mentioned', label: 'Mentioned', hint: 'In the background' },
                    ]}
                  />
                </div>
                {person.include && !person.characterId && (
                  <TextInput
                    aria-label="Name for the new person"
                    value={person.name}
                    onChange={(e) => setPerson(person.key, { name: e.target.value })}
                    className="mt-2 h-9 py-1 text-sm"
                  />
                )}
                <p className="mt-2 text-xs text-ink-soft">
                  You said “{person.surfaces.join('”, “')}”
                  {person.evidence ? (
                    <>
                      {' '}
                      · <span className="italic">{person.evidence}</span>
                    </>
                  ) : null}
                </p>
                {person.reason && (
                  <p className="mt-1 text-xs font-semibold text-lavender-deep">{person.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="How it felt">
          <div className="flex flex-wrap gap-2">
            {emotions.map((e, i) => (
              <button
                key={`${e.tag}-${e.phase}`}
                type="button"
                aria-pressed={e.include}
                title={
                  e.quote ? `${e.basis === 'stated' ? 'You said' : 'From'}: ${e.quote}` : undefined
                }
                onClick={() => {
                  play('tap');
                  setEmotions((list) =>
                    list.map((x, j) => (j === i ? { ...x, include: !x.include } : x)),
                  );
                }}
                className={`inline-flex items-center gap-1 rounded-full transition ${e.include ? '' : 'opacity-40 grayscale'}`}
              >
                <EmotionChip tag={e.tag} phase={e.phase} />
                {e.include && <Check className="size-3.5 text-sage-deep" aria-hidden="true" />}
              </button>
            ))}
            {!emotions.length && (
              <p className="text-sm text-ink-soft">No feelings named outright. Add any that fit.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TextInput
              aria-label="Add a feeling"
              list="review-feelings"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value.toLowerCase().slice(0, 40))}
              placeholder="Add a feeling, any word"
              className="h-9 w-52 py-1 text-sm"
            />
            <datalist id="review-feelings">
              {BASE_EMOTION_TAGS.map((t) => (
                <option key={t} value={t}>
                  {emotionMeta(t).label}
                </option>
              ))}
            </datalist>
            <Segmented
              size="sm"
              label="When"
              value={customPhase}
              onChange={setCustomPhase}
              options={[
                { value: 'then', label: 'Back then' },
                { value: 'now', label: 'Now' },
              ]}
            />
            <Button
              size="sm"
              variant="soft"
              icon={<Plus className="size-4" />}
              disabled={!customTag.trim()}
              onClick={() => {
                setEmotions((list) => [
                  ...list.filter((x) => !(x.tag === customTag.trim() && x.phase === customPhase)),
                  {
                    tag: customTag.trim(),
                    phase: customPhase,
                    include: true,
                    quote: '',
                    basis: 'stated' as const,
                    source: 'suggested' as const,
                  },
                ]);
                setCustomTag('');
              }}
            >
              Add
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            “Back then” is how it felt at the time. “Now” is how it feels to remember it.
          </p>
        </Card>

        {!attaching && (
          <Card title="Milestones and details">
            {analysis.milestones
              .filter((m) => !m.existing)
              .map((cue) => (
                <label key={cue.label} className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={newMilestones.includes(cue.label)}
                    onChange={(e) =>
                      setNewMilestones((list) =>
                        e.target.checked
                          ? [...list, cue.label]
                          : list.filter((l) => l !== cue.label),
                      )
                    }
                  />
                  Make “{cue.label}” a milestone
                </label>
              ))}
            {milestones && milestones.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {milestones.map((m) => {
                  const on = milestoneIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setMilestoneIds((list) =>
                          on ? list.filter((id) => id !== m.id) : [...list, m.id],
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${on ? 'bg-peach-deep text-abyss' : 'bg-linen text-ink-soft hover:text-ink'}`}
                    >
                      ⚑ {m.title}
                    </button>
                  );
                })}
              </div>
            )}
            <label htmlFor="place" className="mb-1.5 block text-sm font-bold">
              Place (optional)
            </label>
            <TextInput
              id="place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Only if you want it recorded"
            />
            <div className="mt-3">
              <Toggle
                checked={sensitive}
                onChange={setSensitive}
                label="Keep this one quiet"
                description="It won't come up in prompts, playback suggestions or answers unless you ask."
              />
            </div>
          </Card>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/8 bg-ivory/90 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} sound="shift">
            Back to my notes
          </Button>
          <Button
            size="lg"
            onClick={save}
            disabled={saving || !readingCopy.trim()}
            icon={attaching ? <BookCopy className="size-5" /> : <Sparkles className="size-5" />}
            sound={false}
          >
            {saving ? 'Saving…' : attaching ? 'Add to this memory' : 'Save memory'}
          </Button>
        </div>
      </div>
    </div>
  );
}
