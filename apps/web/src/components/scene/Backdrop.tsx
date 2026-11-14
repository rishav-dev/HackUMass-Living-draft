import { useMemo } from 'react';
import { weatherParticles } from '@living-draft/engine';
import { useActiveAtmosphere } from '../../lib/mood/atmosphere';
import { useWorld } from '../../lib/world/world';
import { Ambience } from '../decor/Ambience';
import { ShaderSky } from './ShaderSky';

const DAYLIGHT: Record<string, number> = {
  dawn: 0.95,
  morning: 1.08,
  afternoon: 1.1,
  evening: 0.92,
  night: 0.8,
};

export function Backdrop() {
  const atmosphere = useActiveAtmosphere();
  const world = useWorld();
  const light = DAYLIGHT[world.part] ?? 1;
  const target = useMemo(
    () => ({ mood: atmosphere.mood, dim: atmosphere.dim * light }),
    [atmosphere, light],
  );
  const outside = world.intoRoom ? weatherParticles(world.kind) : null;
  const inside = atmosphere.mood.weather;
  return (
    <>
      <ShaderSky target={target} />
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <Ambience key={inside} kind={inside} density={0.55 + atmosphere.mood.energy * 0.6} />
        {outside && outside !== inside && (
          <Ambience
            key={`outside-${outside}`}
            kind={outside}
            density={outside === 'rain' ? 0.35 : 0.45}
          />
        )}
      </div>
    </>
  );
}
