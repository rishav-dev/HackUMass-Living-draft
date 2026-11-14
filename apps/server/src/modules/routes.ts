import { Router } from 'express';
import {
  analysisSaveSchema,
  askSchema,
  capsuleInputSchema,
  chapterNoteSchema,
  chapterOrderSchema,
  generateArtSchema,
  compareSchema,
  connectionInputSchema,
  connectionUpdateSchema,
  mapPositionsSchema,
  milestoneInputSchema,
  openCapsuleSchema,
  recapRequestSchema,
  reflectionInputSchema,
  suggestConnectionsSchema,
} from '@living-draft/contracts';
import {
  CONNECTION_TYPES,
  COMPARE_QUESTIONS,
  CURATED_QUESTIONS,
  pickPrompts,
  runEvaluation,
  type PromptGroup,
} from '@living-draft/engine';
import { badRequest, body, param } from '../lib/http';
import { deleteEverything, exportArchive } from './archive/archive.service';
import { artStatus, declineArt, findArt, requestArt } from './art/art.service';
import { authRouter, requireSession } from './auth/auth.routes';
import { recapFor } from './story/recap.service';
import { chapterShareHtml } from './story/share.service';
import { storyRouter } from './stories/story.routes';
import { dayWeather, searchPlaces, weatherNow } from './weather/weather.service';
import { clearAuth } from './auth/auth.service';
import { chapterNotes, saveChapterNote, saveStoryOrder } from './story/story.service';
import {
  createCapsule,
  deleteCapsule,
  listCapsules,
  markMilestoneReached,
  openCapsule,
} from './capsules/capsule.service';
import { characterRouter, mentionRouter } from './characters/character.routes';
import {
  createConnection,
  deleteConnection,
  listConnections,
  suggestAndStore,
  updateConnection,
} from './connections/connection.service';
import {
  ask,
  compare,
  deleteAnalysis,
  listAnalyses,
  saveAnalysis,
} from './insight/insight.service';
import { chapter, days, lifePath, playback } from './lifepath/lifepath.service';
import { memoryMap, resetPositions, savePositions } from './map/map.service';
import { mediaRouter } from './media/media.routes';
import { memoryRouter } from './memories/memory.routes';
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  updateMilestone,
} from './milestones/milestone.service';
import { profileRouter } from './profile/profile.routes';
import { requireProfile } from './profile/profile.repository';
import {
  createReflection,
  deleteReflection,
  listReflections,
} from './reflections/reflection.service';

const optionalInt = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw badRequest(`Expected a whole number, got "${value}"`);
  return parsed;
};

