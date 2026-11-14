export interface NarrationPerson {
  name: string;
  pronouns?: string | null;
}

interface PronounSet {
  subject: string;
  object: string;
  possessive: string;
  independent: string;
  reflexive: string;
  plural: boolean;
}

const THEY: PronounSet = {
  subject: 'they',
  object: 'them',
  possessive: 'their',
  independent: 'theirs',
  reflexive: 'themselves',
  plural: true,
};

function pronounSet(pronouns: string | null | undefined): PronounSet {
  const value = (pronouns ?? '').toLowerCase().trim();
  if (value.startsWith('she'))
    return {
      subject: 'she',
      object: 'her',
      possessive: 'her',
      independent: 'hers',
      reflexive: 'herself',
      plural: false,
    };
  if (value.startsWith('he'))
    return {
      subject: 'he',
      object: 'him',
      possessive: 'his',
      independent: 'his',
      reflexive: 'himself',
      plural: false,
    };
  return THEY;
}

const SKIP = new Set(
  'still never always just really also only even finally sometimes often usually actually honestly barely almost already truly genuinely definitely probably maybe kind sort totally completely simply somehow suddenly then'.split(
    ' ',
  ),
);

const UNCHANGED = new Set(
  `can could will would should might must may shall did had was were used
  went felt said saw made knew thought got came took found told left ran sat stood kept held heard lost wore wrote
  drove gave became began bought brought caught fell forgot grew hid hit hurt let meant met paid put read rode rang
  sang slept spent spoke threw understood woke won swam ate drank sank shook stole struck swore taught tore wept
  flew forgave froze hung laid led lit rose sent shot shut slid split spread stuck stung swept swung bent bit blew
  broke built burnt chose cut dealt dreamt dug fed fought fled ground knelt leapt learnt lent lay quit set sold
  sought spun spat sprang stank strode wove`.split(/\s+/),
);

const SINGULAR: Record<string, string> = {
  am: 'is',
  are: 'is',
  have: 'has',
  do: 'does',
  go: 'goes',
  "don't": "doesn't",
  "haven't": "hasn't",
  "aren't": "isn't",
  "can't": "can't",
  "won't": "won't",
  "didn't": "didn't",
  "wasn't": "wasn't",
  "couldn't": "couldn't",
  "wouldn't": "wouldn't",
  "shouldn't": "shouldn't",
};

const PLURAL: Record<string, string> = { am: 'are', was: 'were', "wasn't": "weren't" };

