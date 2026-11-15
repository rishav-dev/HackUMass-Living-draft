import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Headphones, Square } from 'lucide-react';
import { useInvalidateArchive, useProfile } from '../../api/hooks';
import { Core, type CoreState } from '../../components/core/Core';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { stopSpeaking } from '../../lib/narration';
import { say } from '../../lib/say';
import { listenOnce, speechSupported } from '../../lib/speech';
import { sound } from '../../lib/sound/engine';
import { memoryToRead, quickSave, readable } from './quickSave';
import { useWorld } from '../../lib/world/world';

const YES = /\b(yes|yeah|yep|sure|keep|save|ok|okay|please do)\b/i;
const NO = /\b(no|nope|don't|do not|forget|skip|let it go)\b/i;
const READ = /\b(read|tell|play)\b.*\b(one|me|something|memory)\b|\bread me\b/i;
const STOP = /\b(stop|that's all|that is all|goodbye|bye|i'm done|im done|end)\b/i;

export default function ListenPage() {
  const { data: profile } = useProfile();
  const world = useWorld();
  const invalidate = useInvalidateArchive();
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<CoreState>('ready');
  const [caption, setCaption] = useState('Tap start, then just talk.');
  const live = useRef(false);
  useAtmosphere({ mood: 'peaceful', intensity: 0.3, seed: 'listen', music: false });

  useEffect(
    () => () => {
      live.current = false;
      stopSpeaking();
    },
    [],
  );

  const speak = async (text: string) => {
    setCaption(text);
    setState('organizing');
    await say(text);
  };

  const hear = async (): Promise<string> => {
    setState('listening');
    sound.play('start');
    const heard = await listenOnce({ timeoutMs: 45_000 }).catch(() => '');
    setState('ready');
    if (heard) setCaption(`“${heard}”`);
    return heard;
  };

  const loop = async () => {
    const name = profile?.preferredName ?? 'there';
    await speak(`Hi ${name}. I'm listening. Tell me a memory, or say "read me one".`);
    while (live.current) {
      const heard = await hear();
      if (!live.current) break;
      if (!heard) {
        await speak("I didn't catch that. Tell me a memory, say read me one, or say stop.");
        continue;
      }
      if (STOP.test(heard) && heard.split(/\s+/).length < 5) {
        await speak("Okay. I'll be here whenever you want to remember something.");
        break;
      }
      if (READ.test(heard) && heard.split(/\s+/).length < 8) {
        const memory = await memoryToRead();
        if (!memory) await speak("There's nothing to read yet. Tell me a memory and I'll keep it.");
        else await speak(await readable(memory, profile));
        if (live.current) await speak('Would you like another, or do you have one to tell me?');
        continue;
      }
      await speak(`Here's what I heard. ${heard}. Should I keep it?`);
      const answer = await hear();
      if (YES.test(answer) && !NO.test(answer)) {
        try {
          await quickSave(heard, world.context());
          invalidate();
          sound.play('saved');
          await speak("Kept. It's in your notebook, waiting for you to look it over.");
        } catch {
          await speak(
            "Something went wrong saving that one. I'm sorry. Could you tell me again later?",
          );
        }
      } else {
        await speak("Okay, I'll let that one go.");
      }
      if (live.current) await speak('Anything else?');
    }
    live.current = false;
    setRunning(false);
    setState('ready');
  };

  const start = () => {
    sound.unlock();
    live.current = true;
    setRunning(true);
    void loop();
  };

  const stop = () => {
    live.current = false;
    stopSpeaking();
    setRunning(false);
    setState('ready');
    setCaption('Stopped. Tap start whenever you like.');
  };

  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <Link to="/" className="hand absolute left-5 top-5 text-xl text-ink-soft hover:text-ink">
        ← notebook
      </Link>
      <p className="eyebrow">hands-free</p>
      <Core state={state} size={220} />
      <p
        className="max-w-xl font-display text-2xl leading-snug text-ink sm:text-3xl"
        aria-live="polite"
      >
        {caption}
      </p>
      {!speechSupported() ? (
        <p className="max-w-md text-ink-soft">
          This browser can't listen yet. Chrome, Edge and Safari can, and they work with earbuds and
          smart glasses paired over Bluetooth.
        </p>
      ) : running ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex h-16 items-center gap-3 rounded-full bg-white/10 px-8 text-lg font-semibold hover:bg-white/15"
        >
          <Square className="size-5" /> Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="btn-aurora inline-flex h-16 items-center gap-3 rounded-full px-8 text-lg font-semibold"
        >
          <Headphones className="size-6" /> Start
        </button>
      )}
      <p className="max-w-md text-sm text-ink-faint">
        Pair your earbuds or Meta glasses with this phone first. Their microphone and speakers carry
        the whole conversation, so you never have to look down. Say “read me one” to hear a memory,
        or “stop” when you're done.
      </p>
    </main>
  );
}
