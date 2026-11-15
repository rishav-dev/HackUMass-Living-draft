import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { FeatureCollection, Geometry } from 'geojson';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { MemoryCardDto } from '@living-draft/contracts';
import { useMotionAllowed } from '../../lib/motion';
import {
  clusterByPixels,
  clusterLabel,
  clusterTint,
  loadCountries,
  type MapPlace,
  type PlaceCluster,
} from './placeMap';

export default function PlacesFlatMap({
  places,
  cards,
  selected,
  onSelect,
}: {
  places: MapPlace[];
  cards: Map<string, MemoryCardDto>;
  selected: PlaceCluster | null;
  onSelect: (cluster: PlaceCluster | null) => void;
}) {
  const motionOk = useMotionAllowed();
  const holder = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: 800, height: 480 });
  const [world, setWorld] = useState<FeatureCollection<Geometry> | null>(null);
  const [view, setView] = useState<ZoomTransform>(zoomIdentity);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    void loadCountries().then(setWorld);
  }, []);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fit = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const projection = useMemo(
    () =>
      geoNaturalEarth1().fitExtent(
        [
          [12, 12],
          [size.width - 12, size.height - 12],
        ],
        { type: 'Sphere' },
      ),
    [size],
  );
  const shapes = useMemo(() => {
    const path = geoPath(projection);
    return {
      sphere: path({ type: 'Sphere' }) ?? '',
      grid: path(geoGraticule10()) ?? '',
      countries: (world?.features ?? []).map((f, i) => ({ key: i, d: path(f) ?? '' })),
    };
  }, [projection, world]);

  const k = view.k;
  const clusters = useMemo(
    () => clusterByPixels(places, (p) => projection([p.lon, p.lat]), 30 / k),
    [places, projection, k],
  );
  const labelled = useMemo(() => {
    type Box = { x0: number; x1: number; y0: number; y1: number; id?: string };
    const taken: Box[] = clusters.flatMap((c) => {
      const at = projection([c.lon, c.lat]);
      if (!at) return [];
      const r = (8 + Math.sqrt(c.count) * 3.4) / k;
      return [{ id: c.id, x0: at[0] - r, x1: at[0] + r, y0: at[1] - r, y1: at[1] + r }];
    });
    const shown = new Set<string>();
    for (const cluster of [...clusters].sort((a, b) => b.count - a.count)) {
      const point = projection([cluster.lon, cluster.lat]);
      if (!point) continue;
      const half = (clusterLabel(cluster).length * 3.6) / k;
      const radius = (6 + Math.sqrt(cluster.count) * 3.4) / k;
      const box = {
        x0: point[0] - half,
        x1: point[0] + half,
        y0: point[1] + radius + 2 / k,
        y1: point[1] + radius + 18 / k,
      };
      if (
        taken.some(
          (t) =>
            t.id !== cluster.id && t.x0 < box.x1 && box.x0 < t.x1 && t.y0 < box.y1 && box.y0 < t.y1,
        )
      )
        continue;
      taken.push(box);
      shown.add(cluster.id);
    }
    return shown;
  }, [clusters, projection, k]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 80])
      .translateExtent([
        [0, 0],
        [size.width, size.height],
      ])
      .on('zoom', (event: { transform: ZoomTransform }) => setView(event.transform));
    zoomRef.current = behavior;
    select(svg).call(behavior);
    return () => {
      select(svg).on('.zoom', null);
    };
  }, [size]);

  const zoomTo = (x: number, y: number, scale: number) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior) return;
    const target = zoomIdentity
      .translate(size.width / 2, size.height / 2)
      .scale(scale)
      .translate(-x, -y);
    const selection = select(svg);
    if (motionOk)
      selection
        .transition()
        .duration(750)
        .call(behavior.transform as never, target);
    else selection.call(behavior.transform, target);
  };

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg && behavior) select(svg).call(behavior.scaleBy, factor);
  };

  return (
    <div ref={holder} className="relative h-full w-full">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="block cursor-grab touch-none active:cursor-grabbing"
        role="application"
        aria-label="Map of the places in your memories. Drag to move, scroll or pinch to zoom."
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
      >
        <defs>
          <radialGradient id="place-glow">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={view.toString()}>
          <path d={shapes.sphere} fill="#120e1b" onClick={() => onSelect(null)} />
          <path
            d={shapes.grid}
            fill="none"
            stroke="rgba(196,181,253,0.07)"
            vectorEffect="non-scaling-stroke"
          />
          {shapes.countries.map((c) => (
            <path
              key={c.key}
              d={c.d}
              fill="#211b2f"
              stroke="rgba(206,194,255,0.28)"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
              onClick={() => onSelect(null)}
            />
          ))}
          <path
            d={shapes.sphere}
            fill="none"
            stroke="rgba(167,139,250,0.35)"
            vectorEffect="non-scaling-stroke"
          />
          {clusters.map((cluster) => {
            const point = projection([cluster.lon, cluster.lat]);
            if (!point) return null;
            const tint = clusterTint(cluster, cards);
            const radius = (6 + Math.sqrt(cluster.count) * 3.4) / k;
            const active = selected?.id === cluster.id || hovered === cluster.id;
            const label = clusterLabel(cluster);
            return (
              <g
                key={cluster.id}
                transform={`translate(${point[0]},${point[1]})`}
                role="button"
                tabIndex={0}
                aria-label={`${label}: ${cluster.count} ${cluster.count === 1 ? 'memory' : 'memories'}`}
                className="cursor-pointer outline-none"
                onPointerEnter={() => setHovered(cluster.id)}
                onPointerLeave={() => setHovered(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(cluster);
                  if (cluster.places.length > 1) zoomTo(point[0], point[1], Math.min(80, k * 4));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(cluster);
                  }
                }}
              >
                <circle r={radius * 2.2} fill="url(#place-glow)" opacity={active ? 0.35 : 0.16} />
                <circle r={radius * 1.7} fill={tint} opacity={active ? 0.28 : 0.14} />
                <circle
                  r={radius * (active ? 1.2 : 1)}
                  fill={tint}
                  stroke="#fff"
                  strokeOpacity={0.7}
                  strokeWidth={1 / k}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={11 / k}
                  fontWeight={700}
                  fill="#0b0910"
                  className="pointer-events-none select-none"
                >
                  {cluster.count}
                </text>
                {(active || labelled.has(cluster.id)) && (
                  <text
                    textAnchor="middle"
                    y={radius + 14 / k}
                    fontSize={12 / k}
                    fontWeight={600}
                    fill="#f4ede1"
                    stroke="#0b0910"
                    strokeWidth={3 / k}
                    paintOrder="stroke"
                    className="pointer-events-none select-none"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.8)}
          className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-abyss/85 text-ink-soft hover:text-snow"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / 1.8)}
          className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-abyss/85 text-ink-soft hover:text-snow"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Show the whole world"
          onClick={() => zoomTo(size.width / 2, size.height / 2, 1)}
          className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-abyss/85 text-ink-soft hover:text-snow"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  );
}
