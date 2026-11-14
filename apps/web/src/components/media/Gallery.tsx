import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { MediaDto } from '@living-draft/contracts';
import { hashNumber } from '../../lib/meta';
import { useDuckWhilePlaying, useSound } from '../../lib/sound/SoundProvider';

export function VideoNote({ media }: { media: MediaDto }) {
  const duck = useDuckWhilePlaying();
  return (
    <figure className="rounded-2xl bg-dusk p-2 pb-3 shadow-lift">
      <div className="relative overflow-hidden rounded-xl">
        <video
          src={media.url}
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full bg-night object-cover"
          {...duck}
        />
      </div>
      <figcaption className="mt-2 flex items-center justify-between px-2 text-xs font-semibold text-snow/80">
        <span>{media.caption ?? 'Video note'}</span>
        <span className="tracking-[0.3em] text-snow/40">● ● ●</span>
      </figcaption>
    </figure>
  );
}

export function PhotoStack({
  photos,
  onOpen,
}: {
  photos: MediaDto[];
  onOpen: (index: number) => void;
}) {
  const { play } = useSound();
  return (
    <div className="flex flex-wrap gap-5">
      {photos.map((photo, index) => {
        const tilt = (hashNumber(photo.id) - 0.5) * 7;
        return (
          <motion.button
            key={photo.id}
            type="button"
            onClick={() => {
              play('whoosh');
              onOpen(index);
            }}
            whileHover={{ rotate: 0, y: -6, scale: 1.02 }}
            style={{ rotate: tilt }}
            className="relative w-44 bg-paper p-2 pb-8 text-left shadow-lift sm:w-52"
            aria-label={`Open photo${photo.caption ? `: ${photo.caption}` : ''}`}
          >
            <img
              src={photo.url}
              alt={photo.caption ?? ''}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            {photo.caption && (
              <span className="absolute inset-x-2 bottom-1.5 truncate eyebrow">
                {photo.caption}
              </span>
            )}
            <span
              className="washi -top-3 left-6"
              style={
                {
                  '--washi': index % 2 ? 'rgb(167 192 163 / 0.75)' : 'rgb(238 179 176 / 0.75)',
                  rotate: '-8deg',
                } as React.CSSProperties
              }
            />
          </motion.button>
        );
      })}
    </div>
  );
}

export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: MediaDto[];
  index: number | null;
  onClose: () => void;
  onIndex: (index: number) => void;
}) {
  const { play } = useSound();
  const current = index === null ? null : photos[index];
  return (
    <AnimatePresence>
      {current && index !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-night/90 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
            if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
          }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <motion.figure
            key={current.id}
            initial={{ scale: 0.92, rotate: -2, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="relative max-h-full bg-paper p-3 pb-12 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.url}
              alt={current.caption ?? ''}
              className="max-h-[78dvh] max-w-[88vw] object-contain"
            />
            <figcaption className="absolute inset-x-3 bottom-2 eyebrow">
              {current.caption}
            </figcaption>
          </motion.figure>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-paper/15 p-2 text-snow hover:bg-paper/25"
          >
            <X className="size-6" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute left-4 rounded-full bg-paper/15 p-3 text-snow hover:bg-paper/25"
                onClick={(e) => {
                  e.stopPropagation();
                  play('shift');
                  onIndex((index - 1 + photos.length) % photos.length);
                }}
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                className="absolute right-4 rounded-full bg-paper/15 p-3 text-snow hover:bg-paper/25"
                onClick={(e) => {
                  e.stopPropagation();
                  play('shift');
                  onIndex((index + 1) % photos.length);
                }}
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
