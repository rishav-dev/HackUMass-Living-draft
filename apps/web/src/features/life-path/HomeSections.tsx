import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Library, Search, Sparkles } from 'lucide-react';
import type { MemoryCardDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useMemories } from '../../api/hooks';
import { CertaintyMark } from '../../components/memory/bits';

export function HomeSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const go = (mode: 'search' | 'ask') => {
    const q = text.trim();
    if (mode === 'ask') void navigate(q ? `/ask?q=${encodeURIComponent(q)}` : '/ask');
    else void navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(
          /\?$|^(how|why|what|when|who|did|do|have|has|was|were|is)\b/i.test(text.trim())
            ? 'ask'
            : 'search',
        );
      }}
      className="paper mt-8 flex max-w-3xl flex-col gap-2 rounded-3xl p-2 sm:flex-row sm:items-center"
    >
      <label className="relative flex-1">
        <span className="sr-only">Search your memories or ask a question</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search a name, a place, a feeling, or ask: “How has my dad changed?”"
          className="h-12 w-full rounded-2xl bg-transparent pl-12 pr-3 text-base text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => go('search')}
          className="h-11 flex-1 rounded-2xl bg-white/8 px-4 text-sm font-semibold hover:bg-white/12 sm:flex-none"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => go('ask')}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-snow px-4 text-sm font-semibold text-abyss sm:flex-none"
        >
          <Sparkles className="size-4" /> Ask
        </button>
      </div>
    </form>
  );
}

function Strip({
  title,
  icon,
  link,
  memories,
}: {
  title: string;
  icon: React.ReactNode;
  link: { to: string; label: string };
  memories: MemoryCardDto[];
}) {
  if (!memories.length) return null;
  return (
    <section className="mx-auto mt-12 max-w-6xl px-5 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          {icon} {title}
        </h2>
        <Link
          to={link.to}
          viewTransition
          className="text-sm font-semibold text-lavender-deep hover:underline"
        >
          {link.label}
        </Link>
      </div>
      <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
        {memories.map((m) => (
          <li key={m.id} className="w-64 shrink-0 snap-start">
            <Link
              to={`/memories/${m.id}`}
              viewTransition
              className="paper block h-full rounded-3xl p-4 transition hover:-translate-y-0.5"
            >
              <CertaintyMark temporal={m.temporal} compact />
              <p className="mt-2 font-display text-lg font-semibold leading-snug">{m.title}</p>
              <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{m.summary ?? m.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RecentAndSaved() {
  const { data: memories } = useMemories({});
  const { data: saved } = useQuery({
    queryKey: ['saved'],
    queryFn: () => api.get<{ memories: MemoryCardDto[] }>('/saved'),
  });
  const recent = [...(memories ?? [])]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  return (
    <>
      <Strip
        title="Recently added"
        icon={<Library className="size-5 text-lavender-deep" />}
        link={{ to: '/album', label: 'Open the album' }}
        memories={recent}
      />
      <Strip
        title="Bookmarked"
        icon={<Bookmark className="size-5 text-gold-deep" />}
        link={{ to: '/saved', label: 'Everything you saved' }}
        memories={saved?.memories.slice(0, 8) ?? []}
      />
    </>
  );
}
