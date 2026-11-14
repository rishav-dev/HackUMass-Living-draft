import { runEvaluation } from '../src/evaluation/run';

const report = runEvaluation();
const pct = (value: number) => `${Math.round(value * 100)}%`;
const lines: string[] = [];

lines.push('# Evaluation', '');
lines.push(
  `Run on ${report.generatedAt.slice(0, 10)}. Every case is fictional and hand-labelled. The set is small, so treat the numbers as a smoke test, not a benchmark.`,
  '',
);

const m = report.matching;
lines.push('## Same-event matching', '');
lines.push(`- ${m.total} new captures checked against an archive of 8 memories.`);
lines.push(
  `- ${m.expectedSame} should match an existing memory; ${m.expectedSeparate} should stay separate.`,
);
lines.push(
  `- Precision of "likely the same memory": ${m.correctSame} correct out of ${m.predictedSame} suggested (${pct(m.precision)}).`,
);
lines.push(
  `- Recall: ${m.correctSame} of ${m.expectedSame} real matches were suggested (${pct(m.recall)}).`,
);
lines.push(
  `- Separate events kept separate: ${m.separateKeptSeparate} of ${m.expectedSeparate}.`,
  '',
);
if (m.misses.length) {
  lines.push('| Case | Expected | Got | Score |', '| --- | --- | --- | --- |');
  for (const miss of m.misses)
    lines.push(
      `| ${miss.label} | ${miss.expected ?? 'separate'} | ${miss.got ?? 'separate'} | ${miss.score ?? '–'} |`,
    );
  lines.push('');
}

const c = report.changes;
lines.push('## Version changes', '');
lines.push(
  `${c.correct} of ${c.total} pairs got the expected headline change (${pct(c.accuracy)}).`,
  '',
);
lines.push('| Case | Expected | Got |', '| --- | --- | --- |');
for (const row of c.rows)
  lines.push(`| ${row.label} | ${row.expected} | ${row.got}${row.ok ? '' : ' ✗'} |`);
lines.push('');

const t = report.temporal;
lines.push('## Time placement', '');
lines.push(`${t.correct} of ${t.total} placed at the expected ages (${pct(t.accuracy)}).`, '');
lines.push('| Text | Expected | Got |', '| --- | --- | --- |');
for (const row of t.rows)
  lines.push(`| ${row.text} | ${row.expected} | ${row.got}${row.ok ? '' : ' ✗'} |`);

console.log(lines.join('\n'));
