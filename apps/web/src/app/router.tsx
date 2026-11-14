import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { useAuthStatus } from '../api/auth';
import { useProfile } from '../api/hooks';
import { LockScreen } from '../components/auth/LockScreen';
import { AppShell } from '../components/layout/AppShell';
import { ErrorState, PaperLoading } from '../components/ui/states';

const OnboardingPage = lazy(() => import('../features/onboarding/OnboardingPage'));
const LifePathPage = lazy(() => import('../features/life-path/LifePathPage'));
const ChapterPage = lazy(() => import('../features/chapter/ChapterPage'));
const DaysPage = lazy(() => import('../features/days/DaysPage'));
const ConnectionsPage = lazy(() => import('../features/connections/ConnectionsPage'));
const StoriesPage = lazy(() => import('../features/stories/StoriesPage'));
const StoryBookPage = lazy(() => import('../features/stories/StoryBookPage'));
const GlancePage = lazy(() => import('../features/devices/GlancePage'));
const ListenPage = lazy(() => import('../features/devices/ListenPage'));
const CapturePage = lazy(() => import('../features/capture/CapturePage'));
const MemoryPage = lazy(() => import('../features/memory/MemoryPage'));
const EvolutionPage = lazy(() => import('../features/memory/EvolutionPage'));
const CharactersPage = lazy(() => import('../features/characters/CharactersPage'));
const CharacterPage = lazy(() => import('../features/characters/CharacterPage'));
const MemoryMapPage = lazy(() => import('../features/map/MemoryMapPage'));
const ComparePage = lazy(() => import('../features/compare/ComparePage'));
const AskPage = lazy(() => import('../features/ask/AskPage'));
const AlbumPage = lazy(() => import('../features/album/AlbumPage'));
const CapsulesPage = lazy(() => import('../features/capsules/CapsulesPage'));
const SearchPage = lazy(() => import('../features/search/SearchPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const HowItWorksPage = lazy(() => import('../features/settings/HowItWorksPage'));

function AuthGate() {
  const { data: status, isLoading, error, refetch } = useAuthStatus();
  if (isLoading) return null;
  if (error) return <ServerDown retry={() => void refetch()} />;
  if (status?.configured && !status.authenticated) return <LockScreen />;
  return <Outlet />;
}

function RequireProfile({ children }: { children: ReactNode }) {
  const { data: profile, isLoading, error, refetch } = useProfile();
  if (isLoading) return <PaperLoading label="Opening your notebook…" />;
  if (error) return <ServerDown retry={() => void refetch()} />;
  if (!profile) return <Navigate to="/welcome" replace />;
  return children;
}

function ServerDown({ retry }: { retry: () => void }) {
  return (
    <ErrorState
      error={
        new Error(
          "The local server isn't answering. Make sure `npm run dev` is running, then try again.",
        )
      }
      retry={retry}
    />
  );
}

function WelcomeGate() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  if (isLoading) return null;
  if (error) return <ServerDown retry={() => void refetch()} />;
  if (profile) return <Navigate to="/" replace />;
  return <OnboardingPage />;
}

export const router = createBrowserRouter([
  {
    element: <AuthGate />,
    children: [
      { path: '/welcome', element: <WelcomeGate /> },
      {
        path: '/glance',
        element: (
          <RequireProfile>
            <Suspense fallback={null}>
              <GlancePage />
            </Suspense>
          </RequireProfile>
        ),
      },
      {
        path: '/listen',
        element: (
          <RequireProfile>
            <Suspense fallback={null}>
              <ListenPage />
            </Suspense>
          </RequireProfile>
        ),
      },
      {
        element: (
          <RequireProfile>
            <AppShell />
          </RequireProfile>
        ),
        children: [
          { index: true, element: <LifePathPage /> },
          { path: 'chapters/:age', element: <ChapterPage /> },
          { path: 'days', element: <DaysPage /> },
          { path: 'connections', element: <ConnectionsPage /> },
          { path: 'stories', element: <StoriesPage /> },
          { path: 'stories/:id', element: <StoryBookPage /> },
          { path: 'capture', element: <CapturePage /> },
          { path: 'memories/:id', element: <MemoryPage /> },
          { path: 'memories/:id/evolution', element: <EvolutionPage /> },
          { path: 'people', element: <CharactersPage /> },
          { path: 'people/:id', element: <CharacterPage /> },
          { path: 'map', element: <MemoryMapPage /> },
          { path: 'compare', element: <ComparePage /> },
          { path: 'ask', element: <AskPage /> },
          { path: 'album', element: <AlbumPage /> },
          { path: 'capsules', element: <CapsulesPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'how-it-works', element: <HowItWorksPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
