import { lazy, Suspense } from 'react';
import { closePlayback, usePlaybackRequest } from './playbackStore';

const PlaybackOverlay = lazy(() => import('./PlaybackOverlay'));

export function PlaybackHost() {
  const request = usePlaybackRequest();
  if (!request) return null;
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[80] bg-abyss" />}>
      <PlaybackOverlay key={JSON.stringify(request)} request={request} onClose={closePlayback} />
    </Suspense>
  );
}
