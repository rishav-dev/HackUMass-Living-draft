import { useMemo, useState } from 'react';
import type { DayDto } from '@living-draft/contracts';
import { useDays } from '../../api/hooks';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, PaperLoading } from '../../components/ui/states';
import { plural } from '../../lib/format';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { DayCard } from './DayCard';
import { usePreviewAtmosphere } from './preview';

export default function DaysPage() {
  const { data: days, isLoading, error, refetch } = useDays();
  const [preview, setPreview] = useState<DayDto | null>(null);
  useAtmosphere({ mood: 'cosmos', intensity: 0.5, seed: 'days' });
  usePreviewAtmosphere(preview);

  const years = useMemo(() => {
    const groups = new Map<string, DayDto[]>();
    for (const day of [...(days ?? [])].reverse()) {
      const year = day.date.slice(0, 4);
      groups.set(year, [...(groups.get(year) ?? []), day]);
    }
    return [...groups.entries()];
  }, [days]);

  if (isLoading) return <PaperLoading label="Finding your days…" />;
  if (error || !days) return <ErrorState error={error} retry={() => void refetch()} />;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8">
      <p className="eyebrow">Days</p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Step back into a day</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every day you remember the exact date of, and everything that happened on it. Pick one and
        we'll go back there together, one memory at a time.
      </p>
      {days.length === 0 ? (
        <EmptyState
          title="No exact dates yet"
          action={<ButtonLink to="/capture">Capture a memory</ButtonLink>}
        >
          When a memory has a full date, like “June 2, 2012”, its day shows up here.
        </EmptyState>
      ) : (
        years.map(([year, list]) => (
          <section key={year} className="mt-12" aria-labelledby={`year-${year}`}>
            <div className="flex items-baseline gap-3">
              <h2 id={`year-${year}`} className="neon font-display text-3xl font-semibold">
                {year}
              </h2>
              <span className="text-sm text-ink-faint">{plural(list.length, 'day')}</span>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((day) => (
                <DayCard key={day.date} day={day} size="lg" onPreview={setPreview} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
