import { Link } from 'react-router';
import { LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';
import type { AiJobDto, AiStatusDto } from '@living-draft/contracts';
import { aiUsable } from '../../api/ai';

export function AiBanner({
  ai,
  job,
  working,
  stage,
}: {
  ai: AiStatusDto | null;
  job: AiJobDto | null;
  working: boolean;
  stage: AiJobDto['stage'] | null;
}) {
  if (!aiUsable(ai ?? undefined)) {
    return (
      <section className="paper flex items-start gap-3 rounded-3xl p-5">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-lavender-deep" />
        <p className="text-sm text-ink-soft">
          This is a quick first pass. For a real rewrite, a title that gets the point, and people
          and feelings picked up properly, turn on the writing helper in{' '}
          <Link to="/settings#writing-helper" className="font-semibold text-ink underline">
            Settings
          </Link>
          . It runs on this computer and downloads once ({ai?.sizeLabel ?? 'about 2.4 GB'}).
        </p>
      </section>
    );
  }
  if (working) {
    return (
      <section role="status" className="paper flex items-start gap-3 rounded-3xl p-5">
        <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-lavender-deep" />
        <p className="text-sm text-ink-soft">
          {stage === 'narrative'
            ? 'Writing the version you’ll read later. Everything above updates when it’s ready; you can keep editing in the meantime.'
            : 'Reading it properly: what it’s really about, who mattered, how it felt. This takes a little while on this computer.'}
        </p>
      </section>
    );
  }
  if (job?.status === 'failed') {
    return (
      <section className="paper flex items-start gap-3 rounded-3xl p-5">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-peach-deep" />
        <p className="text-sm text-ink-soft">
          The writing helper couldn’t finish this one ({job.error}). Your words are safe and you can
          still save it.
        </p>
      </section>
    );
  }
  return null;
}
