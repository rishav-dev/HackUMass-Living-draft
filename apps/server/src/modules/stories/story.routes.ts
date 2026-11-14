import { Router } from 'express';
import {
  storyBookInputSchema,
  storyBookUpdateSchema,
  storyChapterInputSchema,
  storyCharacterInputSchema,
  storyCharacterUpdateSchema,
  storyLinkInputSchema,
  storyNoteInputSchema,
  storyNoteUpdateSchema,
  storyOrderSchema,
  storySceneInputSchema,
  storySceneUpdateSchema,
} from '@living-draft/contracts';
import { STORY_LINK_TYPES } from '@living-draft/engine';
import { body, param } from '../../lib/http';
import {
  addChapter,
  addCharacter,
  addLink,
  addNote,
  bookDetail,
  createBook,
  createScene,
  deleteBook,
  deleteChapter,
  deleteCharacter,
  deleteLink,
  deleteNote,
  deleteScene,
  listBooks,
  renameChapter,
  reorderScenes,
  restoreSceneOriginal,
  tidyScene,
  updateBook,
  updateCharacter,
  updateNote,
  updateScene,
} from './story.service';

export const storyRouter = Router();

const book = (req: Parameters<typeof param>[0]) => param(req, 'bookId');

storyRouter.get('/', (_req, res) => res.json(listBooks()));
storyRouter.get('/link-types', (_req, res) => res.json(STORY_LINK_TYPES));
storyRouter.post('/', (req, res) =>
  res.status(201).json(createBook(body(req, storyBookInputSchema))),
);
storyRouter.get('/:bookId', (req, res) => res.json(bookDetail(book(req))));
storyRouter.patch('/:bookId', (req, res) =>
  res.json(updateBook(book(req), body(req, storyBookUpdateSchema))),
);
storyRouter.delete('/:bookId', (req, res) => {
  deleteBook(book(req));
  res.status(204).end();
});

storyRouter.post('/:bookId/chapters', (req, res) =>
  res.status(201).json(addChapter(book(req), body(req, storyChapterInputSchema).title)),
);
storyRouter.patch('/:bookId/chapters/:chapterId', (req, res) =>
  res.json(
    renameChapter(book(req), param(req, 'chapterId'), body(req, storyChapterInputSchema).title),
  ),
);
storyRouter.delete('/:bookId/chapters/:chapterId', (req, res) =>
  res.json(deleteChapter(book(req), param(req, 'chapterId'))),
);

storyRouter.post('/:bookId/scenes', (req, res) =>
  res.status(201).json(createScene(book(req), body(req, storySceneInputSchema))),
);
storyRouter.patch('/:bookId/scenes/:sceneId', (req, res) =>
  res.json(updateScene(book(req), param(req, 'sceneId'), body(req, storySceneUpdateSchema))),
);
storyRouter.post('/:bookId/scenes/:sceneId/tidy', (req, res) =>
  res.json(tidyScene(book(req), param(req, 'sceneId'))),
);
storyRouter.post('/:bookId/scenes/:sceneId/restore', (req, res) =>
  res.json(restoreSceneOriginal(book(req), param(req, 'sceneId'))),
);
storyRouter.delete('/:bookId/scenes/:sceneId', (req, res) => {
  deleteScene(book(req), param(req, 'sceneId'));
  res.status(204).end();
});
storyRouter.put('/:bookId/order', (req, res) =>
  res.json(reorderScenes(book(req), body(req, storyOrderSchema))),
);

storyRouter.post('/:bookId/characters', (req, res) =>
  res.status(201).json(addCharacter(book(req), body(req, storyCharacterInputSchema))),
);
storyRouter.patch('/:bookId/characters/:characterId', (req, res) =>
  res.json(
    updateCharacter(book(req), param(req, 'characterId'), body(req, storyCharacterUpdateSchema)),
  ),
);
storyRouter.delete('/:bookId/characters/:characterId', (req, res) =>
  res.json(deleteCharacter(book(req), param(req, 'characterId'))),
);

storyRouter.post('/:bookId/links', (req, res) =>
  res.status(201).json(addLink(book(req), body(req, storyLinkInputSchema))),
);
storyRouter.delete('/:bookId/links/:linkId', (req, res) =>
  res.json(deleteLink(book(req), param(req, 'linkId'))),
);

storyRouter.post('/:bookId/notes', (req, res) =>
  res.status(201).json(addNote(book(req), body(req, storyNoteInputSchema))),
);
storyRouter.patch('/:bookId/notes/:noteId', (req, res) =>
  res.json(updateNote(book(req), param(req, 'noteId'), body(req, storyNoteUpdateSchema))),
);
storyRouter.delete('/:bookId/notes/:noteId', (req, res) =>
  res.json(deleteNote(book(req), param(req, 'noteId'))),
);
