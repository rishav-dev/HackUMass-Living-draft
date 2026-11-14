import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useProfile } from '../api/hooks';

const MotionContext = createContext(true);

function systemAllows(): boolean {
  return (
    typeof window === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  );
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile();
  const [system, setSystem] = useState(systemAllows);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const onChange = () => setSystem(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const preference = profile?.motion ?? 'system';
  const allowed = preference === 'full' ? true : preference === 'reduce' ? false : system;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('motion-ok', allowed);
    root.classList.toggle('motion-off', !allowed);
    root.classList.toggle('density-simple', profile?.density === 'simple');
  }, [allowed, profile?.density]);

  return (
    <MotionContext.Provider value={allowed}>
      <MotionConfig reducedMotion={allowed ? 'never' : 'always'}>{children}</MotionConfig>
    </MotionContext.Provider>
  );
}

export function useMotionAllowed() {
  return useContext(MotionContext);
}
