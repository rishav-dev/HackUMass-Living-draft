export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Role = 'central' | 'supporting' | 'mentioned';
export type Phase = 'then' | 'now';
export type MediaKind = 'photo' | 'video' | 'audio' | 'scan';
export type Certainty = 'certain' | 'approximate' | 'unplaced';

export interface ProfileDto {
  id: string;
  preferredName: string;
  currentAge: number;
  birthDate: string | null;
  gender: string | null;
  pronouns: string | null;
  fullName: string | null;
  sex: string | null;
  birthPlace: string | null;
  hemisphere: 'north' | 'south' | 'none' | 'unknown';
  dateOrder: 'mdy' | 'dmy';
  narrativeVoice: 'first' | 'third';
  motion: 'system' | 'reduce' | 'full';
  density: 'rich' | 'simple';
  keepAudio: boolean;
  soundEffects: boolean;
  ambientSound: boolean;
  volume: number;
  artOnline: boolean;
  artDailyLimit: number;
  autoLockMinutes: number;
  placeName: string | null;
  placeLat: number | null;
  placeLon: number | null;
  weatherOn: boolean;
  tempUnit: 'auto' | 'c' | 'f';
  locationMode: 'home' | 'travel' | 'off';
  isSample: boolean;
  createdAt: string;
}

export interface EvidenceDto {
  quote: string;
  start: number;
  end: number;
  reason: string;
}

export type Precision =
  'exact' | 'month' | 'year' | 'season_age' | 'age' | 'age_range' | 'relative' | 'unknown';

export interface TemporalDto {
  precision: Precision;
  ageMin: number | null;
  ageMax: number | null;
  year: number | null;
  month: number | null;
  day: number | null;
  season: Season | null;
  approximate: boolean;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  evidence: EvidenceDto[];
  confirmed: boolean;
  label: string;
  certainty: Certainty;
  placedAges: number[];
}

export interface MediaDto {
  id: string;
  kind: MediaKind;
  url: string;
  mimeType: string;
  caption: string | null;
  durationMs: number | null;
  versionId: string | null;
  createdAt: string;
}

export interface EmotionDto {
  id: string;
  tag: string;
  phase: Phase;
  source: 'suggested' | 'user';
  evidence: string | null;
}

export interface PersonRefDto {
  characterId: string;
  name: string;
  role: Role;
}

export interface MemoryCardDto {
  id: string;
  title: string;
  excerpt: string;
  temporal: TemporalDto;
  emotions: EmotionDto[];
  people: PersonRefDto[];
  connectionTypes: string[];
  versionCount: number;
  cover: MediaDto | null;
  mediaKinds: MediaKind[];
  reviewStatus: 'ok' | 'needs_review';
  sensitive: boolean;
  storyOrder: number | null;
  createdAt: string;
  updatedAt: string;
  bookmarked: boolean;
  themes: string[];
  places: string[];
  summary: string | null;
}

export interface MemoryQuestionDto {
  id: string;
  versionId: string | null;
  question: string;
  answer: string | null;
  askedAt: string;
  answeredAt: string | null;
}

export interface MemoryVersionDto {
  id: string;
  seq: number;
  sourceKind: string;
  mode: string;
  originalText: string;
  readingCopy: string;
  recordedAt: string;
  note: string | null;
  audio: MediaDto | null;
  context: CaptureContextDto | null;
}

export interface CaptureContextDto {
  part: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
  weekday: string;
  weatherKind: string | null;
  weatherLabel: string | null;
  temperature: number | null;
  place: string | null;
}

export interface WeatherNowDto {
  place: string;
  code: number;
  kind: string;
  label: string;
  temperature: number;
  isDay: boolean;
  sunrise: string | null;
  sunset: string | null;
  observedAt: string;
}

export interface DayWeatherDto {
  status: 'ok' | 'no_place' | 'not_found' | 'no_date' | 'too_recent' | 'off';
  place: string | null;
  date: string | null;
  code: number | null;
  kind: string | null;
  label: string | null;
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number | null;
}

export interface PlaceDto {
  name: string;
  region: string | null;
  country: string | null;
  lat: number;
  lon: number;
  label: string;
}

