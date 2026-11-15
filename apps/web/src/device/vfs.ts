const DB_NAME = 'living-draft-device';
const STORE = 'files';

const files = new Map<string, Uint8Array>();
let database: IDBDatabase | null = null;
const writes = new Map<string, Uint8Array | null>();
let flushing: Promise<void> | null = null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadFiles(): Promise<void> {
  database = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = database!.transaction(STORE, 'readonly');
    const cursor = tx.objectStore(STORE).openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current) return;
      files.set(String(current.key), new Uint8Array(current.value as ArrayBuffer));
      current.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    while (writes.size && database) {
      const batch = [...writes.entries()];
      writes.clear();
      await new Promise<void>((resolve, reject) => {
        const tx = database!.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        for (const [key, value] of batch) {
          if (value)
            store.put(
              value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
              key,
            );
          else store.delete(key);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function persistSoon(path: string, data: Uint8Array | null) {
  writes.set(path, data);
  queueMicrotask(() => void flush());
}

export function readFile(path: string): Uint8Array | undefined {
  return files.get(path);
}

export function writeFile(path: string, data: Uint8Array, persist = true) {
  files.set(path, data);
  if (persist) persistSoon(path, data);
}

export function removeFile(path: string) {
  files.delete(path);
  persistSoon(path, null);
}

export function listFiles(prefix: string): string[] {
  return [...files.keys()].filter((key) => key.startsWith(prefix));
}

export function hasFile(path: string): boolean {
  return files.has(path);
}

export function settle(): Promise<void> {
  return flush();
}
