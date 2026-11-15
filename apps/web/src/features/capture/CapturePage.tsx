import { readLocal, writeLocal } from '../../lib/storage';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Image as ImageIcon,
  Mic,
  Pause,
  PenLine,
  Play,
  Square,
  Video,
  X,
} from 'lucide-react';
import type { CaptureAnalysisDto, ConnectionDto, MemoryDetailDto } from '@living-draft/contracts';
import { api, uploadMedia } from '../../api/client';
import { useInvalidateArchive, useMemory, useProfile, usePrompts } from '../../api/hooks';
import { Ambience } from '../../components/decor/Ambience';
import { Core, type CoreState } from '../../components/core/Core';
import { InkPad } from '../../components/media/InkPad';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { haptic } from '../../lib/haptics';
import { formatDuration, useRecorder, type Recording } from '../../lib/recorder';
import { useScene, useSound } from '../../lib/sound/SoundProvider';
import { useSpeechRecognition } from '../../lib/speech';
import { momentPrompts } from '@living-draft/engine';
import { useWorld } from '../../lib/world/world';
import { ReviewCapsule, ReviewReflection } from './OtherReviews';
import { ReviewMemory, type ReviewResult } from './ReviewMemory';
import { aiUsable, understand, useAiJob, useAiStatus } from '../../api/ai';
import { SavedScreen } from './SavedScreen';
import { useAttachments, type CaptureKind } from './useCaptureDraft';
import { VideoNoteDialog } from './VideoNoteDialog';

type Step = 'record' | 'organizing' | 'review' | 'saved';

const KINDS: Array<{ value: CaptureKind; label: string; hint: string }> = [
  { value: 'memory', label: 'Memory', hint: 'Something that happened' },
  { value: 'reflection', label: 'Reflection', hint: 'How you see things now' },
  { value: 'capsule', label: 'Time capsule', hint: 'A note for future you' },
];

const PLACEHOLDER: Record<CaptureKind, string> = {
  memory: 'Start anywhere. “When I was about eight…” or “I don’t know when, but…”',
  reflection: 'What are you thinking about? It can be about an old memory or about today.',
  capsule: 'Dear future me…',
};

