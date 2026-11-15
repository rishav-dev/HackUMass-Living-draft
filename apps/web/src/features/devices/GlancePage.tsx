import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check, Mic, Square } from 'lucide-react';
import type { MemoryCardDto } from '@living-draft/contracts';
import { useInvalidateArchive, useProfile } from '../../api/hooks';
import { emotionMeta } from '../../lib/meta';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { stopSpeaking } from '../../lib/narration';
import { say } from '../../lib/say';
import { listenOnce, speechSupported } from '../../lib/speech';
import { sound } from '../../lib/sound/engine';
import { memoryToRead, quickSave, readable } from './quickSave';
import { useWorld } from '../../lib/world/world';

type Step = 'idle' | 'listening' | 'saving' | 'saved' | 'reading';

export default function GlancePage() {
  const { data: profile } = useProfile();
  const world = useWorld();
  const invalidate = useInvalidateArchive();
  const [memory, setMemory] = useState<MemoryCardDto | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [heard, setHeard] = useState('');
  useAtmosphere({ mood: 'cosmos', intensity: 0.25, seed: 'glance', music: false });

  useEffect(() => {
    let alive = true;
    void memoryToRead().then((m) => {
      if (alive) setMemory(m);
    });
    return () => {
      alive = false;
      stopSpeaking();
    };
  }, []);

  const record = async () => {
    sound.unlock();
    setStep('listening');
    const text = await listenOnce({ timeoutMs: 60_000 }).catch(() => '');
    if (!text) {
      setStep('idle');
      return;
    }
    setHeard(text);
    setStep('saving');
    try {
      await quickSave(text, world.context());
      invalidate();
      sound.play('saved');
      setStep('saved');
      window.setTimeout(() => setStep('idle'), 3200);
    } catch {
      setStep('idle');
    }
  };

  const read = async () => {
    if (!memory) return;
    sound.unlock();
    setStep('reading');
    await say(await readable(memory, profile));
    setStep('idle');
  };

  const tint = memory?.emotions[0] ? emotionMeta(memory.emotions[0].tag).ink : '#c4b5fd';

  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center bg-abyss/40 p-[6vmin]">
      <div
        className="relative flex size-[min(92vmin,26rem)] shrink-0 flex-col overflow-hidden items-center justify-center gap-[3vmin] rounded-full p-[12%] text-center"
        style={{
          background: `radial-gradient(circle at 50% 35%, ${tint}22, #0b0910 70%)`,
          boxShadow: `0 0 60px -20px ${tint}`,
        }}
      >
        {step === 'saved' ? (
          <>
            <Check className="size-[12vmin] text-sage-deep" aria-hidden="true" />
            <p className="hand text-[6vmin] leading-tight">Kept. It's waiting in your notebook.</p>
          </>
        ) : step === 'listening' || step === 'saving' ? (
          <>
            <p className="hand text-[5vmin] text-ink-soft">
              {step === 'saving' ? 'Keeping it…' : "I'm listening"}
            </p>
            {heard && step === 'saving' && (
              <p className="line-clamp-3 text-[3.6vmin] text-ink">{heard}</p>
            )}
            {step === 'listening' && (
              <span
                className="anim-breathe size-[14vmin] rounded-full bg-magenta/80 shadow-[0_0_40px_var(--color-magenta)]"
                aria-hidden="true"
              />
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void read()}
              disabled={!memory}
              className="w-full"
              aria-label={memory ? `Hear ${memory.title}` : 'No memories to read yet'}
            >
              <p className="hand text-[4.4vmin] text-ink-faint">
                {memory ? memory.temporal.label : 'nothing here yet'}
              </p>
              <p className="mt-1 line-clamp-2 font-display text-[6vmin] font-semibold leading-tight">
                {memory ? memory.title : 'Tell me your first memory'}
              </p>
              {memory && (
                <p className="hand mt-1 text-[4vmin] text-ink-soft">
                  {step === 'reading' ? 'reading…' : 'tap to hear it'}
                </p>
              )}
            </button>
            {speechSupported() ? (
              <button
                type="button"
                onClick={() =>
                  step === 'reading' ? (stopSpeaking(), setStep('idle')) : void record()
                }
                aria-label={step === 'reading' ? 'Stop reading' : 'Record a memory'}
                className="btn-aurora flex size-[18vmin] max-h-20 max-w-20 shrink-0 items-center justify-center rounded-full"
              >
                {step === 'reading' ? (
                  <Square className="size-[7vmin]" />
                ) : (
                  <Mic className="size-[8vmin]" />
                )}
              </button>
            ) : (
              <Link
                to="/capture"
                className="btn-aurora rounded-full px-5 py-2 text-[4vmin] font-semibold"
              >
                Write one
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
