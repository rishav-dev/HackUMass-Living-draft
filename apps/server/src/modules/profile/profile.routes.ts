import { Router } from 'express';
import { profileInputSchema, profileUpdateSchema } from '@living-draft/contracts';
import { body, HttpError } from '../../lib/http';
import { createProfile, findProfile, updateProfile } from './profile.repository';

export const profileRouter = Router();

profileRouter.get('/', (_req, res) => {
  res.json({ profile: findProfile() });
});

profileRouter.post('/', (req, res) => {
  if (findProfile()) throw new HttpError(409, 'A profile already exists');
  res.status(201).json(createProfile(body(req, profileInputSchema)));
});

profileRouter.patch('/', (req, res) => {
  res.json(updateProfile(body(req, profileUpdateSchema)));
});
