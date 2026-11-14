import { useState } from 'react';
import { Link } from 'react-router';
import {
  AudioLines,
  Eye,
  Film,
  History,
  Image as ImageIcon,
  Moon,
  TriangleAlert,
} from 'lucide-react';
import type { MemoryCardDto } from '@living-draft/contracts';
import { emotionMeta } from '../../lib/meta';
import { prepareMemoryMusic } from '../../lib/sound/prepare';
import { useSound } from '../../lib/sound/SoundProvider';
import { CertaintyMark, ConnectionGlyphs, EmotionRow, PeopleRow } from './bits';

export function MemoryCard({
  memory,
  note,
  selectable,
  selected,
  onSelect,
  index = 0,
}: {
  memory: MemoryCardDto;
  note?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  index?: number;
}) {
  const { play } = useSound();
  const [revealed, setRevealed] = useState(false);
  const hidden = memory.sensitive && !revealed;
  const glow = memory.emotions[0] ? emotionMeta(memory.emotions[0].tag).ink : '#c4b5fd';
  const body = (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-4 left-0 w-0.5 rounded-full opacity-70 transition group-hover:opacity-100"
        style={{ background: glow, boxShadow: `0 0 14px ${glow}` }}
      />
      {memory.cover && !hidden && (
        <div className="relative float-right -mr-1 -mt-1 mb-2 ml-4 w-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/15 sm:w-36">
          <img
            src={memory.cover.url}
            alt=""
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105"
          />
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CertaintyMark temporal={memory.temporal} compact />
        {memory.sensitive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[0.7rem] font-bold text-ink-soft">
            <Moon className="size-3" aria-hidden="true" /> Kept quiet
          </span>
        )}
        {memory.reviewStatus === 'needs_review' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-peach/50 px-2 py-0.5 text-[0.7rem] font-bold text-peach-deep">
            <TriangleAlert className="size-3" aria-hidden="true" /> Worth a look
          </span>
        )}
      </div>
      <h3
        className="text-xl font-semibold leading-snug"
        style={{ viewTransitionName: `mt-${memory.id}` }}
      >
        {memory.title}
      </h3>
      {hidden ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setRevealed(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              setRevealed(true);
            }
          }}
          className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-faint hover:text-ink-soft"
        >
          <Eye className="size-4" aria-hidden="true" /> Show a preview
        </span>
      ) : (
        <p className="mt-1.5 line-clamp-3 text-[0.95rem] text-ink-soft">{memory.excerpt}</p>
      )}
      {note && <p className="mt-2 eyebrow">{note}</p>}
      <div className="clear-both mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <EmotionRow
          emotions={memory.emotions.filter((e) => e.phase === 'then')}
          size="sm"
          limit={3}
        />
        <PeopleRow people={memory.people.slice(0, 3)} linked={false} />
        <div className="ml-auto flex items-center gap-2 text-ink-faint">
          <ConnectionGlyphs types={memory.connectionTypes} />
          {memory.versionCount > 1 && (
            <span
              className="inline-flex items-center gap-1 text-xs font-bold"
              title={`Told ${memory.versionCount} times`}
            >
              <History className="size-3.5" aria-hidden="true" />
              {memory.versionCount}
              <span className="sr-only">tellings</span>
            </span>
          )}
          {memory.mediaKinds.includes('photo') && (
            <ImageIcon className="size-4" aria-label="Has photos" />
          )}
          {memory.mediaKinds.includes('audio') && (
            <AudioLines className="size-4" aria-label="Has a recording" />
          )}
          {memory.mediaKinds.includes('video') && (
            <Film className="size-4" aria-label="Has a video" />
          )}
        </div>
      </div>
    </>
  );

  const classes = `paper anim-rise group relative block overflow-hidden rounded-3xl p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lift ${
    memory.temporal.certainty === 'approximate'
      ? 'outline-dashed outline-2 -outline-offset-8 outline-white/12'
      : ''
  } ${selected ? 'ring-2 ring-magenta shadow-[0_0_40px_-10px_var(--color-magenta)]' : ''}`;

  if (selectable) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={classes}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        {body}
      </button>
    );
  }
  return (
    <Link
      to={`/memories/${memory.id}`}
      viewTransition
      onClick={() => play('shift')}
      onPointerEnter={() => prepareMemoryMusic(memory)}
      onFocus={() => prepareMemoryMusic(memory)}
      className={classes}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {body}
    </Link>
  );
}
