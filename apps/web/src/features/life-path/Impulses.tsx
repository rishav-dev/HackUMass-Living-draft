import { useEffect, useRef } from 'react';

const SVG = 'http://www.w3.org/2000/svg';

export function Impulses({ d, height }: { d: string; height: number }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || !d) return;
    const holder = document.createElementNS(SVG, 'svg');
    holder.setAttribute('width', '0');
    holder.setAttribute('height', '0');
    holder.style.position = 'absolute';
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    holder.appendChild(path);
    el.appendChild(holder);
    const total = path.getTotalLength();

    const fire = () => {
      if (document.hidden || el.childElementCount > 4) return;
      const width = el.clientWidth;
      const start = Math.random() * 0.75;
      const span = 0.12 + Math.random() * 0.18;
      const steps = 18;
      const frames: Keyframe[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const point = path.getPointAtLength(total * Math.min(1, start + (span * i) / steps));
        frames.push({
          transform: `translate(${(point.x / 100) * width}px, ${point.y}px)`,
          opacity: i === 0 || i === steps ? 0 : 1,
        });
      }
      const dot = document.createElement('span');
      dot.className = 'impulse';
      el.appendChild(dot);
      const run = dot.animate(frames, { duration: 2200 + span * 4000, easing: 'ease-in-out' });
      run.onfinish = () => dot.remove();
    };

    fire();
    const timer = window.setInterval(fire, 1700);
    return () => {
      window.clearInterval(timer);
      el.replaceChildren();
    };
  }, [d, height]);

  return <div ref={box} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