export interface MentionDto {
  id: string;
  versionId: string;
  characterId: string;
  characterName: string;
  surface: string;
  start: number;
  end: number;
  role: Role;
  roleEvidence: string | null;
  confirmed: boolean;
}

export interface ConnectionEndpointDto {
  nodeType: 'memory' | 'character' | 'milestone';
  nodeId: string;
  title: string;
  ageLabel: string | null;
  evidence: { quote: string; start: number; end: number } | null;
}

export interface ConnectionDto {
  id: string;
  type: string;
  label: string;
  explanation: string;
  status: 'suggested' | 'confirmed' | 'dismissed';
  origin: 'suggested' | 'manual';
  note: string | null;
  endpoints: ConnectionEndpointDto[];
  createdAt: string;
}

export interface ResolutionDto {
  id: string;
  earlierVersionId: string;
  laterVersionId: string;
  changeKind: string;
  earlierText: string | null;
  laterText: string | null;
  resolution: string;
  createdAt: string;
}

export interface DetailChangeDto {
  kind: string;
  label: string;
  note: string;
  earlier: { start: number; end: number; text: string } | null;
  later: { start: number; end: number; text: string } | null;
  sharedTerms: string[];
}

export interface VersionComparisonDto {
  earlierVersionId: string;
  laterVersionId: string;
  earlierText: string;
  laterText: string;
  changes: DetailChangeDto[];
  counts: Record<string, number>;
  similarity: number;
  needsReview: boolean;
  diff: Array<{ type: 'same' | 'added' | 'removed'; text: string }>;
}

export interface MilestoneRefDto {
  id: string;
  title: string;
  date?: string | null;
}

export interface ReflectionDto {
  id: string;
  body: string;
  originalText: string;
  recordedAt: string;
  memoryIds: string[];
  audio: MediaDto | null;
}

export interface ReviewItemDto extends DetailChangeDto {
  id: string;
  earlierVersionId: string;
  laterVersionId: string;
}

export interface MemoryDetailDto extends MemoryCardDto {
  readingCopy: string;
  place: string | null;
  time: { kind: string; hint: string } | null;
  questions: MemoryQuestionDto[];
  themeEvidence: Array<{ theme: string; evidence: string | null }>;
  placeList: Array<{ id: string; name: string; kind: string | null }>;
  currentVersionId: string;
  versions: MemoryVersionDto[];
  mentions: MentionDto[];
  media: MediaDto[];
  connections: ConnectionDto[];
  milestones: MilestoneRefDto[];
  resolutions: ResolutionDto[];
  reflections: ReflectionDto[];
  pendingReview: ReviewItemDto[];
}

export interface AgeNodeDto {
  age: number;
  title: string;
  dateRange: { start: string; end: string } | null;
  memoryCount: number;
  uncertainCount: number;
  milestones: MilestoneRefDto[];
  cover: MediaDto | null;
  topEmotions: string[];
  people: string[];
  seasons: Season[];
  connectionCount: number;
}

export interface LifePathDto {
  profile: ProfileDto;
  ages: AgeNodeDto[];
  future: number[];
  unplacedCount: number;
  needsReviewCount: number;
  totalMemories: number;
  onThisDay: MemoryCardDto[];
}

export interface ChapterDto {
  age: number;
  title: string;
  dateRange: { start: string; end: string } | null;
  recap: string[];
  memories: Array<MemoryCardDto & { sharedWith: number[] }>;
  characters: Array<{ id: string; name: string; count: number }>;
  milestones: MilestoneRefDto[];
  hemisphere: ProfileDto['hemisphere'];
  previousAge: number | null;
  nextAge: number | null;
}

export interface ProposedPersonDto {
  key: string;
  label: string;
  kind: 'kin' | 'role' | 'name';
  surfaces: string[];
  role: Role;
  roleEvidence: string;
  relationship: string | null;
  suggestion: { characterId: string; name: string; reason: string } | null;
  options: Array<{ characterId: string; name: string; relationship: string | null }>;
}

export interface CandidateMatchDto {
  memoryId: string;
  title: string;
  score: number;
  verdict: 'likely_same' | 'related';
  reasons: string[];
  sharedTerms: string[];
  temporalLabel: string;
  excerpt: string;
}

