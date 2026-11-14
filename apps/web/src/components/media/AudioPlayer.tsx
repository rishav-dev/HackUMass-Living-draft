import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { MediaDto } from '@living-draft/contracts';
import { formatDuration } from '../../lib/recorder';
import { useDuckWhilePlaying } from '../../lib/sound/SoundProvider';
import { loadPeaks } from '../../lib/waveform';

export function AudioPlayer({
  media,
  label,
  tone = 'light',
}: {
  media: Pick<MediaDto, 'url' | 'caption' | 'durationMs'>;
  label?: string;
  tone?: 'light' | 'dark';
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState((media.durationMs ?? 0) / 1000);
  const duck = useDuckWhilePlaying();

  useEffect(() => {
    let cancelled = false;
    loadPeaks(media.url, 56)
      .then((p) => !cancelled && setPeaks(p))
      .catch(
        () =>
          !cancelled &&
          setPeaks(Array.from({ length: 56 }, (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.7)))),
      );
    return () => {
      cancelled = true;
    };
  }, [media.url]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const seek = (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el || !el.duration) return;
    if ('key' in event) {
      if (event.key === 'ArrowRight') el.currentTime = Math.min(el.duration, el.currentTime + 5);
      if (event.key === 'ArrowLeft') el.currentTime = Math.max(0, el.currentTime - 5);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    el.currentTime = ((event.clientX - rect.left) / rect.width) * el.duration;
  };

  const dark = tone === 'dark';
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-3 ${dark ? 'bg-white/10 text-snow' : 'paper'}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause recording' : 'Play recording'}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full transition ${dark ? 'bg-paper text-ink' : 'bg-ink text-abyss hover:bg-snow'}`}
      >
        {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
      </button>
      <div className="min-w-0 flex-1">
        {(label || media.caption) && (
          <p className={`mb-1 truncate text-sm font-semibold ${dark ? 'text-snow/90' : ''}`}>
            {label ?? media.caption}
          </p>
        )}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Position in recording"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(progress * duration)}
          onClick={seek}
          onKeyDown={seek}
          className="flex h-9 cursor-pointer items-center gap-[2px]"
        >
          {(peaks ?? Array.from({ length: 56 }, () => 0.15)).map((peak, i, list) => {
            const played = i / list.length < progress;
            return (
              <span
                key={i}
                className="w-full rounded-full transition-colors"
                style={{
                  height: `${Math.max(10, peak * 100)}%`,
                  backgroundColor: played
                    ? dark
                      ? '#e5bd66'
                      : '#6a58a6'
                    : dark
                      ? 'rgb(255 255 255 / 0.35)'
                      : 'rgb(53 47 68 / 0.18)',
                }}
              />
            );
          })}
        </div>
      </div>
      <span
        className={`w-12 shrink-0 text-right text-xs font-bold tabular-nums ${dark ? 'text-snow/80' : 'text-ink-soft'}`}
      >
        {formatDuration((playing || progress > 0 ? progress * duration : duration) * 1000)}
      </span>
      <audio
        ref={audio}
        src={media.url}
        preload="metadata"
        onLoadedMetadata={(e) =>
          Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)
        }
        onTimeUpdate={(e) =>
          setProgress(
            e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0,
          )
        }
        onPlay={() => {
          setPlaying(true);
          duck.onPlay();
        }}
        onPause={() => {
          setPlaying(false);
          duck.onPause();
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          duck.onEnded();
        }}
      />
    </div>
  );
}
