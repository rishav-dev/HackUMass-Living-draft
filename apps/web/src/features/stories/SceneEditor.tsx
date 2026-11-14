import { useState } from 'react';
import { Mic, MicOff, RotateCcw, Sparkles, Trash2, UserPlus, Wand2 } from 'lucide-react';
import type { SceneSaveResultDto, StoryBookDto, StorySceneDto } from '@living-draft/contracts';
import type { StoryActions } from '../../api/stories';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Select, TextArea, TextInput } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';
import { BASE_EMOTION_TAGS, emotionMeta } from '../../lib/meta';
import { useSpeechRecognition } from '../../lib/speech';
import { useSound } from '../../lib/sound/SoundProvider';

export function SceneEditor({
  book,
  scene,
  defaultChapterId,
  actions,
  onClose,
}: {
  book: StoryBookDto;
  scene: StorySceneDto | null;
  defaultChapterId: string | null;
  actions: StoryActions;
  onClose: () => void;
}) {
  const { play } = useSound();
  const toast = useToast();
  const [title, setTitle] = useState(scene?.title ?? '');
  const [text, setText] = useState(scene?.text ?? '');
  const [chapterId, setChapterId] = useState<string | null>(
    scene ? scene.chapterId : defaultChapterId,
  );
  const [mood, setMood] = useState(scene?.mood ?? '');
  const [povId, setPovId] = useState(scene?.povId ?? '');
  const [cast, setCast] = useState<string[]>(scene?.characterIds ?? []);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SceneSaveResultDto | null>(null);
  const speech = useSpeechRecognition((words) =>
    setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${words}`),
  );

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    speech.stop();
    try {
      const saved = await actions.saveScene(scene?.id ?? null, {
        title,
        text,
        chapterId,
        mood: mood || null,
        povId: povId || null,
        characterIds: cast,
      });
      play('saved');
      if (saved.newNames.length || saved.echoes.length) setResult(saved);
      else onClose();
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Dialog
        open
        onClose={onClose}
        title="Saved. A couple of things I noticed"
        description="Only suggestions. Take any, or none."
        footer={<Button onClick={onClose}>Done</Button>}
      >
        {result.newNames.length > 0 && (
          <div>
            <p className="text-sm font-bold">Names that aren't in your cast yet</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.newNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={async () => {
                    const updated = await actions.addCharacter({ name });
                    const created = updated.characters.find((c) => c.name === name);
                    if (created)
                      await actions.saveScene(result.scene.id, {
                        characterIds: [...new Set([...result.scene.characterIds, created.id])],
                      });
                    setResult({ ...result, newNames: result.newNames.filter((n) => n !== name) });
                    toast(`${name} joined the cast`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lavender/20 px-3 py-1.5 text-sm font-semibold text-lavender-deep ring-1 ring-lavender/40 hover:bg-lavender/30"
                >
                  <UserPlus className="size-4" /> {name}
                </button>
              ))}
            </div>
          </div>
        )}
        {result.echoes.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-bold">This scene seems to rhyme with</p>
            <ul className="mt-2 flex flex-col gap-2">
              {result.echoes.map((echo) => (
                <li
                  key={echo.sceneId}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/4 p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{echo.title}</span>
                    <span className="text-xs text-ink-soft">shares {echo.shared.join(', ')}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="soft"
                    icon={<Sparkles className="size-4" />}
                    onClick={async () => {
                      const later = echo.type === 'foreshadowing';
                      await actions.addLink({
                        fromSceneId: later ? result.scene.id : echo.sceneId,
                        toSceneId: later ? echo.sceneId : result.scene.id,
                        type: echo.type,
                        note: `Both mention ${echo.shared.slice(0, 2).join(' and ')}.`,
                      });
                      setResult({
                        ...result,
                        echoes: result.echoes.filter((e) => e.sceneId !== echo.sceneId),
                      });
                      play('pluck');
                    }}
                  >
                    Mark as {echo.type}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width="max-w-3xl"
      title={scene ? 'Edit scene' : 'New scene'}
      description="Write it in any order. It can float until you know where it goes."
      footer={
        <>
          {scene && (
            <Button
              variant="ghost"
              icon={<Trash2 className="size-4" />}
              className="mr-auto"
              onClick={async () => {
                if (!window.confirm(`Delete “${scene.title}”? This can't be undone.`)) return;
                await actions.deleteScene(scene.id);
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!text.trim() || saving} sound={false}>
            {saving ? 'Saving…' : 'Save scene'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          aria-label="Scene title"
        />
        <div className="relative">
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What happens?"
            rows={10}
            aria-label="Scene text"
            className="font-display text-[1.05rem]"
          />
          {speech.interim && (
            <p className="pointer-events-none absolute bottom-3 left-4 right-4 truncate text-sm italic text-ink-faint">
              {speech.interim}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {speech.supported && (
            <Button
              size="sm"
              variant={speech.listening ? 'danger' : 'soft'}
              icon={speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              sound={speech.listening ? 'stop' : 'start'}
            >
              {speech.listening ? 'Stop dictating' : 'Dictate'}
            </Button>
          )}
          {scene && (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<Wand2 className="size-4" />}
                onClick={async () => {
                  await actions.tidyScene(scene.id);
                  toast('Tidied the dictation: fillers and repeats out, your words kept.');
                  onClose();
                }}
              >
                Tidy dictation
              </Button>
              {scene.originalText !== scene.text && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw className="size-4" />}
                  onClick={async () => {
                    await actions.restoreScene(scene.id);
                    onClose();
                  }}
                >
                  First draft
                </Button>
              )}
            </>
          )}
          {speech.error && <p className="text-xs text-rose-deep">{speech.error}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-bold">
            Chapter
            <Select
              value={chapterId ?? ''}
              onChange={(e) => setChapterId(e.target.value || null)}
              className="mt-1.5"
            >
              <option value="">Floating, not placed yet</option>
              {book.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number}. {c.title}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-bold">
            Point of view
            <Select value={povId} onChange={(e) => setPovId(e.target.value)} className="mt-1.5">
              <option value="">Not set</option>
              {book.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-bold">
            Feeling
            <TextInput
              list="scene-moods"
              value={mood}
              onChange={(e) => setMood(e.target.value.toLowerCase())}
              className="mt-1.5"
              placeholder="tense, tender…"
            />
            <datalist id="scene-moods">
              {BASE_EMOTION_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {emotionMeta(tag).label}
                </option>
              ))}
            </datalist>
          </label>
        </div>

        {book.characters.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold">In this scene</p>
            <div className="flex flex-wrap gap-1.5">
              {book.characters.map((c) => {
                const on = cast.includes(c.id) || povId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setCast((list) =>
                        list.includes(c.id) ? list.filter((x) => x !== c.id) : [...list, c.id],
                      )
                    }
                    className={`rounded-full px-3 py-1 text-sm font-semibold transition ${on ? 'bg-snow text-abyss' : 'bg-white/6 text-ink-soft hover:text-ink'}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
