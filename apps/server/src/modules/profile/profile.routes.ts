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
  const input = body(req, profileInputSchema);
  createProfile(input);
  const extras = {
    ...(input.placeName !== undefined ? { placeName: input.placeName } : {}),
    ...(input.placeLat !== undefined ? { placeLat: input.placeLat } : {}),
    ...(input.placeLon !== undefined ? { placeLon: input.placeLon } : {}),
    ...(input.weatherOn !== undefined ? { weatherOn: input.weatherOn } : {}),
    ...(input.tempUnit !== undefined ? { tempUnit: input.tempUnit } : {}),
    ...(input.locationMode !== undefined ? { locationMode: input.locationMode } : {}),
  };
  res.status(201).json(Object.keys(extras).length ? updateProfile(extras) : findProfile());
});

profileRouter.patch('/', (req, res) => {
  res.json(updateProfile(body(req, profileUpdateSchema)));
});
