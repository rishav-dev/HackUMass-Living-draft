import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    const first = result.error.issues[0];
    const where = (first?.path ?? [])
      .filter((part) => typeof part === 'string')
      .map((part) =>
        String(part)
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase(),
      )
      .join(' › ');
    const problem =
      first?.code === 'too_small'
        ? 'is empty or too short'
        : first?.code === 'too_big'
          ? 'is too long'
          : first?.code === 'invalid_type'
            ? 'is missing or the wrong kind of value'
            : "isn't one of the options this accepts";
    throw badRequest(
      where ? `The ${where} ${problem}.` : 'Something in that request was off.',
      issues,
    );
  }
  return result.data;
}

export function body<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  return parse(schema, req.body);
}

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw badRequest(`Missing ${name}`);
  return value;
}

export function newId(): string {
  return randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
