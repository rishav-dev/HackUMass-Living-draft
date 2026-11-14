import type { PersonMention, Season } from '../types';

const POSSESSIVE_NOUNS: Record<string, string> = {
  promise: 'promise',
  promised: 'promise',
  birthday: 'birthday',
  wedding: 'wedding',
  funeral: 'funeral',
  garden: 'garden',
  kitchen: 'kitchen',
  advice: 'advice',
  letter: 'letter',
  gift: 'gift',
  recipe: 'recipe',
  secret: 'secret',
  surprise: 'surprise',
  apology: 'apology',
  porch: 'porch',
};

const WITH_PHRASES: Record<string, string> = {
  trip: 'The trip',
  outing: 'The outing',
  vacation: 'The vacation',
  drive: 'The drive',
  walk: 'A walk',
  game: 'The game',
  fight: 'The fight',
  argument: 'The argument',
  argued: 'The argument',
  talk: 'A talk',
  dinner: 'Dinner',
  lunch: 'Lunch',
  call: 'The phone call',
  hike: 'The hike',
  concert: 'The concert',
  movie: 'The movie',
  picnic: 'The picnic',
  move: 'Moving day',
  moved: 'Moving day',
};

const EVENT_NOUNS: Record<string, string> = {
  recital: 'recital',
  graduation: 'graduation',
  competition: 'competition',
  tournament: 'tournament',
  interview: 'interview',
  wedding: 'wedding',
  funeral: 'funeral',
  sleepover: 'sleepover',
  party: 'party',
  race: 'race',
  exam: 'exam',
  storm: 'storm',
  accident: 'accident',
  kindergarten: 'first day of kindergarten',
  raise: 'raise',
  move: 'move',
  camp: 'camp',
};

const OBJECT_NOUNS: Record<string, string> = {
  ocean: 'ocean',
  beach: 'beach',
  lake: 'lake',
  bike: 'bike',
  dog: 'dog',
  cat: 'cat',
  puppy: 'puppy',
  lunch: 'lunch table',
  bus: 'bus',
  piano: 'piano',
  stage: 'stage',
  homework: 'homework',
  rain: 'rain',
  porch: 'porch',
  hospital: 'hospital',
  apartment: 'apartment',
  snow: 'snow day',
  assignments: 'assignments',
};

const OUTDOOR = new Set([
  'trip',
  'outing',
  'vacation',
  'camp',
  'beach',
  'lake',
  'ocean',
  'storm',
  'rain',
]);

const LEAD_IN =
  /^(?:(?:so|and|well|okay|ok|um|uh|i remember|i remember that|i think|one time|once|back)\s*,?\s*)+|^(?:in|during|around|when|at)\b[^,]*,\s*/i;

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function suggestTitle(text: string, people: PersonMention[], season: Season | null): string {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const wordSet = new Set(words);
  const lead =
    people.find((p) => p.role === 'central') ??
    people.find((p) => p.role === 'supporting') ??
    people.find((p) => p.kind === 'name');

  if (lead) {
    const surfaceSet = new Set(lead.surfaces.map((s) => s.toLowerCase()));
    for (let i = 0; i < words.length; i += 1) {
      const noun = POSSESSIVE_NOUNS[words[i]!];
      if (!noun) continue;
      const window = words.slice(Math.max(0, i - 4), i + 3);
      if (window.some((w) => surfaceSet.has(w) || surfaceSet.has(w.replace(/'s$/, '')))) {
        return `${lead.label}'s ${noun}`;
      }
    }
    for (const word of words) {
      const phrase = WITH_PHRASES[word];
      if (phrase) return `${phrase} with ${lead.label}`;
    }
  }

  const event = Object.keys(EVENT_NOUNS).find((noun) => wordSet.has(noun));
  if (event) {
    const noun = EVENT_NOUNS[event]!;
    if (season && OUTDOOR.has(event)) return `That ${season} ${noun}`;
    return noun.startsWith('first') ? cap(noun) : `The ${noun}`;
  }

  for (const word of words) {
    const noun = OBJECT_NOUNS[word];
    if (!noun) continue;
    if (season && OUTDOOR.has(word))
      return word === 'ocean' ? `That ${season} by the ocean` : `That ${season} ${noun}`;
    return `The ${noun}`;
  }

  const firstSentence = text.split(/[.!?\n]/)[0] ?? text;
  let clause = firstSentence.replace(LEAD_IN, '').replace(LEAD_IN, '').trim();
  clause = clause.split(/,|\band then\b|\bbecause\b/)[0]!.trim();
  const clipped = clause
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .replace(/\b(?:and|the|a|to|of|with|but|so)$/i, '')
    .trim();
  return clipped ? cap(clipped) : 'Untitled memory';
}
