import type { ReactNode } from 'react';
import { Core, type CoreState } from '../core/Core';

export function PaperLoading({
  label = 'Turning pages…',
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-10"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="paper relative h-28 overflow-hidden rounded-3xl">
          <div className="anim-shimmer absolute inset-0" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  core = 'ready',
  action,
}: {
  title: string;
  children?: ReactNode;
  core?: CoreState;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-14 text-center">
      <Core state={core} size={110} />
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children && <div className="text-ink-soft">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <h2 className="text-2xl font-semibold">That didn't come through</h2>
      <p className="mt-2 text-ink-soft">{message}</p>
      {retry && (
        <button type="button" onClick={retry} className="ink-link mt-4 font-semibold">
          Try again
        </button>
      )}
    </div>
  );
}

export function SectionTitle({
  children,
  aside,
  id,
}: {
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {children}
      </h2>
      {aside}
    </div>
  );
}
