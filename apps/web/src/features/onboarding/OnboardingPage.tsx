import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, KeyRound, Mic, ShieldCheck, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProfileDto } from '@living-draft/contracts';
import { authKey, useAuthStatus } from '../../api/auth';
import { api } from '../../api/client';
import { keys } from '../../api/hooks';
import { Core, type CoreState } from '../../components/core/Core';
import { Button } from '../../components/ui/Button';
import { Field, Segmented, TextInput, Toggle } from '../../components/ui/controls';
import { haptic } from '../../lib/haptics';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import type { MoodKey } from '../../lib/mood/moods';
import { useSound } from '../../lib/sound/SoundProvider';

const OPENING = [
  'Every life is a story.',
  'Some chapters are clear, some are forgotten,',
  'and some are still being written.',
];

const STEP_MOODS: MoodKey[] = ['cosmos', 'nostalgic', 'peaceful', 'grateful', 'anxious', 'proud'];

interface Draft {
  preferredName: string;
  currentAge: string;
  birthDate: string;
  pronouns: string;
  gender: string;
  narrativeVoice: 'first' | 'third';
  hemisphere: ProfileDto['hemisphere'];
  passphrase: string;
  confirm: string;
  artOnline: boolean;
  locationMode: 'home' | 'travel' | 'off';
}

const LOCATION_CHOICES: Array<{ value: Draft['locationMode']; title: string; text: string }> = [
  {
    value: 'home',
    title: 'Share it once',
    text: 'Your rough area is saved as home, for local weather and time of day. The app never tracks you after that.',
  },
  {
    value: 'travel',
    title: 'While I’m using the app',
    text: 'Home stays saved, and when you travel the weather follows where you are. Only checked while the app is open.',
  },
  {
    value: 'off',
    title: 'Don’t use my location',
    text: 'Nothing is asked. You can type a town in Settings whenever you like.',
  },
];

