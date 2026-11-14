import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const api = process.env.LIVING_DRAFT_API ?? 'http://127.0.0.1:4317';
const shim = (name: string) => path.join(here, 'src/device/shims', `${name}.ts`);

export default defineConfig(({ mode }) => {
  const device = mode === 'app';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_RUNTIME': JSON.stringify(device ? 'device' : 'server'),
    },
    resolve: {
      alias: [
        { find: /^node:fs$/, replacement: shim('fs') },
        { find: /^node:path$/, replacement: shim('path') },
        { find: /^node:url$/, replacement: shim('url') },
        { find: /^node:crypto$/, replacement: shim('crypto') },
        { find: /^node:sqlite$/, replacement: shim('sqlite') },
        { find: /^express$/, replacement: shim('express') },
        { find: /^multer$/, replacement: shim('multer') },
        {
          find: /^voice-runtime\.wasm/,
          replacement: path.join(
            here,
            '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
          ),
        },
      ],
    },
    server: {
      port: 5173,
      proxy: {
        '/api': api,
        '/media': api,
      },
    },
    worker: { format: 'es' as const },
    build: {
      outDir: device ? 'dist-app' : 'dist',
      chunkSizeWarningLimit: 900,
    },
  };
});
