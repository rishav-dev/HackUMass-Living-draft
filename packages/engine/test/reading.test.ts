import { describe, expect, it } from 'vitest';
import { leadIn, planReading } from '../src';

describe('reading a memory aloud', () => {
  it('breathes between sentences and longer between paragraphs', () => {
    const plan = planReading('We left at dawn. Nobody talked.\n\nThen the ocean, finally.');
    expect(plan.map((s) => s.text)).toEqual([
      'We left at dawn.',
      'Nobody talked.',
      'Then the ocean, finally.',
    ]);
    expect(plan[0]!.pause).toBe(440);
    expect(plan[1]!.pause).toBe(440 + 480);
  });

  it('lingers after a question or a trailing thought', () => {
    const [question, trailing, plain] = planReading(
      'Did she know what she was giving me? I think so... It was a good summer.',
    );
    expect(question!.pause).toBeGreaterThan(plain!.pause - 480);
    expect(trailing!.text).toBe('I think so…');
    expect(trailing!.pause).toBeGreaterThan(question!.pause);
  });

  it('slows down for quiet feelings and reads the title first', () => {
    const sad = planReading('The house felt empty that night.', {
      mood: 'sad',
      title: "Nani's porch",
    });
    const happy = planReading('The house felt empty that night.', { mood: 'happy' });
    expect(sad[0]!.text).toBe("Nani's porch.");
    expect(sad[0]!.pause).toBe(750);
    expect(sad[1]!.speed).toBeLessThan(happy[0]!.speed);
  });

  it('folds a tiny plain fragment into the next sentence so it does not sound clipped', () => {
    const plan = planReading('Then nothing. The phone rang twice and stopped.');
    expect(plan.map((s) => s.text)).toEqual(['Then nothing. The phone rang twice and stopped.']);
  });

  it('turns dashes into breaths and splits very long sentences at a comma', () => {
    const long = `We drove past the old school — the one with the red doors, ${'and the field where we used to run, '.repeat(6)}until it was dark.`;
    const plan = planReading(long);
    expect(plan.length).toBeGreaterThan(1);
    expect(plan.every((s) => s.text.length <= 230)).toBe(true);
    expect(plan[0]!.text).not.toContain('—');
  });
});

describe('starting to read quickly', () => {
  it('splits a long opening at a comma so the first words arrive fast', () => {
    const [segment] = planReading(
      'The winter I was ten, an ice storm knocked the power out for three whole days.',
    );
    const parts = leadIn(segment!);
    expect(parts.map((p) => p.text)).toEqual([
      'The winter I was ten,',
      'an ice storm knocked the power out for three whole days.',
    ]);
    expect(parts[1]!.pause).toBe(segment!.pause);
  });

  it('falls back to a natural joining word, and leaves short sentences alone', () => {
    const [long] = planReading('We counted forty two boxes before giving up and ordering pizza.');
    expect(leadIn(long!)[0]!.text).toBe('We counted forty two boxes,');
    const [short] = planReading('Nobody talked on the drive home.');
    expect(leadIn(short!)).toHaveLength(1);
  });
});
