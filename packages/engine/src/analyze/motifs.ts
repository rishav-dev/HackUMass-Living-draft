export type Motif =
  | 'ocean'
  | 'lake'
  | 'garden'
  | 'forest'
  | 'snow'
  | 'rain'
  | 'storm'
  | 'fire'
  | 'stage'
  | 'school'
  | 'home'
  | 'kitchen'
  | 'road'
  | 'city'
  | 'night'
  | 'hospital'
  | 'party'
  | 'sports'
  | 'graduation'
  | 'baby'
  | 'office'
  | 'sky';

const LEXICON: Array<[Motif, RegExp]> = [
  ['ocean', /\b(ocean|sea|waves?|beach|shore|surf|maine coast)\b/i],
  ['lake', /\b(lake|pond|river|dock|stones?)\b/i],
  ['garden', /\b(garden|tomato(es)?|flowers?|vines?|backyard|porch|roses?)\b/i],
  ['forest', /\b(forest|woods|trees?|park|trail|hike)\b/i],
  ['snow', /\b(snow|ice storm|icy|frozen|winter)\b/i],
  ['rain', /\b(rain(ed|ing)?|wet dirt|puddles?|drizzle)\b/i],
  ['storm', /\b(storm|thunder|lightning|power (went )?out)\b/i],
  ['fire', /\b(fireplace|fire|candles?|bonfire|campfire)\b/i],
  ['stage', /\b(recital|stage|piano|concert|performance|spotlight|audience|dance)\b/i],
  [
    'school',
    /\b(school|class(room)?|lunch|cafeteria|teacher|kindergarten|grade|homework|assignments?|hallway)\b/i,
  ],
  ['home', /\b(apartment|house|home|room|moved|move|boxes|shelves|living room|bed)\b/i],
  ['kitchen', /\b(kitchen|cooking|dinner|breakfast|cake|ice cream|pizza)\b/i],
  ['road', /\b(road ?trip|drive|drove|car|highway|bike|bicycle|rode)\b/i],
  ['city', /\b(city|street|downtown|subway|bus|office)\b/i],
  ['night', /\b(night|dark|stars?|moon|midnight|5 in the morning|five in the morning)\b/i],
  ['hospital', /\b(hospital|born|doctor|nurse|clinic)\b/i],
  ['party', /\b(party|birthday|celebrat\w*|confetti|wedding)\b/i],
  ['sports', /\b(game|match|team|field|soccer|basketball|race|swim)\b/i],
  ['graduation', /\b(graduat\w*|diploma|cap and gown|ceremony)\b/i],
  ['baby', /\b(baby|newborn|little brother|little sister|was born)\b/i],
  ['office', /\b(boss|raise|meeting|job|work|desk|manager)\b/i],
];

export function detectMotifs(text: string, limit = 3): Motif[] {
  const scored: Array<[Motif, number]> = [];
  for (const [motif, pattern] of LEXICON) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches?.length) scored.push([motif, matches.length]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const result = scored.slice(0, limit).map(([m]) => m);
  return result.length ? result : ['sky'];
}

export const MOTIF_SCENES: Record<Motif, string> = {
  ocean: 'a vast ocean shoreline with rolling waves under a wide sky',
  lake: 'a still lake with a small wooden dock and distant hills',
  garden: 'an overgrown garden with vines and leaves catching soft light',
  forest: 'a misty forest path with tall trees',
  snow: 'a quiet snow covered street with frost on the windows',
  rain: 'rain streaking down a window with blurred lights behind it',
  storm: 'a dramatic storm sky with flickering light over rooftops',
  fire: 'a fireplace glowing in a dark living room',
  stage: 'an empty stage with a grand piano under a single spotlight',
  school: 'a school hallway with tall windows and long afternoon shadows',
  home: 'a small apartment with moving boxes and warm lamplight',
  kitchen: 'a warm kitchen with steam rising in the lamplight',
  road: 'an open road stretching toward the horizon',
  city: 'a city street with reflections on wet pavement',
  night: 'a night sky full of stars over a sleeping town',
  hospital: 'a quiet hospital window at dawn',
  party: 'string lights and confetti floating in the night air',
  sports: 'an empty sports field under floodlights',
  graduation: 'graduation caps tossed into a bright open sky',
  baby: 'a soft nursery bathed in early morning light',
  office: 'a modern office at night with city lights outside',
  sky: 'clouds drifting through a vast luminous sky',
};
