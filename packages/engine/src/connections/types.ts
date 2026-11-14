export interface ConnectionTypeInfo {
  id: string;
  label: string;
  hint: string;
  suggestable: boolean;
  group: 'core' | 'more';
}

export const CONNECTION_TYPES: ConnectionTypeInfo[] = [
  {
    id: 'full_circle',
    label: 'Full circle',
    hint: 'Something that happened to you, and later you were on the other side of it.',
    suggestable: true,
    group: 'core',
  },
  {
    id: 'repeating_pattern',
    label: 'Repeating pattern',
    hint: 'A similar situation or response, years apart.',
    suggestable: true,
    group: 'core',
  },
  {
    id: 'breaking_pattern',
    label: 'Breaking a pattern',
    hint: 'The same kind of moment, handled differently.',
    suggestable: true,
    group: 'core',
  },
  {
    id: 'wish_fulfilled',
    label: 'Wish fulfilled',
    hint: 'Something you wanted, and later got to do.',
    suggestable: true,
    group: 'core',
  },
  {
    id: 'relationship_change',
    label: 'Relationship change',
    hint: 'How things felt with the same person, at different times.',
    suggestable: true,
    group: 'core',
  },
  {
    id: 'personal_growth',
    label: 'Personal growth',
    hint: 'A change in skills, beliefs or how you see things.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'turning_point',
    label: 'Turning point',
    hint: 'One event that split life into before and after.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'promise_kept',
    label: 'Promise kept',
    hint: 'A promise made, and later kept.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'promise_revisited',
    label: 'Promise revisited',
    hint: 'An old promise or intention you came back to.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'dream_deferred',
    label: 'Dream deferred',
    hint: 'Something hoped for that had to wait.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'cause_consequence',
    label: 'Cause and consequence',
    hint: 'An earlier event that may have shaped a later choice. Only a guess.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'echo',
    label: 'Echo',
    hint: 'A later moment that recalls an earlier one.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'reaffirmation',
    label: 'Reaffirmation',
    hint: 'A later experience that confirmed an earlier idea.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'question_answer',
    label: 'Question and answer',
    hint: 'A later event that answered an earlier question.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'returning_to_place',
    label: 'Returning to a place',
    hint: 'The same place, years apart.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'role_reversal',
    label: 'Role reversal',
    hint: 'You and someone else swapped places.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'recurring_joy',
    label: 'Recurring joy',
    hint: 'The same kind of happiness, more than once.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'recurring_fear',
    label: 'Recurring fear',
    hint: 'The same kind of worry, more than once.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'change_across_events',
    label: 'Change across events',
    hint: 'Different circumstances or beliefs between two moments.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'shared_memory',
    label: 'Shared memory',
    hint: 'Two moments with the same people or setting.',
    suggestable: false,
    group: 'more',
  },
  {
    id: 'custom',
    label: 'Something else',
    hint: 'Name it yourself.',
    suggestable: false,
    group: 'more',
  },
];

export function connectionLabel(id: string): string {
  return CONNECTION_TYPES.find((t) => t.id === id)?.label ?? id.replace(/_/g, ' ');
}
