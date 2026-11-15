import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Cake, Dog, Heart, MapPin, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { ageOnDate } from '@living-draft/engine';
import { useAuthStatus } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Field, Select, TextInput } from '../../components/ui/controls';
import { useMotionAllowed } from '../../lib/motion';
import { account, useRefreshAuth } from './api';

type Kind = 'family' | 'friend' | 'partner' | 'pet' | 'mentor' | 'other';

interface Person {
  key: number;
  name: string;
  kind: Kind;
  relationship: string;
  note: string;
}

const KINDS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: 'family', label: 'Family', hint: 'Mom, older brother, grandmother…' },
  { value: 'friend', label: 'Friend', hint: 'Best friend, roommate…' },
  { value: 'partner', label: 'Partner', hint: 'Wife, boyfriend, fiancé…' },
  { value: 'pet', label: 'Pet', hint: 'Dog, cat, parrot…' },
  { value: 'mentor', label: 'Mentor', hint: 'Teacher, coach, boss…' },
  { value: 'other', label: 'Someone else', hint: 'Neighbor, cousin’s kid…' },
];

const QUICK: Array<{ label: string; kind: Kind; relationship: string }> = [
  { label: 'Mom', kind: 'family', relationship: 'Mom' },
  { label: 'Dad', kind: 'family', relationship: 'Dad' },
  { label: 'A sibling', kind: 'family', relationship: 'sibling' },
  { label: 'A grandparent', kind: 'family', relationship: 'grandparent' },
  { label: 'A partner', kind: 'partner', relationship: '' },
  { label: 'A best friend', kind: 'friend', relationship: 'best friend' },
  { label: 'A pet', kind: 'pet', relationship: '' },
  { label: 'A mentor', kind: 'mentor', relationship: '' },
];

const SEXES = ['Female', 'Male', 'Intersex'];
const GENDERS = ['Woman', 'Man', 'Non-binary', 'Genderfluid', 'Agender'];
const PRONOUNS = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they'];

const STEPS = [
  { title: 'Tell us about you', icon: UserRound },
  { title: 'Where you’re from', icon: MapPin },
  { title: 'The people who matter', icon: Users },
  { title: 'How you’ll sign in', icon: Heart },
];

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.';

function Choice({
  id,
  label,
  value,
  options,
  onChange,
  other,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  other: string;
}) {
  const custom = value !== '' && value !== 'skip' && !options.includes(value);
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex flex-col gap-2">
        <Select
          id={id}
          value={custom ? 'custom' : value}
          onChange={(e) => onChange(e.target.value === 'custom' ? ' ' : e.target.value)}
        >
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value="custom">{other}</option>
          <option value="skip">I’d rather not say</option>
        </Select>
        {custom && (
          <TextInput
            aria-label={`${label}, in your words`}
            value={value.trimStart()}
            onChange={(e) => onChange(e.target.value || ' ')}
            placeholder="In your own words"
            autoFocus
          />
        )}
      </div>
    </Field>
  );
}

