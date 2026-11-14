import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { MemoryDetailDto, TemporalDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useInvalidateArchive, useMilestones } from '../../api/hooks';
import { EmotionChip } from '../../components/memory/bits';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Segmented, TextArea, TextInput, Toggle } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { BASE_EMOTION_TAGS, emotionMeta } from '../../lib/meta';
import { PlacementEditor } from '../capture/PlacementEditor';
import { useWorld } from '../../lib/world/world';

export function EditTextDialog({
  memory,
  open,
  onClose,
}: {
  memory: MemoryDetailDto;
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState(memory.readingCopy);
  const [kind, setKind] = useState<'edit' | 'correction'>('edit');
  const world = useWorld();
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateArchive();
  const toast = useToast();

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/memories/${memory.id}/versions`, {
        originalText: text,
        readingCopy: text,
        sourceKind: 'typing',
        mode: kind,
        people: [],
        emotions: [],
        context: world.context(),
      });
      invalidate();
      toast(
        kind === 'edit'
          ? 'Wording updated. The old version is still in the history.'
          : 'Correction saved alongside the earlier telling.',
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit the reading copy"
      description="Every edit becomes a new entry in this memory's history. Nothing earlier is lost."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !text.trim() || text === memory.readingCopy}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-2 text-sm font-bold">What kind of change is this?</p>
      <Segmented
        label="Kind of change"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'edit', label: 'Fixing the wording' },
          { value: 'correction', label: 'Correcting what happened' },
        ]}
      />
      <p className="mt-2 text-xs text-ink-soft">
        {kind === 'edit'
          ? 'Typos, phrasing, flow. The facts stay the same.'
          : 'Something in the earlier telling was wrong. Both versions stay, marked as a correction.'}
      </p>
      <TextArea
        aria-label="Reading copy"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-4 font-display text-lg"
      />
    </Dialog>
  );
}

export function EditDetailsDialog({
  memory,
  open,
  onClose,
}: {
  memory: MemoryDetailDto;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(memory.title);
  const [temporal, setTemporal] = useState<TemporalDto>(memory.temporal);
  const [emotions, setEmotions] = useState(
    memory.emotions.map((e) => ({
      tag: e.tag,
      phase: e.phase,
      source: e.source,
      evidence: e.evidence,
    })),
  );
  const [tag, setTag] = useState('');
  const [phase, setPhase] = useState<'then' | 'now'>('then');
  const [place, setPlace] = useState(memory.place ?? '');
  const [sensitive, setSensitive] = useState(memory.sensitive);
  const [milestoneIds, setMilestoneIds] = useState(memory.milestones.map((m) => m.id));
  const { data: milestones } = useMilestones();
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateArchive();

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/memories/${memory.id}`, {
        title,
        temporal: { ...temporal, confirmed: true },
        emotions,
        place: place.trim() || null,
        sensitive,
        milestoneIds,
      });
      invalidate();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Details"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            Save details
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Title</span>
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-display text-lg"
          />
        </label>
        <div>
          <p className="mb-3 text-sm font-bold">When</p>
          <PlacementEditor value={temporal} onChange={setTemporal} />
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">Feelings</p>
          <div className="flex flex-wrap gap-1.5">
            {emotions.map((e) => (
              <EmotionChip
                key={`${e.tag}-${e.phase}`}
                tag={e.tag}
                phase={e.phase}
                onRemove={() =>
                  setEmotions((list) =>
                    list.filter((x) => !(x.tag === e.tag && x.phase === e.phase)),
                  )
                }
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TextInput
              aria-label="Add a feeling"
              list="edit-feelings"
              value={tag}
              onChange={(e) => setTag(e.target.value.toLowerCase().slice(0, 40))}
              placeholder="Add a feeling, any word"
              className="h-9 w-52 py-1 text-sm"
            />
            <datalist id="edit-feelings">
              {BASE_EMOTION_TAGS.map((t) => (
                <option key={t} value={t}>
                  {emotionMeta(t).label}
                </option>
              ))}
            </datalist>
            <Segmented
              size="sm"
              label="When"
              value={phase}
              onChange={setPhase}
              options={[
                { value: 'then', label: 'Back then' },
                { value: 'now', label: 'Now' },
              ]}
            />
            <Button
              size="sm"
              variant="soft"
              disabled={!tag.trim()}
              onClick={() => {
                setEmotions((list) => [
                  ...list.filter((x) => !(x.tag === tag.trim() && x.phase === phase)),
                  { tag: tag.trim(), phase, source: 'user', evidence: null },
                ]);
                setTag('');
              }}
            >
              Add
            </Button>
          </div>
        </div>
        {milestones && milestones.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold">Milestones</p>
            <div className="flex flex-wrap gap-1.5">
              {milestones.map((m) => {
                const on = milestoneIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setMilestoneIds((l) => (on ? l.filter((x) => x !== m.id) : [...l, m.id]))
                    }
                    className={`rounded-full px-3 py-1 text-xs font-bold ${on ? 'bg-peach-deep text-abyss' : 'bg-linen text-ink-soft'}`}
                  >
                    ⚑ {m.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Place</span>
          <TextInput
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <Toggle
          checked={sensitive}
          onChange={setSensitive}
          label="Keep this one quiet"
          description="Left out of prompts, playback and answers unless you ask for it."
        />
      </div>
    </Dialog>
  );
}

export function DeleteMemoryDialog({
  memory,
  open,
  onClose,
}: {
  memory: MemoryDetailDto;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const files = memory.media.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete “${memory.title}”?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} autoFocus>
            Keep it
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            sound="close"
            onClick={async () => {
              setDeleting(true);
              await api.delete(`/memories/${memory.id}`);
              invalidate();
              toast('Deleted for good.');
              void navigate('/', { viewTransition: true });
            }}
          >
            Delete permanently
          </Button>
        </>
      }
    >
      <p className="text-ink-soft">
        This removes all {memory.versions.length}{' '}
        {memory.versions.length === 1 ? 'telling' : 'tellings'}
        {files ? `, ${files} ${files === 1 ? 'file' : 'files'}` : ''} and any links to other
        memories from this computer. There's no undo and no hidden copy.
      </p>
    </Dialog>
  );
}
