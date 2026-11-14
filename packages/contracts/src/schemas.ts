import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const seasonSchema = z.enum(['spring', 'summer', 'autumn', 'winter']);
export const roleSchema = z.enum(['central', 'supporting', 'mentioned']);
export const phaseSchema = z.enum(['then', 'now']);
export const hemisphereSchema = z.enum(['north', 'south', 'none', 'unknown']);
export const precisionSchema = z.enum([
  'exact',
  'month',
  'year',
  'season_age',
  'age',
  'age_range',
  'relative',
  'unknown',
]);
export const captureKindSchema = z.enum(['memory', 'reflection', 'capsule']);
export const sourceKindSchema = z.enum(['speech', 'typing']);
export const mediaKindSchema = z.enum(['photo', 'video', 'audio', 'scan']);

const optionalText = z.string().trim().max(200).nullable().optional();

export const profileInputSchema = z.object({
  preferredName: z.string().trim().min(1).max(80),
  currentAge: z.number().int().min(1).max(120),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  gender: optionalText,
  pronouns: optionalText,
  hemisphere: hemisphereSchema.optional(),
  dateOrder: z.enum(['mdy', 'dmy']).optional(),
  narrativeVoice: z.enum(['first', 'third']).optional(),
  motion: z.enum(['system', 'reduce', 'full']).optional(),
  density: z.enum(['rich', 'simple']).optional(),
  keepAudio: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  ambientSound: z.boolean().optional(),
  volume: z.number().min(0).max(1).optional(),
  artOnline: z.boolean().optional(),
  artDailyLimit: z.number().int().min(0).max(100).optional(),
  autoLockMinutes: z.number().int().min(0).max(1440).optional(),
  placeName: z.string().trim().max(160).nullable().optional(),
  placeLat: z.number().min(-90).max(90).nullable().optional(),
  placeLon: z.number().min(-180).max(180).nullable().optional(),
  weatherOn: z.boolean().optional(),
  tempUnit: z.enum(['auto', 'c', 'f']).optional(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;

export const profileUpdateSchema = profileInputSchema.partial();
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const analyzeSchema = z.object({
  text: z.string().trim().min(1).max(20000),
  kind: captureKindSchema.default('memory'),
  memoryId: z.string().optional(),
});
export type AnalyzeInput = z.infer<typeof analyzeSchema>;

export const evidenceSchema = z.object({
  quote: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  reason: z.string(),
});

export const temporalInputSchema = z.object({
  precision: precisionSchema,
  ageMin: z.number().int().min(0).max(130).nullable(),
  ageMax: z.number().int().min(0).max(130).nullable(),
  year: z.number().int().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
  season: seasonSchema.nullable(),
  approximate: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  explanation: z.string().max(2000).default(''),
  evidence: z.array(evidenceSchema).default([]),
  confirmed: z.boolean().default(true),
});
export type TemporalInput = z.infer<typeof temporalInputSchema>;

export const personDecisionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  surfaces: z.array(z.string().trim().min(1)).min(1),
  characterId: z.string().nullable(),
  relationship: z.string().trim().max(60).nullable().optional(),
  role: roleSchema,
  roleEvidence: z.string().max(1000).optional(),
  addAlias: z.boolean().default(true),
});
export type PersonDecision = z.infer<typeof personDecisionSchema>;

export const emotionInputSchema = z.object({
  tag: z.string().trim().min(1).max(40),
  phase: phaseSchema,
  source: z.enum(['suggested', 'user']),
  evidence: z.string().max(1000).nullable().optional(),
});
export type EmotionInput = z.infer<typeof emotionInputSchema>;

export const captureContextSchema = z.object({
  part: z.enum(['dawn', 'morning', 'afternoon', 'evening', 'night']),
  weekday: z.string().max(20),
  weatherKind: z.string().max(20).nullable(),
  weatherLabel: z.string().max(60).nullable(),
  temperature: z.number().min(-90).max(70).nullable(),
  place: z.string().max(160).nullable(),
});

export const createMemorySchema = z.object({
  title: z.string().trim().min(1).max(160),
  originalText: z.string().trim().min(1).max(20000),
  readingCopy: z.string().trim().min(1).max(20000),
  sourceKind: sourceKindSchema,
  temporal: temporalInputSchema,
  people: z.array(personDecisionSchema).default([]),
  emotions: z.array(emotionInputSchema).default([]),
  milestoneIds: z.array(z.string()).default([]),
  newMilestones: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        ageMin: z.number().int().nullable(),
        ageMax: z.number().int().nullable(),
      }),
    )
    .default([]),
  place: z.string().trim().max(160).nullable().optional(),
  mediaIds: z.array(z.string()).default([]),
  audioId: z.string().nullable().optional(),
  sensitive: z.boolean().default(false),
  context: captureContextSchema.optional(),
});
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;

