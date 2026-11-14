const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
};

export const NUMBER_PATTERN =
  '(?:\\d{1,2}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)';

export const ORDINAL_PATTERN =
  '(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|1st|2nd|3rd|[4-9]th|1[0-2]th)';

export function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (/^\d+$/.test(value)) return Number(value);
  if (value in UNITS) return UNITS[value]!;
  if (value in TENS) return TENS[value]!;
  const parts = value.split(/[- ]/);
  if (parts.length === 2 && parts[0]! in TENS && parts[1]! in UNITS) {
    return TENS[parts[0]!]! + UNITS[parts[1]!]!;
  }
  return null;
}

export function parseOrdinal(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value in ORDINALS) return ORDINALS[value]!;
  const numeric = value.match(/^(\d{1,2})(?:st|nd|rd|th)$/);
  return numeric ? Number(numeric[1]) : null;
}

const SMALL = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const DECADES = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

export function numberToWords(value: number): string {
  if (value < 0 || !Number.isInteger(value)) return String(value);
  if (value < 20) return SMALL[value]!;
  if (value < 100) {
    const tens = DECADES[Math.floor(value / 10)]!;
    const rest = value % 10;
    return rest === 0 ? tens : `${tens}-${SMALL[rest]!.toLowerCase()}`;
  }
  if (value < 1000) {
    const hundreds = `${SMALL[Math.floor(value / 100)]} Hundred`;
    const rest = value % 100;
    return rest === 0 ? hundreds : `${hundreds} ${numberToWords(rest)}`;
  }
  return String(value);
}

export function countPhrase(count: number, singular: string, plural = `${singular}s`): string {
  const word = count < 20 ? numberToWords(count).toLowerCase() : String(count);
  return `${word} ${count === 1 ? singular : plural}`;
}