export default function CapturePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidateArchive();
  const { play } = useSound();
  const { data: profile } = useProfile();
  const world = useWorld();
  const presetMemoryId = params.get('memoryId');
  const presetAge = params.get('age') !== null ? Number(params.get('age')) : null;
  const { data: target } = useMemory(presetMemoryId ?? undefined);
  const [promptTopic, setPromptTopic] = useState<string | undefined>(undefined);
  const { data: listed, refetch: shufflePrompts } = usePrompts(promptTopic, 3);
  const prompts = listed
    ? promptTopic === undefined
      ? [...momentPrompts(world.part, world.kind).slice(0, 1), ...listed].slice(0, 3)
      : listed
    : undefined;

  const { data: aiStatus } = useAiStatus();
  const [jobId, setJobId] = useState<string | null>(null);
  const [rewriteId, setRewriteId] = useState<string | null>(null);
  const { data: job } = useAiJob(jobId);
  const { data: rewrite } = useAiJob(rewriteId);
  const askAgain = (body: {
    memoryId?: string;
    answers?: Array<{ question: string; answer: string }>;
  }) =>
    understand({ text: text.trim(), notes: false, ...body })
      .then((next) => setRewriteId(next.id))
      .catch(() => undefined);

  const [kind, setKind] = useState<CaptureKind>((params.get('type') as CaptureKind) || 'memory');
  const [step, setStep] = useState<Step>('record');
  const draftKey = `capture-draft:${presetMemoryId ?? 'new'}`;
  const [text, setText] = useState(() => readLocal(draftKey) ?? '');

  useEffect(() => {
    const later = window.setTimeout(() => writeLocal(draftKey, text.trim() ? text : null), 400);
    return () => window.clearTimeout(later);
  }, [text, draftKey]);
  const [sourceKind, setSourceKind] = useState<'speech' | 'typing'>('typing');
  const [analysis, setAnalysis] = useState<CaptureAnalysisDto | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{
    memory?: MemoryDetailDto;
    updated?: boolean;
    suggestions?: ConnectionDto[];
    label: string;
  } | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(params.get('prompt'));
  const [inking, setInking] = useState(false);
  const attachments = useAttachments();
  const recorder = useRecorder();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useScene('studio');
  const speech = useSpeechRecognition((final) => {
    setSourceKind('speech');
    setText((current) => {
      const joiner = current && !/\s$/.test(current) ? ' ' : '';
      return `${current}${joiner}${final}`;
    });
  });

  const listening = recorder.state === 'recording' || speech.listening;
  const coreState: CoreState =
    step === 'organizing'
      ? 'organizing'
      : step === 'saved'
        ? 'saved'
        : listening
          ? 'listening'
          : 'ready';

  const startListening = async () => {
    const started = await recorder.start();
    if (!started && !speech.supported) return;
    speech.start();
    play('start');
    haptic('start');
  };

  const stopListening = async () => {
    speech.stop();
    const result = await recorder.stop();
    if (result) setRecording(result);
    play('stop');
    haptic('stop');
  };

  const togglePause = () => {
    if (recorder.state === 'recording') {
      recorder.pause();
      speech.stop();
    } else if (recorder.state === 'paused') {
      recorder.resume();
      speech.start();
    }
  };

  const organize = async () => {
    if (listening || recorder.state === 'paused') await stopListening();
    const content = text.trim();
    if (!content) return;
    setStep('organizing');
    play('shift');
    const started = Date.now();
    try {
      const result = await api.post<CaptureAnalysisDto>('/memories/analyze', {
        text: content,
        kind,
        memoryId: presetMemoryId ?? undefined,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 1500 - (Date.now() - started))),
      );
      setAnalysis(result);
      setJobId(null);
      setRewriteId(null);
      if (kind === 'memory' && aiUsable(aiStatus))
        understand({ text: content, memoryId: presetMemoryId ?? undefined })
          .then((job) => setJobId(job.id))
          .catch(() => undefined);
      setStep('review');
      play('deny');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not organize that', 'error');
      setStep('record');
    }
  };

  const audioId = async (): Promise<string | null> => {
    if (!recording || profile?.keepAudio === false) return null;
    const media = await uploadMedia(recording.blob, {
      name: `telling.${recording.mimeType.includes('mp4') ? 'm4a' : 'webm'}`,
      durationMs: recording.durationMs,
      caption: 'The original telling',
    });
    return media.id;
  };

  const saveMemory = async (result: ReviewResult) => {
    setSaving(true);
    try {
      const audio = await audioId();
      const common = {
        originalText: text.trim(),
        readingCopy: result.readingCopy,
        sourceKind,
        people: result.people,
        emotions: result.emotions,
        mediaIds: attachments.mediaIds,
        audioId: audio,
        context: world.context(),
        understanding: result.understanding,
      };
      if (result.target === 'new') {
        const memory = await api.post<MemoryDetailDto>('/memories', {
          ...common,
          title: result.title,
          temporal: result.temporal,
          milestoneIds: result.milestoneIds,
          newMilestones: result.newMilestones,
          place: result.place,
          sensitive: result.sensitive,
        });
        const suggestions = await api
          .post<ConnectionDto[]>('/connections/suggest', { memoryIds: [memory.id] })
          .catch(() => []);
        setSaved({ memory, suggestions, label: 'Memory added' });
      } else {
        const response = await api.post<{ memory: MemoryDetailDto }>(
          `/memories/${result.target.memoryId}/versions`,
          { ...common, mode: result.target.mode },
        );
        setSaved({ memory: response.memory, updated: true, label: 'Memory updated' });
      }
      invalidate();
      writeLocal(draftKey, null);
      setStep('saved');
      play('saved');
      haptic('saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveOther = async (payload: {
    path: string;
    body: Record<string, unknown>;
    label: string;
  }) => {
    setSaving(true);
    try {
      const audio = await audioId();
      await api.post(payload.path, { ...payload.body, originalText: text.trim(), audioId: audio });
      invalidate();
      setSaved({ label: payload.label });
      writeLocal(draftKey, null);
      setStep('saved');
      play(kind === 'capsule' ? 'seal' : 'saved');
      haptic('saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    recorder.cancel();
    speech.stop();
    play('close');
    if (window.history.length > 1) void navigate(-1);
    else void navigate('/');
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_top,#221d2b_0%,#17151c_50%,#0c0a10_100%)]">
      <Ambience kind="dust" density={0.6} />
      <header className="relative z-20 flex items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={close}
          aria-label="Close and go back"
          className="inline-flex size-11 items-center justify-center rounded-full bg-paper/70 text-ink-soft shadow-sm hover:text-ink"
        >
          <X className="size-5" />
        </button>
        {step === 'record' && !presetMemoryId ? (
          <div
            role="tablist"
            aria-label="What are you capturing?"
            className="flex rounded-full bg-paper/70 p-1 shadow-sm"
          >
            {KINDS.map((k) => (
              <button
                key={k.value}
                role="tab"
                aria-selected={kind === k.value}
                title={k.hint}
                onClick={() => {
                  play('tap');
                  setKind(k.value);
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition sm:px-4 ${kind === k.value ? 'bg-snow text-abyss shadow-[0_0_22px_-6px_var(--mood-c)]' : 'text-ink-soft hover:text-ink'}`}
              >
                {k.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="font-display text-lg font-semibold">
            {step === 'review' ? 'Check it over' : ''}
          </p>
        )}
        <span className="w-11" />
      </header>

      <AnimatePresence mode="wait">
        {(step === 'record' || step === 'organizing') && (
          <motion.div
            key="studio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-2 sm:px-6"
          >
            {target && (
              <p className="mb-2 rounded-full bg-lavender/40 px-4 py-1.5 text-sm font-semibold text-lavender-deep">
                Adding to “{target.title}”
              </p>
            )}
            <h1 className="sr-only">Capture a {kind}</h1>
            <Core state={coreState} size={150} level={recorder.level} />
            <p className="mt-2 min-h-6 text-center eyebrow" aria-live="polite">
              {step === 'organizing'
                ? 'Reading it back. Working out when it happened, who was there, and how it felt…'
                : listening
                  ? recorder.state === 'paused'
                    ? 'Paused. Take your time.'
                    : speech.supported
                      ? 'Listening. Words appear as you talk.'
                      : 'Recording. Type along, or type it after.'
                  : 'Ready when you are'}
            </p>

            {step === 'record' && (
              <div className="mt-6 flex items-center gap-4">
                {listening || recorder.state === 'paused' ? (
                  <>
                    <button
                      type="button"
                      onClick={togglePause}
                      aria-label={recorder.state === 'paused' ? 'Resume' : 'Pause'}
                      className="flex size-12 items-center justify-center rounded-full bg-paper text-ink shadow-paper"
                    >
                      {recorder.state === 'paused' ? (
                        <Play className="size-5" />
                      ) : (
                        <Pause className="size-5" />
                      )}
                    </button>
                    <MicOrb
                      active
                      level={recorder.level}
                      onClick={stopListening}
                      label="Stop recording"
                      icon={<Square className="size-7 fill-current" />}
                    />
                    <span className="w-12 text-center text-sm font-bold tabular-nums text-ink-soft">
                      {formatDuration(recorder.elapsed)}
                    </span>
                  </>
                ) : (
                  <MicOrb
                    active={false}
                    level={0}
                    onClick={startListening}
                    label="Start talking"
                    icon={<Mic className="size-8" />}
                  />
                )}
              </div>
            )}
            {(recorder.error || speech.error) && (
              <p className="mt-3 max-w-md text-center text-sm font-semibold text-peach-deep">
                {recorder.error ?? speech.error}
              </p>
            )}
            {!speech.supported && step === 'record' && !listening && (
              <p className="mt-3 max-w-md text-center text-xs text-ink-soft">
                This browser can record your voice but can't transcribe it live. Chrome and Edge
                can. You can always type.
              </p>
            )}

            <div className="relative mt-8 w-full">
              {prompt && (
                <p className="mb-3 flex items-start gap-2 eyebrow">
                  <span aria-hidden="true">“</span>
                  {prompt}
                  <button
                    type="button"
                    onClick={() => setPrompt(null)}
                    aria-label="Dismiss prompt"
                    className="ml-auto text-base text-ink-faint hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </p>
              )}
              <div className="paper relative rounded-[1.75rem] px-6 pb-5 pt-8 sm:px-10">
                <span
                  className="absolute -left-1 top-10 bottom-10 w-2 rounded-full bg-rose/50"
                  aria-hidden="true"
                />
                <label htmlFor="capture-text" className="sr-only">
                  Your {kind}
                </label>
                <textarea
                  id="capture-text"
                  ref={textRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (!listening) setSourceKind('typing');
                  }}
                  placeholder={PLACEHOLDER[kind]}
                  rows={8}
                  disabled={step === 'organizing'}
                  className="ruled w-full resize-none bg-transparent font-display text-xl text-ink placeholder:text-ink-faint focus:outline-none"
                />
                {speech.interim && (
                  <p className="-mt-2 font-display text-xl italic text-ink-faint">
                    {speech.interim}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/8 pt-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      for (const file of Array.from(e.target.files ?? []))
                        void attachments.add(file, { name: file.name });
                      e.target.value = '';
                    }}
                  />
                  {kind === 'memory' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<ImageIcon className="size-4" />}
                        onClick={() => fileRef.current?.click()}
                      >
                        Photos, video, audio
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<PenLine className="size-4" />}
                        onClick={() => setInking(true)}
                      >
                        Handwrite
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Video className="size-4" />}
                        onClick={() => setVideoOpen(true)}
                      >
                        Video note
                      </Button>
                    </>
                  )}
                  {recording && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-sage/30 px-3 py-1 text-xs font-bold text-sage-deep">
                      <Mic className="size-3.5" /> {formatDuration(recording.durationMs)} recorded
                      {profile?.keepAudio === false ? ' (not kept)' : ''}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-ink-faint">
                    {text.trim() ? `${text.trim().split(/\s+/).length} words` : ''}
                  </span>
                </div>
                {attachments.items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachments.items.map((item) => (
                      <div
                        key={item.localId}
                        className="group relative size-20 overflow-hidden rounded-xl bg-dusk shadow"
                      >
                        {item.kind === 'photo' ? (
                          <img src={item.previewUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-xs font-bold text-snow">
                            {item.kind}
                          </span>
                        )}
                        {!item.media && !item.error && (
                          <span className="anim-shimmer absolute inset-0" />
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => attachments.remove(item.localId)}
                          className="absolute right-1 top-1 rounded-full bg-night/70 p-0.5 text-snow"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!text && step === 'record' && kind === 'memory' && prompts && (
                <div className="mt-5">
                  <p className="mb-2 text-center text-sm font-semibold text-ink-soft">
                    Need a nudge? Pick a thread to pull, or skip it.
                  </p>
                  <div
                    className="mb-3 flex flex-wrap justify-center gap-1.5"
                    role="group"
                    aria-label="Prompt topics"
                  >
                    {[
                      { value: undefined, label: 'Anything' },
                      { value: 'place', label: 'Places' },
                      { value: 'period', label: 'Times' },
                      { value: 'people', label: 'People' },
                      { value: 'emotion', label: 'Feelings' },
                    ].map((topic) => (
                      <button
                        key={topic.label}
                        type="button"
                        aria-pressed={promptTopic === topic.value}
                        onClick={() => {
                          if (promptTopic === topic.value) void shufflePrompts();
                          setPromptTopic(topic.value);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${promptTopic === topic.value ? 'bg-snow text-abyss' : 'bg-white/6 text-ink-soft hover:text-ink'}`}
                      >
                        {topic.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {prompts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          play('tap');
                          setPrompt(p.text);
                          textRef.current?.focus();
                        }}
                        className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-white/25 hover:text-ink"
                      >
                        {p.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {step === 'record' && (
              <div className="mt-8">
                <Button
                  size="lg"
                  onClick={organize}
                  disabled={!text.trim() || !attachments.ready}
                  sound={false}
                >
                  {kind === 'memory' ? 'Done, find its place' : 'Done'}
                  <ArrowRight className="size-5" />
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {step === 'review' && analysis && kind === 'memory' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <ReviewMemory
              original={text.trim()}
              analysis={analysis}
              attachments={attachments.items}
              presetAge={presetAge}
              presetMemoryId={presetMemoryId}
              saving={saving}
              onSave={saveMemory}
              onBack={() => setStep('record')}
              ai={aiStatus ?? null}
              job={job ?? null}
              rewrite={rewrite ?? null}
              onAskAgain={askAgain}
            />
          </motion.div>
        )}

        {step === 'review' && analysis && kind === 'reflection' && (
          <motion.div
            key="reflection"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10"
          >
            <ReviewReflection
              analysis={analysis}
              saving={saving}
              onBack={() => setStep('record')}
              onSave={(body) => saveOther({ path: '/reflections', body, label: 'Reflection kept' })}
            />
          </motion.div>
        )}

        {step === 'review' && analysis && kind === 'capsule' && (
          <motion.div
            key="capsule"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10"
          >
            <ReviewCapsule
              analysis={analysis}
              saving={saving}
              onBack={() => setStep('record')}
              onSave={(body) => saveOther({ path: '/capsules', body, label: 'Sealed for later' })}
            />
          </motion.div>
        )}

        {step === 'saved' && saved && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10"
          >
            <SavedScreen
              kind={kind}
              label={saved.label}
              memory={saved.memory}
              updated={saved.updated}
              suggestions={saved.suggestions ?? []}
              onAnother={() => {
                setText('');
                setRecording(null);
                setAnalysis(null);
                setSaved(null);
                setStep('record');
                void navigate('/capture', { replace: true });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <VideoNoteDialog
        open={videoOpen}
        onClose={() => setVideoOpen(false)}
        onDone={(clip) =>
          void attachments.add(clip.blob, {
            name: 'Video note.webm',
            durationMs: clip.durationMs,
            caption: 'Video note',
          })
        }
      />
      {inking && (
        <InkPad
          onClose={() => setInking(false)}
          onSave={(image, caption) => {
            void attachments.add(image, {
              name: 'Handwritten page.png',
              caption: caption || 'Handwritten page',
              kind: 'scan',
            });
            setInking(false);
          }}
        />
      )}
    </div>
  );
}

function MicOrb({
  active,
  level,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  level: number;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative flex size-28 items-center justify-center">
      {active &&
        [0, 1, 2].map((i) => (
          <span
            key={i}
            className="ripple-ring absolute inset-2 rounded-full border-2 border-rose-deep/50"
            style={{ animationDelay: `${i * 0.8}s` }}
            aria-hidden="true"
          />
        ))}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-rose/50 transition-transform duration-100"
        style={{
          transform: `scale(${active ? 0.85 + level * 0.6 : 0.8})`,
          opacity: active ? 0.7 : 0,
        }}
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`relative flex size-24 items-center justify-center rounded-full text-snow transition hover:scale-105 ${active ? 'bg-rose shadow-[0_0_60px_rgb(251_113_133/0.85)]' : 'anim-breathe btn-aurora'}`}
      >
        {icon}
      </button>
    </div>
  );
}
