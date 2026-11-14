import type { DayDto } from '@living-draft/contracts';
import { SceneArt } from '../../components/scene/SceneArt';
import { plural } from '../../lib/format';
import { emotionMeta } from '../../lib/meta';
import { openPlayback } from '../playback/playbackStore';

export function DayCard({
  day,
  size = 'md',
  onPreview,
}: {
  day: DayDto;
  size?: 'md' | 'lg';
  onPreview?: (day: DayDto | null) => void;
}) {
  const large = size === 'lg';
  return (
    <button
      type="button"
      onClick={() => openPlayback({ date: day.date })}
      onPointerEnter={() => onPreview?.(day)}
      onPointerLeave={() => onPreview?.(null)}
      onFocus={() => onPreview?.(day)}
      onBlur={() => onPreview?.(null)}
      aria-label={`Go back to ${day.label}: ${day.memories.map((m) => m.title).join(', ')}`}
      className={`group relative block shrink-0 overflow-hidden rounded-3xl text-left ring-1 ring-white/10 transition duration-500 hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_var(--mood-c)] hover:ring-white/30 ${large ? 'w-full' : 'w-72'}`}
    >
      <SceneArt
        artKey={day.artKey}
        artUrl={day.artUrl}
        motifs={day.motifs}
        emotions={day.emotions}
        pan={false}
        className={`${large ? 'h-64' : 'h-44'} transition duration-700 group-hover:scale-[1.04]`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/30 to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-1.5">
          {day.emotions.slice(0, 4).map((tag) => (
            <span
              key={tag}
              title={emotionMeta(tag).label}
              className="size-2.5 rounded-full"
              style={{
                background: emotionMeta(tag).ink,
                boxShadow: `0 0 10px ${emotionMeta(tag).ink}`,
              }}
            />
          ))}
        </div>
        <span className="absolute right-4 top-4 rounded-full bg-abyss/88 px-2.5 py-1 text-xs font-bold text-snow">
          {plural(day.count, 'memory', 'memories')}
        </span>
        <div className="absolute inset-x-4 bottom-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-snow/70">
            {day.age !== null ? `Age ${day.age}` : 'Age not set'}
          </p>
          <p className={`font-display font-semibold text-snow ${large ? 'text-2xl' : 'text-lg'}`}>
            {day.label}
          </p>
        </div>
      </SceneArt>
      <ul className="space-y-1 bg-abyss/88 px-4 py-3">
        {day.memories.slice(0, large ? 5 : 3).map((m) => (
          <li key={m.id} className="flex items-center gap-2 truncate text-sm text-ink-soft">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: m.emotions[0] ? emotionMeta(m.emotions[0]).ink : '#c4b5fd' }}
            />
            <span className="truncate">{m.title}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
