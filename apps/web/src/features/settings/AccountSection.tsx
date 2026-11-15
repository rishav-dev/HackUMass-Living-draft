import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserRound } from 'lucide-react';
import { authKey, useAuthStatus } from '../../api/auth';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { TextInput, Toggle } from '../../components/ui/controls';
import { useToast } from '../../components/ui/Toast';

export function AccountSection() {
  const { data: status } = useAuthStatus();
  const client = useQueryClient();
  const toast = useToast();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [removing, setRemoving] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const [offPassword, setOffPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!status) return null;

  const refresh = () => client.invalidateQueries({ queryKey: authKey });
  const fail = (err: unknown) =>
    setError(err instanceof Error ? err.message : 'That did not work.');

  return (
    <section id="account" className="paper scroll-mt-24 rounded-3xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <UserRound className="size-5 text-lavender-deep" /> Account
      </h2>
      <p className="text-sm">
        {status.name ? <span className="font-semibold">{status.name}</span> : null}
        {status.email ? <span className="text-ink-soft"> · {status.email}</span> : null}
        {status.demo ? <span className="text-ink-soft"> · demo notebook</span> : null}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-deep">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-sage-deep" /> Two-step sign-in
          </p>
          <div className="mt-2">
            <Toggle
              checked={status.twoStep}
              onChange={(on) => {
                setError(null);
                if (on)
                  void api.post('/auth/two-step', { on: true }).then(() => {
                    toast('Two-step sign-in is on.');
                    void refresh();
                  }, fail);
                else setTurningOff(true);
              }}
              label="Ask for a second step on new devices"
              description={
                status.twoStep
                  ? status.totpEnabled
                    ? 'New devices ask for a code from your authenticator app.'
                    : 'New devices are asked for a code sent to your email.'
                  : 'Off. Your email and password are enough to sign in.'
              }
            />
          </div>
          {turningOff && (
            <div className="mt-2 flex flex-wrap gap-2">
              <TextInput
                type="password"
                aria-label="Your password"
                placeholder="Your password, to turn it off"
                value={offPassword}
                onChange={(e) => setOffPassword(e.target.value)}
                className="h-10 w-64"
              />
              <Button
                size="sm"
                variant="soft"
                onClick={() =>
                  api.post('/auth/two-step', { on: false, password: offPassword }).then(() => {
                    setTurningOff(false);
                    setOffPassword('');
                    toast('Two-step sign-in is off.');
                    void refresh();
                  }, fail)
                }
              >
                Turn it off
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTurningOff(false)}>
                Keep it on
              </Button>
            </div>
          )}
          {status.methods.totp && !status.totpEnabled && !setup && (
            <Button
              size="sm"
              variant="soft"
              className="mt-2"
              onClick={() =>
                api
                  .post<{ secret: string; uri: string }>('/auth/authenticator/start')
                  .then(setSetup, fail)
              }
            >
              Set up an authenticator app
            </Button>
          )}
          {setup && (
            <div className="mt-3 rounded-2xl bg-cream/60 p-4 text-sm">
              <p>
                In your authenticator app (Google Authenticator, 1Password, Authy…), add an account
                with this key, then type the 6-digit code it shows.
              </p>
              <p className="mt-2 break-all font-mono text-base tracking-wider">{setup.secret}</p>
              <a href={setup.uri} className="mt-1 inline-block text-xs font-semibold underline">
                Open in an authenticator app on this device
              </a>
              <div className="mt-3 flex flex-wrap gap-2">
                <TextInput
                  aria-label="Code from the app"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  className="h-10 w-36 text-center font-mono tracking-[0.3em]"
                />
                <Button
                  size="sm"
                  disabled={code.length !== 6}
                  onClick={() =>
                    api.post('/auth/authenticator/confirm', { code }).then(() => {
                      setSetup(null);
                      setCode('');
                      setError(null);
                      toast('Two-step sign-in is on.');
                      void refresh();
                    }, fail)
                  }
                >
                  Turn it on
                </Button>
              </div>
            </div>
          )}
          {status.totpEnabled && (
            <div className="mt-2">
              {removing ? (
                <div className="flex flex-wrap gap-2">
                  <TextInput
                    type="password"
                    aria-label="Your password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-56"
                  />
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() =>
                      api.post('/auth/authenticator/remove', { password }).then(() => {
                        setRemoving(false);
                        setPassword('');
                        toast('The authenticator app is no longer needed.');
                        void refresh();
                      }, fail)
                    }
                  >
                    Turn it off
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
                  Turn off the authenticator
                </Button>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-bold">Trusted devices</p>
          <p className="mt-1 text-sm text-ink-soft">
            Devices you told to remember you skip the second step for 90 days.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() =>
              api
                .post('/auth/trusted/forget')
                .then(() => toast('Every device will ask again.'), fail)
            }
          >
            Forget all trusted devices
          </Button>
        </div>

        {status.methods.google && (
          <div>
            <p className="text-sm font-bold">Google</p>
            <p className="mt-1 text-sm text-ink-soft">
              {status.googleLinked
                ? 'Connected. You can sign in with Google.'
                : 'Connect your Google account to sign in with it.'}
            </p>
            {!status.googleLinked && (
              <a
                href="/api/auth/google?mode=link"
                className="mt-2 inline-flex h-9 items-center rounded-full border border-white/15 px-4 text-sm font-semibold hover:bg-white/8"
              >
                Connect Google
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
