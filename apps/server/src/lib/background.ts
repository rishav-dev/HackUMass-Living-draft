import os from 'node:os';

export const WORK_THREADS = Math.max(1, Math.min(4, Math.floor(os.availableParallelism() / 2) - 1));

let lowered = false;

export function stepAside() {
  if (lowered) return;
  lowered = true;
  try {
    os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    return;
  }
}
