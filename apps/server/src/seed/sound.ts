const RATE = 22050;

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0 ? 0.85 / peak : 1;
  samples.forEach((s, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296 - 0.5;
  };
}

function fade(samples: Float32Array, seconds = 0.8) {
  const n = Math.floor(seconds * RATE);
  for (let i = 0; i < n && i < samples.length; i += 1) {
    samples[i]! *= i / n;
    samples[samples.length - 1 - i]! *= i / n;
  }
  return samples;
}

export function pianoNote(): Buffer {
  const notes = [
    [0, 64, 0.9],
    [0.45, 67, 0.9],
    [0.9, 71, 1.2],
    [1.8, 69, 0.6],
    [2.25, 67, 0.6],
    [2.7, 64, 1.5],
    [4.2, 62, 0.9],
    [4.65, 64, 0.9],
    [5.1, 67, 1.4],
    [6.3, 60, 0.6],
    [6.75, 62, 0.6],
    [7.2, 64, 2.2],
  ] as const;
  const length = 10;
  const out = new Float32Array(RATE * length);
  for (const [start, midi, duration] of notes) {
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const begin = Math.floor(start * RATE);
    const span = Math.floor((duration + 1.6) * RATE);
    for (let i = 0; i < span && begin + i < out.length; i += 1) {
      const t = i / RATE;
      const env = Math.exp(-t * 2.6) * Math.min(1, t * 200);
      const tone =
        Math.sin(2 * Math.PI * freq * t) +
        0.45 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t * 3) +
        0.2 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-t * 5);
      out[begin + i]! += tone * env * 0.4;
    }
  }
  const noise = random(3);
  for (let i = 0; i < out.length; i += 1) out[i]! += noise() * 0.004;
  return wav(fade(out, 0.3));
}

export function oceanWaves(): Buffer {
  const length = 14;
  const out = new Float32Array(RATE * length);
  const noise = random(11);
  let brown = 0;
  let low = 0;
  for (let i = 0; i < out.length; i += 1) {
    const t = i / RATE;
    brown = (brown + noise() * 0.06) * 0.996;
    low += (noise() - low) * 0.08;
    const swell = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin((2 * Math.PI * t) / 6.5)), 2);
    out[i] = brown * 1.6 * swell + low * 0.35 * swell;
  }
  return wav(fade(out, 1.5));
}

export function rainOnPorch(): Buffer {
  const length = 12;
  const out = new Float32Array(RATE * length);
  const noise = random(29);
  let pink = 0;
  for (let i = 0; i < out.length; i += 1) {
    pink = pink * 0.9 + noise() * 0.1;
    out[i] = pink * 0.6;
  }
  for (let drop = 0; drop < 900; drop += 1) {
    const at = Math.floor(Math.abs(noise() + 0.5) * (out.length - RATE * 0.05));
    const freq = 1800 + Math.abs(noise()) * 3500;
    const amp = 0.05 + Math.abs(noise()) * 0.25;
    for (let j = 0; j < RATE * 0.03; j += 1) {
      const t = j / RATE;
      out[at + j]! += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 180) * amp;
    }
  }
  return wav(fade(out, 1.2));
}

export function fireCrackle(): Buffer {
  const length = 10;
  const out = new Float32Array(RATE * length);
  const noise = random(41);
  let rumble = 0;
  for (let i = 0; i < out.length; i += 1) {
    rumble = rumble * 0.995 + noise() * 0.02;
    out[i] = rumble * 2;
  }
  for (let pop = 0; pop < 260; pop += 1) {
    const at = Math.floor(Math.abs(noise() + 0.5) * (out.length - 400));
    const amp = 0.2 + Math.abs(noise()) * 0.8;
    for (let j = 0; j < 300; j += 1) out[at + j]! += noise() * amp * Math.exp(-j / 40);
  }
  return wav(fade(out, 1));
}
