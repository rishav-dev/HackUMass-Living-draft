export interface SamplePerson {
  name: string;
  said: string[];
  role: 'central' | 'supporting' | 'mentioned';
  relationship?: string;
}

export type SampleWhen =
  | { date: string }
  | { month: string }
  | { ages: [number, number]; season?: 'spring' | 'summer' | 'autumn' | 'winter' }
  | { unknown: true };

export interface SampleTelling {
  raw: string;
  story: string;
  recordedDaysAgo: number;
  sourceKind?: 'speech' | 'typing';
}

export interface SampleMemory {
  key: string;
  title: string;
  raw: string;
  story: string;
  summary: string;
  when: SampleWhen;
  time: { kind: string; hint: string };
  places: string[];
  people: SamplePerson[];
  feelings: Array<[string, 'then' | 'now']>;
  themes?: Array<[string, string]>;
  questions?: Array<[string, string | null]>;
  milestone?: string;
  sourceKind: 'speech' | 'typing';
  sound?: 'piano' | 'ocean' | 'rain' | 'fire';
  soundCaption?: string;
  photos?: Array<{ scene: string; caption: string }>;
  sensitive?: boolean;
  recordedDaysAgo: number;
  tellings?: SampleTelling[];
}

export interface SampleThread {
  type: string;
  from: string;
  to: string;
  explanation: string;
  fromQuote: string;
  toQuote: string;
  status: 'confirmed' | 'suggested';
}
