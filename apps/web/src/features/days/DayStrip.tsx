import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { DayDto } from '@living-draft/contracts';
import { useDays } from '../../api/hooks';
import { DayCard } from './DayCard';
import { usePreviewAtmosphere } from './preview';

export function DayStrip() {
  const { data: days = [] } = useDays();
  const [preview, setPreview] = useState<DayDto | null>(null);
  usePreviewAtmosphere(preview);
  if (!days.length) return null;
  const recent = [...days].reverse().slice(0, 10);
  return (
    <section className="mx-auto mt-8 max-w-6xl" aria-labelledby="days-heading">
      <div className="flex items-baseline justify-between px-5 sm:px-8">
        <h2 id="days-heading" className="text-xl font-semibold">
          Days you can step back into
        </h2>
        <Link
          to="/days"
          viewTransition
          className="ink-link inline-flex items-center gap-1 text-sm font-semibold"
        >
          All days <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-4 flex snap-x gap-4 overflow-x-auto px-5 pb-4 scrollbar-none sm:px-8">
        {recent.map((day) => (
          <div key={day.date} className="snap-start">
            <DayCard day={day} onPreview={setPreview} />
          </div>
        ))}
      </div>
    </section>
  );
}
