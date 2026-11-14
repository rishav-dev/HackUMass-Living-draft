import { Router } from 'express';
import {
  addVersionSchema,
  analyzeSchema,
  attachMediaSchema,
  createMemorySchema,
  resolutionSchema,
  searchQuerySchema,
  updateMemorySchema,
} from '@living-draft/contracts';
import { get } from '../../db/database';
import { badRequest, body, notFound, param, parse } from '../../lib/http';
import type { VersionRow } from '../archive/rows';
import {
  addVersion,
  analyzeCapture,
  compareVersionRows,
  createMemory,
  restoreVersion,
} from '../capture/capture.service';
import {
  attachMedia,
  confirmPlacement,
  deleteMemory,
  memoryDetail,
  resolveChange,
  searchMemories,
  updateMemory,
} from './memory.service';

export const memoryRouter = Router();

memoryRouter.post('/analyze', (req, res) => {
  res.json(analyzeCapture(body(req, analyzeSchema)));
});

memoryRouter.get('/', (req, res) => {
  res.json(searchMemories(parse(searchQuerySchema, req.query)));
});

memoryRouter.post('/', (req, res) => {
  const created = createMemory(body(req, createMemorySchema));
  res.status(201).json(memoryDetail(created.memoryId));
});

memoryRouter.get('/:id', (req, res) => {
  res.json(memoryDetail(param(req, 'id')));
});

memoryRouter.patch('/:id', (req, res) => {
  res.json(updateMemory(param(req, 'id'), body(req, updateMemorySchema)));
});

memoryRouter.delete('/:id', (req, res) => {
  deleteMemory(param(req, 'id'));
  res.status(204).end();
});

memoryRouter.post('/:id/media', (req, res) => {
  const id = param(req, 'id');
  const { mediaIds } = body(req, attachMediaSchema);
  attachMedia(id, mediaIds);
  res.json(memoryDetail(id));
});

memoryRouter.post('/:id/confirm-placement', (req, res) => {
  const id = param(req, 'id');
  confirmPlacement(id);
  res.json(memoryDetail(id));
});

memoryRouter.post('/:id/versions', (req, res) => {
  const result = addVersion(param(req, 'id'), body(req, addVersionSchema));
  res.status(201).json({
    memory: memoryDetail(result.memoryId),
    comparison: result.comparison,
    versionId: result.versionId,
  });
});

memoryRouter.post('/:id/versions/:versionId/restore', (req, res) => {
  const result = restoreVersion(param(req, 'id'), param(req, 'versionId'));
  res.json(memoryDetail(result.memoryId));
});

memoryRouter.get('/:id/compare', (req, res) => {
  const id = param(req, 'id');
  const a = typeof req.query.a === 'string' ? req.query.a : '';
  const b = typeof req.query.b === 'string' ? req.query.b : '';
  if (!a || !b) throw badRequest('Pick two versions to compare');
  const earlier = get<VersionRow>(
    'SELECT * FROM memory_versions WHERE id = ? AND memory_id = ?',
    a,
    id,
  );
  const later = get<VersionRow>(
    'SELECT * FROM memory_versions WHERE id = ? AND memory_id = ?',
    b,
    id,
  );
  if (!earlier || !later) throw notFound('Version');
  const [first, second] = earlier.seq <= later.seq ? [earlier, later] : [later, earlier];
  res.json(compareVersionRows(first, second));
});

memoryRouter.post('/:id/resolutions', (req, res) => {
  const id = param(req, 'id');
  const reviewItemId = typeof req.body?.reviewItemId === 'string' ? req.body.reviewItemId : null;
  const result = resolveChange(id, reviewItemId, body(req, resolutionSchema));
  res.json({ memory: memoryDetail(id), splitMemoryId: result.splitMemoryId ?? null });
});
