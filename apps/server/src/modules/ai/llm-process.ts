import os from 'node:os';
import type { Llama, LlamaChatSession, LlamaContextSequence } from 'node-llama-cpp';

type Incoming =
  | { type: 'load'; modelPath: string; threads: number }
  | {
      type: 'json' | 'text';
      id: number;
      system: string;
      prompt: string;
      maxTokens: number;
      temperature: number;
      schema?: unknown;
    };

let llama: Llama | null = null;
let sequence: LlamaContextSequence | null = null;
let Session: typeof LlamaChatSession | null = null;

try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  // not allowed here
}

const send = (message: object) => process.send?.(message);

async function load(modelPath: string, threads: number) {
  const lib = await import('node-llama-cpp');
  Session = lib.LlamaChatSession;
  llama = await lib.getLlama({ gpu: 'auto', progressLogs: false });
  const model = await llama.loadModel({ modelPath, gpuLayers: 'auto' });
  const context = await model.createContext({
    contextSize: { max: 12288 },
    threads,
    batchSize: 512,
  });
  sequence = context.getSequence();
  const names = await llama.getGpuDeviceNames().catch(() => [] as string[]);
  return names[0] ?? (llama.gpu || null);
}

process.on('message', async (message: Incoming) => {
  if (message.type === 'load') {
    try {
      send({ type: 'loaded', gpu: await load(message.modelPath, message.threads) });
    } catch (error) {
      send({ type: 'failed', message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (!llama || !sequence || !Session) {
    send({ type: 'result', id: message.id, error: 'The model is not loaded.' });
    return;
  }
  const session = new Session({
    contextSequence: sequence,
    systemPrompt: message.system,
    autoDisposeSequence: false,
  });
  try {
    const grammar =
      message.type === 'json'
        ? await llama.createGrammarForJsonSchema(
            message.schema as Parameters<Llama['createGrammarForJsonSchema']>[0],
          )
        : undefined;
    let soFar = '';
    let last = 0;
    const text = await session.prompt(message.prompt, {
      grammar,
      maxTokens: message.maxTokens,
      temperature: message.temperature,
      repeatPenalty: message.type === 'text' ? { penalty: 1.08, lastTokens: 96 } : false,
      onTextChunk:
        message.type === 'text'
          ? (chunk) => {
              soFar += chunk;
              if (Date.now() - last > 250) {
                last = Date.now();
                send({ type: 'chunk', id: message.id, soFar });
              }
            }
          : undefined,
    });
    send({ type: 'result', id: message.id, text });
  } catch (error) {
    send({
      type: 'result',
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    session.dispose({ disposeSequence: false });
  }
});

send({ type: 'ready' });
