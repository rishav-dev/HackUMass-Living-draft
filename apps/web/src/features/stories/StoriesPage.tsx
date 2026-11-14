import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { BookPlus, Feather } from 'lucide-react';
import type { StoryBookSummaryDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useStoryBooks } from '../../api/stories';
import { Button } from '../../components/ui/Button';
import { Field, TextArea, TextInput } from '../../components/ui/controls';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { plural, relativeTime } from '../../lib/format';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { MOODS, type MoodKey } from '../../lib/mood/moods';

export default function StoriesPage() {
  const { data: books, isLoading, error, refetch } = useStoryBooks();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [creating, setCreating] = useState(false);
  useAtmosphere({ mood: 'confused', intensity: 0.45, seed: 'story-books', texture: 'vinyl' });

  if (isLoading) return <PaperLoading label="Finding your books…" />;
  if (error || !books) return <ErrorState error={error} retry={() => void refetch()} />;

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const book = await api.post<StoryBookSummaryDto>('/stories', {
        title: title.trim(),
        premise: premise.trim() || null,
      });
      void navigate(`/stories/${book.id}`, { viewTransition: true });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8">
      <p className="eyebrow">Story books</p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">
        Fiction, <span className="aurora-text">written out of order</span>
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        For the stories you make up. Scenes can float until you know where they go, and characters,
        threads and world notes live with each book. Nothing here ever mixes with your own memories.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book, i) => {
          const look = MOODS[(book.mood as MoodKey) in MOODS ? (book.mood as MoodKey) : 'cosmos'];
          return (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to={`/stories/${book.id}`}
                viewTransition
                className="group relative block h-full overflow-hidden rounded-3xl border border-white/10 p-6 transition duration-500 hover:-translate-y-1 hover:border-white/25"
                style={{
                  background: `radial-gradient(circle at 20% 15%, ${look.palette[1]}66, transparent 60%), radial-gradient(circle at 90% 100%, ${look.palette[2]}40, transparent 55%), #0b0916`,
                }}
              >
                <Feather className="size-6 text-snow/70" aria-hidden="true" />
                <h2 className="mt-4 font-display text-2xl font-semibold text-snow">{book.title}</h2>
                {book.premise && (
                  <p className="mt-2 line-clamp-3 text-sm text-snow/75">{book.premise}</p>
                )}
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-snow/55">
                  {plural(book.sceneCount, 'scene')} · {plural(book.chapterCount, 'chapter')} ·{' '}
                  {plural(book.characterCount, 'character')}
                </p>
                <p className="mt-1 text-xs text-snow/45">Touched {relativeTime(book.updatedAt)}</p>
              </Link>
            </motion.div>
          );
        })}

        <form
          className="paper flex flex-col gap-3 rounded-3xl p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <BookPlus className="size-5 text-magenta" aria-hidden="true" /> Start a new book
          </p>
          <Field label="Title" htmlFor="new-book-title">
            <TextInput
              id="new-book-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Lighthouse Keeper"
            />
          </Field>
          <Field label="What's it about? (optional)" htmlFor="new-book-premise">
            <TextArea
              id="new-book-premise"
              rows={3}
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!title.trim() || creating} className="self-start">
            {creating ? 'Opening…' : 'Create book'}
          </Button>
        </form>
      </div>
    </div>
  );
}
