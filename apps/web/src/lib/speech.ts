import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => recognitionClass() !== null;

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. You can still type.',
  'service-not-allowed': 'Speech recognition is turned off in this browser. Typing works the same.',
  network:
    'Live transcription needs a connection in this browser. Your recording is still saved, and you can type what you said.',
  'audio-capture': "I can't hear a microphone. Check it's plugged in, or type instead.",
};

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const finalRef = useRef(onFinal);
  useLayoutEffect(() => {
    finalRef.current = onFinal;
  });

  const start = useCallback(() => {
    const Recognition = recognitionClass();
    if (!Recognition) return false;
    setError(null);
    wanted.current = true;
    const instance = new Recognition();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || 'en-US';
    instance.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]!;
        if (result.isFinal) finalRef.current(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    instance.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(ERRORS[event.error] ?? 'Live transcription stopped. You can keep typing.');
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error))
        wanted.current = false;
    };
    instance.onend = () => {
      setInterim('');
      if (wanted.current) {
        try {
          instance.start();
          return;
        } catch {
          wanted.current = false;
        }
      }
      setListening(false);
    };
    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.abort();
    },
    [],
  );

  return { supported: speechSupported(), listening, interim, error, start, stop };
}

export function listenOnce(options: { timeoutMs?: number } = {}): Promise<string> {
  const Recognition = recognitionClass();
  if (!Recognition) return Promise.reject(new Error('Speech recognition is not available here'));
  return new Promise((resolve, reject) => {
    const instance = new Recognition();
    instance.continuous = false;
    instance.interimResults = false;
    instance.lang = navigator.language || 'en-US';
    let heard = '';
    const timer = window.setTimeout(() => instance.stop(), options.timeoutMs ?? 20_000);
    instance.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]!;
        if (result.isFinal) heard += `${result[0].transcript} `;
      }
    };
    instance.onerror = (event) => {
      window.clearTimeout(timer);
      if (event.error === 'no-speech' || event.error === 'aborted') resolve('');
      else reject(new Error(ERRORS[event.error] ?? 'Listening stopped.'));
    };
    instance.onend = () => {
      window.clearTimeout(timer);
      resolve(heard.trim());
    };
    instance.start();
  });
}
