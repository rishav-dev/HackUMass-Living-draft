export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Hemisphere = 'north' | 'south' | 'none' | 'unknown';
export type DateOrder = 'mdy' | 'dmy';
export type Confidence = 'high' | 'medium' | 'low';

export type DatePrecision =
  'exact' | 'month' | 'year' | 'season_age' | 'age' | 'age_range' | 'relative' | 'unknown';

export interface TextSpan {
  start: number;
  end: number;
  text: string;
}

export type TemporalClueKind =
  | 'exact_date'
  | 'month_year'
  | 'season_year'
  | 'year'
  | 'age'
  | 'birthday'
  | 'grade'
  | 'life_stage'
  | 'season'
  | 'month'
  | 'relative'
  | 'years_ago'
  | 'unknown';

export type AnchorRelation = 'before' | 'after' | 'around';

export interface TemporalClue {
  kind: TemporalClueKind;
  span: TextSpan;
  ageMin?: number;
  ageMax?: number;
  year?: number;
  month?: number;
  day?: number;
  season?: Season;
  relation?: AnchorRelation;
  anchorPhrase?: string;
  yearsAgo?: number;
  hedged: boolean;
  note?: string;
}

export interface TemporalAnchor {
  relation: AnchorRelation;
  phrase: string;
}

export interface TemporalEvidence {
  quote: string;
  start: number;
  end: number;
  reason: string;
}

export interface TemporalEstimate {
  precision: DatePrecision;
  ageMin: number | null;
  ageMax: number | null;
  year: number | null;
  month: number | null;
  day: number | null;
  season: Season | null;
  approximate: boolean;
  confidence: Confidence;
  anchors: TemporalAnchor[];
  evidence: TemporalEvidence[];
  explanation: string;
  conflicts: string[];
}

export interface TemporalContext {
  today: Date;
  currentAge: number;
  birthDate?: string | null;
  hemisphere?: Hemisphere;
  dateOrder?: DateOrder;
}

export interface KnownEvent {
  id: string;
  label: string;
  ageMin: number | null;
  ageMax: number | null;
}

export type CharacterRole = 'central' | 'supporting' | 'mentioned';
export type PersonKind = 'kin' | 'role' | 'name';

export interface PersonMention {
  key: string;
  label: string;
  kind: PersonKind;
  surfaces: string[];
  spans: TextSpan[];
  role: CharacterRole;
  roleEvidence: string;
  confidence: number;
  relationship?: string;
}

export const BASE_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'nostalgic',
  'excited',
  'peaceful',
  'anxious',
  'proud',
  'grateful',
  'confused',
  'disappointed',
] as const;

export type BaseEmotion = (typeof BASE_EMOTIONS)[number];
export type EmotionPhase = 'then' | 'now';

export interface EmotionSignal {
  tag: BaseEmotion;
  phase: EmotionPhase;
  basis: 'stated' | 'described';
  quote: string;
  start: number;
  end: number;
  confidence: number;
}

export interface MilestoneCue {
  label: string;
  quote: string;
  start: number;
  end: number;
}

export type DiffSegment = { type: 'same' | 'added' | 'removed'; text: string };

export interface ReadingCopy {
  text: string;
  diff: DiffSegment[];
  removedFillers: number;
  removedRepeats: number;
}

export interface AccountAnalysis {
  readingCopy: ReadingCopy;
  title: string;
  temporal: { clues: TemporalClue[]; estimate: TemporalEstimate };
  people: PersonMention[];
  emotions: EmotionSignal[];
  milestones: MilestoneCue[];
  hedges: TextSpan[];
}

export interface MemoryDocPerson {
  characterId: string;
  name: string;
  role: CharacterRole;
}

export interface MemoryDoc {
  id: string;
  title: string;
  text: string;
  ageMin: number | null;
  ageMax: number | null;
  season: Season | null;
  people: MemoryDocPerson[];
  emotions: Array<{ tag: string; phase: EmotionPhase }>;
  versionCount?: number;
  sensitive?: boolean;
}

export type MatchVerdict = 'likely_same' | 'related';

export interface CandidateMatch {
  memoryId: string;
  title: string;
  score: number;
  verdict: MatchVerdict;
  reasons: string[];
  sharedTerms: string[];
}

export type DetailChangeKind =
  | 'consistent'
  | 'new'
  | 'omitted'
  | 'changed'
  | 'contradictory'
  | 'uncertain'
  | 'corrected'
  | 'reflected';

export interface DetailChange {
  kind: DetailChangeKind;
  earlier: TextSpan | null;
  later: TextSpan | null;
  note: string;
  sharedTerms: string[];
}

export interface VersionComparison {
  changes: DetailChange[];
  counts: Record<DetailChangeKind, number>;
  similarity: number;
  needsReview: boolean;
}

export interface ConnectionEvidence {
  memoryId: string;
  quote: string;
  start: number;
  end: number;
}

export interface ConnectionSuggestion {
  type: string;
  memoryIds: string[];
  explanation: string;
  evidence: ConnectionEvidence[];
  score: number;
}

export interface Citation {
  memoryId: string;
  title: string;
  quote: string;
  start: number;
  end: number;
  ageLabel: string;
}

export interface GroundedAnswer {
  intent: string;
  lines: Array<{ text: string; memoryIds: string[] }>;
  citations: Citation[];
  limitations: string[];
  consideredCount: number;
}
