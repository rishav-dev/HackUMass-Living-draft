import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  HardDrive,
  Image,
  KeyRound,
  Lock,
  Mic,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { ProfileDto } from '@living-draft/contracts';
import { resetArtRequests, useArtStatus } from '../../api/art';
import {
  useAuthStatus,
  useChangePassphrase,
  useEndOtherSessions,
  useLock,
  useSetPassphrase,
} from '../../api/auth';
import { api, downloadFromApi, ON_DEVICE } from '../../api/client';
import { keys, useProfile, useUpdateProfile } from '../../api/hooks';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Segmented, Select, TextInput, Toggle } from '../../components/ui/controls';
import { PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { sound } from '../../lib/sound/engine';
import { narrationSupported, narratorVoices, speak, stopSpeaking } from '../../lib/narration';
import {
  NARRATOR_DOWNLOAD,
  NARRATOR_VOICES,
  narratorCached,
  neuralVoice,
  neuralWanted,
  prepareNarrator,
  useNarratorState,
  type NarratorState,
} from '../../lib/voice/neural';
import { readLocal, writeLocal } from '../../lib/storage';
import { useScene } from '../../lib/sound/SoundProvider';
import { DevicesSection } from './DevicesSection';
import { PlaceSection } from './PlaceSection';

function Section({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className="paper rounded-3xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { data: profile } = useProfile();
  useScene('quiet');
  if (!profile) return <PaperLoading />;
  return <SettingsView profile={profile} />;
}

function SettingsView({ profile }: { profile: ProfileDto }) {
  const update = useUpdateProfile();
  const toast = useToast();
  const [you, setYou] = useState({
    preferredName: profile.preferredName,
    currentAge: String(profile.currentAge),
    birthDate: profile.birthDate ?? '',
    pronouns: profile.pronouns ?? '',
    gender: profile.gender ?? '',
  });
  const [deleting, setDeleting] = useState(false);
  const save = (patch: Partial<ProfileDto>) => update.mutate(patch);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:px-8">
      <h1 className="text-4xl font-semibold sm:text-5xl">Settings & privacy</h1>
      {profile.isSample && (
        <p className="mt-4 rounded-2xl bg-peach/45 px-4 py-3 text-sm font-semibold text-peach-deep">
          This is the sample archive. {profile.preferredName} and every memory here are made up for
          the demo. Delete everything below to start your own.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <Section title="You">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate(
                {
                  preferredName: you.preferredName.trim(),
                  currentAge: Number(you.currentAge),
                  birthDate: you.birthDate || null,
                  pronouns: you.pronouns.trim() || null,
                  gender: you.gender.trim() || null,
                },
                { onSuccess: () => toast('Saved.') },
              );
            }}
          >
            <Field label="Name" htmlFor="s-name">
              <TextInput
                id="s-name"
                value={you.preferredName}
                onChange={(e) => setYou({ ...you, preferredName: e.target.value })}
              />
            </Field>
            <Field label="Age" htmlFor="s-age">
              <TextInput
                id="s-age"
                inputMode="numeric"
                value={you.currentAge}
                onChange={(e) => setYou({ ...you, currentAge: e.target.value.replace(/\D/g, '') })}
              />
            </Field>
            <Field label="Birthday (optional)" htmlFor="s-dob">
              <TextInput
                id="s-dob"
                type="date"
                value={you.birthDate}
                onChange={(e) => setYou({ ...you, birthDate: e.target.value })}
              />
            </Field>
            <Field label="Pronouns (optional)" htmlFor="s-pro">
              <TextInput
                id="s-pro"
                value={you.pronouns}
                onChange={(e) => setYou({ ...you, pronouns: e.target.value })}
              />
            </Field>
            <Field label="Gender (optional)" htmlFor="s-gender">
              <TextInput
                id="s-gender"
                value={you.gender}
                onChange={(e) => setYou({ ...you, gender: e.target.value })}
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={!you.preferredName.trim() || !you.currentAge}>
                Save
              </Button>
            </div>
          </form>
        </Section>

        <Section title="Look, sound and motion">
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-sm font-bold">Playback voice</p>
              <Segmented
                label="Narrative voice"
                value={profile.narrativeVoice}
                onChange={(v) => save({ narrativeVoice: v })}
                options={[
                  { value: 'first', label: 'In my words (“I”)' },
                  { value: 'third', label: `Narrator (“${profile.preferredName}”)` },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Motion</p>
              <Segmented
                label="Motion"
                value={profile.motion}
                onChange={(v) => save({ motion: v })}
                options={[
                  { value: 'system', label: 'Follow my device' },
                  { value: 'reduce', label: 'Calm' },
                  { value: 'full', label: 'Full' },
                ]}
              />
              <p className="mt-1.5 text-xs text-ink-soft">
                Calm keeps the page still: no sparks, drifting light, slow pans or page turns.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Page style</p>
              <Segmented
                label="Density"
                value={profile.density}
                onChange={(v) => save({ density: v })}
                options={[
                  { value: 'rich', label: 'Immersive' },
                  { value: 'simple', label: 'Simple, for reading' },
                ]}
              />
            </div>
            <Toggle
              checked={profile.soundEffects}
              onChange={(v) => save({ soundEffects: v })}
              label="Sparks and cues"
              description="Soft notes when you tap, a page turning between sections, and a small chime when something is saved."
            />
            <Toggle
              checked={profile.ambientSound}
              onChange={(v) => save({ ambientSound: v })}
              label="Living score"
              description="Quiet music that follows the feeling of each memory. It stays soft while you browse and comes forward when you open one. Memories you've kept quiet stay silent."
            />
            <GentleScore />
            <NarratorVoice name={profile.preferredName} />
            <div>
              <label htmlFor="volume" className="text-sm font-bold">
                Volume
              </label>
              <input
                id="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                defaultValue={profile.volume}
                onChange={(e) => sound.configure({ volume: Number(e.target.value) })}
                onPointerUp={(e) => {
                  save({ volume: Number((e.target as HTMLInputElement).value) });
                  sound.play('chime');
                }}
                onKeyUp={(e) => save({ volume: Number((e.target as HTMLInputElement).value) })}
                className="mt-2 w-full"
              />
            </div>
          </div>
        </Section>

        <LockSection minutes={profile.autoLockMinutes} />

        <DevicesSection />

        <ArtSection profile={profile} save={save} />

        <PlaceSection profile={profile} save={save} />

        <Section title="Dates and seasons">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Where your seasons happened
              <Select
                value={profile.hemisphere}
                onChange={(e) => save({ hemisphere: e.target.value as ProfileDto['hemisphere'] })}
                className="mt-1.5"
              >
                <option value="north">Northern hemisphere</option>
                <option value="south">Southern hemisphere</option>
                <option value="none">No real seasons</option>
                <option value="unknown">Rather not say</option>
              </Select>
            </label>
            <label className="text-sm font-bold">
              Numeric dates like 3/4/2015 mean
              <Select
                value={profile.dateOrder}
                onChange={(e) => save({ dateOrder: e.target.value as ProfileDto['dateOrder'] })}
                className="mt-1.5"
              >
                <option value="mdy">Month / day / year</option>
                <option value="dmy">Day / month / year</option>
              </Select>
            </label>
          </div>
        </Section>

        <Section title="Recordings" icon={<Mic className="size-5 text-peach-deep" />}>
          <Toggle
            checked={profile.keepAudio}
            onChange={(v) => save({ keepAudio: v })}
            label="Keep my voice recordings"
            description="On: the recording is saved next to the words, so you can hear how you said it. Off: only the text is kept."
          />
        </Section>

        <Section
          title="Where your memories live"
          icon={<ShieldCheck className="size-5 text-sage-deep" />}
        >
          <ul className="space-y-3 text-[0.97rem]">
            <li className="flex gap-3">
              <HardDrive className="mt-0.5 size-5 shrink-0 text-ink-soft" />
              <span>
                Everything is stored on this computer: a database file and a folder of photos and
                recordings inside{' '}
                <code className="rounded bg-white/8 px-1.5 text-sm">apps/server/data</code>. There's
                no account and no cloud copy.
              </span>
            </li>
            <li className="flex gap-3">
              <Wrench className="mt-0.5 size-5 shrink-0 text-ink-soft" />
              <span>
                Dates, people, feelings, matching, comparisons and answers are worked out by code
                running here. Nothing is sent to an AI service.{' '}
                <Link to="/how-it-works" viewTransition className="ink-link font-semibold">
                  See how it works
                </Link>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <Mic className="mt-0.5 size-5 shrink-0 text-ink-soft" />
              <span>
                The one exception is live transcription, which uses your browser's speech service.
                In Chrome and Edge, that sends audio to Google or Microsoft to turn it into text.
                Typing avoids it completely.
              </span>
            </li>
            <li className="flex gap-3">
              <Image className="mt-0.5 size-5 shrink-0 text-ink-soft" />
              <span>
                If scene art is on, a short scene description (like “lake at dusk, winter, calm teal
                light”) goes to Pollinations.ai to paint a backdrop. Your words, names and dates are
                never part of it. The picture is saved here, and anything not painted online is
                painted locally instead.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ink-soft" />
              <span>
                The passphrase keeps the app closed to anyone using this browser. The database
                itself isn't encrypted on disk. Anyone who can use this computer's files could read
                it, so treat it like a private diary on your desk.
              </span>
            </li>
          </ul>
        </Section>

        <Section title="Your archive">
          <div className="flex flex-wrap gap-3">
            <Button
              icon={<Download className="size-4" />}
              onClick={() => void downloadFromApi('/export', 'living-draft-archive.zip')}
            >
              Download everything (.zip)
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => setDeleting(true)}
            >
              Delete everything
            </Button>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            The download has every memory, every telling, your people, links and settings, plus all
            your files exactly as you added them.
          </p>
        </Section>
      </div>

      {deleting && (
        <DeleteEverything name={profile.preferredName} onClose={() => setDeleting(false)} />
      )}
    </div>
  );
}

function DeleteEverything({ name, onClose }: { name: string; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const navigate = useNavigate();
  const client = useQueryClient();
  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete the whole archive?"
      description="Every memory, every telling, every photo and recording, all the people and links. Gone from this computer, with no undo. Download a copy first if you might want it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} autoFocus>
            Keep everything
          </Button>
          <Button
            variant="danger"
            disabled={typed !== 'DELETE'}
            onClick={async () => {
              await api.delete('/archive', { confirm: 'DELETE' });
              client.setQueryData(keys.profile, null);
              client.clear();
              void navigate('/welcome', { replace: true });
            }}
          >
            Delete {name}'s archive
          </Button>
        </>
      }
    >
      <label className="block text-sm font-bold">
        Type DELETE to confirm
        <TextInput
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-1.5"
          autoComplete="off"
        />
      </label>
    </Dialog>
  );
}

function GentleScore() {
  const [gentle, setGentle] = useState(() => readLocal('gentle-music') === 'true');
  return (
    <Toggle
      checked={gentle}
      onChange={(value) => {
        setGentle(value);
        writeLocal('gentle-music', String(value));
        sound.configure({ gentle: value });
      }}
      label="Gentler score"
      description="Fewer drums and brass, more strings and air. Good for late nights."
    />
  );
}

function LockSection({ minutes }: { minutes: number }) {
  const { data: auth } = useAuthStatus();
  const update = useUpdateProfile();
  const lock = useLock();
  const endOthers = useEndOtherSessions();
  const change = useChangePassphrase();
  const setup = useSetPassphrase();
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const configured = auth?.configured ?? false;
  const valid =
    form.next.length >= 8 && form.next === form.confirm && (!configured || form.current.length > 0);
  const pending = change.isPending || setup.isPending;
  const error = change.error ?? setup.error;

  const submit = () => {
    if (!valid) return;
    const done = {
      onSuccess: () => {
        setForm({ current: '', next: '', confirm: '' });
        toast(
          configured
            ? 'Passphrase changed. Other sessions were signed out.'
            : 'Locked with your new passphrase.',
        );
      },
    };
    if (configured) change.mutate({ current: form.current, next: form.next }, done);
    else setup.mutate({ passphrase: form.next }, done);
  };

  return (
    <Section title="Lock" icon={<KeyRound className="size-5 text-lavender-deep" />}>
      <form
        className="grid gap-4 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {configured && (
          <Field label="Current passphrase" htmlFor="pp-current">
            <TextInput
              id="pp-current"
              type="password"
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
            />
          </Field>
        )}
        <Field
          label={configured ? 'New passphrase' : 'Passphrase'}
          htmlFor="pp-next"
          hint="At least 8 characters."
        >
          <TextInput
            id="pp-next"
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          />
        </Field>
        <Field
          label="Once more"
          htmlFor="pp-confirm"
          hint={form.confirm && form.confirm !== form.next ? "These don't match yet." : undefined}
        >
          <TextInput
            id="pp-confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" disabled={!valid || pending}>
            {configured ? 'Change passphrase' : 'Set passphrase'}
          </Button>
          {configured && (
            <Button
              variant="secondary"
              icon={<Lock className="size-4" />}
              onClick={() => lock.mutate()}
              sound="zoomOut"
            >
              Lock now
            </Button>
          )}
          {configured && (
            <Button
              variant="ghost"
              onClick={() =>
                endOthers.mutate(undefined, {
                  onSuccess: () => toast('Every other browser is signed out.'),
                })
              }
              disabled={endOthers.isPending}
            >
              Sign out everywhere else
            </Button>
          )}
          {error instanceof Error && (
            <p className="text-sm font-semibold text-rose-deep">{error.message}</p>
          )}
        </div>
      </form>
      {configured && (
        <label className="mt-5 block max-w-xs text-sm font-bold">
          Lock by itself after
          <Select
            value={String(minutes)}
            onChange={(e) => update.mutate({ autoLockMinutes: Number(e.target.value) })}
            className="mt-1.5"
          >
            <option value="5">5 minutes idle</option>
            <option value="15">15 minutes idle</option>
            <option value="30">30 minutes idle</option>
            <option value="60">1 hour idle</option>
            <option value="0">Never</option>
          </Select>
        </label>
      )}
    </Section>
  );
}

