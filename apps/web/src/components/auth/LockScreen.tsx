import { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, Lock } from 'lucide-react';
import { useUnlock } from '../../api/auth';
import { haptic } from '../../lib/haptics';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { useSound } from '../../lib/sound/SoundProvider';
import { Core } from '../core/Core';
import { Button } from '../ui/Button';

export function LockScreen() {
  const unlock = useUnlock();
  const { play } = useSound();
  const [passphrase, setPassphrase] = useState('');
  const [shakes, setShakes] = useState(0);
  useAtmosphere({ mood: 'cosmos', intensity: 0.3, dim: 0.7 });

  const submit = () => {
    if (!passphrase || unlock.isPending) return;
    unlock.mutate(
      { passphrase },
      {
        onSuccess: () => {
          play('saved');
          haptic('saved');
        },
        onError: () => {
          setShakes((n) => n + 1);
          setPassphrase('');
          play('deny');
          haptic('warn');
        },
      },
    );
  };

  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-6 py-16">
      <motion.form
        key={shakes}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        initial={shakes ? { x: 0 } : { opacity: 0, y: 16 }}
        animate={shakes ? { x: [0, -14, 12, -8, 6, 0] } : { opacity: 1, y: 0 }}
        transition={{ duration: shakes ? 0.45 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="flex w-full max-w-sm flex-col items-center text-center"
      >
        <Core
          state={unlock.isPending ? 'organizing' : unlock.isSuccess ? 'saved' : 'ready'}
          size={170}
        />
        <p className="eyebrow mt-6">The Living Draft</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold">
          <Lock className="size-6 text-lavender-deep" aria-hidden="true" />
          Locked
        </h1>
        <p className="mt-2 text-ink-soft">Your passphrase opens the archive on this computer.</p>

        <label htmlFor="unlock-passphrase" className="sr-only">
          Passphrase
        </label>
        <div className="glow-ring mt-8 flex w-full items-center gap-2 rounded-full bg-abyss/70 py-1.5 pl-5 pr-1.5">
          <KeyRound className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            id="unlock-passphrase"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Passphrase"
            className="h-10 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-faint"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10 px-5"
            disabled={!passphrase || unlock.isPending}
            sound={false}
          >
            {unlock.isPending ? 'Opening…' : 'Unlock'}
          </Button>
        </div>
        <p role="alert" className="mt-3 min-h-5 text-sm font-semibold text-rose-deep">
          {unlock.error instanceof Error ? unlock.error.message : ''}
        </p>

        <details className="mt-6 text-sm text-ink-faint">
          <summary className="cursor-pointer font-semibold hover:text-ink-soft">Forgot it?</summary>
          <p className="mt-2 text-left">
            There's no reset email because nothing leaves this computer. If the passphrase is truly
            gone, stop the app and delete the <code className="text-ink-soft">data</code> folder in{' '}
            <code className="text-ink-soft">apps/server</code> to start over. That erases every
            memory, so keep an export somewhere safe.
          </p>
        </details>
      </motion.form>
    </main>
  );
}
