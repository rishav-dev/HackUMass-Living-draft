import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { mediaUpdateSchema } from '@living-draft/contracts';
import { config } from '../../config';
import { badRequest, body, notFound, param } from '../../lib/http';
import {
  deleteMedia,
  findMedia,
  insertMedia,
  kindForMime,
  toMediaDto,
  updateCaption,
} from './media.repository';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => {
      fs.mkdirSync(config.mediaDir, { recursive: true });
      done(null, config.mediaDir);
    },
    filename: (_req, file, done) => {
      const base = file.mimetype.split(';')[0]!;
      const ext = EXTENSIONS[base] ?? path.extname(file.originalname).toLowerCase().slice(0, 6);
      done(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, done) => {
    done(null, /^(image|video|audio)\//.test(file.mimetype));
  },
});

export const mediaRouter = Router();

mediaRouter.post('/', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) throw badRequest('Attach an image, video or audio file');
  const mime = file.mimetype.split(';')[0]!;
  const duration = Number(req.body?.durationMs);
  const row = insertMedia({
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: mime,
    sizeBytes: file.size,
    kind: kindForMime(mime, req.body?.kind),
    caption:
      typeof req.body?.caption === 'string' && req.body.caption.trim()
        ? req.body.caption.trim()
        : null,
    durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
  });
  res.status(201).json(toMediaDto(row));
});

mediaRouter.patch('/:id', (req, res) => {
  const id = param(req, 'id');
  if (!findMedia(id)) throw notFound('File');
  updateCaption(id, body(req, mediaUpdateSchema).caption);
  res.json(toMediaDto(findMedia(id)!));
});

mediaRouter.delete('/:id', (req, res) => {
  const id = param(req, 'id');
  if (!findMedia(id)) throw notFound('File');
  deleteMedia(id);
  res.status(204).end();
});