function ArtSection({
  profile,
  save,
}: {
  profile: ProfileDto;
  save: (patch: Partial<ProfileDto>) => void;
}) {
  const { data: status } = useArtStatus();
  return (
    <Section title="Scene art" icon={<Image className="size-5 text-magenta" />}>
      <Toggle
        checked={profile.artOnline}
        onChange={(value) => {
          resetArtRequests();
          save({ artOnline: value });
        }}
        label="Illustrations from the internet"
        description="Each day and memory can get its own illustration from the free Pollinations service. It only sees a short scene description, never your words or names. When this is off, or today's few are used up, pages get a sketch drawn right here."
      />
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <label className="block text-sm font-bold">
          New scenes per day
          <Select
            value={String(profile.artDailyLimit)}
            disabled={!profile.artOnline}
            onChange={(e) => {
              resetArtRequests();
              save({ artDailyLimit: Number(e.target.value) });
            }}
            className="mt-1.5"
          >
            {[2, 4, 8, 16, 32].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        {status && (
          <div className="min-w-48 flex-1">
            <div className="flex justify-between text-xs font-semibold text-ink-soft">
              <span>
                {status.used} of {status.limit} used today
              </span>
              {status.queued > 0 && (
                <span className="text-magenta">{status.queued} being painted</span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lavender via-magenta to-gold transition-all duration-700"
                style={{
                  width: `${Math.min(100, (status.used / Math.max(1, status.limit)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        The free tier allows about one image every 45 seconds, so new scenes fade in a little after
        you open a day.
      </p>
    </Section>
  );
}

function NarratorVoice({ name }: { name: string }) {
  const state = useNarratorState();
  const [natural, setNatural] = useState(() => neuralWanted());
  const [voice, setVoice] = useState(() => neuralVoice());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => narratorVoices());
  const [chosen, setChosen] = useState(() => readLocal('narrator-voice') ?? '');
  const [cached, setCached] = useState(false);

  useEffect(() => {
    void narratorCached().then(setCached);
    if (!('speechSynthesis' in window)) return;
    const refresh = () => setVoices(narratorVoices());
    window.speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, [state.status]);

  if (!narrationSupported()) return null;
  const sample = `Hi ${name}. This is how your memories will sound when I read them back to you. Some of them are small… and some of them, I think, you'll be really glad you kept.`;

  return (
    <div>
      <p className="mb-2 text-sm font-bold">Who reads your memories aloud</p>
      <Segmented
        label="Narrator"
        value={natural ? 'natural' : 'device'}
        onChange={(v) => {
          stopSpeaking();
          setNatural(v === 'natural');
          writeLocal('narrator-engine', v === 'natural' ? null : 'device');
        }}
        options={[
          { value: 'natural', label: 'Natural voice' },
          { value: 'device', label: "This device's voice" },
        ]}
      />
      {natural ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              aria-label="Natural voice"
              value={voice}
              onChange={(e) => {
                stopSpeaking();
                setVoice(e.target.value);
                writeLocal('narrator-neural-voice', e.target.value);
              }}
              className="max-w-xs"
            >
              {NARRATOR_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}, {v.note}
                </option>
              ))}
            </Select>
            <Button variant="ghost" size="sm" onClick={() => speak(sample, { wait: true })}>
              Hear it
            </Button>
          </div>
          <NarratorStatus state={state} cached={cached} />
          <p className="mt-1.5 text-xs text-ink-soft">
            The natural voice is Kokoro, an open voice model that runs on{' '}
            {ON_DEVICE ? 'this device' : 'this computer'}. The first time, it downloads about{' '}
            {NARRATOR_DOWNLOAD} from Hugging Face and keeps it. Your writing is read right here and
            never sent anywhere. Until the download finishes, your device&apos;s own voice reads
            instead.
          </p>
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              aria-label="Device voice"
              value={chosen}
              onChange={(e) => {
                setChosen(e.target.value);
                writeLocal('narrator-voice', e.target.value || null);
              }}
              className="max-w-xs"
            >
              <option value="">The warmest voice on this device</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name.replace(/^Microsoft |^Google /, '').replace(/ - English.*$/, '')}
                </option>
              ))}
            </Select>
            <Button variant="ghost" size="sm" onClick={() => speak(sample)}>
              Hear it
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            Uses the voices built into your device. The ones marked Natural or Premium sound the
            most human.
          </p>
        </>
      )}
    </div>
  );
}

