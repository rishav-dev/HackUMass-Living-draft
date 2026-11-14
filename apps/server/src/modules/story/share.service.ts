import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config';
import { Archive } from '../archive/snapshot';
import { chapter } from '../lifepath/lifepath.service';

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function embed(url: string, mimeType: string, budget: { left: number }): string | null {
  const file = path.join(config.mediaDir, path.basename(url));
  if (!fs.existsSync(file)) return null;
  const size = fs.statSync(file).size;
  if (size > MAX_PHOTO_BYTES || size > budget.left) return null;
  budget.left -= size;
  return `data:${mimeType};base64,${fs.readFileSync(file).toString('base64')}`;
}

export function chapterShareHtml(
  age: number,
  includeQuiet: boolean,
): { fileName: string; html: string } {
  const archive = Archive.load();
  const data = chapter(age);
  const shown = data.memories.filter((m) => includeQuiet || !m.sensitive);
  const hidden = data.memories.length - shown.length;
  const budget = { left: MAX_TOTAL_BYTES };
  const owner = archive.profile.preferredName;

  const articles = shown
    .map((memory) => {
      const paragraphs = archive
        .text(memory.id)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escape(p)}</p>`)
        .join('');
      const photos = archive
        .media(memory.id)
        .filter((m) => m.kind === 'photo' || m.kind === 'scan')
        .slice(0, 4)
        .map((m) => {
          const src = embed(m.url, m.mimeType, budget);
          if (!src) return '';
          return `<figure><img src="${src}" alt="${escape(m.caption ?? '')}">${m.caption ? `<figcaption>${escape(m.caption)}</figcaption>` : ''}</figure>`;
        })
        .join('');
      const people = memory.people.map((p) => p.name);
      return `<article>
  <p class="when">${escape(memory.temporal.label)}${people.length ? ` · with ${escape(people.join(', '))}` : ''}</p>
  <h2>${escape(memory.title)}</h2>
  ${paragraphs}
  ${photos ? `<div class="photos">${photos}</div>` : ''}
</article>`;
    })
    .join('\n<hr>\n');

  const made = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(data.title)} · ${escape(owner)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: radial-gradient(ellipse at 20% 0%, #2e1065 0%, #07060e 55%) fixed, #07060e; color: #efebfb;
    font: 18px/1.75 Georgia, 'Iowan Old Style', 'Palatino Linotype', serif; }
  main { max-width: 42rem; margin: 0 auto; padding: 4rem 1.5rem 5rem; }
  .eyebrow { font: 600 0.72rem/1 system-ui, sans-serif; letter-spacing: 0.3em; text-transform: uppercase; color: #c4b5fd; }
  h1 { font-size: 2.8rem; line-height: 1.1; margin: 0.6rem 0 1rem; }
  .recap { color: #b7b0cc; font-size: 1rem; }
  article { margin: 3rem 0; }
  h2 { font-size: 1.6rem; margin: 0.3rem 0 1rem; }
  .when { font: 600 0.8rem/1.4 system-ui, sans-serif; color: #e879f9; letter-spacing: 0.05em; margin: 0; }
  .photos { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; margin-top: 1.5rem; }
  figure { margin: 0; }
  img { width: 100%; border-radius: 1rem; display: block; }
  figcaption { font: 0.8rem/1.4 system-ui, sans-serif; color: #b7b0cc; margin-top: 0.4rem; }
  hr { border: 0; text-align: center; color: #7f789a; }
  hr::after { content: '⁂'; }
  footer { font: 0.8rem/1.6 system-ui, sans-serif; color: #7f789a; border-top: 1px solid #ffffff1a; padding-top: 1.5rem; margin-top: 4rem; }
  @media print { body { background: #fff; color: #16141f; } .recap, figcaption, footer { color: #555; } .when { color: #7c3aed; } }
</style>
</head>
<body>
<main>
  <p class="eyebrow">From ${escape(owner)}'s Living Draft</p>
  <h1>${escape(data.title)}</h1>
  <div class="recap">${data.recap.map((line) => `<p>${escape(line)}</p>`).join('')}</div>
  ${articles || '<p>Nothing to share from this chapter.</p>'}
  <footer>
    Shared on ${escape(made)}. These are memories as ${escape(owner)} remembers them, not a record of fact.
    ${hidden ? ` ${hidden} ${hidden === 1 ? 'memory' : 'memories'} kept quiet ${hidden === 1 ? 'is' : 'are'} not included.` : ''}
  </footer>
</main>
</body>
</html>
`;
  return { fileName: `living-draft-chapter-${age}.html`, html };
}
