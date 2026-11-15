import type { MemoryCardDto } from '@living-draft/contracts';
import { seedFrom } from '../mood/atmosphere';
import { blendEmotions } from '../mood/moods';
import { sound } from './engine';
import { textureFor } from './textures';

export function memoryTexture(memory: Pick<MemoryCardDto, 'title' | 'excerpt' | 'temporal'>) {
  return textureFor(null, memory.temporal.season, `${memory.title} ${memory.excerpt}`);
}

export function prepareMemoryMusic(memory: MemoryCardDto) {
  if (memory.sensitive) return;
  const mood = blendEmotions(
    memory.emotions.map((e) => ({ tag: e.tag, phase: e.phase })),
    'nostalgic',
  ).key;
  sound.prepare(mood, seedFrom(memory.id), memoryTexture(memory));
}
