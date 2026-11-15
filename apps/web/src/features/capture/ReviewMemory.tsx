import { useMemo, useState } from 'react';
import {
  BookCopy,
  Check,
  Eye,
  EyeOff,
  MessageCircleQuestion,
  Plus,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import type {
  AiJobDto,
  AiNotesDto,
  AiStatusDto,
  CaptureAnalysisDto,
  PersonDecision,
  Role,
  TemporalDto,
  UnderstandingInput,
} from '@living-draft/contracts';
import { AiBanner } from './aiReview';
import { mergeAiFeelings, mergeAiPeople } from './aiMerge';
import { useCharacters, useMilestones } from '../../api/hooks';
import { EmotionChip, Portrait } from '../../components/memory/bits';
import { Button } from '../../components/ui/Button';
import { Segmented, Select, TextArea, TextInput, Toggle } from '../../components/ui/controls';
import { ALL_EMOTION_TAGS, emotionMeta, TIME_SPANS } from '../../lib/meta';
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
  understanding: UnderstandingInput;
}

export interface PersonRow {
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
  ai,
  job,
  rewrite,
  onAskAgain,
}: {
  ai: AiStatusDto | null;
  job: AiJobDto | null;
  rewrite: AiJobDto | null;
  onAskAgain: (body: {
    memoryId?: string;
    answers?: Array<{ question: string; answer: string }>;
  }) => void;
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
  const [titleEdited, setTitleEdited] = useState(false);
  const [readingEdited, setReadingEdited] = useState(false);
  const [notes, setNotes] = useState<AiNotesDto | null>(null);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [themes, setThemes] = useState<Array<{ theme: string; because: string; include: boolean }>>(
    [],
  );
  const [questions, setQuestions] = useState<Array<{ question: string; answer: string }>>([]);
  const [placesFound, setPlacesFound] = useState<Array<{ name: string; kind: string }>>([]);
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
  const [place, setPlace] = useState('');
  const [span, setSpan] = useState<string | null>(null);
  const [spanEdited, setSpanEdited] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [aiMilestone, setAiMilestone] = useState<string | null>(null);

  const freshNotes = job?.notes ?? null;
  if (freshNotes && freshNotes !== notes) {
    setNotes(freshNotes);
    if (!titleEdited && freshNotes.title.trim()) setTitle(freshNotes.title.trim());
    setPeople((rows) => mergeAiPeople(rows, freshNotes, characters ?? []));
    setEmotions((list) => mergeAiFeelings(list, freshNotes));
    setThemes(freshNotes.themes.map((t) => ({ ...t, include: true })));
    setQuestions(freshNotes.questions.map((question) => ({ question, answer: '' })));
    setPlacesFound(freshNotes.places);
    const town = freshNotes.places.find((p) => p.kind !== 'home' && p.kind !== 'other');
    if (!place && town) setPlace(town.name);
    if (!spanEdited && freshNotes.time.kind !== 'unclear') setSpan(freshNotes.time.kind);
    if (freshNotes.milestone.isMilestone && freshNotes.milestone.title.trim()) {
      const label = freshNotes.milestone.title.trim();
      setAiMilestone(label);
      setNewMilestones((list) => (list.includes(label) ? list : [...list, label]));
    }
  }
  const latestNarrative =
    (rewrite?.status === 'done' ? rewrite.narrative : null) ?? job?.narrative ?? null;
  if (latestNarrative && latestNarrative !== aiNarrative) {
    setAiNarrative(latestNarrative);
    if (!readingEdited) setReadingCopy(latestNarrative);
  }
  const working = job?.status === 'working' || rewrite?.status === 'working';
  const stage = rewrite?.status === 'working' ? 'narrative' : (job?.stage ?? null);

  const hedges = useMemo(() => analysis.hedges, [analysis.hedges]);
  const attaching = target !== 'new';

  const setPerson = (key: string, patch: Partial<PersonRow>) =>
    setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const save = () => {
    const chosen = people.filter((p) => p.include);
    onSave({
      target: attaching
        ? { memoryId: target, mode: aiNarrative ? 'retelling' : 'addition' }
        : 'new',
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
      understanding: {
        summary: notes?.summary ?? null,
        time: span ? { kind: span, hint: notes?.time.hint ?? '' } : null,
        themes: themes
          .filter((t) => t.include)
          .map((t) => ({ theme: t.theme, evidence: t.because })),
        followups: questions.map((q) => ({
          question: q.question,
          answer: q.answer.trim() || null,
        })),
        places: [
          ...(place.trim() ? [{ name: place.trim(), kind: null }] : []),
          ...placesFound
            .filter((p) => p.name.toLowerCase() !== place.trim().toLowerCase())
            .map((p) => ({ name: p.name, kind: p.kind })),
        ],
      },
    });
  };

  const answered = questions.filter((q) => q.answer.trim());

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
          <p className="ruled max-h-[28rem] overflow-y-auto rounded-xl bg-paper px-1 font-display text-[1.08rem] text-ink">
            {showChanges && !aiNarrative
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
            {aiNarrative
              ? 'The version below was rewritten from them so it reads well later, without adding anything you did not say.'
              : null}
            {!aiNarrative && analysis.removedFillers + analysis.removedRepeats > 0
              ? `The reading copy drops ${analysis.removedFillers} filler ${analysis.removedFillers === 1 ? 'word' : 'words'} and ${analysis.removedRepeats} repeat${analysis.removedRepeats === 1 ? '' : 's'}, nothing else.`
              : 'Nothing needed tidying.'}
            {hedges.length > 0 &&
              ` You sounded unsure in ${hedges.length} ${hedges.length === 1 ? 'place' : 'places'}, and that's kept.`}
          </p>
        </Card>

        <Card
          title="Reading copy"
          aside={
            readingEdited ? (
              <button
                type="button"
                onClick={() => {
                  setReadingCopy(aiNarrative ?? analysis.readingCopy);
                  setReadingEdited(false);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
              >
                <Undo2 className="size-4" /> Undo my edits
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setReadingCopy(original.trim());
                  setReadingEdited(true);
                }}
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
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleEdited(true);
            }}
            className="font-display text-lg font-semibold"
          />
          <label htmlFor="reading" className="mb-1.5 mt-4 block text-sm font-bold">
            The version you'll read later
          </label>
          <TextArea
            id="reading"
            rows={Math.min(14, Math.max(5, Math.ceil(readingCopy.length / 70)))}
            value={readingCopy}
            onChange={(e) => {
              setReadingCopy(e.target.value);
              setReadingEdited(true);
            }}
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
        <AiBanner ai={ai} job={job} working={working} stage={stage} />

        {questions.length > 0 && (
          <Card
            title="A few questions, if you like"
            aside={<MessageCircleQuestion className="size-5 text-lavender-deep" />}
          >
            <p className="mb-3 text-sm text-ink-soft">
              Answer any, all or none. Skipped ones stay with the memory so you can come back to
              them.
            </p>
            <ul className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <li key={q.question}>
                  <label htmlFor={`followup-${i}`} className="block text-sm font-semibold">
                    {q.question}
                  </label>
                  <TextArea
                    id={`followup-${i}`}
                    rows={2}
                    value={q.answer}
                    onChange={(e) =>
                      setQuestions((list) =>
                        list.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)),
                      )
                    }
                    className="mt-1 text-sm"
                    placeholder="Skip it if you'd rather"
                  />
                </li>
              ))}
            </ul>
            {answered.length > 0 && (
              <Button
                size="sm"
                variant="soft"
                className="mt-3"
                disabled={working}
                icon={<Sparkles className="size-4" />}
                onClick={() =>
                  onAskAgain({
                    memoryId: attaching ? target : undefined,
                    answers: answered.map((q) => ({
                      question: q.question,
                      answer: q.answer.trim(),
                    })),
                  })
                }
              >
                Rewrite it with my answers
              </Button>
            )}
          </Card>
        )}

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
                      if (aiNarrative !== null || working) onAskAgain({ memoryId: match.memoryId });
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
                  {person.relationship ? (
                    <span className="font-semibold text-ink">{person.relationship} · </span>
                  ) : null}
                  You said “{person.surfaces.slice(0, 3).join('”, “')}”
                  {person.evidence && person.evidence.length <= 160 ? (
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
              {ALL_EMOTION_TAGS.map((t) => (
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
            {[
              ...(aiMilestone && !analysis.milestones.some((m) => m.label === aiMilestone)
                ? [{ label: aiMilestone }]
                : []),
              ...analysis.milestones.filter((m) => !m.existing),
            ].map((cue) => (
              <label key={cue.label} className="mb-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={newMilestones.includes(cue.label)}
                  onChange={(e) =>
                    setNewMilestones((list) =>
                      e.target.checked ? [...list, cue.label] : list.filter((l) => l !== cue.label),
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
            {themes.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-sm font-bold">Threads it belongs to</p>
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((t, i) => (
                    <button
                      key={t.theme}
                      type="button"
                      aria-pressed={t.include}
                      title={t.because}
                      onClick={() =>
                        setThemes((list) =>
                          list.map((x, j) => (j === i ? { ...x, include: !x.include } : x)),
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-bold transition ${t.include ? 'bg-lavender-deep text-abyss' : 'bg-linen text-ink-soft line-through'}`}
                    >
                      {t.theme}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p id="span-label" className="mb-1.5 text-sm font-bold">
              How long did it last? (optional)
            </p>
            <div role="group" aria-labelledby="span-label" className="mb-4 flex flex-wrap gap-2">
              {TIME_SPANS.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={span === s.kind}
                  onClick={() => {
                    setSpanEdited(true);
                    setSpan(span === s.kind ? null : s.kind);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${span === s.kind ? 'bg-gold-deep text-abyss' : 'bg-linen text-ink-soft hover:text-ink'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-[#141119]/95 px-4 py-3">
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
