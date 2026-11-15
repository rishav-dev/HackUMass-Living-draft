import { detectMotifs } from '@living-draft/engine';

const BY_MOTIF: Record<string, string> = {
  ocean: 'waves',
  lake: 'waves',
  rain: 'rain',
  storm: 'rain',
  fire: 'fire',
  night: 'crickets',
  garden: 'birds',
  forest: 'birds',
  snow: 'bells',
  home: 'room',
  kitchen: 'room',
  hospital: 'room',
  baby: 'room',
  road: 'wind',
  sky: 'wind',
  stage: 'vinyl',
  graduation: 'wind',
};

const BY_SEASON: Record<string, string> = {
  spring: 'birds',
  summer: 'crickets',
  autumn: 'wind',
  winter: 'bells',
};

export function textureFor(
  motifs: string[] | null,
  season: string | null,
  text = '',
): string | null {
  const list = motifs?.length ? motifs : text ? detectMotifs(text, 2) : [];
  for (const motif of list) if (BY_MOTIF[motif]) return BY_MOTIF[motif]!;
  return season ? (BY_SEASON[season] ?? null) : null;
}
