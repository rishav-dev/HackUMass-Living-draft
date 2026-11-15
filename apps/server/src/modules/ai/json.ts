export function readJson<T>(reply: string): T {
  const start = reply.indexOf('{');
  if (start < 0) throw new Error('The model did not return anything usable.');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < reply.length; i += 1) {
    const ch = reply[i]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(reply.slice(start, i + 1)) as T;
    }
  }
  const rescued = salvage(reply, start);
  if (rescued) {
    try {
      return JSON.parse(rescued) as T;
    } catch {
      // fall through
    }
  }
  if (process.env.LIVING_DRAFT_AI_DEBUG)
    console.error('Unparsed model reply:', reply.slice(0, 400));
  throw new Error('The model stopped before finishing its answer.');
}

function salvage(reply: string, start: number): string | null {
  const open: string[] = [];
  let quoted = false;
  let escaped = false;
  let cut = -1;
  let closers: string[] = [];
  for (let i = start; i < reply.length; i += 1) {
    const ch = reply[i]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === '{') open.push('}');
    else if (ch === '[') open.push(']');
    else if (ch === '}' || ch === ']') {
      open.pop();
      cut = i + 1;
      closers = [...open];
    } else if (ch === ',') {
      cut = i;
      closers = [...open];
    }
  }
  if (cut < 0) return null;
  return reply.slice(start, cut) + closers.reverse().join('');
}
