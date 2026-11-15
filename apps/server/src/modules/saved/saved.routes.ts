import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../../db/database';
import { body, notFound, now, param } from '../../lib/http';
import { Archive } from '../archive/snapshot';
import { listAnalyses } from '../insight/insight.service';
import { searchPlaces } from '../weather/weather.service';

export const savedRouter = Router();

savedRouter.put('/memories/:id/bookmark', (req, res) => {
  const id = param(req, 'id');
  if (!get('SELECT id FROM memories WHERE id = ?', id)) throw notFound('Memory');
  const { on } = body(req, z.object({ on: z.boolean() }));
  run('UPDATE memories SET bookmarked_at = ? WHERE id = ?', on ? now() : null, id);
  res.json({ bookmarked: on });
});

savedRouter.put('/memories/:id/questions/:questionId', (req, res) => {
  const { answer } = body(req, z.object({ answer: z.string().trim().max(8000) }));
  const id = param(req, 'questionId');
  if (!get('SELECT id FROM memory_questions WHERE id = ? AND memory_id = ?', id, param(req, 'id')))
    throw notFound('Question');
  run(
    'UPDATE memory_questions SET answer = ?, answered_at = ? WHERE id = ?',
    answer || null,
    answer ? now() : null,
    id,
  );
  res.json({ ok: true });
});

savedRouter.get('/saved', (_req, res) => {
  const archive = Archive.load();
  const marked = all<{ id: string }>(
    'SELECT id FROM memories WHERE bookmarked_at IS NOT NULL ORDER BY bookmarked_at DESC',
  ).map((r) => r.id);
  res.json({ memories: archive.cards(marked), analyses: listAnalyses() });
});

savedRouter.get('/themes', (_req, res) => {
  res.json(
    all<{ theme: string; count: number }>(
      `SELECT t.theme, COUNT(*) AS count FROM memory_themes t
       JOIN memories m ON m.id = t.memory_id AND m.sensitive = 0
       GROUP BY t.theme ORDER BY count DESC, t.theme`,
    ),
  );
});

savedRouter.get('/themes/:theme', (req, res) => {
  const theme = param(req, 'theme');
  const rows = all<{ memory_id: string; evidence: string | null }>(
    'SELECT memory_id, evidence FROM memory_themes WHERE theme = ?',
    theme,
  );
  const archive = Archive.load();
  const cards = archive.cards(rows.map((r) => r.memory_id));
  res.json({
    theme,
    memories: cards
      .map((card) => ({
        ...card,
        why: rows.find((r) => r.memory_id === card.id)?.evidence ?? null,
      }))
      .sort((a, b) => (a.temporal.ageMin ?? 999) - (b.temporal.ageMin ?? 999)),
  });
});

savedRouter.get('/places', (_req, res) => {
  res.json(
    all<{ id: string; name: string; kind: string | null; count: number }>(
      `SELECT p.id, p.name, p.kind, COUNT(mp.memory_id) AS count FROM places p
       LEFT JOIN memory_places mp ON mp.place_id = p.id
       GROUP BY p.id HAVING count > 0 ORDER BY count DESC, p.name`,
    ),
  );
});

interface MapRow {
  id: string;
  name: string;
  kind: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  memory_id: string;
}

savedRouter.get('/places/map', (_req, res) => {
  const rows = all<MapRow>(
    `SELECT p.id, p.name, p.kind, p.region, p.country, p.lat, p.lon, mp.memory_id
     FROM places p JOIN memory_places mp ON mp.place_id = p.id ORDER BY p.name`,
  );
  const places = new Map<string, Omit<MapRow, 'memory_id'> & { memoryIds: string[] }>();
  for (const { memory_id: memoryId, ...place } of rows) {
    const entry = places.get(place.id) ?? { ...place, memoryIds: [] };
    entry.memoryIds.push(memoryId);
    places.set(place.id, entry);
  }
  const list = [...places.values()];
  res.json({
    placed: list.filter((p) => p.lat !== null && p.lon !== null),
    unplaced: list
      .filter((p) => p.lat === null || p.lon === null)
      .map((p) => ({ id: p.id, name: p.name, count: p.memoryIds.length })),
  });
});

savedRouter.post('/places/locate', async (_req, res) => {
  const missing = all<{ id: string; name: string }>(
    `SELECT DISTINCT p.id, p.name FROM places p JOIN memory_places mp ON mp.place_id = p.id
     WHERE p.lat IS NULL OR p.lon IS NULL`,
  );
  const notFound: string[] = [];
  for (const place of missing) {
    const [first] = await searchPlaces(place.name).catch(() => []);
    if (!first) {
      notFound.push(place.name);
      continue;
    }
    run(
      'UPDATE places SET lat = ?, lon = ?, region = COALESCE(region, ?), country = COALESCE(country, ?) WHERE id = ?',
      first.lat,
      first.lon,
      first.region,
      first.country,
      place.id,
    );
  }
  res.json({ found: missing.length - notFound.length, notFound });
});

savedRouter.put('/places/:id/location', (req, res) => {
  const id = param(req, 'id');
  if (!get('SELECT id FROM places WHERE id = ?', id)) throw notFound('Place');
  const input = body(
    req,
    z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      region: z.string().max(120).nullable().optional(),
      country: z.string().max(120).nullable().optional(),
    }),
  );
  run(
    'UPDATE places SET lat = ?, lon = ?, region = ?, country = ? WHERE id = ?',
    input.lat,
    input.lon,
    input.region ?? null,
    input.country ?? null,
    id,
  );
  res.json({ ok: true });
});

savedRouter.get('/places/:id', (req, res) => {
  const place = get<{
    id: string;
    name: string;
    kind: string | null;
    lat: number | null;
    lon: number | null;
  }>('SELECT id, name, kind, lat, lon FROM places WHERE id = ?', param(req, 'id'));
  if (!place) throw notFound('Place');
  const ids = all<{ memory_id: string }>(
    'SELECT memory_id FROM memory_places WHERE place_id = ?',
    place.id,
  ).map((r) => r.memory_id);
  const archive = Archive.load();
  const memories = archive
    .cards(ids)
    .sort((a, b) => (a.temporal.ageMin ?? 999) - (b.temporal.ageMin ?? 999));
  const people = new Map<string, { id: string; name: string; count: number }>();
  for (const memory of memories)
    for (const person of memory.people) {
      const entry = people.get(person.characterId) ?? {
        id: person.characterId,
        name: person.name,
        count: 0,
      };
      entry.count += 1;
      people.set(person.characterId, entry);
    }
  const ages = memories
    .flatMap((m) => [m.temporal.ageMin, m.temporal.ageMax])
    .filter((a): a is number => a !== null);
  res.json({
    ...place,
    memories,
    people: [...people.values()].sort((a, b) => b.count - a.count),
    ages: ages.length ? { from: Math.min(...ages), to: Math.max(...ages) } : null,
  });
});
