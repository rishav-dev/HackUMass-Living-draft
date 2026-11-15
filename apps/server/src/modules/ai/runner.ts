import type { AiStatusDto } from '@living-draft/contracts';
import { HttpError } from '../../lib/http';

export type JsonSchema = Record<string, unknown>;

export interface AskOptions {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  urgent?: boolean;
}

export interface AiRunner {
  status(): AiStatusDto;
  prepare(): AiStatusDto;
  available(): boolean;
  askJson<T>(options: AskOptions, schema: JsonSchema): Promise<T>;
  askText(options: AskOptions, onText?: (soFar: string) => void): Promise<string>;
}

export const noRunner: AiRunner = {
  status: () => ({
    status: 'failed',
    progress: 0,
    downloaded: false,
    reason: 'No AI engine is set up here.',
    model: null,
    where: 'none',
    sizeLabel: null,
    gpu: null,
  }),
  prepare: () => noRunner.status(),
  available: () => false,
  askJson: () => Promise.reject(new HttpError(409, 'No AI engine is set up here.')),
  askText: () => Promise.reject(new HttpError(409, 'No AI engine is set up here.')),
};

let runner: AiRunner = noRunner;

export function useAiRunner(next: AiRunner) {
  runner = next;
}

export const ai: AiRunner = {
  status: () => runner.status(),
  prepare: () => runner.prepare(),
  available: () => runner.available(),
  askJson: (options, schema) => runner.askJson(options, schema),
  askText: (options, onText) => runner.askText(options, onText),
};
