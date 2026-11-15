import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { splitSentences } from '@living-draft/engine';

export interface TextMark {
  start: number;
  end: number;
  characterId?: string;
  label?: string;
  className?: string;
}

function renderRange(text: string, from: number, to: number, marks: TextMark[]): ReactNode[] {
  const inside = marks
    .filter((m) => m.start >= from && m.end <= to && m.start >= 0)
    .sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = from;
  inside.forEach((mark, i) => {
    if (mark.start < cursor) return;
    if (mark.start > cursor)
      out.push(<Fragment key={`t${i}`}>{text.slice(cursor, mark.start)}</Fragment>);
    const slice = text.slice(mark.start, mark.end);
    out.push(
      mark.characterId ? (
        <Link
          key={`m${i}`}
          to={`/people/${mark.characterId}`}
          viewTransition
          className="mention"
          title={mark.label}
        >
          {slice}
        </Link>
      ) : (
        <mark
          key={`m${i}`}
          className={mark.className ?? 'rounded bg-gold/35 px-0.5 text-inherit'}
          title={mark.label}
        >
          {slice}
        </mark>
      ),
    );
    cursor = mark.end;
  });
  if (cursor < to) out.push(<Fragment key="tail">{text.slice(cursor, to)}</Fragment>);
  return out;
}

export function MarkedText({
  text,
  marks = [],
  className = '',
}: {
  text: string;
  marks?: TextMark[];
  className?: string;
}) {
  return <span className={className}>{renderRange(text, 0, text.length, marks)}</span>;
}

export function MemoryText({
  text,
  marks = [],
  reveal = false,
  className = '',
  dropCap = false,
}: {
  text: string;
  marks?: TextMark[];
  reveal?: boolean;
  className?: string;
  dropCap?: boolean;
}) {
  const paragraphs: Array<{ start: number; end: number }> = [];
  const pattern = /\n{2,}/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    paragraphs.push({ start: cursor, end: match.index ?? 0 });
    cursor = (match.index ?? 0) + match[0].length;
  }
  paragraphs.push({ start: cursor, end: text.length });

  let sentenceIndex = 0;
  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {paragraphs.map((paragraph, p) => {
        const sentences = splitSentences(text.slice(paragraph.start, paragraph.end)).map((s) => ({
          start: s.start + paragraph.start,
          end: s.end + paragraph.start,
        }));
        return (
          <p key={paragraph.start} className={dropCap && p === 0 ? 'drop-cap' : ''}>
            {sentences.map((sentence, i) => {
              const order = sentenceIndex++;
              const content = renderRange(text, sentence.start, sentence.end, marks);
              return reveal && order < 6 ? (
                <motion.span
                  key={sentence.start}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: 0.15 + order * 0.1,
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {content}
                  {i < sentences.length - 1 ? ' ' : ''}
                </motion.span>
              ) : (
                <Fragment key={sentence.start}>
                  {content}
                  {i < sentences.length - 1 ? ' ' : ''}
                </Fragment>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
