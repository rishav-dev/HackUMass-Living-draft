export function fileURLToPath(value: string | URL): string {
  try {
    return decodeURIComponent(new URL(String(value)).pathname);
  } catch {
    return String(value);
  }
}

export default { fileURLToPath };
