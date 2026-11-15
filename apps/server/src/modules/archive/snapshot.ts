import type {
  ConnectionDto,
  EmotionDto,
  MediaDto,
  MediaKind,
  MemoryCardDto,
  PersonRefDto,
  ProfileDto,
  Role,
} from '@living-draft/contracts';
import { connectionLabel, describeWhen, type MemoryDoc } from '@living-draft/engine';
import { all } from '../../db/database';
import { mediaFor, toMediaDto, type MediaRow } from '../media/media.repository';
import { requireProfile } from '../profile/profile.repository';
import type {
  CharacterRow,
  ConnectionRow,
  EmotionRow,
  EndpointRow,
  MemoryRow,
  MentionRow,
  MilestoneRow,
  TemporalRow,
  VersionRow,
} from './rows';
import { toTemporalDto } from './temporal';

const ROLE_WEIGHT: Record<Role, number> = { central: 3, supporting: 2, mentioned: 1 };

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function excerpt(text: string, length = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= length) return clean;
  const cut = clean.slice(0, length);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

export class Archive {
  readonly profile: ProfileDto;
  readonly memories: MemoryRow[];
  readonly characters: CharacterRow[];
  readonly milestones: MilestoneRow[];
  readonly connections: ConnectionRow[];
  private readonly byId: Map<string, MemoryRow>;
  private readonly currentVersions: Map<string, VersionRow>;
  private readonly versionCounts: Map<string, number>;
  private readonly temporalRows: Map<string, TemporalRow>;
  private readonly mentionRows: Map<string, MentionRow[]>;
  private readonly emotionRows: Map<string, EmotionRow[]>;
  private readonly mediaRows: Map<string, MediaRow[]>;
  private readonly endpoints: Map<string, EndpointRow[]>;
  private readonly milestoneLinks: Map<string, string[]>;
  private readonly aliasRows: Map<string, string[]>;
  private readonly themeRows: Map<string, string[]>;
  private readonly placeRows: Map<string, string[]>;

  private constructor() {
    this.profile = requireProfile();
    this.memories = all<MemoryRow>('SELECT * FROM memories ORDER BY created_at');
    this.byId = new Map(this.memories.map((m) => [m.id, m]));
    this.currentVersions = new Map(
      all<VersionRow>(
        'SELECT v.* FROM memory_versions v JOIN memories m ON m.current_version_id = v.id',
      ).map((v) => [v.memory_id, v]),
    );
    this.versionCounts = new Map(
      all<{ memory_id: string; count: number }>(
        'SELECT memory_id, COUNT(*) AS count FROM memory_versions GROUP BY memory_id',
      ).map((r) => [r.memory_id, r.count]),
    );
    this.temporalRows = new Map(
      all<TemporalRow>('SELECT * FROM temporal_estimates WHERE superseded_at IS NULL').map((t) => [
        t.memory_id,
        t,
      ]),
    );
    this.mentionRows = groupBy(
      all<MentionRow>(
        `SELECT cm.*, c.name AS character_name FROM character_mentions cm
         JOIN characters c ON c.id = cm.character_id
         JOIN memories m ON m.current_version_id = cm.version_id
         ORDER BY cm.span_start`,
      ),
      (r) => r.memory_id,
    );
    this.emotionRows = groupBy(
      all<EmotionRow>('SELECT * FROM emotion_tags ORDER BY created_at'),
      (r) => r.memory_id,
    );
    this.mediaRows = groupBy(
      mediaFor(
        'memory',
        this.memories.map((m) => m.id),
      ),
      (r) => r.owner_id ?? '',
    );
    this.characters = all<CharacterRow>('SELECT * FROM characters ORDER BY name COLLATE NOCASE');
    this.aliasRows = new Map(
      [
        ...groupBy(
          all<{ character_id: string; alias: string }>(
            'SELECT character_id, alias FROM character_aliases',
          ),
          (r) => r.character_id,
        ),
      ].map(([id, rows]) => [id, rows.map((r) => r.alias)]),
    );
    this.milestones = all<MilestoneRow>(
      'SELECT * FROM milestones ORDER BY COALESCE(age_min, 999), title',
    );
    this.milestoneLinks = new Map(
      [
        ...groupBy(
          all<{ milestone_id: string; memory_id: string }>('SELECT * FROM milestone_memories'),
          (r) => r.memory_id,
        ),
      ].map(([memoryId, rows]) => [memoryId, rows.map((r) => r.milestone_id)]),
    );
    this.themeRows = new Map(
      [
        ...groupBy(
          all<{ memory_id: string; theme: string }>(
            'SELECT memory_id, theme FROM memory_themes ORDER BY theme',
          ),
          (r) => r.memory_id,
        ),
      ].map(([id, rows]) => [id, rows.map((r) => r.theme)]),
    );
    this.placeRows = new Map(
      [
        ...groupBy(
          all<{ memory_id: string; name: string }>(
            'SELECT mp.memory_id, p.name FROM memory_places mp JOIN places p ON p.id = mp.place_id',
          ),
          (r) => r.memory_id,
        ),
      ].map(([id, rows]) => [id, rows.map((r) => r.name)]),
    );
    this.connections = all<ConnectionRow>('SELECT * FROM connections ORDER BY created_at');
    this.endpoints = groupBy(
      all<EndpointRow>('SELECT * FROM connection_endpoints ORDER BY position'),
      (r) => r.connection_id,
    );
  }

  static load(): Archive {
    return new Archive();
  }

  memory(id: string): MemoryRow | undefined {
    return this.byId.get(id);
  }

  text(id: string): string {
    return this.currentVersions.get(id)?.composed_text ?? '';
  }

  currentVersion(id: string): VersionRow | undefined {
    return this.currentVersions.get(id);
  }

