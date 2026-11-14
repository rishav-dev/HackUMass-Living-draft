import { Link } from 'react-router';
import type { Certainty, EmotionDto, PersonRefDto, TemporalDto } from '@living-draft/contracts';
import { connectionLabel } from '@living-draft/engine';
import { CERTAINTY_META, connectionMeta, emotionMeta, initials, tintFor } from '../../lib/meta';

export function CertaintyMark({
  temporal,
  compact = false,
}: {
  temporal: Pick<TemporalDto, 'certainty' | 'label' | 'placedAges' | 'explanation'>;
  compact?: boolean;
}) {
  const meta = CERTAINTY_META[temporal.certainty];
  const Icon = meta.icon;
  const shared =
    temporal.placedAges.length > 1 ? ` · could be age ${temporal.placedAges.join(' or ')}` : '';
  const title = `${meta.label}${shared}${temporal.explanation ? `. ${temporal.explanation}` : ''}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
        temporal.certainty === 'certain'
          ? 'border-ink/15 bg-paper text-ink'
          : temporal.certainty === 'approximate'
            ? 'cert-approximate border-ink/35 bg-paper text-ink-soft'
            : 'cert-unplaced border-ink/35 text-ink-soft'
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{temporal.label}</span>
      {!compact && temporal.certainty !== 'certain' && (
        <span className="sr-only">({meta.label.toLowerCase()})</span>
      )}
    </span>
  );
}

export function CertaintySwatch({ certainty }: { certainty: Certainty }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 rounded-full border-2 ${
        certainty === 'certain'
          ? 'border-ink bg-ink'
          : certainty === 'approximate'
            ? 'hatch cert-approximate border-ink'
            : 'cert-unplaced border-ink'
      }`}
    />
  );
}

export function EmotionChip({
  tag,
  phase,
  size = 'md',
  onRemove,
}: {
  tag: string;
  phase?: 'then' | 'now';
  size?: 'sm' | 'md';
  onRemove?: () => void;
}) {
  const meta = emotionMeta(tag);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${size === 'sm' ? 'px-2 py-0.5 text-[0.7rem]' : 'px-2.5 py-1 text-xs'}`}
      style={{ backgroundColor: meta.tint, color: meta.ink }}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden="true" />
      {meta.label}
      {phase === 'now' && <span className="font-semibold opacity-75">· now</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${meta.label}`}
          className="-mr-1 ml-0.5 rounded-full px-1 hover:bg-black/10"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function EmotionRow({
  emotions,
  size = 'md',
  limit = 6,
}: {
  emotions: Array<Pick<EmotionDto, 'tag' | 'phase'>>;
  size?: 'sm' | 'md';
  limit?: number;
}) {
  if (!emotions.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {emotions.slice(0, limit).map((e) => (
        <EmotionChip key={`${e.tag}-${e.phase}`} tag={e.tag} phase={e.phase} size={size} />
      ))}
    </div>
  );
}

export function Portrait({
  name,
  size = 40,
  photoUrl,
}: {
  name: string;
  size?: number;
  photoUrl?: string | null;
}) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-semibold text-ink"
      style={{ width: size, height: size, backgroundColor: tintFor(name), fontSize: size * 0.38 }}
    >
      {photoUrl ? <img src={photoUrl} alt="" className="size-full object-cover" /> : initials(name)}
      <span className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/50" />
    </span>
  );
}

const ROLE_LABEL = {
  central: 'Central',
  supporting: 'Supporting',
  mentioned: 'Mentioned',
} as const;

export function PeopleRow({ people, linked = true }: { people: PersonRefDto[]; linked?: boolean }) {
  if (!people.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {people.map((person) => {
        const content = (
          <>
            <Portrait name={person.name} size={20} />
            <span>{person.name}</span>
            <span className="sr-only">, {ROLE_LABEL[person.role]}</span>
            {person.role === 'central' && (
              <span aria-hidden="true" className="text-gold-deep">
                ★
              </span>
            )}
          </>
        );
        return linked ? (
          <Link
            key={person.characterId}
            to={`/people/${person.characterId}`}
            viewTransition
            title={`${person.name} · ${ROLE_LABEL[person.role]}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper py-0.5 pl-0.5 pr-2.5 text-xs font-bold shadow-sm ring-1 ring-ink/8 transition hover:ring-lavender-deep/40"
          >
            {content}
          </Link>
        ) : (
          <span
            key={person.characterId}
            className="inline-flex items-center gap-1.5 rounded-full bg-paper py-0.5 pl-0.5 pr-2.5 text-xs font-bold ring-1 ring-ink/8"
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}

export function ConnectionGlyphs({ types }: { types: string[] }) {
  if (!types.length) return null;
  return (
    <div className="flex items-center gap-1">
      {types.map((type) => {
        const meta = connectionMeta(type);
        return (
          <span
            key={type}
            title={connectionLabel(type)}
            className="inline-flex size-6 items-center justify-center rounded-full border-2 bg-paper text-[0.7rem] font-bold"
            style={{ borderColor: meta.color, color: meta.color }}
          >
            <span aria-hidden="true">{meta.glyph}</span>
            <span className="sr-only">{connectionLabel(type)}</span>
          </span>
        );
      })}
    </div>
  );
}

export function RoleBadge({ role }: { role: keyof typeof ROLE_LABEL }) {
  const styles = {
    central: 'bg-gold/30 text-gold-deep',
    supporting: 'bg-sage/40 text-sage-deep',
    mentioned: 'bg-linen text-ink-soft',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide ${styles[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
