import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, X } from 'lucide-react';
import { detectMotifs } from '@living-draft/engine';
import { declineArt, isWaitingForArt, repaintArt, useArt } from '../../api/art';
import { paintScene, peekScene } from '../../lib/art/painter';
import { blendEmotions } from '../../lib/mood/moods';
import { useToast } from '../ui/Toast';

interface SceneArtProps {
  artKey: string;
  artUrl?: string | null;
  motifs?: string[];
  text?: string;
  emotions?: string[];
  generate?: boolean;
  pan?: boolean;
  credit?: boolean;
  controls?: boolean;
  size?: 'card' | 'hero';
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
}

const REASONS: Record<string, string> = {
  disabled: 'Online illustrations are off in Settings, so this page keeps its sketch.',
  quota: "Today's allowance of new scenes is used up. Try again tomorrow.",
  failed: "The image service didn't answer. The local painting stays for now.",
  missing: 'There is nothing to paint from yet.',
};

export function SceneArt({
  artKey,
  artUrl,
  motifs,
  text = '',
  emotions = [],
  generate = true,
  pan = true,
  credit = false,
  controls = false,
  size = 'card',
  className = '',
  imageClassName = '',
  children,
}: SceneArtProps) {
  const fetched = useArt(artUrl ? [] : [artKey], { generate });
  const url = artUrl ?? fetched[artKey] ?? null;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const toast = useToast();

  const holder = useRef<HTMLDivElement>(null);
  const emotionKey = emotions.join(',');
  const motifKey = motifs?.join(',') ?? text;
  const [width, height] = size === 'hero' ? [960, 560] : [520, 304];
  const spec = useMemo(
    () => ({
      motifs: motifs ?? detectMotifs(text, 2),
      palette: blendEmotions(emotionKey ? emotionKey.split(',').map((tag) => ({ tag })) : [])
        .palette,
      seed: artKey,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artKey, emotionKey, motifKey],
  );
  const [painted, setPainted] = useState<{ key: string; url: string } | null>(null);
  const specKey = `${artKey}|${emotionKey}|${motifKey}|${width}`;
  const paintedUrl = painted?.key === specKey ? painted.url : peekScene(spec, width);
  const needsPainting = !paintedUrl && !(url && loaded === url);

  useEffect(() => {
    const el = holder.current;
    if (!needsPainting || !el) return;
    let cancelled = false;
    let idle = 0;
    const paint = () => {
      if (!cancelled) setPainted({ key: specKey, url: paintScene(spec, width, height) });
    };
    const schedule = () => {
      idle =
        typeof window.requestIdleCallback === 'function'
          ? window.requestIdleCallback(paint, { timeout: 1200 })
          : window.setTimeout(paint, 60);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        schedule();
      },
      { rootMargin: '240px' },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [needsPainting, spec, specKey, width, height]);

  const ready = url !== null && loaded === url;
  const painting = isWaitingForArt(artKey);

  const repaint = async () => {
    setBusy(true);
    try {
      const reply = await repaintArt(artKey, client);
      if (reply.url === null && reply.reason !== 'queued')
        toast(REASONS[reply.reason] ?? 'Not this time.', 'info');
      else toast('Painting a new one. It’ll fade in when it’s ready.', 'info');
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await declineArt(artKey, client);
      toast('Taken out. This page keeps its sketch.', 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={holder}
      className={`${className.split(' ').some((c) => c === 'absolute' || c === 'fixed') ? '' : 'relative'} overflow-hidden bg-abyss ${className}`}
      style={{
        backgroundImage: `radial-gradient(ellipse at 30% 25%, ${spec.palette[1]}aa, transparent 65%), linear-gradient(180deg, ${spec.palette[0]}, #07060e)`,
      }}
    >
      {paintedUrl && (
        <img
          src={paintedUrl}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 size-full object-cover ${pan ? 'anim-kenburns' : ''} ${imageClassName}`}
        />
      )}
      {url && (
        <img
          src={url}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoaded(url)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ${ready ? 'opacity-100' : 'opacity-0'} ${pan ? 'anim-kenburns' : ''} ${imageClassName}`}
        />
      )}
      {(credit || controls) && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-abyss/88 p-1 pl-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          <span title="Scene art is illustration, not a record of what happened">
            {painting ? 'Painting…' : ready ? 'Illustration' : 'Sketch'}
          </span>
          {controls && (
            <>
              <button
                type="button"
                disabled={busy || painting}
                onClick={() => void repaint()}
                aria-label={ready ? 'Dream a different scene' : 'Dream a scene online'}
                title={ready ? 'Dream a different scene' : 'Dream a scene online'}
                className="rounded-full p-1.5 normal-case tracking-normal text-ink-soft transition hover:bg-white/10 hover:text-snow disabled:opacity-40"
              >
                <RefreshCw className={`size-3.5 ${painting ? 'animate-spin' : ''}`} />
              </button>
              {ready && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decline()}
                  aria-label="Not this picture, keep the local painting"
                  title="Not this picture"
                  className="rounded-full p-1.5 text-ink-soft transition hover:bg-white/10 hover:text-snow disabled:opacity-40"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