export function CreateAccountPage() {
  const navigate = useNavigate();
  const refresh = useRefreshAuth();
  const motionOk = useMotionAllowed();
  const { data: status } = useAuthStatus();
  const emailCodes = Boolean(status?.methods.email);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const counter = useRef(0);
  const [form, setForm] = useState({
    fullName: '',
    callMe: '',
    callMeEdited: false,
    birthDate: '',
    age: '',
    sex: '',
    gender: '',
    pronouns: '',
    birthPlace: '',
    currentPlace: '',
    email: '',
    password: '',
    confirm: '',
    remember: true,
    twoStep: true,
    replaceSample: false,
  });
  const [people, setPeople] = useState<Person[]>([]);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const age = form.birthDate ? ageOnDate(form.birthDate, new Date()) : Number(form.age) || null;
  const firstName = form.fullName.trim().split(/\s+/)[0] ?? '';
  const callMe = form.callMeEdited ? form.callMe : firstName;
  const clean = (value: string) => (value === 'skip' || !value.trim() ? null : value.trim());

  const problems = [
    !form.fullName.trim()
      ? 'Add your name.'
      : !callMe.trim()
        ? 'Tell us what to call you.'
        : !age || age < 1 || age > 120
          ? 'Add your birthday or your age.'
          : null,
    null,
    people.some((p) => !p.name.trim()) ? 'Give each person a name, or remove the empty row.' : null,
    !form.email.trim()
      ? 'Add your email.'
      : form.password.length < 8
        ? 'Use at least 8 characters for the password.'
        : form.password !== form.confirm
          ? 'The passwords don’t match.'
          : status?.demo && !form.replaceSample
            ? 'Tick the box to replace the sample notebook.'
            : null,
  ];

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    const problem = problems[step];
    if (problem) return setError(problem);
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
    else void submit();
  };

  const submit = async () => {
    setBusy(true);
    try {
      await account.signUp({
        name: callMe.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm: form.confirm,
        remember: form.remember,
        twoStep: emailCodes && form.twoStep,
        replaceSample: form.replaceSample,
        about: {
          fullName: form.fullName.trim(),
          birthDate: form.birthDate || null,
          age: form.birthDate ? null : Number(form.age),
          sex: clean(form.sex),
          gender: clean(form.gender),
          pronouns: clean(form.pronouns),
          birthPlace: clean(form.birthPlace),
          currentPlace: clean(form.currentPlace),
        },
        people: people.map(({ name, kind, relationship, note }) => ({
          name: name.trim(),
          kind,
          relationship: relationship.trim(),
          note: note.trim(),
        })),
      });
      await refresh();
      void navigate('/', { replace: true });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const addPerson = (start?: Partial<Person>) => {
    setPeople((list) => [
      ...list,
      {
        key: (counter.current += 1),
        name: '',
        kind: 'family',
        relationship: '',
        note: '',
        ...start,
      },
    ]);
  };
  const updatePerson = (key: number, change: Partial<Person>) =>
    setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const Step = STEPS[step]!;
  let body: ReactNode;
  if (step === 0)
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="full-name" hint="First and last, as you’d write it.">
          <TextInput
            id="full-name"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="What should we call you?" htmlFor="call-me" hint="A nickname is fine.">
          <TextInput
            id="call-me"
            autoComplete="nickname"
            value={callMe}
            onChange={(e) => setForm((f) => ({ ...f, callMe: e.target.value, callMeEdited: true }))}
          />
        </Field>
        <Field
          label="Birthday"
          htmlFor="birthday"
          hint={age ? `That makes you ${age}.` : 'It puts each memory at the right age.'}
        >
          <TextInput
            id="birthday"
            type="date"
            autoComplete="bday"
            max={new Date().toISOString().slice(0, 10)}
            value={form.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
          />
        </Field>
        {!form.birthDate && (
          <Field label="Or just your age" htmlFor="age">
            <TextInput
              id="age"
              inputMode="numeric"
              value={form.age}
              onChange={(e) => set('age', e.target.value.replace(/\D/g, '').slice(0, 3))}
              className="w-28"
            />
          </Field>
        )}
        <Choice
          id="sex"
          label="Sex"
          value={form.sex}
          options={SEXES}
          onChange={(v) => set('sex', v)}
          other="Something else"
        />
        <Choice
          id="gender"
          label="Gender identity"
          value={form.gender}
          options={GENDERS}
          onChange={(v) => set('gender', v)}
          other="Another identity"
        />
        <Choice
          id="pronouns"
          label="Pronouns"
          value={form.pronouns}
          options={PRONOUNS}
          onChange={(v) => set('pronouns', v)}
          other="Other pronouns"
        />
      </div>
    );
  else if (step === 1)
    body = (
      <div className="flex flex-col gap-4">
        <Field
          label="Where were you born?"
          htmlFor="birth-place"
          hint="A town and country is plenty. Your earliest memories start here."
        >
          <TextInput
            id="birth-place"
            value={form.birthPlace}
            onChange={(e) => set('birthPlace', e.target.value)}
            placeholder="Kochi, India"
            autoFocus
          />
        </Field>
        <Field
          label="Where do you live now?"
          htmlFor="current-place"
          hint="Used for today’s weather and the map. You can change how location works in Settings."
        >
          <TextInput
            id="current-place"
            autoComplete="address-level2"
            value={form.currentPlace}
            onChange={(e) => set('currentPlace', e.target.value)}
            placeholder="Amherst, Massachusetts"
          />
        </Field>
        <p className="text-sm text-ink-soft">
          Both are optional and stay in your notebook. Nothing is looked up until you ask.
        </p>
      </div>
    );
  else if (step === 2)
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">
          Add anyone who shows up in your stories: family, friends, a partner, a pet. They’ll be
          recognized when you mention them. You can always add more later.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() =>
                addPerson({
                  kind: q.kind,
                  relationship: q.relationship,
                  name: q.relationship === 'Mom' || q.relationship === 'Dad' ? q.relationship : '',
                })
              }
              className="inline-flex items-center gap-1 rounded-full bg-linen px-3 py-1 text-xs font-semibold text-ink-soft transition hover:text-ink"
            >
              <Plus className="size-3" /> {q.label}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-3">
          {people.map((p, i) => {
            const kind = KINDS.find((k) => k.value === p.kind)!;
            return (
              <li key={p.key} className="rounded-2xl bg-white/5 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem_1fr_auto] sm:items-end">
                  <Field label="Name" htmlFor={`person-${p.key}`}>
                    <TextInput
                      id={`person-${p.key}`}
                      value={p.name}
                      onChange={(e) => updatePerson(p.key, { name: e.target.value })}
                      placeholder={p.kind === 'pet' ? 'Biscuit' : 'Their name'}
                      autoFocus={i === people.length - 1 && !p.name}
                    />
                  </Field>
                  <Field label="Who they are" htmlFor={`kind-${p.key}`}>
                    <Select
                      id={`kind-${p.key}`}
                      value={p.kind}
                      onChange={(e) => updatePerson(p.key, { kind: e.target.value as Kind })}
                    >
                      {KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={p.kind === 'pet' ? 'What kind' : 'To you'} htmlFor={`rel-${p.key}`}>
                    <TextInput
                      id={`rel-${p.key}`}
                      value={p.relationship}
                      onChange={(e) => updatePerson(p.key, { relationship: e.target.value })}
                      placeholder={kind.hint}
                    />
                  </Field>
                  <button
                    type="button"
                    aria-label={`Remove ${p.name || 'this person'}`}
                    onClick={() => setPeople((list) => list.filter((x) => x.key !== p.key))}
                    className="mb-1 self-end rounded-full p-2 text-ink-soft hover:bg-white/10 hover:text-rose-deep"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <TextInput
                  aria-label={`A note about ${p.name || 'them'}`}
                  value={p.note}
                  onChange={(e) => updatePerson(p.key, { note: e.target.value })}
                  placeholder="A line about them (optional)"
                  className="mt-2"
                />
              </li>
            );
          })}
        </ul>
        <Button
          variant="soft"
          icon={people.length ? <Plus className="size-4" /> : <Dog className="size-4" />}
          onClick={() => addPerson()}
          className="self-start"
        >
          {people.length ? 'Add someone else' : 'Add someone'}
        </Button>
      </div>
    );
  else
    body = (
      <div className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" hint="8+ characters, with a number or symbol.">
            <TextInput
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </Field>
          <Field
            label="Password again"
            htmlFor="confirm"
            hint={form.confirm && form.confirm !== form.password ? 'These don’t match yet.' : ' '}
          >
            <TextInput
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            className="size-4"
            checked={form.remember}
            onChange={(e) => set('remember', e.target.checked)}
          />
          Keep me signed in on this device
        </label>
        {emailCodes ? (
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={form.twoStep}
              onChange={(e) => set('twoStep', e.target.checked)}
            />
            <span>
              <span className="font-semibold">Use two-step sign-in</span>
              <span className="block text-ink-soft">
                We’ll email a code to check it’s you now, and again when you sign in on a new
                device. Untick it to sign in with just your email and password; you can turn it on
                later in Settings.
                {status?.mailer === 'outbox' &&
                  ' (There’s no mail server set up here, so codes show up in the server window.)'}
              </span>
            </span>
          </label>
        ) : (
          <p className="text-sm text-ink-soft">
            You’ll sign in with your email and password. For a second step, add an authenticator app
            in Settings.
          </p>
        )}
        {status?.demo && (
          <label className="flex items-start gap-2.5 rounded-2xl bg-peach/15 p-3 text-sm ring-1 ring-peach/40">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={form.replaceSample}
              onChange={(e) => set('replaceSample', e.target.checked)}
            />
            <span>
              <span className="font-semibold">Replace the sample notebook with mine</span>
              <span className="block text-ink-soft">
                This computer holds Kinjal’s made-up notebook. A copy is saved in the backups folder
                first, and <code>npm run restore-sample</code> brings it back any time.
              </span>
            </span>
          </label>
        )}
      </div>
    );

  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="paper w-full max-w-2xl rounded-[2rem] p-6 sm:p-9">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="hand text-2xl text-ink">
            The Living Draft
          </Link>
          <ol className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-snow' : i < step ? 'w-3 bg-lavender-deep' : 'w-3 bg-white/15'}`}
              />
            ))}
          </ol>
        </div>
        <form onSubmit={next} noValidate>
          <motion.div
            key={step}
            initial={motionOk ? { opacity: 0, x: 18 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="mt-5 flex items-center gap-3 text-3xl font-semibold">
              <Step.icon className="size-7 text-lavender-deep" />
              {Step.title}
            </h1>
            {step === 0 && (
              <p className="mt-1 text-ink-soft">
                <Cake className="mr-1 inline size-4" />A few basics so your memories land at the
                right age. Only what you choose to share, and it stays in your notebook.
              </p>
            )}
            <div className="mt-6">{body}</div>
          </motion.div>
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-2xl bg-rose/25 px-4 py-2.5 text-sm font-semibold text-rose-deep"
            >
              {error}
            </p>
          )}
          <div className="mt-7 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button
                variant="ghost"
                icon={<ArrowLeft className="size-4" />}
                onClick={() => {
                  setError(null);
                  setStep(step - 1);
                }}
              >
                Back
              </Button>
            ) : (
              <p className="text-sm text-ink-soft">
                Have an account?{' '}
                <Link to="/sign-in" className="font-semibold text-ink underline">
                  Sign in
                </Link>
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy}>
              {step < STEPS.length - 1
                ? step === 2 && people.length === 0
                  ? 'Skip for now'
                  : 'Next'
                : busy
                  ? 'Creating it…'
                  : 'Create my notebook'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
