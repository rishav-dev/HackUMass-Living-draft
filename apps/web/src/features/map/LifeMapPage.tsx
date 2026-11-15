import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { List, Orbit, Pin, X } from 'lucide-react';
import type { ConnectionDto, MemoryCardDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useConnections, useMemories } from '../../api/hooks';
import { CertaintyMark, EmotionRow, PeopleRow } from '../../components/memory/bits';
import { Toggle } from '../../components/ui/controls';
import { PaperLoading } from '../../components/ui/states';
import { connectionMeta, emotionMeta, hashNumber } from '../../lib/meta';
import { useMotionAllowed } from '../../lib/motion';
import { useScene } from '../../lib/sound/SoundProvider';
import { mix, threadStyle, type GraphLink, type GraphNode } from './threadStyle';

type Focus =
  { kind: 'memory'; memory: MemoryCardDto } | { kind: 'link'; connection: ConnectionDto };

interface Peek {
  focus: Focus;
  style: CSSProperties;
}

const SPIN = 0.2;
const LINGER_MS = 450;

function placeCard(box: HTMLElement, x: number, y: number): CSSProperties {
  const rect = box.getBoundingClientRect();
  const top = Math.max(0, -rect.top);
  const bottom = Math.min(rect.height, window.innerHeight - rect.top);
  const roomBelow = bottom - y - 22;
  const roomAbove = y - top - 22;
  const right = x > rect.width - 360;
  const below = roomBelow >= Math.min(roomAbove, 320);
  return {
    ...(right ? { right: Math.max(8, rect.width - x + 14) } : { left: x + 14 }),
    ...(below
      ? { top: y + 14, maxHeight: Math.max(160, roomBelow) }
      : { bottom: rect.height - y + 14, maxHeight: Math.max(160, roomAbove) }),
  };
}

function nodeColor(memory: MemoryCardDto): string {
  const tag = memory.emotions.find((e) => e.phase === 'then')?.tag ?? memory.emotions[0]?.tag;
  return tag ? emotionMeta(tag).ink : '#c4b5fd';
}

function sameFocus(a: Focus | null, b: Focus | null) {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === 'memory'
    ? a.memory.id === (b as typeof a).memory.id
    : a.connection.id === (b as typeof a).connection.id;
}

