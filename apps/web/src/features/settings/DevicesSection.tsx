import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Download, Glasses, Watch } from 'lucide-react';
import { api, ON_DEVICE } from '../../api/client';
import { Button } from '../../components/ui/Button';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PhoneBridge {
  sendToWatch: (address: string, code: string) => void;
}

const phoneBridge = () =>
  (window as unknown as { LivingDraftAndroid?: PhoneBridge }).LivingDraftAndroid ?? null;

function ConnectWatch() {
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pairing) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [pairing]);

  const start = () => {
    setError(null);
    api
      .post<{ code: string; expiresAt: string }>('/devices/pair')
      .then((next) => {
        setNow(Date.now());
        setPairing(next);
        phoneBridge()?.sendToWatch(window.location.origin, next.code);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Couldn’t make a code. Try again.'),
      );
  };

  const left = pairing ? Math.max(0, new Date(pairing.expiresAt).getTime() - now) : 0;
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);

  return (
    <div className="flex gap-3">
      <Watch className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">Connect a watch</p>
        <p className="mt-1 text-sm text-ink-soft">
          The Living Draft watch app shows a memory for today, reads it to you, saves new ones you
          say out loud and answers questions. Open it on the watch, then enter this address and the
          code below.
        </p>
        {pairing && left > 0 ? (
          <div className="mt-3 rounded-2xl bg-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Address</p>
            <p className="break-all font-mono text-sm">{window.location.origin}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Code</p>
            <p className="font-mono text-4xl font-semibold tracking-[0.25em]" aria-live="polite">
              {pairing.code.slice(0, 3)} {pairing.code.slice(3)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Works once, for {minutes}:{seconds.toString().padStart(2, '0')} more.
            </p>
            {phoneBridge() && (
              <p className="mt-2 text-sm">
                Sent to your watch over Bluetooth.{' '}
                <button
                  type="button"
                  className="font-semibold text-lavender-deep underline"
                  onClick={() => phoneBridge()?.sendToWatch(window.location.origin, pairing.code)}
                >
                  Send it again
                </button>
              </p>
            )}
          </div>
        ) : (
          <Button size="sm" variant="soft" className="mt-3" onClick={start}>
            {pairing ? 'Make a new code' : 'Show a pairing code'}
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-rose-deep">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function DevicesSection() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  );

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return (
    <section className="paper rounded-3xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
        <Download className="size-5 text-lavender-deep" aria-hidden="true" />
        On your other devices
      </h2>
      <div className="flex flex-col gap-5 text-[0.97rem]">
        <div>
          <p className="font-semibold">
            {installed ? 'This notebook is installed as an app.' : 'Keep it as an app'}
          </p>
          {!installed && (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                On Windows, Mac, Android and Chromebooks, install it from the browser and it opens
                in its own window. On an iPhone or iPad, tap Share, then Add to Home Screen.
              </p>
              {prompt && (
                <Button
                  className="mt-3"
                  size="sm"
                  icon={<Download className="size-4" />}
                  onClick={async () => {
                    await prompt.prompt();
                    const choice = await prompt.userChoice;
                    if (choice.outcome === 'accepted') setInstalled(true);
                    setPrompt(null);
                  }}
                >
                  Install The Living Draft
                </Button>
              )}
            </>
          )}
        </div>
        {!ON_DEVICE && <ConnectWatch />}
        <div className="flex gap-3">
          <Watch className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden="true" />
          <p>
            <Link to="/glance" className="ink-link font-semibold">
              Glance
            </Link>{' '}
            is a round, watch-sized page: today's memory, tap to hear it, and one button to record a
            new one. Open it on a watch browser, or pin it as a shortcut on your phone.
          </p>
        </div>
        <div className="flex gap-3">
          <Glasses className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden="true" />
          <p>
            <Link to="/listen" className="ink-link font-semibold">
              Hands-free
            </Link>{' '}
            is a conversation you can have without looking. Pair your earbuds or Meta glasses with
            your phone, start it, and just talk. It reads memories back to you, too.
          </p>
        </div>
      </div>
    </section>
  );
}
