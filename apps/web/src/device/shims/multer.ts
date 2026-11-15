import fs from './fs';
import path from './path';
import type { DeviceRequest } from './express';

type Done<T> = (error: Error | null, value: T) => void;

interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
}

interface Storage {
  kind: 'disk' | 'memory';
  destination?: (req: DeviceRequest, file: UploadedFile, done: Done<string>) => void;
  filename?: (req: DeviceRequest, file: UploadedFile, done: Done<string>) => void;
}

interface Options {
  storage?: Storage;
  limits?: { fileSize?: number };
  fileFilter?: (
    req: DeviceRequest,
    file: UploadedFile,
    done: (error: Error | null, accept: boolean) => void,
  ) => void;
}

class MulterError extends Error {
  constructor(
    readonly code: string,
    readonly field?: string,
  ) {
    super(code === 'LIMIT_FILE_SIZE' ? 'File too large' : code);
    this.name = 'MulterError';
  }
}

function multer(options: Options = {}) {
  return {
    single(field: string) {
      return (req: DeviceRequest, _res: unknown, next: (error?: unknown) => void) => {
        const upload = req.upload;
        if (!upload) return next();
        if (options.limits?.fileSize && upload.size > options.limits.fileSize)
          return next(new MulterError('LIMIT_FILE_SIZE', field));
        const file: UploadedFile = {
          fieldname: field,
          originalname: upload.name,
          mimetype: upload.type,
          size: upload.size,
        };
        const store = () => {
          const storage = options.storage;
          if (storage?.kind !== 'disk' || !storage.destination || !storage.filename) {
            req.file = { ...file, buffer: upload.bytes };
            return next();
          }
          storage.destination(req, file, (error, destination) => {
            if (error) return next(error);
            storage.filename!(req, file, (nameError, filename) => {
              if (nameError) return next(nameError);
              const target = path.join(destination, filename);
              fs.writeFileSync(target, upload.bytes);
              req.file = { ...file, destination, filename, path: target };
              next();
            });
          });
        };
        if (!options.fileFilter) return store();
        options.fileFilter(req, file, (error, accept) => {
          if (error) return next(error);
          if (accept) store();
          else next();
        });
      };
    },
  };
}

multer.diskStorage = (config: Omit<Storage, 'kind'>): Storage => ({ kind: 'disk', ...config });
multer.memoryStorage = (): Storage => ({ kind: 'memory' });
multer.MulterError = MulterError;

export default multer;
