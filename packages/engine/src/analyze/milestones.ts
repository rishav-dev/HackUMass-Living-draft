import type { MilestoneCue } from '../types';

const CUES: Array<{ pattern: RegExp; label: (m: RegExpMatchArray) => string }> = [
  {
    pattern:
      /\b(?:my|our)\s+(little\s+|baby\s+|younger\s+|older\s+)?(brother|sister)\s+(?:\w+\s+)?was born\b/gi,
    label: (m) => `My ${m[2]!.toLowerCase()} was born`,
  },
  {
    pattern: /\b(?:we|i)\s+moved\s+(?:to|into|out)\b[^.,;!?]{0,40}/gi,
    label: (m) => cap(m[0].trim()),
  },
  { pattern: /\bi\s+graduated\b[^.,;!?]{0,40}/gi, label: (m) => cap(m[0].trim()) },
  { pattern: /\b(?:my|the)\s+graduation\b/gi, label: () => 'Graduation' },
  {
    pattern: /\bmy\s+first\s+(job|day of school|apartment|car|kiss|concert|flight|paycheck)\b/gi,
    label: (m) => `First ${m[1]!.toLowerCase()}`,
  },
  {
    pattern:
      /\bfirst day (?:of|at) (school|kindergarten|college|work|high school|middle school)\b/gi,
    label: (m) => `First day of ${m[1]!.toLowerCase()}`,
  },
  {
    pattern: /\b(?:got|getting)\s+married\b|\bour wedding\b|\bmy wedding\b/gi,
    label: () => 'Wedding',
  },
  { pattern: /\b(?:passed away|died)\b/gi, label: (m) => cap(m[0]) },
  { pattern: /\bgot my (?:driver'?s )?license\b/gi, label: () => "Got my driver's license" },
  {
    pattern:
      /\bstarted (college|university|high school|middle school|school|my first job|working)\b/gi,
    label: (m) => `Started ${m[1]!.toLowerCase()}`,
  },
];

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function detectMilestoneCues(text: string): MilestoneCue[] {
  const cues: MilestoneCue[] = [];
  for (const cue of CUES) {
    for (const match of text.matchAll(cue.pattern)) {
      const start = match.index ?? 0;
      cues.push({ label: cue.label(match), quote: match[0], start, end: start + match[0].length });
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}