interface Graph {
  graphData: (d?: { nodes: GraphNode[]; links: GraphLink[] }) => {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  width: (w: number) => unknown;
  height: (h: number) => unknown;
  cameraPosition: (p: object, look?: object, ms?: number) => unknown;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
  _destructor: () => void;
}

export default function LifeMapPage() {
  useScene('studio');
  const navigate = useNavigate();
  const motionOk = useMotionAllowed();
  const box = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const styleRef = useRef<ReturnType<typeof threadStyle> | null>(null);
  const reframeRef = useRef<() => void>(() => undefined);
  const { data: memories, isLoading } = useMemories({});
  const { data: connections } = useConnections();
  const { data: themes } = useQuery({
    queryKey: ['themes'],
    queryFn: () => api.get<Array<{ theme: string; count: number }>>('/themes'),
  });
  const [thread, setThread] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [showSuggested, setShowSuggested] = useState(true);
  const [allTitles, setAllTitles] = useState(false);
  const [allThemes, setAllThemes] = useState(false);
  const [pinned, setPinned] = useState<Focus | null>(null);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [ready, setReady] = useState(0);

  const pointer = useRef({ x: 0, y: 0 });
  const hovering = useRef<Focus | null>(null);
  const overCard = useRef(false);
  const pinnedRef = useRef<Focus | null>(null);
  const motionRef = useRef(motionOk);
  const spin = useRef(0);
  const linger = useRef<number | undefined>(undefined);

  useEffect(() => {
    motionRef.current = motionOk;
  }, [motionOk]);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  useEffect(() => {
    document.documentElement.dataset.sky = 'off';
    return () => {
      delete document.documentElement.dataset.sky;
    };
  }, []);

  const types = useMemo(() => [...new Set((connections ?? []).map((c) => c.type))], [connections]);

  const data = useMemo(() => {
    const visible = (memories ?? []).filter((m) => !theme || m.themes.includes(theme));
    const ids = new Set(visible.map((m) => m.id));
    const links: GraphLink[] = (connections ?? [])
      .filter((c) => c.status !== 'dismissed' && (showSuggested || c.status === 'confirmed'))
      .filter((c) => !thread || c.type === thread)
      .flatMap((c) => {
        const ends = c.endpoints.filter((e) => e.nodeType === 'memory' && ids.has(e.nodeId));
        return ends.slice(1).map((end, i) => ({
          id: `${c.id}-${i}`,
          source: ends[0]!.nodeId,
          target: end.nodeId,
          connection: c,
          color: connectionMeta(c.type).color,
          curve: hashNumber(c.id) * Math.PI * 2,
        }));
      });
    const linked = new Set(links.flatMap((l) => [l.source as string, l.target as string]));
    const nodes: GraphNode[] = visible
      .filter((m) => !thread || linked.has(m.id))
      .map((m) => ({
        id: m.id,
        title: m.title,
        color: nodeColor(m),
        radius: (linked.has(m.id) ? 9 : 6.5) + Math.min(5, m.people.length * 0.6 + m.versionCount),
        linked: linked.has(m.id),
        memory: m,
      }));
    return { nodes, links };
  }, [memories, connections, thread, theme, showSuggested]);

  useEffect(() => {
    const el = box.current;
    if (!el || graphRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let raf = 0;
    const held = () => hovering.current !== null || pinnedRef.current !== null || overCard.current;

    const light = (focus: Focus | null) => styleRef.current?.light(focus);
    const releaseSoon = () => {
      window.clearTimeout(linger.current);
      linger.current = window.setTimeout(() => {
        if (overCard.current || hovering.current) return;
        setPeek(null);
        light(pinnedRef.current);
      }, LINGER_MS);
    };
    const hold = (focus: Focus) => {
      window.clearTimeout(linger.current);
      hovering.current = focus;
      spin.current = 0;
      light(focus);
      if (!sameFocus(focus, pinnedRef.current))
        setPeek({ focus, style: placeCard(el, pointer.current.x, pointer.current.y) });
    };

    let overNode = false;
    let linkAt: (x: number, y: number) => GraphLink | null = () => null;
    const track = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onMove = (event: PointerEvent) => {
      track(event);
      if (overNode || event.buttons) return;
      const link = linkAt(pointer.current.x, pointer.current.y);
      const current = hovering.current;
      if (link) {
        el.style.cursor = 'pointer';
        if (current?.kind !== 'link' || current.connection.id !== link.connection.id)
          hold({ kind: 'link', connection: link.connection });
      } else if (current?.kind === 'link') {
        el.style.cursor = '';
        hovering.current = null;
        releaseSoon();
      }
    };
    const onLeave = () => {
      overNode = false;
      el.style.cursor = '';
      if (!hovering.current) return;
      hovering.current = null;
      releaseSoon();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', track);
    el.addEventListener('pointerleave', onLeave);

    void (async () => {
      const [{ default: ForceGraph3D }, { default: SpriteText }, THREE] = await Promise.all([
        import('3d-force-graph'),
        import('three-spritetext'),
        import('three'),
      ]);
      if (disposed) return;
      const style = threadStyle(THREE, SpriteText);
      styleRef.current = style;
      const graph = new ForceGraph3D(el, { controlType: 'orbit' })
        .backgroundColor('rgba(0,0,0,0)')
        .showNavInfo(false)
        .enableNodeDrag(false)
        .warmupTicks(80)
        .cooldownTime(3500)
        .nodeId('id')
        .nodeLabel(() => '')
        .linkLabel(() => '')
        .nodeThreeObject((n: object) => style.buildNode(n as GraphNode))
        .linkCurvature(0.22)
        .linkCurveRotation((l: object) => (l as GraphLink).curve)
        .linkOpacity(0.8)
        .linkColor((l: object) => style.linkColor(l as GraphLink))
        .linkWidth((l: object) => style.linkWidth(l as GraphLink))
        .linkDirectionalParticles((l: object) =>
          (l as GraphLink).connection.status === 'confirmed' ? 3 : 1,
        )
        .linkDirectionalParticleWidth((l: object) => style.particleWidth(l as GraphLink))
        .linkDirectionalParticleColor((l: object) => mix((l as GraphLink).color, '#ffffff', 0.35))
        .linkDirectionalParticleSpeed(() => (motionRef.current && !held() ? 0.0028 : 0))
        .onNodeHover((n: object | null) => {
          overNode = Boolean(n);
          el.style.cursor = n ? 'pointer' : '';
          if (n) hold({ kind: 'memory', memory: (n as GraphNode).memory });
          else {
            hovering.current = null;
            releaseSoon();
          }
        })
        .onNodeClick((n: object) => {
          const focus: Focus = { kind: 'memory', memory: (n as GraphNode).memory };
          setPeek(null);
          pinnedRef.current = focus;
          setPinned(focus);
          light(focus);
        })
        .onLinkClick((l: object) => {
          const focus: Focus = { kind: 'link', connection: (l as GraphLink).connection };
          setPeek(null);
          pinnedRef.current = focus;
          setPinned(focus);
          light(focus);
        })
        .onBackgroundClick(() => {
          const link = linkAt(pointer.current.x, pointer.current.y);
          const focus: Focus | null = link ? { kind: 'link', connection: link.connection } : null;
          pinnedRef.current = focus;
          setPinned(focus);
          setPeek(null);
          hovering.current = null;
          light(focus);
        });

      const camera = graph.camera();
      const point = new THREE.Vector3();
      const toScreen = (x: number, y: number, z: number) => {
        point.set(x, y, z).project(camera);
        return {
          x: ((point.x + 1) / 2) * el.clientWidth,
          y: ((1 - point.y) / 2) * el.clientHeight,
          behind: point.z > 1,
        };
      };
      const gap = (
        px: number,
        py: number,
        a: { x: number; y: number },
        b: { x: number; y: number },
      ) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(
          0,
          Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)),
        );
        return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
      };
      linkAt = (px, py) => {
        let best: GraphLink | null = null;
        let nearest = 12;
        for (const link of graph.graphData().links as Array<
          GraphLink & {
            __curve?: {
              getPoints: (n: number) => Array<{ x: number; y: number; z: number }>;
            } | null;
          }
        >) {
          const a = link.source as GraphNode;
          const b = link.target as GraphNode;
          if (typeof a !== 'object' || typeof b !== 'object') continue;
          const path = link.__curve
            ? link.__curve.getPoints(20)
            : [
                { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 },
                { x: b.x ?? 0, y: b.y ?? 0, z: b.z ?? 0 },
              ];
          const screen = path.map((p) => toScreen(p.x, p.y, p.z));
          for (let i = 1; i < screen.length; i += 1) {
            if (screen[i]!.behind || screen[i - 1]!.behind) continue;
            const d = gap(px, py, screen[i - 1]!, screen[i]!);
            if (d < nearest) {
              nearest = d;
              best = link;
            }
          }
        }
        return best;
      };
      style.attach(graph as never);

      graph.d3Force('charge')?.strength(-70);
      graph.d3Force('link')?.distance(50);
      let placed: GraphNode[] = [];
      const ageOf = (n: GraphNode) => n.memory.temporal.ageMin ?? n.memory.temporal.ageMax ?? 12;
      const byAge = Object.assign(
        (alpha: number) => {
          for (const n of placed as Array<GraphNode & { vy?: number; vz?: number }>) {
            n.vy = (n.vy ?? 0) + ((ageOf(n) - 12) * 21 - (n.y ?? 0)) * 0.12 * alpha;
            n.vz = (n.vz ?? 0) - (n.z ?? 0) * 0.06 * alpha;
          }
        },
        { initialize: (nodes: GraphNode[]) => (placed = nodes) },
      );
      graph.d3Force('age', byAge as never);

      const frame = (ms: number) => {
        const nodes = graph.graphData().nodes as GraphNode[];
        if (!nodes.length) return;
        const ys = nodes.map((n) => n.y ?? 0);
        const cx = nodes.reduce((sum, n) => sum + (n.x ?? 0), 0) / nodes.length;
        const cz = nodes.reduce((sum, n) => sum + (n.z ?? 0), 0) / nodes.length;
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const across = Math.max(...nodes.map((n) => Math.hypot((n.x ?? 0) - cx, (n.z ?? 0) - cz)));
        const tall = (Math.max(...ys) - Math.min(...ys)) / 2 + 14;
        const camera = graph.camera() as unknown as { fov: number; aspect: number };
        const half = (camera.fov * Math.PI) / 360;
        const wide = Math.atan(Math.tan(half) * camera.aspect);
        const distance =
          Math.max((across + 16) / Math.tan(wide), tall / Math.tan(half)) + across * 0.35;
        graph.cameraPosition({ x: cx, y: cy, z: cz + distance }, { x: cx, y: cy, z: cz }, ms);
      };
      let framed = false;
      graph.onEngineStop(() => {
        if (framed) return;
        framed = true;
        frame(700);
      });
      reframeRef.current = () => (framed = false);

      const turn = () => {
        const controls = graph.controls() as unknown as {
          autoRotate: boolean;
          autoRotateSpeed: number;
        };
        const target = motionRef.current && !held() ? SPIN : 0;
        spin.current += (target - spin.current) * (target > spin.current ? 0.025 : 0.3);
        controls.autoRotate = spin.current > 0.002;
        controls.autoRotateSpeed = spin.current;
        raf = requestAnimationFrame(turn);
      };
      raf = requestAnimationFrame(turn);

      graphRef.current = graph as unknown as Graph;
      const fit = () => {
        graph.width(el.clientWidth);
        graph.height(el.clientHeight);
      };
      fit();
      observer = new ResizeObserver(fit);
      observer.observe(el);
      setReady((n) => n + 1);
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(linger.current);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', track);
      el.removeEventListener('pointerleave', onLeave);
      observer?.disconnect();
      styleRef.current?.dispose();
      graphRef.current?._destructor();
      graphRef.current = null;
      el.replaceChildren();
    };
  }, [isLoading]);

  useEffect(() => {
    const graph = graphRef.current;
    const style = styleRef.current;
    if (!graph || !style) return;
    style.reset(allTitles);
    reframeRef.current();
    graph.graphData({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    });
    style.light(pinnedRef.current);
  }, [data, allTitles, ready]);

  const close = () => {
    pinnedRef.current = null;
    setPinned(null);
    styleRef.current?.light(null);
  };

  const enterCard = () => {
    overCard.current = true;
    window.clearTimeout(linger.current);
    spin.current = 0;
  };
  const leaveCard = () => {
    overCard.current = false;
    window.clearTimeout(linger.current);
    linger.current = window.setTimeout(() => {
      if (overCard.current || hovering.current) return;
      setPeek(null);
      styleRef.current?.light(pinnedRef.current);
    }, LINGER_MS);
  };

  if (isLoading) return <PaperLoading />;

  return (
    <div className="relative mx-auto max-w-[96rem] px-3 pb-6 pt-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">walk through it all</p>
          <h1 className="text-4xl font-semibold sm:text-5xl">Your life, connected</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">
            Every memory is a light, and every thread is a line between two of them. Point at a line
            to read why they belong together; it holds still while you read. Click to keep it open.
          </p>
        </div>
        <Link
          to="/connections"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <List className="size-4" /> See it as a list
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="paper flex h-fit flex-col gap-4 rounded-3xl p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Threads</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={!thread}
                onClick={() => setThread(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${!thread ? 'bg-snow text-abyss' : 'bg-white/8 text-ink-soft'}`}
              >
                All
              </button>
              {types.map((t) => {
                const meta = connectionMeta(t);
                const label = connections?.find((c) => c.type === t)?.label ?? t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={thread === t}
                    onClick={() => setThread(thread === t ? null : t)}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${thread === t ? 'text-abyss' : 'bg-white/8 text-ink-soft'}`}
                    style={thread === t ? { background: meta.color } : { color: meta.color }}
                  >
                    {meta.glyph} {label}
                  </button>
                );
              })}
            </div>
          </div>
          {themes && themes.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Themes</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...themes]
                  .sort((a, b) => b.count - a.count)
                  .filter((t, i) => allThemes || i < 10 || t.theme === theme)
                  .map((t) => (
                    <button
                      key={t.theme}
                      type="button"
                      aria-pressed={theme === t.theme}
                      onClick={() => setTheme(theme === t.theme ? null : t.theme)}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${theme === t.theme ? 'bg-lavender-deep text-abyss' : 'bg-white/8 text-ink-soft'}`}
                    >
                      {t.theme}
                    </button>
                  ))}
                {themes.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setAllThemes((v) => !v)}
                    className="rounded-full px-2.5 py-1 text-xs font-bold text-lavender-deep hover:underline"
                  >
                    {allThemes ? 'Show fewer' : `Show all ${themes.length}`}
                  </button>
                )}
              </div>
            </div>
          )}
          <Toggle
            checked={showSuggested}
            onChange={setShowSuggested}
            label="Show suggested threads"
          />
          <Toggle
            checked={allTitles}
            onChange={setAllTitles}
            label="Name every memory"
            description="Otherwise only memories with a thread are named."
          />
          <p className="text-xs text-ink-faint">
            {data.nodes.length} memories · {data.links.length} threads
          </p>
        </aside>

        <div className="relative self-start overflow-hidden rounded-3xl border border-white/8 bg-[radial-gradient(ellipse_at_50%_40%,#1c1726_0%,#0b0910_72%)]">
          <div
            ref={box}
            className="h-[calc(100dvh-14rem)] min-h-[26rem] w-full touch-none"
            aria-label="3D map of your memories and the threads between them"
            role="img"
          />
          <p className="pointer-events-none absolute bottom-3 left-4 text-xs font-semibold text-ink-faint">
            Higher up is later in life
          </p>
          {!data.nodes.length && (
            <p className="absolute inset-0 flex items-center justify-center text-ink-soft">
              <Orbit className="mr-2 size-5" /> Nothing matches these filters yet.
            </p>
          )}
          {peek && !sameFocus(peek.focus, pinned) && (
            <div
              className="absolute z-10 w-[min(21rem,calc(100%-1rem))] overflow-y-auto rounded-3xl border border-white/12 bg-[#151219]/96 p-4 shadow-2xl"
              style={peek.style}
              data-peek=""
              onPointerEnter={enterCard}
              onPointerLeave={leaveCard}
            >
              <Details focus={peek.focus} compact navigate={navigate} />
              <button
                type="button"
                onClick={() => {
                  setPinned(peek.focus);
                  setPeek(null);
                  styleRef.current?.light(peek.focus);
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-lavender-deep hover:underline"
              >
                <Pin className="size-3.5" /> Keep this open
              </button>
            </div>
          )}
          {pinned && (
            <div
              className="absolute bottom-3 right-3 top-3 z-20 w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto rounded-3xl border border-white/10 bg-[#151219]/96 p-5 shadow-2xl"
              onPointerEnter={() => (overCard.current = true)}
              onPointerLeave={() => (overCard.current = false)}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
              <Details focus={pinned} navigate={navigate} onThread={setThread} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Details({
  focus,
  compact = false,
  navigate,
  onThread,
}: {
  focus: Focus;
  compact?: boolean;
  navigate: ReturnType<typeof useNavigate>;
  onThread?: (type: string) => void;
}) {
  if (focus.kind === 'memory') {
    const memory = focus.memory;
    return (
      <>
        <CertaintyMark temporal={memory.temporal} compact />
        <h2 className={`mt-2 pr-6 font-display font-semibold ${compact ? 'text-xl' : 'text-2xl'}`}>
          {memory.title}
        </h2>
        <p className={`mt-2 text-sm text-ink-soft ${compact ? 'line-clamp-3' : ''}`}>
          {memory.summary ?? memory.excerpt}
        </p>
        <div className="mt-3">
          <EmotionRow emotions={memory.emotions.slice(0, compact ? 3 : 4)} />
        </div>
        {!compact && (
          <div className="mt-3">
            <PeopleRow people={memory.people} />
          </div>
        )}
        <button
          type="button"
          onClick={() => void navigate(`/memories/${memory.id}`, { viewTransition: true })}
          className={`w-full rounded-full bg-snow font-semibold text-abyss ${compact ? 'mt-3 py-2 text-sm' : 'mt-5 py-2.5'}`}
        >
          Open this memory
        </button>
      </>
    );
  }
  const { connection } = focus;
  const meta = connectionMeta(connection.type);
  return (
    <>
      <p className="pr-6 text-sm font-bold" style={{ color: meta.color }}>
        {meta.glyph} {connection.label}
        {connection.status === 'suggested' ? ' · suggested' : ''}
      </p>
      <p className={`mt-2 ${compact ? 'text-sm' : ''}`}>{connection.explanation}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {connection.endpoints
          .filter((e) => e.nodeType === 'memory')
          .map((e) => (
            <li key={e.nodeId} className="rounded-2xl bg-white/5 p-3">
              <Link
                to={`/memories/${e.nodeId}`}
                viewTransition
                className={`font-display font-semibold hover:underline ${compact ? 'text-base' : 'text-lg'}`}
              >
                {e.title}
              </Link>
              {e.evidence?.quote && (
                <p className="mt-1 text-sm italic text-ink-soft">“{e.evidence.quote}”</p>
              )}
            </li>
          ))}
      </ul>
      {onThread && (
        <button
          type="button"
          onClick={() => onThread(connection.type)}
          className="mt-4 text-sm font-semibold text-lavender-deep hover:underline"
        >
          Show only “{connection.label}” threads
        </button>
      )}
    </>
  );
}
