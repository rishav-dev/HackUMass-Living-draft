import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Bookmark,
  Compass,
  Feather,
  Library,
  Lock,
  Mail,
  Map as MapIcon,
  MapPin,
  PenLine,
  Search,
  Settings,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuthStatus, useLock } from '../../api/auth';
import { useProfile } from '../../api/hooks';
import { formatTemp } from '@living-draft/engine';
import { useSound } from '../../lib/sound/SoundProvider';
import { useWorld } from '../../lib/world/world';
import { PaperLoading } from '../ui/states';
import { PlaybackHost } from '../../features/playback/PlaybackHost';
import { NarratorPill } from './NarratorPill';
import { warmNarrator } from '../../lib/voice/neural';

const SECTIONS = [
  { to: '/', label: 'Life', icon: Compass, end: true, tab: '#1f1a26' },
  { to: '/album', label: 'Album', icon: Library, tab: '#1e1c26' },
  { to: '/people', label: 'People', icon: Users, tab: '#1b1d25' },
  { to: '/places', label: 'Places', icon: MapPin, tab: '#1c2023' },
  { to: '/map', label: 'Threads', icon: MapIcon, tab: '#1d1f22' },
  { to: '/ask', label: 'Ask', icon: Sparkles, tab: '#231d1d' },
  { to: '/saved', label: 'Saved', icon: Bookmark, tab: '#22201a' },
  { to: '/capsules', label: 'Capsules', icon: Mail, tab: '#1c2023' },
  { to: '/stories', label: 'Stories', icon: Feather, tab: '#221d27' },
];

const MOBILE = [SECTIONS[0]!, SECTIONS[1]!, SECTIONS[5]!, SECTIONS[6]!];

function DateLine() {
  const world = useWorld();
  const date = world.now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const weather = world.weather;
  const town = world.place?.split(',')[0];
  return (
    <span
      className="hand hidden text-lg text-ink-faint md:inline"
      title={weather ? `Weather from Open-Meteo for ${world.place}` : undefined}
    >
      {date}
      {weather && (
        <>
          {' · '}
          {formatTemp(weather.temperature, world.unit)} and {weather.label}
          {town ? ` in ${town}` : ''}
        </>
      )}
    </span>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className="mr-1"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? '';
        void navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
      }}
    >
      <label className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3 size-4 text-ink-soft"
          aria-hidden="true"
        />
        <span className="sr-only">Search your memories</span>
        <input
          name="q"
          type="search"
          placeholder="Search your memories"
          className="h-9 w-40 rounded-full border border-white/12 bg-white/6 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint transition-[width,border-color] focus:w-64 focus:border-lavender-deep/60 focus:outline-none sm:w-56"
        />
      </label>
    </form>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 40 40" className="size-8" aria-hidden="true">
      <defs>
        <linearGradient id="mark-ink" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="0.55" stopColor="#f0abfc" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <path
        d="M7 29 C 13 27, 15 14, 20 13 S 27 23, 33 9"
        fill="none"
        stroke="url(#mark-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="7" cy="29" r="2.4" fill="#c4b5fd" />
      <circle cx="20" cy="13" r="2.4" fill="#f0abfc" />
      <circle cx="33" cy="9" r="3" fill="#fde68a" />
    </svg>
  );
}

export function CaptureButton({ floating = false }: { floating?: boolean }) {
  const navigate = useNavigate();
  const { play } = useSound();
  return (
    <button
      type="button"
      onClick={() => {
        play('start');
        void navigate('/capture', { viewTransition: true });
      }}
      className={
        floating
          ? 'btn-aurora flex size-14 -translate-y-4 items-center justify-center rounded-full ring-4 ring-abyss'
          : 'btn-aurora inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold'
      }
      aria-label="Write a memory"
    >
      <PenLine className={floating ? 'size-6' : 'size-4'} aria-hidden="true" />
      {!floating && <span>Write</span>}
    </button>
  );
}

function IconLink({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      viewTransition
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-white/6 hover:text-ink"
    >
      {children}
    </Link>
  );
}

function SoundToggle() {
  const { muted, toggleMute } = useSound();
  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound is off' : 'Sound is on'}
      className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-white/6 hover:text-ink"
    >
      {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
    </button>
  );
}

