import type { DayDto } from '@living-draft/contracts';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { textureFor } from '../../lib/sound/textures';

export function usePreviewAtmosphere(day: DayDto | null) {
  useAtmosphere(
    day
      ? {
          emotions: day.emotions.map((tag) => ({ tag })),
          fallback: 'nostalgic',
          seed: day.date,
          texture: textureFor(day.motifs, null),
          intensity: 0.75,
          dim: 0.45,
        }
      : null,
  );
}
