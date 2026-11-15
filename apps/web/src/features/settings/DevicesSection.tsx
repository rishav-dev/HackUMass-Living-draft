import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Download, Glasses, Watch } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
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