function roughPosition(): Promise<{ lat: number; lon: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: Math.round(p.coords.latitude * 10) / 10,
          lon: Math.round(p.coords.longitude * 10) / 10,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 60 * 60_000, timeout: 15_000 },
    ),
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    preferredName: '',
    currentAge: '',
    birthDate: '',
    pronouns: '',
    gender: '',
    narrativeVoice: 'first',
    hemisphere: 'unknown',
    passphrase: '',
    confirm: '',
    artOnline: true,
    locationMode: 'home',
  });
  const navigate = useNavigate();
  const client = useQueryClient();
  const { play } = useSound();
  const { data: auth } = useAuthStatus();
  const needsPassphrase = !auth?.configured;
  const [named, setNamed] = useState(false);
  if (!named && auth?.name && !draft.preferredName) {
    setNamed(true);
    setDraft((d) => ({ ...d, preferredName: auth.name ?? '' }));
  }
  useAtmosphere({
    mood: STEP_MOODS[step] ?? 'cosmos',
    intensity: 0.35 + step * 0.1,
    seed: step * 7 + 1,
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const next = () => {
    play('shift');
    setStep((s) => s + 1);
  };
  const back = () => {
    play('shift');
    setStep((s) => Math.max(0, s - 1));
  };

  const ageNumber = Number(draft.currentAge);
  const ageFromBirth = draft.birthDate
    ? Math.floor((now - new Date(draft.birthDate).getTime()) / (365.2425 * 864e5))
    : null;
  const canContinueName =
    draft.preferredName.trim().length > 0 &&
    ((ageNumber >= 1 && ageNumber <= 120) || (ageFromBirth !== null && ageFromBirth >= 1));
  const passphraseOk =
    !needsPassphrase || (draft.passphrase.length >= 8 && draft.passphrase === draft.confirm);

  const finish = async (destination: string) => {
    setSaving(true);
    setError(null);
    try {
      if (needsPassphrase) {
        const status = await api.post<{ configured: boolean; authenticated: boolean }>(
          '/auth/setup',
          { passphrase: draft.passphrase },
        );
        client.setQueryData(authKey, status);
      }
      const spot = draft.locationMode === 'off' ? null : await roughPosition();
      const profile = await api.post<ProfileDto>('/profile', {
        locationMode: draft.locationMode,
        ...(spot ? { placeLat: spot.lat, placeLon: spot.lon, weatherOn: true } : {}),
        preferredName: draft.preferredName.trim(),
        currentAge: ageFromBirth ?? ageNumber,
        birthDate: draft.birthDate || null,
        pronouns: draft.pronouns.trim() || null,
        gender: draft.gender.trim() || null,
        narrativeVoice: draft.narrativeVoice,
        hemisphere: draft.hemisphere,
        artOnline: draft.artOnline,
      });
      client.setQueryData(keys.profile, profile);
      play('saved');
      haptic('saved');
      void navigate(destination, { viewTransition: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Try again?');
      setSaving(false);
    }
  };

  const coreState: CoreState =
    step === 0 ? 'ready' : step === 5 ? 'saved' : step === 4 ? 'organizing' : 'listening';

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div layout className="mb-6">
          <Core state={coreState} size={step === 0 ? 190 : 120} />
        </motion.div>

        <ol className="mb-6 flex gap-2" aria-label={`Step ${step + 1} of 6`}>
          {STEP_MOODS.map((mood, i) => (
            <li
              key={mood}
              className={`h-1 rounded-full transition-all duration-700 ${i === step ? 'w-8 bg-snow shadow-[0_0_12px_var(--mood-c)]' : i < step ? 'w-3 bg-lavender-deep/70' : 'w-3 bg-white/15'}`}
            />
          ))}
        </ol>

        <AnimatePresence mode="wait">
          <motion.section
            key={step}
            initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full ${step === 0 ? 'text-center' : 'paper rounded-[2rem] p-7 sm:p-9'}`}
            aria-labelledby={`step-${step}`}
          >
            {step === 0 && (
              <>
                <h1 id="step-0" className="sr-only">
                  Welcome to The Living Draft
                </h1>
                <div className="space-y-2 font-display text-3xl leading-snug sm:text-4xl">
                  {OPENING.map((line, i) => (
                    <motion.p
                      key={line}
                      className={i === 2 ? 'aurora-text' : ''}
                      initial={{ opacity: 0, filter: 'blur(10px)', y: 8 }}
                      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                      transition={{ delay: 0.4 + i * 1.1, duration: 1.3 }}
                    >
                      {line}
                    </motion.p>
                  ))}
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3.8 }}
                  className="mt-10"
                >
                  <Button
                    size="lg"
                    onClick={next}
                    sound="zoomIn"
                    icon={<Sparkles className="size-5" />}
                  >
                    Begin
                  </Button>
                </motion.div>
              </>
            )}

            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canContinueName) next();
                }}
                className="flex flex-col gap-5"
              >
                <p className="eyebrow">The storyteller</p>
                <h1 id="step-1" className="-mt-3 text-3xl font-semibold">
                  Who's telling this story?
                </h1>
                <Field label="What should I call you?" htmlFor="name">
                  <TextInput
                    id="name"
                    autoFocus
                    value={draft.preferredName}
                    onChange={(e) => set('preferredName', e.target.value)}
                    placeholder="Your name"
                    autoComplete="given-name"
                  />
                </Field>
                <Field
                  label="How old are you?"
                  htmlFor="age"
                  hint="This sets how many chapters your path has."
                >
                  <TextInput
                    id="age"
                    inputMode="numeric"
                    value={draft.currentAge}
                    onChange={(e) =>
                      set('currentAge', e.target.value.replace(/\D/g, '').slice(0, 3))
                    }
                    placeholder="23"
                  />
                </Field>
                <Field
                  label="Birthday (optional)"
                  htmlFor="dob"
                  hint="Only if you want exact dates to land in the right chapter. Your age alone works fine."
                >
                  <TextInput
                    id="dob"
                    type="date"
                    value={draft.birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set('birthDate', e.target.value)}
                  />
                </Field>
                <StepNav onBack={back} canNext={canContinueName} />
              </form>
            )}

            {step === 2 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
                className="flex flex-col gap-5"
              >
                <p className="eyebrow">The voice</p>
                <h1 id="step-2" className="-mt-3 text-3xl font-semibold">
                  How should your story sound?
                </h1>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Pronouns (optional)" htmlFor="pronouns">
                    <TextInput
                      id="pronouns"
                      value={draft.pronouns}
                      onChange={(e) => set('pronouns', e.target.value)}
                      placeholder="she/her, they/them…"
                      list="pronoun-options"
                    />
                    <datalist id="pronoun-options">
                      <option value="she/her" />
                      <option value="he/him" />
                      <option value="they/them" />
                      <option value="Prefer not to say" />
                    </datalist>
                  </Field>
                  <Field label="Gender (optional)" htmlFor="gender">
                    <TextInput
                      id="gender"
                      value={draft.gender}
                      onChange={(e) => set('gender', e.target.value)}
                      placeholder="Prefer not to say"
                    />
                  </Field>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold">When I read your story back to you</p>
                  <Segmented
                    label="Narrative voice"
                    value={draft.narrativeVoice}
                    onChange={(v) => set('narrativeVoice', v)}
                    options={[
                      { value: 'first', label: 'In your words' },
                      { value: 'third', label: 'As a narrator' },
                    ]}
                  />
                  <p className="neon mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-display text-lg italic text-ink">
                    {draft.narrativeVoice === 'first'
                      ? '“I remember the smell of the lake.”'
                      : `“${draft.preferredName.split(' ')[0] || 'They'} remember${draft.preferredName ? 's' : ''} the smell of the lake.”`}
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    This only changes playback. What you actually said is never rewritten.
                  </p>
                </div>
                <StepNav onBack={back} canNext />
              </form>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-5">
                <p className="eyebrow">The seasons</p>
                <h1 id="step-3" className="-mt-3 text-3xl font-semibold">
                  Where did your seasons happen?
                </h1>
                <p className="text-ink-soft">
                  “Summer” means different months in different places. Knowing this lets me sort
                  memories by month as well as season. You can skip it.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['north', 'Northern hemisphere', 'Summer is June to August'],
                      ['south', 'Southern hemisphere', 'Summer is December to February'],
                      ['none', 'No real seasons', 'Tropics, or it just varied'],
                      ['unknown', 'Rather not say', 'Seasons stay as you say them'],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={draft.hemisphere === value}
                      onClick={() => set('hemisphere', value)}
                      className={`rounded-2xl border p-4 text-left transition ${draft.hemisphere === value ? 'glow-ring border-lavender-deep/60 bg-lavender/15' : 'border-white/10 hover:border-white/25 hover:bg-white/5'}`}
                    >
                      <span className="block font-bold">{label}</span>
                      <span className="text-sm text-ink-soft">{hint}</span>
                    </button>
                  ))}
                </div>
                <StepNav onBack={back} onNext={next} canNext />
              </div>
            )}

            {step === 4 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (passphraseOk) next();
                }}
                className="flex flex-col gap-5"
              >
                <p className="eyebrow">Private by design</p>
                <h1 id="step-4" className="-mt-3 text-3xl font-semibold">
                  Yours, and locked
                </h1>
                <ul className="space-y-3 text-[0.95rem]">
                  <Point icon={ShieldCheck} tone="text-sage-deep">
                    Memories, photos and recordings live on this computer. No feed, nothing public.
                  </Point>
                  <Point icon={ShieldCheck} tone="text-sage-deep">
                    The writing helper and narrator run on this computer too. Your memories are not
                    sent to an AI company.
                  </Point>
                  <Point icon={Mic} tone="text-peach-deep">
                    Live transcription uses your browser's speech service. In Chrome that sends
                    audio to Google. If you'd rather not, type instead.
                  </Point>
                </ul>

                {needsPassphrase && (
                  <div className="rounded-2xl border border-white/10 bg-abyss/50 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-bold">
                      <KeyRound className="size-4 text-lavender-deep" aria-hidden="true" />
                      Choose a password to open your notebook
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Password" htmlFor="pass" hint="At least 8 characters.">
                        <TextInput
                          id="pass"
                          type="password"
                          autoComplete="new-password"
                          value={draft.passphrase}
                          onChange={(e) => set('passphrase', e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Once more"
                        htmlFor="pass2"
                        hint={
                          draft.confirm && draft.confirm !== draft.passphrase
                            ? "These don't match yet."
                            : ' '
                        }
                      >
                        <TextInput
                          id="pass2"
                          type="password"
                          autoComplete="new-password"
                          value={draft.confirm}
                          onChange={(e) => set('confirm', e.target.value)}
                        />
                      </Field>
                    </div>
                    <p className="mt-2 text-xs text-ink-faint">
                      There's no reset email: nothing leaves this computer. Keep it somewhere you
                      trust.
                    </p>
                  </div>
                )}

                <fieldset className="rounded-2xl border border-white/10 bg-abyss/50 p-4">
                  <legend className="px-1 text-sm font-bold">Can the app use your location?</legend>
                  <div className="mt-2 flex flex-col gap-2">
                    {LOCATION_CHOICES.map((choice) => (
                      <label
                        key={choice.value}
                        className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${draft.locationMode === choice.value ? 'border-lavender-deep bg-lavender/15' : 'border-white/10 hover:border-white/25'}`}
                      >
                        <input
                          type="radio"
                          name="location"
                          className="mt-1 size-4"
                          checked={draft.locationMode === choice.value}
                          onChange={() => set('locationMode', choice.value)}
                        />
                        <span>
                          <span className="block font-semibold">{choice.title}</span>
                          <span className="text-sm text-ink-soft">{choice.text}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    Only an area rounded to about 10 km is kept, and it&apos;s only ever sent to the
                    free Open-Meteo weather service. You can change this in Settings.
                  </p>
                </fieldset>

                <div className="rounded-2xl border border-white/10 bg-abyss/50 p-4">
                  <Toggle
                    label="Illustrate my pages"
                    description="A few times a day, the free Pollinations service paints an illustration for a page. It only ever gets a short scene description, like “lake at dusk, winter, soft light”, never your words or names. Turn it off and every page gets a sketch drawn right here instead."
                    checked={draft.artOnline}
                    onChange={(v) => set('artOnline', v)}
                  />
                </div>
                <StepNav onBack={back} canNext={passphraseOk} nextLabel="Sounds good" />
              </form>
            )}

            {step === 5 && (
              <div className="flex flex-col items-center gap-5 text-center">
                <p className="eyebrow">Ready</p>
                <h1 id="step-5" className="-mt-3 text-3xl font-semibold">
                  Your path is ready, {draft.preferredName.split(' ')[0]}
                </h1>
                <p className="text-ink-soft">
                  {ageFromBirth ?? ageNumber} chapters, from your first year to now. Empty years are
                  fine. Start anywhere.
                </p>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    size="lg"
                    onClick={() => finish('/capture')}
                    disabled={saving}
                    icon={<Mic className="size-5" />}
                    sound="start"
                  >
                    Capture your first memory
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => finish('/')}
                    disabled={saving}
                    sound="zoomIn"
                  >
                    Explore your path
                  </Button>
                </div>
                {error && <p className="text-sm font-semibold text-rose-deep">{error}</p>}
                <button
                  type="button"
                  onClick={back}
                  className="text-sm font-semibold text-ink-soft hover:text-ink"
                >
                  Go back
                </button>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Point({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof ShieldCheck;
  tone: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function StepNav({
  onBack,
  onNext,
  canNext,
  nextLabel = 'Continue',
}: {
  onBack: () => void;
  onNext?: () => void;
  canNext: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <Button
        variant="ghost"
        onClick={onBack}
        icon={<ArrowLeft className="size-4" />}
        sound={false}
      >
        Back
      </Button>
      <Button
        type={onNext ? 'button' : 'submit'}
        onClick={onNext}
        disabled={!canNext}
        sound={false}
      >
        {nextLabel}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
