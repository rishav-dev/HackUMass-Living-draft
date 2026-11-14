import { describe, expect, it } from 'vitest';
import { collectionRecap } from '../src';

const memory = (overrides: Partial<Parameters<typeof collectionRecap>[0]['memories'][number]>) => ({
  title: 'A memory',
  ages: [12],
  season: 'summer',
  approximate: false,
  people: ['Mom'],
  feelingsThen: ['sad'],
  feelingsNow: [],
  sensitive: false,
  ...overrides,
});

describe('collectionRecap', () => {
  it('only counts what was recorded and names the gaps', () => {
    const lines = collectionRecap({
      label: 'With Mom',
      memories: [
        memory({ ages: [8] }),
        memory({ ages: [12] }),
        memory({ ages: [21], feelingsNow: ['grateful'] }),
      ],
      connectionCount: 1,
      includeQuiet: false,
    });
    expect(lines[0]).toBe('With Mom: three memories, from age 8 to 21.');
    expect(lines.join(' ')).toContain('Nothing is recorded for ages 9–11 and 13–20');
    expect(lines.join(' ')).toContain('Mom (three memories)');
    expect(lines.join(' ')).toContain('grateful');
  });

  it('leaves quiet memories out unless asked', () => {
    const memories = [memory({}), memory({ sensitive: true, title: 'The secret' })];
    const without = collectionRecap({
      label: 'Age 12',
      memories,
      connectionCount: 0,
      includeQuiet: false,
    });
    expect(without[0]).toContain('one memory');
    expect(without[without.length - 1]).toBe("one memory kept quiet isn't included here.");
    const withQuiet = collectionRecap({
      label: 'Age 12',
      memories,
      connectionCount: 0,
      includeQuiet: true,
    });
    expect(withQuiet[0]).toContain('two memories');
  });

  it('says plainly when there is nothing to summarize', () => {
    expect(
      collectionRecap({ label: 'Age 3', memories: [], connectionCount: 0, includeQuiet: false })[0],
    ).toContain('nothing recorded yet');
  });
});
