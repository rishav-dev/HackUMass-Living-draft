export interface Token {
  text: string;
  lower: string;
  start: number;
  end: number;
}

const WORD = /[A-Za-z0-9]+(?:['’][A-Za-z]+)*/g;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(WORD)) {
    const start = match.index ?? 0;
    const raw = match[0];
    tokens.push({
      text: raw,
      lower: raw.toLowerCase().replace(/’/g, "'"),
      start,
      end: start + raw.length,
    });
  }
  return tokens;
}

export const STOPWORDS = new Set(
  `a about above after again against all almost also am an and any are aren't as at be because been
  before being below between both but by can can't cannot could couldn't did didn't do does doesn't
  doing don't down during each even ever every few for from further get got had hadn't has hasn't
  have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i
  i'd i'll i'm i've if in into is isn't it it's its itself just let's like me more most much
  mustn't my myself no nor not now of off on once only or other ought our ours ourselves out over
  own really same shan't she she'd she'll she's should shouldn't so some such than that that's the
  their theirs them themselves then there there's these they they'd they'll they're they've this
  those though through to too under until up upon us very was wasn't we we'd we'll we're we've
  were weren't what what's when when's where where's which while who who's whom why why's will
  with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves yeah okay
  um uh well still back went go going gone come came thing things stuff something anything one
  kind sort maybe probably think thought remember remembered know knew lot lots day time really`
    .split(/\s+/)
    .filter(Boolean),
);

function undouble(word: string): string {
  if (word.length > 2 && word[word.length - 1] === word[word.length - 2]) {
    const last = word[word.length - 1] ?? '';
    if (!'lsz'.includes(last) && !'aeiou'.includes(last)) return word.slice(0, -1);
  }
  return word;
}

export function stem(input: string): string {
  let word = input.toLowerCase().replace(/’/g, "'");
  if (word.endsWith("'s")) word = word.slice(0, -2);
  if (word.endsWith("s'")) word = word.slice(0, -1);
  if (word.length <= 3) return word;

  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ied') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ing') && word.length > 5) return trimE(undouble(word.slice(0, -3)));
  if (word.endsWith('ed') && word.length > 4) return trimE(undouble(word.slice(0, -2)));
  if (/(sh|ch|x|ss|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ly') && word.length > 5) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 3) {
    return trimE(word.slice(0, -1));
  }
  return trimE(word);
}

function trimE(word: string): string {
  return word.length > 3 && word.endsWith('e') ? word.slice(0, -1) : word;
}

export function contentTermPairs(text: string): Array<{ term: string; surface: string }> {
  const pairs: Array<{ term: string; surface: string }> = [];
  for (const token of tokenize(text)) {
    if (STOPWORDS.has(token.lower)) continue;
    if (token.lower.length < 3 && !/^\d+$/.test(token.lower)) continue;
    pairs.push({ term: stem(token.lower), surface: token.lower.replace(/'s$/, '') });
  }
  return pairs;
}

export function contentTerms(text: string): string[] {
  return contentTermPairs(text).map((pair) => pair.term);
}

export function termSet(text: string): Set<string> {
  return new Set(contentTerms(text));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function overlap(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((term) => b.has(term));
}