function conjugate(word: string, plural: boolean): string {
  const lower = word.toLowerCase().replace('’', "'");
  if (plural) return PLURAL[lower] ? matchCase(word, PLURAL[lower]!) : word;
  if (SINGULAR[lower]) return matchCase(word, SINGULAR[lower]!);
  if (UNCHANGED.has(lower) || /(ed|ing|'s|n't)$/.test(lower) || lower.length < 2) return word;
  if (!/^[a-z]+$/.test(lower)) return word;
  if (/(s|sh|ch|x|z|o)$/.test(lower)) return `${word}es`;
  if (/[^aeiou]y$/.test(lower)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function matchCase(source: string, target: string): string {
  const quoted = source.includes('’') ? target.replace(/'/g, '’') : target;
  return source[0] === source[0]!.toUpperCase()
    ? quoted.charAt(0).toUpperCase() + quoted.slice(1)
    : quoted;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const PEOPLE = new Set(
  'mom dad mum mother father brother sister brothers sisters friend friends family cousin cousins parents grandma grandpa grandmother grandfather nani nana dadi dada aunt uncle husband wife partner boyfriend girlfriend team class roommate roommates kids son daughter baby teacher coach'.split(
    ' ',
  ),
);

const TOKEN = /(\s+|[A-Za-z]+(?:['’][A-Za-z]+)?|[^\sA-Za-z]+)/g;

export function toThirdPerson(text: string, person: NarrationPerson): string {
  const set = pronounSet(person.pronouns);
  const name = person.name.trim().split(/\s+/)[0] || capitalize(set.subject);
  let named = false;

  const parts = text.split(/(“[^”]*”|"[^"]*")/);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      const tokens = part.match(TOKEN) ?? [];
      let sentenceStart = index === 0 ? true : /[.!?]\s*$/.test(parts[index - 1] ?? '');
      const nextWord = (from: number) => {
        for (let j = from + 1; j < tokens.length; j += 1) {
          if (/^\s+$/.test(tokens[j]!)) continue;
          return /^[A-Za-z]/.test(tokens[j]!) ? j : -1;
        }
        return -1;
      };
      const prevToken = (from: number) => {
        for (let j = from - 1; j >= 0; j -= 1) {
          if (/^\s+$/.test(tokens[j]!)) continue;
          return { word: tokens[j]!, index: j };
        }
        return { word: '', index: -1 };
      };
      const compound = (from: number) => {
        const and = prevToken(from);
        if (and.word.toLowerCase() !== 'and') return false;
        const before = prevToken(and.index).word;
        return (/^[A-Z]/.test(before) && before !== 'I') || PEOPLE.has(before.toLowerCase());
      };
      const subject = () => {
        if (!named) {
          named = true;
          return { word: name, plural: false };
        }
        return { word: set.subject, plural: set.plural };
      };
      const start = (word: string, atStart: boolean) => (atStart ? capitalize(word) : word);

      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i]!;
        if (/^\s+$/.test(token)) continue;
        if (!/^[A-Za-z]/.test(token)) {
          if (/[.!?]/.test(token)) sentenceStart = true;
          continue;
        }
        const lower = token.toLowerCase().replace('’', "'");
        const atStart = sentenceStart;
        sentenceStart = false;

        if (lower === 'i') {
          const afterAnd = compound(i);
          if (afterAnd) named = true;
          const who = afterAnd ? { word: name, plural: false } : subject();
          tokens[i] = start(who.word, atStart);
          if (afterAnd) continue;
          let j = nextWord(i);
          while (j !== -1 && SKIP.has(tokens[j]!.toLowerCase())) j = nextWord(j);
          if (j !== -1) tokens[j] = conjugate(tokens[j]!, who.plural);
          continue;
        }
        if (lower === "i'm" || lower === "i've" || lower === "i'd" || lower === "i'll") {
          const who = subject();
          const tail = lower.slice(2);
          const pronoun = who.word === name;
          const expanded =
            tail === 'm'
              ? pronoun
                ? `${who.word} is`
                : `${who.word}${who.plural ? "'re" : "'s"}`
              : tail === 've'
                ? pronoun
                  ? `${who.word} has`
                  : `${who.word}${who.plural ? "'ve" : "'s"}`
                : pronoun
                  ? `${who.word} ${tail === 'd' ? 'would' : 'will'}`
                  : `${who.word}'${tail}`;
          tokens[i] = start(expanded, atStart);
          continue;
        }
        const replace = (word: string) => {
          tokens[i] = start(matchCase(token, word), atStart);
        };
        if (lower === 'me') replace(compound(i) || !named ? name : set.object);
        else if (lower === 'my') {
          if (!named) {
            named = true;
            replace(`${name}'s`);
          } else replace(set.possessive);
        } else if (lower === 'mine') replace(set.independent);
        else if (lower === 'myself') replace(set.reflexive);
        else if (lower === 'we') replace('they');
        else if (lower === "we're") replace("they're");
        else if (lower === "we've") replace("they've");
        else if (lower === "we'd") replace("they'd");
        else if (lower === "we'll") replace("they'll");
        else if (lower === 'us') replace('them');
        else if (lower === 'our') replace('their');
        else if (lower === 'ours') replace('theirs');
        else if (lower === 'ourselves') replace('themselves');
      }
      return tokens.join('');
    })
    .join('');
}
