import { useEffect, useRef, useState } from 'react';
import { useMotionAllowed } from '../../lib/motion';
import type { MoodBlend } from '../../lib/mood/moods';
import { activePulses } from './pulses';

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uEnergy;
uniform float uFlicker;
uniform float uWarp;
uniform float uBright;
uniform float uSeed;
uniform float uZoom;
uniform vec4 uPulse[4];

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  uv /= uZoom;
  float t = uTime * (0.025 + 0.11 * uEnergy);

  vec2 q = vec2(fbm(uv * 1.3 + vec2(0.0, t)), fbm(uv * 1.3 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(uv * 1.5 + (2.5 + uWarp * 2.5) * q + vec2(1.7, 9.2) + t * 0.7), fbm(uv * 1.5 + (2.5 + uWarp * 2.5) * q + vec2(8.3, 2.8) - t * 0.6));
  float f = fbm(uv * 1.15 + (1.6 + uWarp * 2.2) * r);

  vec3 col = mix(uC1, uC2, clamp(f * f * 2.2, 0.0, 1.0));
  col = mix(col, uC3, clamp(length(q) * 0.55 * r.x, 0.0, 1.0) * 0.85);
  col *= 0.55 + 0.9 * f;

  float wave = uv.y - 0.18 * sin(uv.x * 2.1 + t * 4.0) - 0.22 * fbm(uv * 2.4 + t * 1.5) - 0.05;
  float ribbon = exp(-pow(wave * 9.0, 2.0)) * (0.35 + 0.65 * fbm(vec2(uv.x * 6.0 + t * 6.0, t)));
  col += uC3 * ribbon * 0.55 * (0.4 + uEnergy);
  float wave2 = uv.y + 0.32 + 0.12 * sin(uv.x * 3.3 - t * 3.0);
  col += uC2 * exp(-pow(wave2 * 12.0, 2.0)) * 0.25;

  vec2 sp = uv * 34.0;
  vec2 cell = floor(sp);
  float star = hash(cell);
  vec2 offset = vec2(hash(cell + 1.3), hash(cell + 7.1)) - 0.5;
  float d = length(fract(sp) - 0.5 - offset * 0.6);
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + star * 3.0) + star * 40.0);
  col += vec3(1.0) * smoothstep(0.08, 0.0, d) * step(0.965, star) * twinkle * 0.9;

  for (int i = 0; i < 4; i++) {
    vec4 p = uPulse[i];
    if (p.w > 0.0) {
      vec2 c = (p.xy * uRes - 0.5 * uRes) / uRes.y / uZoom;
      float age = p.z;
      float dist = length(uv - c);
      float ring = smoothstep(0.035, 0.0, abs(dist - age * 0.9)) * (1.0 - age) * p.w;
      float core = exp(-dist * 9.0) * (1.0 - age) * p.w * 0.8;
      col += (uC3 * 1.2 + vec3(0.25)) * (ring + core);
    }
  }

  col *= 1.0 + uFlicker * (noise(vec2(uTime * 9.0, 3.0)) - 0.5) * 0.7;
  float vig = smoothstep(1.35, 0.15, length(uv * vec2(0.85, 1.0)));
  col *= mix(0.35, 1.0, vig);
  col *= uBright;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.025;
  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToVec(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

let overlays = 0;

export interface SkyTarget {
  mood: MoodBlend;
  dim: number;
  zoom?: number;
  seed?: number;
}

export function ShaderSky({
  target,
  className = '',
  fixed = true,
}: {
  target: SkyTarget;
  className?: string;
  fixed?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(target);
  const allowed = useMotionAllowed();
  const [epoch, setEpoch] = useState(0);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    });
    if (!gl || gl.isContextLost()) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      res: u('uRes'),
      time: u('uTime'),
      c1: u('uC1'),
      c2: u('uC2'),
      c3: u('uC3'),
      energy: u('uEnergy'),
      flicker: u('uFlicker'),
      warp: u('uWarp'),
      bright: u('uBright'),
      seed: u('uSeed'),
      zoom: u('uZoom'),
      pulse: u('uPulse'),
    };

    const current = {
      c1: hexToVec(targetRef.current.mood.palette[0]),
      c2: hexToVec(targetRef.current.mood.palette[1]),
      c3: hexToVec(targetRef.current.mood.palette[2]),
      energy: targetRef.current.mood.energy,
      flicker: targetRef.current.mood.flicker,
      warp: targetRef.current.mood.warp,
      bright: targetRef.current.mood.brightness * targetRef.current.dim,
      zoom: targetRef.current.zoom ?? 1,
    };

    const resize = () => {
      const scale = 0.4;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    let elapsed = 0;
    let last = performance.now();
    const ease = (a: number, b: number, k: number) => a + (b - a) * k;
    const pulseData = new Float32Array(16);

    let lastDraw = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (
        now - lastDraw < 40 ||
        (fixed && overlays > 0) ||
        (fixed && document.documentElement.dataset.sky === 'off')
      )
        return;
      lastDraw = now;
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      const goal = targetRef.current;
      const k = 1 - Math.pow(0.02, dt);
      elapsed += dt * (allowed ? 1 : 0);
      (['c1', 'c2', 'c3'] as const).forEach((key, i) => {
        const goalColor = hexToVec(goal.mood.palette[i]!);
        current[key] = current[key].map((v, j) => ease(v, goalColor[j]!, k)) as [
          number,
          number,
          number,
        ];
      });
      current.energy = ease(current.energy, goal.mood.energy, k);
      current.flicker = ease(current.flicker, allowed ? goal.mood.flicker : 0, k);
      current.warp = ease(current.warp, goal.mood.warp, k);
      current.bright = ease(current.bright, goal.mood.brightness * goal.dim, k);
      current.zoom = ease(current.zoom, goal.zoom ?? 1, 1 - Math.pow(0.004, dt));

      pulseData.fill(0);
      activePulses(now).forEach((p, i) => {
        pulseData[i * 4] = p.x;
        pulseData[i * 4 + 1] = p.y;
        pulseData[i * 4 + 2] = Math.min(1, (now - p.start) / 2600);
        pulseData[i * 4 + 3] = allowed ? p.strength : 0;
      });

      gl.uniform2f(uniforms.res, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, elapsed + 40);
      gl.uniform3fv(uniforms.c1, current.c1);
      gl.uniform3fv(uniforms.c2, current.c2);
      gl.uniform3fv(uniforms.c3, current.c3);
      gl.uniform1f(uniforms.energy, current.energy);
      gl.uniform1f(uniforms.flicker, current.flicker);
      gl.uniform1f(uniforms.warp, current.warp);
      gl.uniform1f(uniforms.bright, current.bright);
      gl.uniform1f(uniforms.seed, goal.seed ?? 0.37);
      gl.uniform1f(uniforms.zoom, current.zoom);
      gl.uniform4fv(uniforms.pulse, pulseData);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    if (!fixed) overlays += 1;

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      setLost(true);
    };
    const onRestored = () => {
      setLost(false);
      setEpoch((n) => n + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    frame = requestAnimationFrame(draw);

    return () => {
      if (!fixed) overlays -= 1;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      const release = gl.getExtension('WEBGL_lose_context');
      window.setTimeout(() => {
        if (!canvas.isConnected) release?.loseContext();
      }, 0);
    };
  }, [allowed, epoch, fixed]);

  const position = `${fixed ? 'fixed' : 'absolute'} inset-0 -z-10 h-full w-full`;
  return (
    <>
      <div
        aria-hidden="true"
        className={`${position} ${className}`}
        style={{
          background:
            'radial-gradient(ellipse at 28% 18%, color-mix(in oklab, var(--mood-a) 55%, transparent), transparent 60%), radial-gradient(ellipse at 78% 82%, color-mix(in oklab, var(--mood-b) 40%, transparent), transparent 58%), #05040a',
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`${position} transition-opacity duration-700 ${lost ? 'opacity-0' : ''} ${className}`}
      />
    </>
  );
}
