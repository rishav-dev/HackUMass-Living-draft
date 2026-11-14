import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface Recording {
  blob: Blob;
  url: string;
  durationMs: number;
  kind: 'audio' | 'video';
  mimeType: string;
}

function pickMime(video: boolean): string {
  const options = video
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return (
    options.find(
      (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
    ) ?? ''
  );
}

export const recordingSupported = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const frame = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const startedAt = useRef(0);
  const accumulated = useRef(0);
  const kindRef = useRef<'audio' | 'video'>('audio');

  const cleanup = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stream?.getTracks().forEach((t) => t.stop());
    void audioContext.current?.close();
    audioContext.current = null;
    setStream(null);
    setLevel(0);
  }, [stream]);

  const start = useCallback(async (options: { video?: boolean } = {}) => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: options.video
          ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
      });
      kindRef.current = options.video ? 'video' : 'audio';
      setStream(media);
      const mimeType = pickMime(!!options.video);
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      instance.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      instance.start(500);
      recorder.current = instance;
      startedAt.current = performance.now();
      accumulated.current = 0;

      const ctx = new AudioContext();
      audioContext.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        if (recorder.current?.state === 'recording') {
          setElapsed(accumulated.current + performance.now() - startedAt.current);
        }
        frame.current = requestAnimationFrame(tick);
      };
      tick();
      setState('recording');
      return true;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was blocked. You can still type your memory.'
          : name === 'NotFoundError'
            ? "I couldn't find a microphone or camera. Typing works just as well."
            : "Recording didn't start. You can still type.",
      );
      return false;
    }
  }, []);

  const pause = useCallback(() => {
    if (recorder.current?.state !== 'recording') return;
    recorder.current.pause();
    accumulated.current += performance.now() - startedAt.current;
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    if (recorder.current?.state !== 'paused') return;
    recorder.current.resume();
    startedAt.current = performance.now();
    setState('recording');
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Recording | null>((resolve) => {
        const instance = recorder.current;
        if (!instance || instance.state === 'inactive') {
          cleanup();
          resolve(null);
          return;
        }
        const duration =
          accumulated.current +
          (instance.state === 'recording' ? performance.now() - startedAt.current : 0);
        instance.onstop = () => {
          const type =
            instance.mimeType || (kindRef.current === 'video' ? 'video/webm' : 'audio/webm');
          const blob = new Blob(chunks.current, { type });
          cleanup();
          setState('stopped');
          resolve({
            blob,
            url: URL.createObjectURL(blob),
            durationMs: duration,
            kind: kindRef.current,
            mimeType: type,
          });
        };
        instance.stop();
      }),
    [cleanup],
  );

  const cancel = useCallback(() => {
    if (recorder.current && recorder.current.state !== 'inactive') {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    chunks.current = [];
    cleanup();
    setState('idle');
    setElapsed(0);
  }, [cleanup]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return {
    state,
    level,
    elapsed,
    stream,
    error,
    start,
    pause,
    resume,
    stop,
    cancel,
    supported: recordingSupported(),
  };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