export interface CaptureAnalysisDto {
  readingCopy: string;
  diff: Array<{ type: 'same' | 'added' | 'removed'; text: string }>;
  removedFillers: number;
  removedRepeats: number;
  title: string;
  temporal: TemporalDto;
  conflicts: string[];
  people: ProposedPersonDto[];
  emotions: Array<{
    tag: string;
    phase: Phase;
    basis: 'stated' | 'described';
    quote: string;
    confidence: number;
  }>;
  milestones: Array<{ label: string; quote: string; existing: MilestoneRefDto | null }>;
  matches: CandidateMatchDto[];
  hedges: Array<{ start: number; end: number; text: string }>;
}

export interface CharacterDto {
  id: string;
  name: string;
  relationship: string | null;
  aliases: string[];
  notes: string | null;
  provisional: boolean;
  memoryCount: number;
  roleCounts: Record<Role, number>;
  firstAge: number | null;
  lastAge: number | null;
  photo: MediaDto | null;
}

export interface CharacterDetailDto extends CharacterDto {
  memories: Array<MemoryCardDto & { role: Role; mentionIds: string[]; evidence: string | null }>;
  related: Array<{ id: string; name: string; shared: number }>;
  links: Array<{
    id: string;
    characterId: string;
    name: string;
    label: string;
    note: string | null;
  }>;
  connections: ConnectionDto[];
}

export interface MapNodeDto {
  id: string;
  kind: 'memory' | 'character' | 'milestone' | 'period';
  refId: string;
  title: string;
  subtitle: string;
  ageMin: number | null;
  cover: MediaDto | null;
  emotions: string[];
  x: number | null;
  y: number | null;
}

export interface MapEdgeDto {
  id: string;
  source: string;
  target: string;
  kind: 'connection' | 'character' | 'milestone' | 'period';
  connectionId: string | null;
  type: string;
  label: string;
  status: string;
}

export interface MapDto {
  nodes: MapNodeDto[];
  edges: MapEdgeDto[];
}

export interface CitationDto {
  memoryId: string;
  title: string;
  quote: string;
  start: number;
  end: number;
  ageLabel: string;
}

export interface AnswerDto {
  intent: string;
  lines: Array<{ text: string; memoryIds: string[] }>;
  citations: CitationDto[];
  limitations: string[];
  consideredCount: number;
}

export interface ComparisonDto {
  memories: MemoryCardDto[];
  sharedPeople: Array<{
    characterId: string;
    name: string;
    roles: Array<{ memoryId: string; role: string | null }>;
  }>;
  onlyIn: Array<{ memoryId: string; people: string[]; terms: string[] }>;
  sharedTerms: Array<{
    term: string;
    quotes: Array<{ memoryId: string; quote: string; start: number; end: number }>;
  }>;
  emotions: Array<{ memoryId: string; then: string[]; now: string[] }>;
  summary: string[];
  suggestions: Array<{
    type: string;
    label: string;
    memoryIds: string[];
    explanation: string;
    evidence: Array<{ memoryId: string; quote: string; start: number; end: number }>;
  }>;
}

export interface MilestoneDto {
  id: string;
  title: string;
  ageMin: number | null;
  ageMax: number | null;
  year: number | null;
  date: string | null;
  description: string | null;
  memoryIds: string[];
}

export interface CapsuleDto {
  id: string;
  title: string;
  body: string | null;
  originalText: string | null;
  authoredAt: string;
  authoredAge: number;
  unlockKind: 'date' | 'milestone';
  unlockDate: string | null;
  unlockMilestone: string | null;
  openedAt: string | null;
  unlocked: boolean;
  reflection: ReflectionDto | null;
  audio: MediaDto | null;
}

export interface PromptDto {
  id: string;
  group: string;
  text: string;
}

export interface PlaybackSceneDto {
  memoryId: string;
  title: string;
  when: string;
  certainty: Certainty;
  season: Season | null;
  paragraphs: string[];
  photos: MediaDto[];
  videos: MediaDto[];
  audio: MediaDto[];
  people: string[];
  emotions: string[];
  feelings: Array<{ tag: string; phase: Phase }>;
  motifs: string[];
  artKey: string;
  artUrl: string | null;
  sensitive: boolean;
  date: string | null;
  connections: Array<{
    memoryId: string;
    title: string;
    type: string;
    label: string;
    explanation: string;
  }>;
  weather: DayWeatherDto | null;
}

