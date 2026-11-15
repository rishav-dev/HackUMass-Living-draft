function normalize(parts: string[]): string {
  const out: string[] = [];
  for (const part of parts.join('/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

const path = {
  sep: '/',
  join: (...parts: string[]) => normalize(parts),
  resolve: (...parts: string[]) => {
    const start =
      parts
        .map((p, i) => (p.startsWith('/') ? i : -1))
        .filter((i) => i >= 0)
        .pop() ?? 0;
    return normalize(parts.slice(start));
  },
  dirname: (value: string) => normalize([value, '..']),
  basename: (value: string) => value.split('/').filter(Boolean).pop() ?? '',
  extname: (value: string) => {
    const base = value.split('/').pop() ?? '';
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(dot) : '';
  },
};

export default path;
export const { join, resolve, dirname, basename, extname, sep } = path;