function LockButton() {
  const { data: auth } = useAuthStatus();
  const lock = useLock();
  const { play } = useSound();
  if (!auth?.configured) return null;
  return (
    <button
      type="button"
      onClick={() => {
        play('close');
        lock.mutate();
      }}
      aria-label="Lock the notebook"
      title="Lock"
      className="inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-white/6 hover:text-ink"
    >
      <Lock className="size-[18px]" />
    </button>
  );
}

function useIdleLock(minutes: number | undefined) {
  const { data: auth } = useAuthStatus();
  const { mutate } = useLock();
  const enabled = Boolean(auth?.configured && minutes);
  useEffect(() => {
    if (!enabled || !minutes) return;
    const limit = minutes * 60_000;
    let timer = window.setTimeout(() => mutate(), limit);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => mutate(), limit);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const name of events) window.addEventListener(name, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, reset);
    };
  }, [enabled, minutes, mutate]);
}

export function AppShell() {
  const { data: profile } = useProfile();
  const location = useLocation();
  const { play } = useSound();
  const mainRef = useRef<HTMLElement>(null);
  const writing = location.pathname.startsWith('/capture');
  useIdleLock(profile?.autoLockMinutes);

  useEffect(() => {
    const later = window.setTimeout(warmNarrator, 2500);
    return () => window.clearTimeout(later);
  }, []);

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0 });
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, [location.pathname, location.hash]);

  const owner = profile?.preferredName ? `${profile.preferredName}'s` : 'My';

  return (
    <div className="relative min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-abyss focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to the page
      </a>

      <div className="mx-auto flex max-w-[88rem] px-2 pb-24 pt-2 sm:px-5 sm:pt-5 lg:pb-8 lg:pl-10">
        <div className="relative min-w-0 flex-1">
          <span className="notebook-spine hidden lg:block" aria-hidden="true" />
          <div
            className="notebook-page min-h-[calc(100dvh-2.5rem)]"
            style={{ viewTransitionName: 'page' }}
          >
            <span className="notebook-ribbon hidden sm:block" aria-hidden="true" />
            {!writing && (
              <header className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-1 pt-4 sm:px-8 lg:pl-[5.5rem]">
                <Link
                  to="/"
                  viewTransition
                  className="flex items-center gap-2"
                  aria-label="Back to the start of the notebook"
                >
                  <Mark />
                  <span className="hand text-2xl text-ink">{owner} Living Draft</span>
                </Link>
                <DateLine />
                {profile?.isSample && (
                  <span
                    className="hand rounded-full border border-peach/40 px-2.5 py-0.5 text-base text-peach-deep"
                    title="Every memory in this notebook is made up for the demo"
                  >
                    sample notebook, all made up
                  </span>
                )}
                <div className="ml-auto flex items-center gap-0.5">
                  <HeaderSearch />
                  <SoundToggle />
                  <LockButton />
                  <IconLink to="/settings" label="Settings and privacy">
                    <Settings className="size-[18px]" />
                  </IconLink>
                  <div className="ml-2 hidden sm:block">
                    <CaptureButton />
                  </div>
                </div>
              </header>
            )}
            <main id="main" ref={mainRef} className="relative lg:pl-12">
              <Suspense fallback={<PaperLoading />}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>

        {!writing && (
          <nav
            aria-label="Notebook sections"
            className="sticky top-16 hidden h-fit flex-col gap-1.5 pt-10 lg:flex"
          >
            {SECTIONS.map(({ to, label, icon: Icon, end, tab }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                viewTransition
                onClick={() => play('shift')}
                className="notebook-tab"
                style={{ ['--tab' as string]: tab }}
              >
                <Icon className="size-4 opacity-70" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      {!writing && (
        <nav
          aria-label="Notebook sections"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/6 bg-[#100e14] pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
            {MOBILE.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                viewTransition
                onClick={() => play('shift')}
                className={({ isActive }) =>
                  `bottom-tab flex flex-col items-center gap-0.5 ${isActive ? 'text-snow' : 'text-ink-faint'}`
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            <div className="flex justify-center">
              <CaptureButton floating />
            </div>
            {MOBILE.slice(2).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                viewTransition
                onClick={() => play('shift')}
                className={({ isActive }) =>
                  `bottom-tab flex flex-col items-center gap-0.5 ${isActive ? 'text-snow' : 'text-ink-faint'}`
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
      <PlaybackHost />
      <NarratorPill />
    </div>
  );
}