export interface PlaybackDto {
  title: string;
  subtitle: string;
  scenes: PlaybackSceneDto[];
}

export interface SavedAnalysisDto {
  id: string;
  kind: string;
  question: string;
  createdAt: string;
  result: unknown;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface DayDto {
  date: string;
  label: string;
  age: number | null;
  count: number;
  memories: Array<{ id: string; title: string; emotions: string[] }>;
  emotions: string[];
  motifs: string[];
  artKey: string;
  artUrl: string | null;
  cover: MediaDto | null;
}

export interface ArtStatusDto {
  online: boolean;
  limit: number;
  used: number;
  remaining: number;
  queued: number;
}

export interface AuthStatusDto {
  configured: boolean;
  authenticated: boolean;
}

export interface ChapterNoteDto {
  age: number;
  body: string;
  updatedAt: string | null;
}

export interface StoryBookSummaryDto {
  id: string;
  title: string;
  premise: string | null;
  mood: string;
  sceneCount: number;
  chapterCount: number;
  characterCount: number;
  updatedAt: string;
}

export interface StorySceneDto {
  id: string;
  chapterId: string | null;
  position: number;
  title: string;
  text: string;
  originalText: string;
  mood: string | null;
  povId: string | null;
  characterIds: string[];
  updatedAt: string;
}

export interface StoryChapterDto {
  id: string;
  number: number;
  title: string;
  sceneIds: string[];
}

export interface StoryCharacterDto {
  id: string;
  name: string;
  role: string | null;
  notes: string | null;
  sceneCount: number;
}

export interface StoryLinkDto {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  type: string;
  label: string;
  note: string | null;
}

export interface StoryNoteDto {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

export interface StoryBookDto extends StoryBookSummaryDto {
  chapters: StoryChapterDto[];
  floating: string[];
  scenes: StorySceneDto[];
  characters: StoryCharacterDto[];
  links: StoryLinkDto[];
  notes: StoryNoteDto[];
}

export interface SceneSaveResultDto {
  scene: StorySceneDto;
  newNames: string[];
  echoes: Array<{ sceneId: string; title: string; type: string; shared: string[] }>;
}

export interface VoiceStatusDto {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  progress: number;
  downloaded: boolean;
  reason: string | null;
}

export interface AiStatusDto {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  progress: number;
  downloaded: boolean;
  reason: string | null;
  model: string | null;
  where: 'local' | 'remote' | 'browser' | 'none';
  sizeLabel: string | null;
  gpu: string | null;
}

export interface AiNotesDto {
  title: string;
  summary: string;
  time: { kind: string; hint: string };
  feelings: Array<{ feeling: string; when: 'at the time' | 'looking back'; because: string }>;
  milestone: { isMilestone: boolean; title: string };
  people: Array<{
    mentionedAs: string;
    name: string;
    describedAs: string;
    role: Role;
    relationTo: string;
    relationship: string;
    why: string;
  }>;
  places: Array<{ name: string; kind: string }>;
  themes: Array<{ theme: string; because: string }>;
  questions: string[];
}

export interface AiJobDto {
  id: string;
  status: 'working' | 'done' | 'failed';
  stage: 'waiting' | 'notes' | 'narrative' | 'done';
  notes: AiNotesDto | null;
  narrative: string | null;
  draft: string | null;
  result: unknown;
  error: string | null;
}

export interface CompareInsightDto {
  headline: string;
  observations: Array<{
    kind: 'alike' | 'different' | 'changed' | 'reading';
    basis: 'shown' | 'suggested';
    text: string;
    memoryIds: string[];
  }>;
  caveat: string;
  memoryIds: string[];
}

export interface AuthStatusDto {
  configured: boolean;
  authenticated: boolean;
  email: string | null;
  name: string | null;
  verified: boolean;
  hasEmail: boolean;
  totpEnabled: boolean;
  googleLinked: boolean;
  methods: { email: boolean; google: boolean; totp: boolean };
  mailer: 'smtp' | 'outbox' | 'none';
  demo: boolean;
  twoStep: boolean;
}
