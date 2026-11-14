const cache = new Map<string, Promise<number[]>>();
let decoder: AudioContext | null = null;

export function loadPeaks(url: string, bars = 64): Promise<number[]> {
  const key = `${url}#${bars}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const job = (async () => {
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    decoder ??= new AudioContext();
    const audio = await decoder.decodeAudioData(data);
    const channel = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(channel.length / bars));
    const peaks: number[] = [];
    for (let i = 0; i < bars; i += 1) {
      let max = 0;
      for (let j = i * step; j < Math.min(channel.length, (i + 1) * step); j += 16)
        max = Math.max(max, Math.abs(channel[j]!));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.001);
    return peaks.map((p) => Math.max(0.06, p / top));
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
