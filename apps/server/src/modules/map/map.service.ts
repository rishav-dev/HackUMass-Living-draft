import type { MapDto, MapEdgeDto, MapNodeDto } from '@living-draft/contracts';
import { all, run, transaction } from '../../db/database';
import { now } from '../../lib/http';
import { Archive } from '../archive/snapshot';
import { allCharacterLinks } from '../characters/character.links';

export interface MapFilters {
  characterId?: string;
  ageMin?: number;
  ageMax?: number;
  emotion?: string;
  includeSuggested?: boolean;
  includeCharacters?: boolean;
}

export function memoryMap(filters: MapFilters): MapDto {
  const archive = Archive.load();
  const positions = new Map(
    all<{ node_id: string; x: number; y: number }>('SELECT * FROM map_positions').map((p) => [
      p.node_id,
      p,
    ]),
  );
  const at = (id: string) => positions.get(id) ?? null;

  let cards = archive.cards();
  if (filters.characterId)
    cards = cards.filter((c) => c.people.some((p) => p.characterId === filters.characterId));
  if (filters.ageMin !== undefined)
    cards = cards.filter((c) => (c.temporal.ageMax ?? -1) >= filters.ageMin!);
  if (filters.ageMax !== undefined)
    cards = cards.filter((c) => c.temporal.ageMin !== null && c.temporal.ageMin <= filters.ageMax!);
  if (filters.emotion)
    cards = cards.filter((c) => c.emotions.some((e) => e.tag === filters.emotion));
  const visible = new Set(cards.map((c) => c.id));

  const nodes: MapNodeDto[] = cards.map((card) => ({
    id: `memory:${card.id}`,
    kind: 'memory',
    refId: card.id,
    title: card.title,
    subtitle: card.temporal.label,
    ageMin: card.temporal.ageMin,
    cover: card.cover,
    emotions: card.emotions.filter((e) => e.phase === 'then').map((e) => e.tag),
    x: at(`memory:${card.id}`)?.x ?? null,
    y: at(`memory:${card.id}`)?.y ?? null,
  }));
  const edges: MapEdgeDto[] = [];

  for (const connection of archive.connections) {
    if (connection.status === 'dismissed') continue;
    if (connection.status === 'suggested' && !filters.includeSuggested) continue;
    const ids = archive.connectionMemoryIds(connection.id).filter((id) => visible.has(id));
    for (let i = 1; i < ids.length; i += 1) {
      edges.push({
        id: `${connection.id}:${i}`,
        source: `memory:${ids[i - 1]}`,
        target: `memory:${ids[i]}`,
        kind: 'connection',
        connectionId: connection.id,
        type: connection.type,
        label: archive.connectionDto(connection).label,
        status: connection.status,
      });
    }
  }

  if (filters.includeCharacters !== false) {
    const counts = new Map<string, number>();
    for (const card of cards)
      for (const person of card.people)
        counts.set(person.characterId, (counts.get(person.characterId) ?? 0) + 1);
    const recurring = [...counts.entries()].filter(
      ([id, count]) => count >= 2 || id === filters.characterId,
    );
    for (const [characterId] of recurring) {
      const character = archive.character(characterId);
      if (!character) continue;
      const nodeId = `character:${characterId}`;
      const linked = cards.filter((c) => c.people.some((p) => p.characterId === characterId));
      nodes.push({
        id: nodeId,
        kind: 'character',
        refId: characterId,
        title: character.name,
        subtitle: character.relationship ?? `${linked.length} memories`,
        ageMin: null,
        cover: null,
        emotions: [],
        x: at(nodeId)?.x ?? null,
        y: at(nodeId)?.y ?? null,
      });
      for (const card of linked) {
        const role = card.people.find((p) => p.characterId === characterId)!.role;
        if (role === 'mentioned') continue;
        edges.push({
          id: `${nodeId}->${card.id}`,
          source: nodeId,
          target: `memory:${card.id}`,
          kind: 'character',
          connectionId: null,
          type: 'shared_character',
          label: role,
          status: 'confirmed',
        });
      }
    }
    const present = new Set(nodes.filter((n) => n.kind === 'character').map((n) => n.refId));
    for (const link of allCharacterLinks()) {
      if (!present.has(link.from) || !present.has(link.to)) continue;
      edges.push({
        id: `person-link:${link.id}`,
        source: `character:${link.from}`,
        target: `character:${link.to}`,
        kind: 'character',
        connectionId: null,
        type: 'relationship_change',
        label: link.label,
        status: 'confirmed',
      });
    }
  }

  for (const milestone of archive.milestones) {
    const linked = cards.filter((c) => archive.milestoneIds(c.id).includes(milestone.id));
    if (!linked.length) continue;
    const nodeId = `milestone:${milestone.id}`;
    nodes.push({
      id: nodeId,
      kind: 'milestone',
      refId: milestone.id,
      title: milestone.title,
      subtitle: milestone.age_min !== null ? `Age ${milestone.age_min}` : 'Milestone',
      ageMin: milestone.age_min,
      cover: null,
      emotions: [],
      x: at(nodeId)?.x ?? null,
      y: at(nodeId)?.y ?? null,
    });
    for (const card of linked) {
      edges.push({
        id: `${nodeId}->${card.id}`,
        source: nodeId,
        target: `memory:${card.id}`,
        kind: 'milestone',
        connectionId: null,
        type: 'milestone',
        label: 'milestone',
        status: 'confirmed',
      });
    }
  }

  return { nodes, edges };
}

export function savePositions(positions: Array<{ id: string; x: number; y: number }>) {
  const timestamp = now();
  transaction(() => {
    for (const p of positions) {
      run(
        'INSERT INTO map_positions (node_id, x, y, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (node_id) DO UPDATE SET x = excluded.x, y = excluded.y, updated_at = excluded.updated_at',
        p.id,
        p.x,
        p.y,
        timestamp,
      );
    }
  });
}

export function resetPositions() {
  run('DELETE FROM map_positions');
}
