import type { Role, Season } from '@living-draft/contracts';

export interface MemoryRow {
  id: string;
  book_id: string;
  title: string;
  current_version_id: string | null;
  place: string | null;
  sensitive: number;
  review_status: 'ok' | 'needs_review';
  story_order: number | null;
  created_at: string;
  updated_at: string;
  summary?: string | null;
  time_kind?: string | null;
  time_hint?: string | null;
  bookmarked_at?: string | null;
}

export interface VersionRow {
  id: string;
  memory_id: string;
  seq: number;
  source_kind: string;
  mode: string;
  original_text: string;
  reading_copy: string;
  composed_text: string;
  audio_id: string | null;
  note: string | null;
  recorded_at: string;
  created_at: string;
  capture_context?: string | null;
}

export interface TemporalRow {
  id: string;
  memory_id: string;
  precision: string;
  age_min: number | null;
  age_max: number | null;
  year: number | null;
  month: number | null;
  day: number | null;
  season: Season | null;
  approximate: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  evidence_json: string;
  confirmed: number;
  created_at: string;
  superseded_at: string | null;
}

export interface MentionRow {
  id: string;
  memory_id: string;
  version_id: string;
  character_id: string;
  character_name: string;
  surface: string;
  span_start: number;
  span_end: number;
  role: Role;
  role_evidence: string | null;
  confirmed: number;
}

export interface EmotionRow {
  id: string;
  memory_id: string;
  tag: string;
  phase: 'then' | 'now';
  source: 'suggested' | 'user';
  evidence: string | null;
}

export interface ConnectionRow {
  id: string;
  type: string;
  explanation: string;
  status: 'suggested' | 'confirmed' | 'dismissed';
  origin: 'suggested' | 'manual';
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EndpointRow {
  connection_id: string;
  node_type: 'memory' | 'character' | 'milestone';
  node_id: string;
  evidence_quote: string | null;
  evidence_start: number | null;
  evidence_end: number | null;
  position: number;
}

export interface MilestoneRow {
  id: string;
  title: string;
  age_min: number | null;
  age_max: number | null;
  year: number | null;
  date: string | null;
  description: string | null;
  created_at: string;
}

export interface CharacterRow {
  id: string;
  name: string;
  relationship: string | null;
  kin_key: string | null;
  notes: string | null;
  provisional: number;
  photo_id: string | null;
  created_at: string;
  updated_at: string;
}
