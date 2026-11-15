import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useProfile } from '../../api/hooks';
import { useAtmosphere } from '../mood/atmosphere';
import type { MoodKey } from '../mood/moods';
import { readLocal, writeLocal } from '../storage';
import { sound, type Effect, type Scene } from './engine';

interface SoundContextValue {
  play: (effect: Effect) => void;
  muted: boolean;
  toggleMute: () => void;
  unlocked: boolean;
}

const SoundContext = createContext<SoundContextValue>({
  play: () => undefined,
  muted: false,
  toggleMute: () => undefined,
  unlocked: false,
});

export function SoundProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile();
  const [muted, setMuted] = useState(() => readLocal('muted') === 'true');
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const unlock = () => {
      sound.unlock();
      setUnlocked(sound.unlocked);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    sound.configure({
      effects: profile?.soundEffects ?? true,
      ambient: profile?.ambientSound ?? true,
      volume: profile?.volume ?? 0.6,
      muted,
      gentle: readLocal('gentle-music') === 'true',
    });
  }, [profile?.soundEffects, profile?.ambientSound, profile?.volume, muted]);

  useEffect(() => {
    const onVisibility = () => sound.setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((value) => {
      writeLocal('muted', String(!value));
      return !value;
    });
  }, []);

  const value = useMemo(
    () => ({ play: (effect: Effect) => sound.play(effect), muted, toggleMute, unlocked }),
    [muted, toggleMute, unlocked],
  );
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}

const SCENE_ATMOSPHERE: Record<Scene, { mood: MoodKey; texture: string | null; music: boolean }> = {
  quiet: { mood: 'cosmos', texture: null, music: true },
  path: { mood: 'cosmos', texture: null, music: true },
  night: { mood: 'cosmos', texture: 'crickets', music: true },
  spring: { mood: 'peaceful', texture: 'birds', music: true },
  summer: { mood: 'happy', texture: null, music: true },
  autumn: { mood: 'nostalgic', texture: null, music: true },
  winter: { mood: 'cosmos', texture: 'bells', music: true },
  studio: { mood: 'studio', texture: null, music: true },
  board: { mood: 'cosmos', texture: 'rain', music: true },
  playback: { mood: 'cosmos', texture: null, music: true },
};

export function useScene(scene: Scene, texture: string | null = null) {
  const config = SCENE_ATMOSPHERE[scene];
  useAtmosphere({ mood: config.mood, texture: texture ?? config.texture, music: config.music });
}

export function useDuckWhilePlaying() {
  return useMemo(
    () => ({
      onPlay: () => sound.duck(true),
      onPause: () => sound.duck(false),
      onEnded: () => sound.duck(false),
    }),
    [],
  );
}
