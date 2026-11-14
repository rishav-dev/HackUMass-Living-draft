export interface SceneSpec {
  motifs: string[];
  palette: [string, string, string];
  seed: string;
}

const cache = new Map<string, string>();

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function alpha(hex: string, a: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

function silhouette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: number,
  rough: number,
  color: string,
  r: () => number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 24) {
    ctx.lineTo(x, base + (r() - 0.5) * rough + Math.sin(x / (w / 3)) * rough * 0.6);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function skyline(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: number,
  glow: string,
  r: () => number,
) {
  let x = 0;
  while (x < w) {
    const bw = 40 + r() * 90;
    const bh = 60 + r() * 220;
    ctx.fillStyle = '#05040a';
    ctx.fillRect(x, base - bh, bw - 4, bh + h);
    for (let wy = base - bh + 12; wy < base - 8; wy += 16) {
      for (let wx = x + 8; wx < x + bw - 12; wx += 14) {
        if (r() < 0.35) {
          ctx.fillStyle = alpha(glow, 0.35 + r() * 0.5);
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
    x += bw;
  }
}

function paint(canvas: HTMLCanvasElement, spec: SceneSpec) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const r = rng(spec.seed);
  const [deep, mid, light] = spec.palette;
  const motif = spec.motifs[0] ?? 'sky';
  const horizon = h * (0.55 + r() * 0.12);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#04030a');
  sky.addColorStop(0.35, deep);
  sky.addColorStop(0.75, mid);
  sky.addColorStop(1, alpha(light, 0.9));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 160; i += 1) {
    ctx.fillStyle = alpha('#ffffff', r() * 0.8);
    const size = r() * 1.6;
    ctx.fillRect(r() * w, r() * horizon * 0.8, size, size);
  }

  const ox = w * (0.25 + r() * 0.5);
  const oy = horizon - h * (0.08 + r() * 0.22);
  const orb = ctx.createRadialGradient(ox, oy, 0, ox, oy, h * 0.55);
  orb.addColorStop(0, alpha('#ffffff', 0.95));
  orb.addColorStop(0.05, alpha(light, 0.9));
  orb.addColorStop(0.25, alpha(light, 0.3));
  orb.addColorStop(1, 'transparent');
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i += 1) {
    const angle = Math.PI * 0.5 + (r() - 0.5) * 1.6;
    ctx.fillStyle = alpha(light, 0.035);
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(angle - 0.06) * w, oy + Math.sin(angle - 0.06) * w);
    ctx.lineTo(ox + Math.cos(angle + 0.06) * w, oy + Math.sin(angle + 0.06) * w);
    ctx.fill();
  }
  ctx.restore();

  if (motif === 'ocean' || motif === 'lake') {
    const water = ctx.createLinearGradient(0, horizon, 0, h);
    water.addColorStop(0, alpha(mid, 0.95));
    water.addColorStop(1, '#03020a');
    ctx.fillStyle = water;
    ctx.fillRect(0, horizon, w, h - horizon);
    for (let i = 0; i < 46; i += 1) {
      const y = horizon + Math.pow(i / 46, 1.6) * (h - horizon);
      ctx.strokeStyle = alpha(light, 0.08 + (i / 46) * 0.25);
      ctx.lineWidth = 1 + (i / 46) * 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12)
        ctx.lineTo(x, y + Math.sin(x / (30 + i * 3) + i) * (2 + i * 0.3));
      ctx.stroke();
    }
    const streak = ctx.createLinearGradient(ox - 60, 0, ox + 60, 0);
    streak.addColorStop(0, 'transparent');
    streak.addColorStop(0.5, alpha(light, 0.45));
    streak.addColorStop(1, 'transparent');
    ctx.fillStyle = streak;
    ctx.fillRect(ox - 60, horizon, 120, h - horizon);
    if (motif === 'lake') silhouette(ctx, w, h, horizon - 20, 40, alpha(deep, 0.95), r);
  } else if (motif === 'city' || motif === 'rain' || motif === 'storm' || motif === 'office') {
    skyline(ctx, w, h, horizon + 40, light, r);
    if (motif === 'storm') {
      ctx.strokeStyle = alpha('#ffffff', 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      let lx = w * (0.3 + r() * 0.4);
      let ly = 0;
      ctx.moveTo(lx, ly);
      while (ly < horizon - 40) {
        lx += (r() - 0.5) * 60;
        ly += 30 + r() * 30;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
    if (motif !== 'office') {
      ctx.strokeStyle = alpha('#bfdbfe', 0.25);
      ctx.lineWidth = 1;
      for (let i = 0; i < 260; i += 1) {
        const x = r() * w;
        const y = r() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + 22);
        ctx.stroke();
      }
    }
  } else if (motif === 'fire') {
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, horizon, w, h);
    const fire = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.9);
    fire.addColorStop(0, alpha('#fde68a', 0.95));
    fire.addColorStop(0.2, alpha('#f97316', 0.6));
    fire.addColorStop(0.6, alpha(mid, 0.2));
    fire.addColorStop(1, 'transparent');
    ctx.fillStyle = fire;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = alpha(r() < 0.5 ? '#fb923c' : '#fde047', 0.4 + r() * 0.5);
      ctx.beginPath();
      ctx.arc(w / 2 + (r() - 0.5) * w * 0.6, h - r() * h * 0.8, r() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (motif === 'stage') {
    ctx.fillStyle = '#030208';
    ctx.fillRect(0, horizon + 30, w, h);
    const beam = ctx.createLinearGradient(w / 2, 0, w / 2, h);
    beam.addColorStop(0, alpha('#ffffff', 0.5));
    beam.addColorStop(1, alpha(light, 0.05));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 30, 0);
    ctx.lineTo(w / 2 + 30, 0);
    ctx.lineTo(w / 2 + w * 0.22, h);
    ctx.lineTo(w / 2 - w * 0.22, h);
    ctx.fill();
    ctx.fillStyle = '#020105';
    ctx.beginPath();
    ctx.ellipse(w / 2, horizon + 70, w * 0.16, 50, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(w / 2 - w * 0.16, horizon + 70, w * 0.32, 18);
  } else if (motif === 'road') {
    silhouette(ctx, w, h, horizon, 60, alpha(deep, 0.95), r);
    ctx.fillStyle = '#05040b';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, horizon);
    ctx.lineTo(w / 2 + 8, horizon);
    ctx.lineTo(w * 0.85, h);
    ctx.lineTo(w * 0.15, h);
    ctx.fill();
    ctx.strokeStyle = alpha(light, 0.7);
    ctx.setLineDash([18, 22]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, horizon);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (motif === 'snow') {
    silhouette(ctx, w, h, horizon, 30, alpha('#e0e7ff', 0.18), r);
    skyline(ctx, w, h, horizon + 60, '#fde68a', r);
    for (let i = 0; i < 220; i += 1) {
      ctx.fillStyle = alpha('#ffffff', 0.3 + r() * 0.6);
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, r() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (['school', 'home', 'kitchen', 'hospital', 'baby'].includes(motif)) {
    ctx.fillStyle = 'rgba(3,2,8,0.86)';
    ctx.fillRect(0, 0, w, h);
    const cols = 3 + Math.floor(r() * 2);
    const pw = w / (cols + 1);
    for (let c = 0; c < cols; c += 1) {
      const x = pw * (c + 0.5);
      const pane = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.7);
      pane.addColorStop(0, alpha(light, 0.55));
      pane.addColorStop(1, alpha(mid, 0.25));
      ctx.fillStyle = pane;
      ctx.fillRect(x, h * 0.12, pw * 0.8, h * 0.56);
      ctx.fillStyle = 'rgba(3,2,8,0.9)';
      ctx.fillRect(x + pw * 0.38, h * 0.12, 6, h * 0.56);
      ctx.fillRect(x, h * 0.38, pw * 0.8, 6);
      const spill = ctx.createLinearGradient(x, h * 0.7, x + pw * 0.4, h);
      spill.addColorStop(0, alpha(light, 0.25));
      spill.addColorStop(1, 'transparent');
      ctx.fillStyle = spill;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.7);
      ctx.lineTo(x + pw * 0.8, h * 0.7);
      ctx.lineTo(x + pw * 1.3, h);
      ctx.lineTo(x + pw * 0.2, h);
      ctx.fill();
    }
  } else if (motif === 'garden' || motif === 'forest') {
    silhouette(ctx, w, h, horizon - 30, 70, alpha(deep, 0.85), r);
    silhouette(ctx, w, h, horizon + 40, 50, '#04030a', r);
    for (let i = 0; i < 26; i += 1) {
      const x = r() * w;
      const th = 60 + r() * 140;
      ctx.fillStyle = '#04030a';
      ctx.beginPath();
      ctx.moveTo(x, horizon + 40 - th);
      ctx.lineTo(x - th * 0.3, horizon + 60);
      ctx.lineTo(x + th * 0.3, horizon + 60);
      ctx.fill();
    }
  } else {
    silhouette(ctx, w, h, horizon, 90, alpha(deep, 0.9), r);
    silhouette(ctx, w, h, horizon + 50, 60, '#04030a', r);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band += 1) {
      ctx.strokeStyle = alpha(band % 2 ? light : mid, 0.18);
      ctx.lineWidth = 30 + band * 10;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 20)
        ctx.lineTo(x, h * (0.18 + band * 0.07) + Math.sin(x / 140 + band) * 30);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (motif === 'party' || motif === 'graduation') {
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = alpha([light, mid, '#fde047', '#f472b6'][i % 4]!, 0.7);
      ctx.save();
      ctx.translate(r() * w, r() * h * 0.8);
      ctx.rotate(r() * Math.PI);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 28; i += 1) {
    const x = r() * w;
    const y = r() * h;
    const size = 8 + r() * 40;
    const bokeh = ctx.createRadialGradient(x, y, 0, x, y, size);
    bokeh.addColorStop(0, alpha(i % 2 ? light : mid, 0.18));
    bokeh.addColorStop(1, 'transparent');
    ctx.fillStyle = bokeh;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vignette.addColorStop(0, 'transparent');
  vignette.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

function cacheKey(spec: SceneSpec, width: number) {
  return `${spec.seed}|${spec.motifs.join(',')}|${spec.palette.join(',')}|${width}`;
}

export function peekScene(spec: SceneSpec, width = 960): string | null {
  return cache.get(cacheKey(spec, width)) ?? null;
}

export function paintScene(spec: SceneSpec, width = 960, height = 560): string {
  const key = cacheKey(spec, width);
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas, spec);
  const url = canvas.toDataURL('image/jpeg', 0.82);
  cache.set(key, url);
  return url;
}