export const addVersionSchema = z.object({
  originalText: z.string().trim().min(1).max(20000),
  readingCopy: z.string().trim().min(1).max(20000),
  sourceKind: z.enum(['speech', 'typing']),
  mode: z.enum(['addition', 'retelling', 'correction', 'edit']),
  people: z.array(personDecisionSchema).default([]),
  emotions: z.array(emotionInputSchema).default([]),
  mediaIds: z.array(z.string()).default([]),
  audioId: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  context: captureContextSchema.optional(),
});
export type AddVersionInput = z.infer<typeof addVersionSchema>;

export const updateMemorySchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  place: z.string().trim().max(160).nullable().optional(),
  sensitive: z.boolean().optional(),
  temporal: temporalInputSchema.optional(),
  emotions: z.array(emotionInputSchema).optional(),
  milestoneIds: z.array(z.string()).optional(),
});
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;

export const resolutionSchema = z.object({
  earlierVersionId: z.string(),
  laterVersionId: z.string(),
  changeKind: z.string(),
  earlierText: z.string().nullable(),
  laterText: z.string().nullable(),
  resolution: z.enum([
    'keep_both',
    'prefer_later',
    'prefer_earlier',
    'mark_uncertain',
    'separate',
    'dismissed',
  ]),
});
export type ResolutionInput = z.infer<typeof resolutionSchema>;

export const connectionInputSchema = z.object({
  type: z.string().min(1).max(40),
  memoryIds: z.array(z.string()).min(2).max(8),
  explanation: z.string().trim().min(1).max(1000),
  note: z.string().max(1000).nullable().optional(),
  status: z.enum(['suggested', 'confirmed']).default('confirmed'),
  evidence: z
    .array(
      z.object({
        memoryId: z.string(),
        quote: z.string(),
        start: z.number().int(),
        end: z.number().int(),
      }),
    )
    .default([]),
});
export type ConnectionInput = z.infer<typeof connectionInputSchema>;

export const connectionUpdateSchema = z.object({
  status: z.enum(['suggested', 'confirmed', 'dismissed']).optional(),
  explanation: z.string().trim().min(1).max(1000).optional(),
  note: z.string().max(1000).nullable().optional(),
  type: z.string().min(1).max(40).optional(),
});
export type ConnectionUpdate = z.infer<typeof connectionUpdateSchema>;

export const suggestConnectionsSchema = z.object({ memoryIds: z.array(z.string()).optional() });

export const characterInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(60).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  aliases: z.array(z.string().trim().min(1).max(60)).default([]),
});
export type CharacterInput = z.infer<typeof characterInputSchema>;

export const characterUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  relationship: z.string().trim().max(60).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  provisional: z.boolean().optional(),
  photoId: z.string().nullable().optional(),
});
export type CharacterUpdate = z.infer<typeof characterUpdateSchema>;

export const aliasSchema = z.object({ alias: z.string().trim().min(1).max(60) });
export const mergeCharactersSchema = z.object({ sourceId: z.string(), targetId: z.string() });
export const splitCharacterSchema = z.object({
  mentionIds: z.array(z.string()).min(1),
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(60).nullable().optional(),
});
export const mentionUpdateSchema = z.object({
  role: roleSchema.optional(),
  characterId: z.string().optional(),
  confirmed: z.boolean().optional(),
});

export const compareSchema = z.object({
  memoryIds: z.array(z.string()).min(2).max(6),
  question: z.string().max(400).optional(),
});

export const askScopeSchema = z.object({
  characterId: z.string().optional(),
  emotion: z.string().optional(),
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  centralOnly: z.boolean().optional(),
  memoryIds: z.array(z.string()).optional(),
  includeDifficult: z.boolean().optional(),
});
export const askSchema = z.object({
  question: z.string().trim().min(2).max(500),
  scope: askScopeSchema.default({}),
});
export type AskInput = z.infer<typeof askSchema>;

export const analysisSaveSchema = z.object({
  kind: z.enum(['ask', 'compare']),
  question: z.string().max(500),
  scope: z.record(z.string(), z.unknown()).default({}),
  result: z.unknown(),
});

export const milestoneInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  ageMin: z.number().int().min(0).max(130).nullable(),
  ageMax: z.number().int().min(0).max(130).nullable(),
  year: z.number().int().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  memoryIds: z.array(z.string()).default([]),
});
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;