export function apiRouter(): Router {
  const api = Router();

  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRouter);
  api.use(requireSession);
  api.use('/profile', profileRouter);
  api.use('/memories', memoryRouter);
  api.use('/characters', characterRouter);
  api.use('/mentions', mentionRouter);
  api.use('/media', mediaRouter);
  api.use('/stories', storyRouter);

  api.get('/life-path', (_req, res) => res.json(lifePath()));
  api.get('/days', (_req, res) => res.json(days()));

  api.get('/art/status', (_req, res) => res.json(artStatus()));
  api.get('/art', (req, res) => {
    const keys =
      typeof req.query.keys === 'string'
        ? req.query.keys.split(',').filter(Boolean).slice(0, 200)
        : [];
    res.json(Object.fromEntries(findArt(keys)));
  });
  api.post('/art/generate', (req, res) => {
    const input = body(req, generateArtSchema);
    res.json(requestArt(input.key, input.fresh));
  });
  api.delete('/art/:key', (req, res) => {
    const key = param(req, 'key');
    if (!/^(memory|day):[\w-]+$/.test(key)) throw badRequest('Not a scene');
    declineArt(key);
    res.status(204).end();
  });

  api.post('/recap', (req, res) => {
    const input = body(req, recapRequestSchema);
    res.json(recapFor(input.focusPeople, input.label, input.memoryIds, input.includeQuiet));
  });
  api.get('/weather/now', async (_req, res) => res.json(await weatherNow()));
  api.get('/weather/memory/:id', async (req, res) => res.json(await dayWeather(param(req, 'id'))));
  api.get('/places', async (req, res) =>
    res.json(await searchPlaces(typeof req.query.q === 'string' ? req.query.q.slice(0, 80) : '')),
  );
  api.get('/chapter-notes', (_req, res) => res.json(chapterNotes()));
  api.put('/chapters/:age/note', (req, res) => {
    res.json(
      saveChapterNote(optionalInt(param(req, 'age')) ?? 0, body(req, chapterNoteSchema).body),
    );
  });
  api.put('/story-order', (req, res) => {
    saveStoryOrder(body(req, chapterOrderSchema).memoryIds);
    res.status(204).end();
  });
  api.get('/chapters/:age/share', (req, res) => {
    const page = chapterShareHtml(optionalInt(param(req, 'age')) ?? 0, req.query.quiet === '1');
    res.setHeader('Content-Disposition', `attachment; filename="${page.fileName}"`);
    res.type('html').send(page.html);
  });
  api.get('/chapters/:age', (req, res) => res.json(chapter(optionalInt(param(req, 'age')) ?? 0)));
  api.get('/playback', (req, res) => {
    res.json(
      playback({
        age: optionalInt(req.query.age),
        memoryId: typeof req.query.memoryId === 'string' ? req.query.memoryId : undefined,
        characterId: typeof req.query.characterId === 'string' ? req.query.characterId : undefined,
        date:
          typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
            ? req.query.date
            : undefined,
      }),
    );
  });

  api.get('/connections', (req, res) => {
    res.json(listConnections(typeof req.query.status === 'string' ? req.query.status : undefined));
  });
  api.get('/connections/types', (_req, res) => res.json(CONNECTION_TYPES));
  api.post('/connections', (req, res) =>
    res.status(201).json(createConnection(body(req, connectionInputSchema))),
  );
  api.post('/connections/suggest', (req, res) =>
    res.json(suggestAndStore(body(req, suggestConnectionsSchema).memoryIds)),
  );
  api.patch('/connections/:id', (req, res) =>
    res.json(updateConnection(param(req, 'id'), body(req, connectionUpdateSchema))),
  );
  api.delete('/connections/:id', (req, res) => {
    deleteConnection(param(req, 'id'));
    res.status(204).end();
  });

  api.get('/map', (req, res) => {
    res.json(
      memoryMap({
        characterId: typeof req.query.characterId === 'string' ? req.query.characterId : undefined,
        ageMin: optionalInt(req.query.ageMin),
        ageMax: optionalInt(req.query.ageMax),
        emotion:
          typeof req.query.emotion === 'string' && req.query.emotion
            ? req.query.emotion
            : undefined,
        includeSuggested: req.query.suggested === 'true',
        includeCharacters: req.query.characters !== 'false',
      }),
    );
  });
  api.put('/map/positions', (req, res) => {
    savePositions(body(req, mapPositionsSchema).positions);
    res.status(204).end();
  });
  api.delete('/map/positions', (_req, res) => {
    resetPositions();
    res.status(204).end();
  });

  api.post('/compare', (req, res) => {
    const input = body(req, compareSchema);
    res.json(compare(input.memoryIds, input.question));
  });
  api.get('/compare/questions', (_req, res) => res.json(COMPARE_QUESTIONS));

  api.post('/ask', (req, res) => res.json(ask(body(req, askSchema))));
  api.get('/ask/questions', (_req, res) => res.json(CURATED_QUESTIONS));
  api.get('/analyses', (_req, res) => res.json(listAnalyses()));
  api.post('/analyses', (req, res) => {
    const input = body(req, analysisSaveSchema);
    res.status(201).json(saveAnalysis({ ...input, scope: input.scope as Record<string, unknown> }));
  });
  api.delete('/analyses/:id', (req, res) => {
    deleteAnalysis(param(req, 'id'));
    res.status(204).end();
  });

  api.get('/milestones', (_req, res) => res.json(listMilestones()));
  api.post('/milestones', (req, res) =>
    res.status(201).json(createMilestone(body(req, milestoneInputSchema))),
  );
  api.put('/milestones/:id', (req, res) =>
    res.json(updateMilestone(param(req, 'id'), body(req, milestoneInputSchema))),
  );
  api.delete('/milestones/:id', (req, res) => {
    deleteMilestone(param(req, 'id'));
    res.status(204).end();
  });

  api.get('/capsules', (_req, res) => res.json(listCapsules()));
  api.post('/capsules', (req, res) =>
    res.status(201).json(createCapsule(body(req, capsuleInputSchema))),
  );
  api.post('/capsules/:id/milestone-reached', (req, res) =>
    res.json(markMilestoneReached(param(req, 'id'))),
  );
  api.post('/capsules/:id/open', (req, res) =>
    res.json(openCapsule(param(req, 'id'), body(req, openCapsuleSchema).reflection)),
  );
  api.delete('/capsules/:id', (req, res) => {
    deleteCapsule(param(req, 'id'));
    res.status(204).end();
  });

  api.get('/reflections', (_req, res) => res.json(listReflections()));
  api.post('/reflections', (req, res) =>
    res.status(201).json(createReflection(body(req, reflectionInputSchema))),
  );
  api.delete('/reflections/:id', (req, res) => {
    deleteReflection(param(req, 'id'));
    res.status(204).end();
  });

  api.get('/prompts', (req, res) => {
    const group =
      typeof req.query.group === 'string' ? (req.query.group as PromptGroup) : undefined;
    res.json(pickPrompts({ group, count: optionalInt(req.query.count) ?? 3 }));
  });

  api.get('/evaluation', (_req, res) => res.json(runEvaluation()));

  api.get('/export', (_req, res) => {
    const profile = requireProfile();
    const archive = exportArchive();
    const name = `living-draft-${profile.preferredName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(Buffer.from(archive));
  });

  api.delete('/archive', (req, res) => {
    if (req.body?.confirm !== 'DELETE')
      throw badRequest('Send confirm: "DELETE" to erase everything');
    deleteEverything();
    clearAuth();
    res.status(204).end();
  });

  return api;
}