function NarratorStatus({ state, cached }: { state: NarratorState; cached: boolean }) {
  if (state.status === 'loading') {
    return (
      <div className="mt-3 max-w-sm">
        <p className="text-xs font-semibold text-ink-soft">
          Downloading the voice… {Math.round(state.progress * 100)}%
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-lavender via-magenta to-gold transition-all duration-500"
            style={{ width: `${Math.max(3, state.progress * 100)}%` }}
          />
        </div>
      </div>
    );
  }
  if (state.status === 'failed') {
    return (
      <p className="mt-3 text-xs text-ink-soft">
        It couldn&apos;t start: {state.reason}{' '}
        <button
          type="button"
          className="font-semibold text-ink underline underline-offset-2"
          onClick={() => prepareNarrator().catch(() => undefined)}
        >
          Try again
        </button>
      </p>
    );
  }
  if (state.status === 'ready' || cached) {
    return <p className="mt-3 text-xs font-semibold text-ink-soft">Downloaded and ready.</p>;
  }
  return (
    <p className="mt-3 text-xs text-ink-soft">
      Not downloaded yet.{' '}
      <button
        type="button"
        className="font-semibold text-ink underline underline-offset-2"
        onClick={() => prepareNarrator().catch(() => undefined)}
      >
        Download it now
      </button>
    </p>
  );
}