export const capsuleInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  originalText: z.string().trim().min(1).max(20000),
  readingCopy: z.string().trim().min(1).max(20000),
  unlockKind: z.enum(['date', 'milestone']),
  unlockDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  unlockMilestone: z.string().trim().max(160).nullable().optional(),
  audioId: z.string().nullable().optional(),
});
export type CapsuleInput = z.infer<typeof capsuleInputSchema>;

export const openCapsuleSchema = z.object({
  reflection: z.string().trim().max(20000).optional(),
  milestoneReached: z.boolean().optional(),
});

export const reflectionInputSchema = z.object({
  originalText: z.string().trim().min(1).max(20000),
  readingCopy: z.string().trim().min(1).max(20000),
  memoryIds: z.array(z.string()).default([]),
  audioId: z.string().nullable().optional(),
});
export type ReflectionInput = z.infer<typeof reflectionInputSchema>;

export const mapPositionsSchema = z.object({
  positions: z.array(z.object({ id: z.string(), x: z.number(), y: z.number() })).max(2000),
});

export const mediaUpdateSchema = z.object({ caption: z.string().max(500).nullable() });
export const attachMediaSchema = z.object({ mediaIds: z.array(z.string()).min(1).max(50) });

export const searchQuerySchema = z.object({
  q: z.string().optional(),
  emotions: z.string().optional(),
  emotionMode: z.enum(['any', 'all']).default('any'),
  characterId: z.string().optional(),
  role: roleSchema.optional(),
  ageMin: z.coerce.number().int().optional(),
  ageMax: z.coerce.number().int().optional(),
  season: seasonSchema.optional(),
  media: mediaKindSchema.optional(),
  certainty: z.enum(['certain', 'approximate', 'unplaced']).optional(),
  connection: z.string().optional(),
  milestoneId: z.string().optional(),
  collection: z.enum(['unplaced', 'needs_review', 'sensitive']).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const passphraseSchema = z.object({ passphrase: z.string().min(8).max(200) });
export const changePassphraseSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(8).max(200),
});
export const chapterNoteSchema = z.object({ body: z.string().max(20000) });
export const chapterOrderSchema = z.object({ memoryIds: z.array(z.string()).max(500) });
export const recapRequestSchema = z.object({
  label: z.string().trim().min(1).max(120),
  memoryIds: z.array(z.string()).max(300),
  includeQuiet: z.boolean().default(false),
  focusPeople: z.array(z.string().max(80)).max(10).default([]),
});

export const generateArtSchema = z.object({
  key: z.string().regex(/^(memory|day):[\w-]+$/),
  fresh: z.boolean().default(false),
});
export const characterLinkSchema = z.object({
  otherId: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  note: z.string().trim().max(500).nullable().optional(),
});

const storyMood = z.enum([
  'cosmos',
  'happy',
  'excited',
  'peaceful',
  'nostalgic',
  'grateful',
  'proud',
  'sad',
  'disappointed',
  'angry',
  'anxious',
  'confused',
]);

export const storyBookInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  premise: z.string().trim().max(2000).nullable().optional(),
  mood: storyMood.default('cosmos'),
});
export const storyBookUpdateSchema = storyBookInputSchema.partial();

export const storyChapterInputSchema = z.object({ title: z.string().trim().min(1).max(120) });

export const storySceneInputSchema = z.object({
  title: z.string().trim().max(160).optional(),
  text: z.string().max(60000),
  originalText: z.string().max(60000).optional(),
  chapterId: z.string().nullable().optional(),
  mood: z.string().trim().max(40).nullable().optional(),
  povId: z.string().nullable().optional(),
  characterIds: z.array(z.string()).max(60).default([]),
});
export const storySceneUpdateSchema = storySceneInputSchema.partial();

export const storyOrderSchema = z.object({
  chapters: z.array(z.object({ id: z.string(), sceneIds: z.array(z.string()) })).max(500),
  floating: z.array(z.string()).max(2000),
});

export const storyCharacterInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});
export const storyCharacterUpdateSchema = storyCharacterInputSchema.partial();

export const storyLinkInputSchema = z.object({
  fromSceneId: z.string(),
  toSceneId: z.string(),
  type: z.string().trim().min(1).max(40),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const storyNoteInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().max(20000).default(''),
});
export const storyNoteUpdateSchema = storyNoteInputSchema.partial();

export const NARRATOR_VOICE_IDS = [
  'af_heart',
  'af_bella',
  'af_nicole',
  'bf_emma',
  'bm_fable',
  'am_michael',
  'bm_george',
] as const;

export const voiceRequestSchema = z.object({
  text: z.string().trim().min(1).max(700),
  voice: z.enum(NARRATOR_VOICE_IDS),
  speed: z.number().min(0.5).max(1.5),
});
