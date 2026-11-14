import { Router } from 'express';
import {
  aliasSchema,
  characterInputSchema,
  characterLinkSchema,
  characterUpdateSchema,
  mentionUpdateSchema,
  mergeCharactersSchema,
  splitCharacterSchema,
} from '@living-draft/contracts';
import { body, param } from '../../lib/http';
import {
  addCharacterAlias,
  characterDetail,
  createCharacterFromInput,
  deleteCharacter,
  listCharacters,
  mergeCharacters,
  removeCharacterAlias,
  splitCharacter,
  updateCharacter,
  updateMention,
} from './character.service';

import { linkCharacters, unlinkCharacters } from './character.links';

export const characterRouter = Router();

characterRouter.get('/', (_req, res) => {
  res.json(listCharacters());
});

characterRouter.post('/', (req, res) => {
  res.status(201).json(createCharacterFromInput(body(req, characterInputSchema)));
});

characterRouter.post('/merge', (req, res) => {
  const { sourceId, targetId } = body(req, mergeCharactersSchema);
  res.json(mergeCharacters(sourceId, targetId));
});

characterRouter.get('/:id', (req, res) => {
  res.json(characterDetail(param(req, 'id')));
});

characterRouter.patch('/:id', (req, res) => {
  res.json(updateCharacter(param(req, 'id'), body(req, characterUpdateSchema)));
});

characterRouter.delete('/:id', (req, res) => {
  deleteCharacter(param(req, 'id'));
  res.status(204).end();
});

characterRouter.post('/:id/links', (req, res) => {
  const input = body(req, characterLinkSchema);
  res.json(linkCharacters(param(req, 'id'), input.otherId, input.label, input.note));
});

characterRouter.delete('/:id/links/:linkId', (req, res) => {
  res.json(unlinkCharacters(param(req, 'id'), param(req, 'linkId')));
});

characterRouter.post('/:id/aliases', (req, res) => {
  res.json(addCharacterAlias(param(req, 'id'), body(req, aliasSchema).alias));
});

characterRouter.delete('/:id/aliases/:alias', (req, res) => {
  res.json(removeCharacterAlias(param(req, 'id'), decodeURIComponent(param(req, 'alias'))));
});

characterRouter.post('/:id/split', (req, res) => {
  const input = body(req, splitCharacterSchema);
  res
    .status(201)
    .json(splitCharacter(param(req, 'id'), input.mentionIds, input.name, input.relationship));
});

export const mentionRouter = Router();

mentionRouter.patch('/:id', (req, res) => {
  updateMention(param(req, 'id'), body(req, mentionUpdateSchema));
  res.status(204).end();
});
