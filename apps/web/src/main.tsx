import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './app/router';
import { authKey } from './api/auth';
import { onLocked } from './api/client';
import { MotionProvider } from './lib/motion';
import { SoundProvider } from './lib/sound/SoundProvider';
import { ToastProvider } from './components/ui/Toast';
import { Backdrop } from './components/scene/Backdrop';
import { Synapses } from './components/scene/Synapses';
import { WorldProvider } from './lib/world/WorldProvider';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

onLocked(() => {
  queryClient.setQueryData(authKey, { configured: true, authenticated: false });
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <SoundProvider>
          <WorldProvider>
            <ToastProvider>
              <Backdrop />
              <Synapses />
              <Suspense fallback={null}>
                <RouterProvider router={router} />
              </Suspense>
            </ToastProvider>
          </WorldProvider>
        </SoundProvider>
      </MotionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
