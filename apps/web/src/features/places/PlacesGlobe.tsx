import { useEffect, useMemo, useRef, useState } from 'react';
import type { MemoryCardDto } from '@living-draft/contracts';
import { useMotionAllowed } from '../../lib/motion';
import {
  clusterByDegrees,
  clusterLabel,
  clusterTint,
  loadCountries,
  type MapPlace,
  type PlaceCluster,
} from './placeMap';

interface GlobeHandle {
  width: (w: number) => unknown;
  height: (h: number) => unknown;
  pointOfView: (
    pov?: { lat?: number; lng?: number; altitude?: number },
    ms?: number,
  ) => { lat: number; lng: number; altitude: number };
  htmlElementsData: (d: object[]) => unknown;
  ringsData: (d: object[]) => unknown;
  hexPolygonsData: (d: object[]) => unknown;
  controls: () => {
    autoRotate: boolean;
    autoRotateSpeed: number;
    addEventListener: (type: string, fn: () => void) => void;
  };
  _destructor: () => void;
}

const SPIN = 0.32;

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export default function PlacesGlobe({
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
  const box = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeHandle | null>(null);
  const motionOk = useMotionAllowed();
  const motion = useRef(motionOk);
  const held = useRef({ hover: false, open: false, touching: false });
  const pick = useRef(onSelect);
  const [altitude, setAltitude] = useState(2.2);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    motion.current = motionOk;
  }, [motionOk]);
  useEffect(() => {
    held.current.open = selected !== null;
  }, [selected]);
  useEffect(() => {
    pick.current = onSelect;
  }, [onSelect]);

  const clusters = useMemo(
    () => clusterByDegrees(places, Math.max(0.12, altitude * 5.5)),
    [places, altitude],
  );

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let disposed = false;
    let raf = 0;
    let observer: ResizeObserver | null = null;
    let release: number | undefined;
    void (async () => {
      const [{ default: Globe }, countries] = await Promise.all([
        import('globe.gl'),
        loadCountries(),
      ]);
      if (disposed) return;
      const first = [...places].sort((a, b) => b.memoryIds.length - a.memoryIds.length)[0];
      const globe = new Globe(el, { animateIn: motion.current })
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true)
        .atmosphereColor('#a78bfa')
        .atmosphereAltitude(0.17)
        .hexPolygonsData(countries.features)
        .hexPolygonResolution(3)
        .hexPolygonMargin(0.42)
        .hexPolygonUseDots(true)
        .hexPolygonColor(() => 'rgba(206, 194, 255, 0.62)')
        .htmlLat('lat')
        .htmlLng('lon')
        .htmlAltitude(0.012)
        .htmlTransitionDuration(0)
        .htmlElementVisibilityModifier((node: HTMLElement, visible: boolean) => {
          node.style.opacity = visible ? '1' : '0';
          node.style.pointerEvents = visible ? 'auto' : 'none';
        })
        .ringLat('lat')
        .ringLng('lon')
        .ringColor((d: object) => {
          const tint = (d as { tint: string }).tint;
          return (t: number) =>
            `${tint}${Math.round((1 - t) * 160)
              .toString(16)
              .padStart(2, '0')}`;
        })
        .ringMaxRadius((d: object) => 1.4 + Math.sqrt((d as PlaceCluster).count) * 0.9)
        .ringPropagationSpeed(0.9)
        .ringRepeatPeriod(2400)
        .htmlElement((d: object) => {
          const cluster = d as PlaceCluster & { tint: string };
          const size = Math.round(16 + Math.sqrt(cluster.count) * 7);
          const holder = document.createElement('div');
          const label = clusterLabel(cluster);
          holder.innerHTML = `<button type="button" class="place-orb" ${cluster.count >= 3 ? 'data-show' : ''} aria-label="${escape(`${label}: ${cluster.count} ${cluster.count === 1 ? 'memory' : 'memories'}`)}" style="--size:${size}px;--tint:${cluster.tint}"><span class="place-orb-count">${cluster.count}</span><span class="place-orb-label">${escape(label)}</span></button>`;
          const button = holder.firstElementChild as HTMLButtonElement;
          button.addEventListener('pointerenter', () => (held.current.hover = true));
          button.addEventListener('pointerleave', () => (held.current.hover = false));
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            held.current.hover = false;
            pick.current(cluster);
            if (cluster.places.length > 1) {
              const now = globe.pointOfView();
              globe.pointOfView(
                {
                  lat: cluster.lat,
                  lng: cluster.lon,
                  altitude: Math.max(0.08, now.altitude / 3.5),
                },
                motion.current ? 1000 : 0,
              );
            }
          });
          return holder;
        })
        .onZoom((pov: { altitude: number }) => {
          setAltitude(Math.round(pov.altitude * 20) / 20);
        });
      const material = globe.globeMaterial() as unknown as {
        color: { set: (c: string) => void };
        emissive?: { set: (c: string) => void };
        shininess?: number;
      };
      material.color.set('#14101f');
      material.emissive?.set('#0b0813');
      material.shininess = 4;
      if (first) globe.pointOfView({ lat: first.lat - 8, lng: first.lon + 18, altitude: 2.2 }, 0);
      const controls = globe.controls() as unknown as ReturnType<GlobeHandle['controls']>;
      controls.addEventListener('start', () => {
        window.clearTimeout(release);
        held.current.touching = true;
      });
      controls.addEventListener('end', () => {
        window.clearTimeout(release);
        release = window.setTimeout(() => (held.current.touching = false), 2500);
      });
      let spin = 0;
      const turn = () => {
        const busy = held.current.hover || held.current.open || held.current.touching;
        const target = motion.current && !busy ? SPIN : 0;
        spin = busy ? 0 : spin + (target - spin) * 0.03;
        controls.autoRotate = spin > 0.002;
        controls.autoRotateSpeed = spin;
        raf = requestAnimationFrame(turn);
      };
      raf = requestAnimationFrame(turn);
      const fit = () => {
        globe.width(el.clientWidth);
        globe.height(el.clientHeight);
      };
      fit();
      observer = new ResizeObserver(fit);
      observer.observe(el);
      globeRef.current = globe as unknown as GlobeHandle;
      setReady(true);
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(release);
      observer?.disconnect();
      globeRef.current?._destructor();
      globeRef.current = null;
      el.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const tinted = clusters.map((c) => ({ ...c, tint: clusterTint(c, cards) }));
    globe.htmlElementsData(tinted);
    globe.ringsData(motionOk ? tinted : []);
  }, [clusters, cards, ready, motionOk]);

  return (
    <div
      ref={box}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      role="application"
      aria-label="Globe of the places in your memories. Drag to turn it, scroll or pinch to zoom."
      onClick={(event) => {
        if (
          event.target === event.currentTarget ||
          (event.target as HTMLElement).tagName === 'CANVAS'
        )
          onSelect(null);
      }}
    />
  );
}
