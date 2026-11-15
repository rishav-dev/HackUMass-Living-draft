import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  BookOpen,
  GitCompare,
  Map as MapIcon,
  MessageCircleQuestion,
  Mic,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuthStatus } from '../../api/auth';
import { ON_DEVICE } from '../../api/client';
import { Core } from '../../components/core/Core';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/controls';
import { account, useRefreshAuth } from './api';

function Card({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className={`paper w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-[2rem] p-7 sm:p-9`}>
        <Link to="/" className="hand text-2xl text-ink">
          The Living Draft
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      role="alert"
      className="rounded-2xl bg-rose/25 px-4 py-2.5 text-sm font-semibold text-rose-deep"
    >
      {text}
    </p>
  );
}

function Remember({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm font-semibold">
      <input
        type="checkbox"
        className="size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function GoogleButton({ remember }: { remember: boolean }) {
  const { data: status } = useAuthStatus();
  if (!status?.methods.google) return null;
  return (
    <>
      <div className="my-4 flex items-center gap-3 text-xs font-semibold text-ink-faint">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>
      <a
        href={`/api/auth/google?mode=login&remember=${remember ? '1' : '0'}`}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/6 font-semibold hover:bg-white/10"
      >
        <span className="text-lg font-bold">G</span> Continue with Google
      </a>
    </>
  );
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.';

export function LandingPage() {
  const { data: status } = useAuthStatus();
  const navigate = useNavigate();
  const refresh = useRefreshAuth();
  const [busy, setBusy] = useState(false);

  const demo = async () => {
    setBusy(true);
    try {
      if (ON_DEVICE && !status?.demo) {
        const response = await fetch(`${import.meta.env.BASE_URL}demo/kinjal.zip`);
        if (!response.ok) throw new Error('The demo notebook is missing from this build.');
        const { importArchiveBytes } = await import('../../device/runtime');
        await importArchiveBytes(new Uint8Array(await response.arrayBuffer()));
      } else await account.demo();
      await refresh();
      void navigate('/');
    } finally {
      setBusy(false);
    }
  };
  const offerDemo = Boolean(status?.demo) || (ON_DEVICE && !status?.configured);

  const features = [
    {
      icon: Mic,
      title: 'Say it however it comes out',
      text: 'Talk or type. Your exact words are kept forever, untouched.',
    },
    {
      icon: Sparkles,
      title: 'Get a version worth rereading',
      text: 'It turns a messy recollection into clear writing in your own voice, without adding anything you didn’t say.',
    },
    {
      icon: MessageCircleQuestion,
      title: 'Asked what matters',
      text: 'A few curious follow-up questions fill in the parts you skipped. Answer any, or none.',
    },
    {
      icon: Users,
      title: 'People and places, understood',
      text: 'Who mattered, who was in the background, and where it all happened, worked out from the story.',
    },
    {
      icon: MapIcon,
      title: 'See the threads',
      text: 'An interactive map shows how your memories connect, and why: patterns broken, things that came full circle.',
    },
    {
      icon: GitCompare,
      title: 'Compare and ask',
      text: 'Put two moments side by side, or ask how something changed over the years. Answers cite your own memories.',
    },
    {
      icon: ShieldCheck,
      title: 'Private by default',
      text: 'Your notebook runs on your own computer. The writing helper and the narrator run there too.',
    },
    {
      icon: BookOpen,
      title: 'A notebook, not a feed',
      text: 'Night paper, page turns, music that follows each memory, and your stories read back to you.',
    },
  ];

  return (
    <div className="min-h-dvh px-5 pb-20 pt-10 sm:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <span className="hand text-3xl text-ink">The Living Draft</span>
        <div className="flex items-center gap-2">
          {status?.configured && !status.demo ? (
            <Button size="sm" onClick={() => void navigate('/sign-in')}>
              Sign in
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => void navigate('/sign-in')}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => void navigate('/create-account')}>
                Create account
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto mt-16 grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="eyebrow">a journal that understands you</p>
          <h1 className="mt-2 text-5xl font-semibold leading-[1.05] sm:text-7xl">
            Say what you remember. Keep what it meant.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            The Living Draft turns spoken or written recollections into stories you&apos;ll want to
            reread, then shows how the people, places and turning points in your life connect.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {status?.configured && !status.demo ? (
              <Button size="lg" onClick={() => void navigate('/sign-in')}>
                Sign in to your notebook
              </Button>
            ) : (
              <Button size="lg" onClick={() => void navigate('/create-account')}>
                Start your notebook
              </Button>
            )}
            {offerDemo && (
              <Button size="lg" variant="secondary" onClick={demo} disabled={busy}>
                {busy ? 'Opening…' : 'Explore the demo notebook'}
              </Button>
            )}
          </div>
          {offerDemo && (
            <p className="mt-3 text-sm text-ink-faint">
              The demo belongs to Kinjal, a made-up person. Every memory in it is fictional.
            </p>
          )}
        </div>
        <div className="flex justify-center">
          <Core state="ready" size={300} />
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <article key={f.title} className="paper rounded-3xl p-5">
            <f.icon className="size-6 text-lavender-deep" />
            <h2 className="mt-3 text-lg font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{f.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const refresh = useRefreshAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [step, setStep] = useState<{
    kind: 'code' | 'authenticator';
    sentTo?: string | null;
  } | null>(null);
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(true);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [busy, setBusy] = useState(false);
  const { data: status } = useAuthStatus();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await account.signIn(form);
      if (result.next === 'done') {
        await refresh();
        void navigate('/');
      } else setStep({ kind: result.next, sentTo: result.sentTo });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await account.code({ code, trust });
      await refresh();
      void navigate('/');
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  if (step)
    return (
      <Card title="One more step">
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <Problem text={error} />
          <p className="text-ink-soft">
            {step.kind === 'authenticator'
              ? 'Enter the 6-digit code from your authenticator app.'
              : `We sent a 6-digit code to ${step.sentTo ?? 'your email'}.`}
            {step.kind === 'code' &&
              status?.mailer === 'outbox' &&
              ' No mail server is set up for this copy of the app, so the email is in the server window and in data/outbox.'}
          </p>
          <TextInput
            aria-label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            className="text-center font-mono text-2xl tracking-[0.4em]"
            autoFocus
          />
          <Remember
            checked={trust}
            onChange={setTrust}
            label="Trust this device, so it won’t ask again"
          />
          <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Continue'}
          </Button>
          <button
            type="button"
            className="text-sm font-semibold text-ink-soft hover:text-ink"
            onClick={() => setStep(null)}
          >
            Back
          </button>
        </form>
      </Card>
    );

  return (
    <Card title="Sign in">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Problem text={error} />
        {status?.hasEmail !== false && (
          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
        )}
        <Field label={status?.hasEmail === false ? 'Passphrase' : 'Password'} htmlFor="password">
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            autoFocus={status?.hasEmail === false}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <Remember
            checked={form.remember}
            onChange={(v) => setForm((f) => ({ ...f, remember: v }))}
            label="Keep me signed in"
          />
          {status?.hasEmail && (
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <GoogleButton remember={form.remember} />
      {!status?.configured && (
        <p className="mt-5 text-sm text-ink-soft">
          New here?{' '}
          <Link to="/create-account" className="font-semibold text-ink underline">
            Create an account
          </Link>
        </p>
      )}
    </Card>
  );
}

export function VerifyEmailPage() {
  const refresh = useRefreshAuth();
  const { data: status } = useAuthStatus();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await account.verify(code);
      await refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Check your email">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Problem text={error} />
        <p className="text-ink-soft">
          We sent a 6-digit code to {status?.email ?? 'your email'} to make sure it&apos;s yours. It
          works for 10 minutes.
          {status?.mailer === 'outbox' &&
            ' No mail server is set up for this copy of the app, so the email is in the server window and in data/outbox.'}
        </p>
        <TextInput
          aria-label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
          className="text-center font-mono text-2xl tracking-[0.4em]"
          autoFocus
        />
        <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Verify'}
        </Button>
        {note && <p className="text-sm text-sage-deep">{note}</p>}
        <button
          type="button"
          className="text-sm font-semibold text-ink-soft hover:text-ink"
          onClick={() =>
            account.resend().then(
              () => setNote('A new code is on its way.'),
              (err: unknown) => setError(message(err)),
            )
          }
        >
          Send a new code
        </button>
      </form>
    </Card>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: status } = useAuthStatus();
  return (
    <Card title="Reset your password">
      {sent ? (
        <p className="text-ink-soft">
          If that email belongs to this notebook, a reset link is on its way. It works for 30
          minutes.
          {status?.mailer === 'outbox' &&
            ' No mail server is set up for this copy of the app, so the link is in the server window and in data/outbox.'}
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await account.forgot(email).catch(() => undefined);
            setBusy(false);
            setSent(true);
          }}
        >
          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Button type="submit" size="lg" disabled={busy}>
            Send me a reset link
          </Button>
        </form>
      )}
      <p className="mt-5 text-sm">
        <Link to="/sign-in" className="font-semibold text-ink-soft hover:text-ink">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const refresh = useRefreshAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const token = params.get('token') ?? '';
  return (
    <Card title="Choose a new password">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (password !== confirm) return setError('The passwords don’t match.');
          setBusy(true);
          try {
            await account.reset(token, password);
            await refresh();
            void navigate('/');
          } catch (err) {
            setError(message(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Problem text={error} />
        <Field label="New password" htmlFor="new" hint="8+ characters, with a number or symbol.">
          <TextInput
            id="new"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="Confirm it" htmlFor="again">
          <TextInput
            id="again"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" size="lg" disabled={busy || !token}>
          {busy ? 'Saving…' : 'Save and sign in'}
        </Button>
        {!token && (
          <p className="text-sm text-ink-soft">This link is missing its code. Ask for a new one.</p>
        )}
      </form>
    </Card>
  );
}
