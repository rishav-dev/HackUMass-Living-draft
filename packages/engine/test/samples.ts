import type { MemoryDoc, TemporalContext } from '../src';

export const context: TemporalContext = {
  today: new Date(Date.UTC(2026, 10, 13)),
  currentAge: 23,
  birthDate: null,
  hemisphere: 'north',
  dateOrder: 'mdy',
};

export const SUMMER_PROMISE =
  "Um, so in sixth grade, around age 12, summer vacation had just started. I finished all my assignments in four days because Mom promised she'd take us somewhere. Then Mom said we weren't going anywhere. I felt so hurt and I argued with Mom.";

export const SUMMER_DAD_ADDITION = 'Dad sided with Mom and nobody took me anywhere that summer.';

export const SUMMER_UNSURE =
  "Thinking about that summer again, I'm not sure Mom actually promised. Maybe I just assumed we'd go somewhere because we went the year before.";

export function doc(partial: Partial<MemoryDoc> & Pick<MemoryDoc, 'id' | 'text'>): MemoryDoc {
  return {
    title: partial.title ?? partial.id,
    ageMin: null,
    ageMax: null,
    season: null,
    people: [],
    emotions: [],
    ...partial,
  };
}