  versionCount(id: string): number {
    return this.versionCounts.get(id) ?? 0;
  }

  temporal(id: string) {
    return toTemporalDto(this.temporalRows.get(id));
  }

  mentions(id: string): MentionRow[] {
    return this.mentionRows.get(id) ?? [];
  }

  people(id: string): PersonRefDto[] {
    const best = new Map<string, PersonRefDto>();
    for (const mention of this.mentions(id)) {
      const existing = best.get(mention.character_id);
      if (!existing || ROLE_WEIGHT[mention.role] > ROLE_WEIGHT[existing.role]) {
        best.set(mention.character_id, {
          characterId: mention.character_id,
          name: mention.character_name,
          role: mention.role,
        });
      }
    }
    return [...best.values()].sort((a, b) => ROLE_WEIGHT[b.role] - ROLE_WEIGHT[a.role]);
  }

  emotions(id: string): EmotionDto[] {
    return (this.emotionRows.get(id) ?? []).map((e) => ({
      id: e.id,
      tag: e.tag,
      phase: e.phase,
      source: e.source,
      evidence: e.evidence,
    }));
  }

  media(id: string): MediaDto[] {
    return (this.mediaRows.get(id) ?? []).map(toMediaDto);
  }

  milestoneIds(memoryId: string): string[] {
    return this.milestoneLinks.get(memoryId) ?? [];
  }

  aliases(characterId: string): string[] {
    return this.aliasRows.get(characterId) ?? [];
  }

  character(id: string): CharacterRow | undefined {
    return this.characters.find((c) => c.id === id);
  }

  connectionsFor(memoryId: string): ConnectionRow[] {
    return this.connections.filter((c) =>
      (this.endpoints.get(c.id) ?? []).some(
        (e) => e.node_type === 'memory' && e.node_id === memoryId,
      ),
    );
  }

  connectionMemoryIds(connectionId: string): string[] {
    return (this.endpoints.get(connectionId) ?? [])
      .filter((e) => e.node_type === 'memory')
      .map((e) => e.node_id);
  }

  connectionDto(row: ConnectionRow): ConnectionDto {
    return {
      id: row.id,
      type: row.type,
      label: connectionLabel(row.type),
      explanation: row.explanation,
      status: row.status,
      origin: row.origin,
      note: row.note,
      createdAt: row.created_at,
      endpoints: (this.endpoints.get(row.id) ?? []).map((e) => {
        const title =
          e.node_type === 'memory'
            ? (this.memory(e.node_id)?.title ?? 'Deleted memory')
            : e.node_type === 'character'
              ? (this.character(e.node_id)?.name ?? 'Someone')
              : (this.milestones.find((m) => m.id === e.node_id)?.title ?? 'Milestone');
        const temporal = e.node_type === 'memory' ? this.temporal(e.node_id) : null;
        return {
          nodeType: e.node_type,
          nodeId: e.node_id,
          title,
          ageLabel: temporal ? temporal.label : null,
          evidence:
            e.evidence_quote !== null
              ? { quote: e.evidence_quote, start: e.evidence_start ?? 0, end: e.evidence_end ?? 0 }
              : null,
        };
      }),
    };
  }

  card(id: string): MemoryCardDto {
    const memory = this.byId.get(id)!;
    const media = this.media(id);
    const cover = media.find((m) => m.kind === 'photo' || m.kind === 'scan') ?? null;
    return {
      id,
      title: memory.title,
      excerpt: excerpt(this.text(id)),
      temporal: this.temporal(id),
      emotions: this.emotions(id),
      people: this.people(id),
      connectionTypes: [
        ...new Set(
          this.connectionsFor(id)
            .filter((c) => c.status === 'confirmed')
            .map((c) => c.type),
        ),
      ],
      versionCount: this.versionCount(id),
      cover,
      mediaKinds: [...new Set(media.map((m) => m.kind))] as MediaKind[],
      reviewStatus: memory.review_status,
      sensitive: !!memory.sensitive,
      storyOrder: memory.story_order ?? null,
      createdAt: memory.created_at,
      updatedAt: memory.updated_at,
      bookmarked: Boolean(memory.bookmarked_at),
      themes: this.themeRows.get(id) ?? [],
      places: this.placeRows.get(id) ?? (memory.place ? [memory.place] : []),
      summary: memory.summary ?? null,
    };
  }

  cards(ids?: string[]): MemoryCardDto[] {
    return (ids ?? this.memories.map((m) => m.id))
      .filter((id) => this.byId.has(id))
      .map((id) => this.card(id));
  }

  doc(id: string): MemoryDoc {
    const memory = this.byId.get(id)!;
    const temporal = this.temporal(id);
    return {
      id,
      title: memory.title,
      text: this.text(id),
      ageMin: temporal.ageMin,
      ageMax: temporal.ageMax,
      season: temporal.season,
      people: this.people(id),
      emotions: this.emotions(id).map((e) => ({ tag: e.tag, phase: e.phase })),
      versionCount: this.versionCount(id),
      sensitive: !!memory.sensitive,
    };
  }

  docs(): MemoryDoc[] {
    return this.memories.map((m) => this.doc(m.id));
  }

  whenLabel(id: string): string {
    return describeWhen(this.temporal(id));
  }
}

export function sortChronologically(cards: MemoryCardDto[]): MemoryCardDto[] {
  const key = (c: MemoryCardDto) => {
    const t = c.temporal;
    const month =
      t.month ?? (t.season ? { spring: 4, summer: 7, autumn: 10, winter: 12 }[t.season] : 13);
    return [t.ageMin ?? 999, t.year ?? 0, month, t.day ?? 32];
  };
  return [...cards].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return ka[i]! - kb[i]!;
    return a.createdAt.localeCompare(b.createdAt);
  });
}
