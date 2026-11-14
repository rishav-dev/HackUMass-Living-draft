import type { MapNodeDto } from '@living-draft/contracts';
import { hashNumber } from '../../lib/meta';

export function autoLayout(nodes: MapNodeDto[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const shownAges = new Set(nodes.filter((n) => n.kind === 'memory').map((n) => n.ageMin));
  const memories = nodes
    .filter((n) => n.kind === 'memory' || (n.kind === 'period' && !shownAges.has(n.ageMin)))
    .sort((a, b) => (a.ageMin ?? 99) - (b.ageMin ?? 99) || (a.kind === 'period' ? -1 : 1));
  const columns = Math.max(3, Math.ceil(Math.sqrt(memories.length * 1.7)));
  memories.forEach((node, i) => {
    const row = Math.floor(i / columns);
    const col = row % 2 === 0 ? i % columns : columns - 1 - (i % columns);
    const jx = (hashNumber(`${node.id}x`) - 0.5) * 90;
    const jy = (hashNumber(`${node.id}y`) - 0.5) * 80;
    positions.set(node.id, { x: col * 270 + jx, y: row * 330 + jy });
  });
  const around = (ids: string[]) => {
    const points = ids
      .map((id) => positions.get(id))
      .filter((p): p is { x: number; y: number } => !!p);
    if (!points.length) return { x: 0, y: 0 };
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  };
  const people = nodes.filter((n) => n.kind === 'character');
  people.forEach((node, i) => {
    positions.set(node.id, {
      x: ((i + 0.5) / people.length) * columns * 270 - 60,
      y: -230 - (i % 2) * 70,
    });
  });
  nodes
    .filter((n) => n.kind === 'period' && shownAges.has(n.ageMin))
    .forEach((node) => {
      const first = memories.find((m) => m.kind === 'memory' && m.ageMin === node.ageMin);
      const anchor = first ? positions.get(first.id) : undefined;
      if (anchor) positions.set(node.id, { x: anchor.x + 6, y: anchor.y - 86 });
    });
  const milestones = nodes.filter((n) => n.kind === 'milestone');
  milestones.forEach((node) => {
    const nearest = memories.reduce<MapNodeDto | null>(
      (best, m) =>
        best === null ||
        Math.abs((m.ageMin ?? 99) - (node.ageMin ?? 0)) <
          Math.abs((best.ageMin ?? 99) - (node.ageMin ?? 0))
          ? m
          : best,
      null,
    );
    const anchor = nearest ? around([nearest.id]) : { x: 0, y: 0 };
    positions.set(node.id, { x: anchor.x + 40, y: anchor.y + 250 });
  });
  return positions;
}
