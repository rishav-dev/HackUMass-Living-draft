import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  GitCompare,
  Link2,
  List,
  MousePointer2,
  RefreshCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { ConnectionDto, MapDto } from '@living-draft/contracts';
import { chapterTitle, connectionLabel } from '@living-draft/engine';
import { api } from '../../api/client';
import {
  useCharacters,
  useConnections,
  useConnectionTypes,
  useInvalidateArchive,
  useMap,
} from '../../api/hooks';
import { CertaintyMark } from '../../components/memory/bits';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Select, TextArea, TextInput, Toggle } from '../../components/ui/controls';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { BASE_EMOTION_TAGS, CONNECTION_META, connectionMeta, emotionMeta } from '../../lib/meta';
import { sound } from '../../lib/sound/engine';
import { useScene, useSound } from '../../lib/sound/SoundProvider';
import {
  MemoryPin,
  MilestoneTag,
  ChapterCluster,
  PersonCard,
  Thread,
  type BoardNode,
  type ThreadEdge,
} from './boardParts';
import { autoLayout } from './layout';

const nodeTypes = {
  memory: MemoryPin,
  character: PersonCard,
  milestone: MilestoneTag,
  period: ChapterCluster,
};
const edgeTypes = { thread: Thread };

export default function MemoryMapPage() {
  return (
    <ReactFlowProvider>
      <Board />
    </ReactFlowProvider>
  );
}

interface Filters {
  characterId: string;
  emotion: string;
  suggested: boolean;
  characters: boolean;
  ageMin: string;
  ageMax: string;
  connectionType: string;
  chapters: boolean;
}

function Board() {
  const [filters, setFilters] = useState<Filters>({
    characterId: '',
    emotion: '',
    suggested: true,
    characters: true,
    ageMin: '',
    ageMax: '',
    connectionType: '',
    chapters: false,
  });
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const {
    data: raw,
    isLoading,
    error,
    refetch,
  } = useMap({
    characterId: filters.characterId || undefined,
    emotion: filters.emotion || undefined,
    suggested: filters.suggested,
    characters: filters.characters,
    ageMin: filters.ageMin === '' ? undefined : Number(filters.ageMin),
    ageMax: filters.ageMax === '' ? undefined : Number(filters.ageMax),
  });
  const data = useMemo(() => {
    if (!raw) return raw;
    const edges = filters.connectionType
      ? raw.edges.filter((e) => e.kind !== 'connection' || e.type === filters.connectionType)
      : raw.edges;
    return filters.chapters ? clusterByChapter({ ...raw, edges }, collapsed) : { ...raw, edges };
  }, [raw, filters.connectionType, filters.chapters, collapsed]);
  const toggleChapter = (age: number) =>
    setCollapsed((list) => (list.includes(age) ? list.filter((a) => a !== age) : [...list, age]));
  const { data: connections } = useConnections();
  const { data: people } = useCharacters();
  const [listView, setListView] = useState(false);
  useScene('board');

  if (isLoading && !data) return <PaperLoading label="Pinning things to the board…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;

  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-hidden">
      <h1 className="sr-only">Memory Map</h1>
      <Toolbar
        filters={filters}
        setFilters={setFilters}
        people={people ?? []}
        listView={listView}
        setListView={setListView}
      />
      {listView ? (
        <MapList data={data} connections={connections ?? []} />
      ) : (
        <Canvas data={data} connections={connections ?? []} onChapter={toggleChapter} />
      )}
    </div>
  );
}

function Toolbar({
  filters,
  setFilters,
  people,
  listView,
  setListView,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  people: Array<{ id: string; name: string }>;
  listView: boolean;
  setListView: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidateArchive();
  const toast = useToast();

  const findConnections = async () => {
    setBusy(true);
    try {
      const found = await api.post<ConnectionDto[]>('/connections/suggest', {});
      found.forEach((_, i) => window.setTimeout(() => sound.play('pluck'), i * 260));
      toast(
        found.length
          ? `Found ${found.length} possible ${found.length === 1 ? 'thread' : 'threads'}. They're dashed until you pin them.`
          : 'No new threads right now.',
        'info',
      );
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center gap-2 glass-strong rounded-3xl p-2 shadow-lift sm:inset-x-5">
      <Button
        size="sm"
        icon={<Sparkles className="size-4" />}
        onClick={findConnections}
        disabled={busy}
        sound={false}
      >
        {busy ? 'Looking…' : 'Find connections'}
      </Button>
      <Select
        aria-label="Focus on a person"
        value={filters.characterId}
        onChange={(e) => setFilters({ ...filters, characterId: e.target.value })}
        className="h-8 w-40 py-0 text-sm"
      >
        <option value="">Everyone</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by feeling"
        value={filters.emotion}
        onChange={(e) => setFilters({ ...filters, emotion: e.target.value })}
        className="h-8 w-36 py-0 text-sm"
      >
        <option value="">Any feeling</option>
        {BASE_EMOTION_TAGS.map((t) => (
          <option key={t} value={t}>
            {emotionMeta(t).label}
          </option>
        ))}
      </Select>
      <span className="inline-flex items-center gap-1 text-sm font-semibold">
        Ages
        <TextInput
          aria-label="Youngest age"
          inputMode="numeric"
          value={filters.ageMin}
          onChange={(e) =>
            setFilters({ ...filters, ageMin: e.target.value.replace(/\D/g, '').slice(0, 3) })
          }
          placeholder="0"
          className="h-8 w-12 px-2 py-0 text-center text-sm"
        />
        to
        <TextInput
          aria-label="Oldest age"
          inputMode="numeric"
          value={filters.ageMax}
          onChange={(e) =>
            setFilters({ ...filters, ageMax: e.target.value.replace(/\D/g, '').slice(0, 3) })
          }
          placeholder="now"
          className="h-8 w-14 px-2 py-0 text-center text-sm"
        />
      </span>
      <Select
        aria-label="Filter by kind of thread"
        value={filters.connectionType}
        onChange={(e) => setFilters({ ...filters, connectionType: e.target.value })}
        className="h-8 w-44 py-0 text-sm"
      >
        <option value="">Every kind of thread</option>
        {Object.keys(CONNECTION_META).map((type) => (
          <option key={type} value={type}>
            {CONNECTION_META[type]!.glyph} {connectionLabel(type)}
          </option>
        ))}
      </Select>
      <label className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-4"
          checked={filters.suggested}
          onChange={(e) => setFilters({ ...filters, suggested: e.target.checked })}
        />
        Suggestions
      </label>
      <label className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-4"
          checked={filters.chapters}
          onChange={(e) => setFilters({ ...filters, chapters: e.target.checked })}
        />
        Chapters
      </label>
      <label className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="size-4"
          checked={filters.characters}
          onChange={(e) => setFilters({ ...filters, characters: e.target.checked })}
        />
        People
      </label>
      <button
        type="button"
        onClick={() => setListView(!listView)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-ink/6 hover:text-ink"
      >
        {listView ? <MousePointer2 className="size-4" /> : <List className="size-4" />}
        {listView ? 'Board' : 'List'}
      </button>
      <Link
        to="/connections"
        viewTransition
        className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-white/8 hover:text-ink"
      >
        All threads
      </Link>
    </div>
  );
}

function Canvas({
  data,
  connections,
  onChapter,
}: {
  data: MapDto;
  connections: ConnectionDto[];
  onChapter: (age: number) => void;
}) {
  const { play } = useSound();
  const navigate = useNavigate();
  const flow = useReactFlow();
  const [picked, setPicked] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [preview, setPreview] = useState<
    { kind: 'node'; id: string } | { kind: 'edge'; connectionId: string } | null
  >(null);
  const [connecting, setConnecting] = useState(false);

  const layout = useMemo(() => autoLayout(data.nodes), [data.nodes]);
  const initialNodes: BoardNode[] = useMemo(
    () =>
      data.nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position:
          n.x !== null && n.y !== null ? { x: n.x, y: n.y } : (layout.get(n.id) ?? { x: 0, y: 0 }),
        data: { ...n },
      })),
    [data.nodes, layout],
  );
  const initialEdges: ThreadEdge[] = useMemo(
    () =>
      data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'thread',
        zIndex: e.kind === 'connection' ? 2 : 0,
        data: {
          type: e.type,
          label: e.label,
          status: e.status,
          kind: e.kind,
          connectionId: e.connectionId,
        },
      })),
    [data.edges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ThreadEdge>(initialEdges);
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  useEffect(() => {
    setNodes((list) =>
      list.map((n) => ({ ...n, data: { ...n.data, picked: picked.includes(n.data.refId) } })),
    );
  }, [picked, setNodes]);

  const measured = useNodesInitialized();
  useEffect(() => {
    if (measured)
      void flow.fitView({
        padding: { top: 0.28, bottom: 0.18, left: 0.08, right: 0.08 },
        duration: 900,
      });
  }, [flow, measured, data.nodes.length]);

  const savePositions = useCallback((moved: BoardNode[]) => {
    const saved = moved.filter((n) => n.data.kind !== 'period');
    if (!saved.length) return;
    void api.put('/map/positions', {
      positions: saved.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
    });
  }, []);

  const connection =
    preview?.kind === 'edge' ? connections.find((c) => c.id === preview.connectionId) : null;
  const node = preview?.kind === 'node' ? data.nodes.find((n) => n.id === preview.id) : null;

  return (
    <div className="cork vignette absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={() => play('tap')}
        onNodeDragStop={(_, __, moved) => savePositions(moved as BoardNode[])}
        onNodeClick={(_, n) => {
          play('tap');
          if (n.data.kind === 'period') {
            onChapter(n.data.ageMin ?? 0);
            return;
          }
          if (n.data.kind === 'memory' && (selectMode || picked.length > 0)) {
            setPicked((list) =>
              list.includes(n.data.refId)
                ? list.filter((x) => x !== n.data.refId)
                : [...list, n.data.refId],
            );
            return;
          }
          setPreview({ kind: 'node', id: n.id });
        }}
        onEdgeClick={(_, e) => {
          const connectionId = (e.data as { connectionId?: string | null } | undefined)
            ?.connectionId;
          if (connectionId) {
            play('pluck');
            setPreview({ kind: 'edge', connectionId });
          }
        }}
        onPaneClick={() => setPreview(null)}
        minZoom={0.15}
        maxZoom={2}
        fitView
        proOptions={{ hideAttribution: false }}
        style={{ background: 'transparent' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={34}
          size={1.4}
          color="rgb(196 181 253 / 0.18)"
        />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(n) =>
            n.type === 'memory'
              ? '#e879f9'
              : n.type === 'character'
                ? '#38bdf8'
                : n.type === 'period'
                  ? '#c4b5fd'
                  : '#fbbf24'
          }
          maskColor="rgb(4 3 9 / 0.6)"
          bgColor="#0b0916"
          style={{ borderRadius: 16, overflow: 'hidden' }}
        />
      </ReactFlow>

      <div className="glass-strong absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full p-1.5 shadow-lift sm:bottom-6">
        <button
          type="button"
          aria-pressed={selectMode}
          onClick={() => {
            setSelectMode((s) => !s);
            if (selectMode) setPicked([]);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${selectMode ? 'bg-snow text-abyss shadow-[0_0_22px_-6px_var(--mood-c)]' : 'text-ink-soft hover:text-ink'}`}
        >
          <MousePointer2 className="size-4" />{' '}
          {selectMode ? `${picked.length} picked` : 'Pick memories'}
        </button>
        {picked.length >= 2 && (
          <>
            <Button
              size="sm"
              icon={<GitCompare className="size-4" />}
              onClick={() =>
                void navigate(`/compare?ids=${picked.join(',')}`, { viewTransition: true })
              }
            >
              Compare
            </Button>
            <Button
              size="sm"
              variant="soft"
              icon={<Link2 className="size-4" />}
              onClick={() => setConnecting(true)}
            >
              Connect
            </Button>
          </>
        )}
        <button
          type="button"
          title="Reset layout"
          aria-label="Reset layout"
          onClick={async () => {
            await api.delete('/map/positions');
            setNodes(initialNodes.map((n) => ({ ...n, position: layout.get(n.id) ?? n.position })));
            void flow.fitView({ padding: 0.18, duration: 700 });
          }}
          className="rounded-full p-2 text-ink-soft hover:bg-ink/6 hover:text-ink"
        >
          <RefreshCcw className="size-4" />
        </button>
      </div>

      <AnimatePresence>
        {(connection || node) && (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            className="paper absolute bottom-24 right-3 top-24 z-20 w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto rounded-3xl p-5 sm:bottom-6 sm:right-5"
          >
            <button
              type="button"
              onClick={() => setPreview(null)}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1.5 text-ink-soft hover:bg-ink/6"
            >
              <X className="size-4" />
            </button>
            {connection && <ThreadPanel connection={connection} onDone={() => setPreview(null)} />}
            {node && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                  {node.kind}
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold">{node.title}</h2>
                <p className="text-sm text-ink-soft">{node.subtitle}</p>
                {node.cover && (
                  <img
                    src={node.cover.url}
                    alt=""
                    className="mt-3 aspect-[4/3] w-full rounded-2xl object-cover"
                  />
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {node.kind === 'memory' && (
                    <>
                      <Link
                        to={`/memories/${node.refId}`}
                        viewTransition
                        className="ink-link font-semibold"
                      >
                        Open memory
                      </Link>
                      <button
                        type="button"
                        className="ink-link font-semibold"
                        onClick={() => {
                          setSelectMode(true);
                          setPicked((l) => (l.includes(node.refId) ? l : [...l, node.refId]));
                          setPreview(null);
                        }}
                      >
                        Pick for comparing
                      </button>
                    </>
                  )}
                  {node.kind === 'character' && (
                    <Link
                      to={`/people/${node.refId}`}
                      viewTransition
                      className="ink-link font-semibold"
                    >
                      Open {node.title}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {connecting && (
        <ConnectDialog
          memoryIds={picked}
          onClose={() => setConnecting(false)}
          onDone={() => setPicked([])}
        />
      )}
    </div>
  );
}

function ThreadPanel({ connection, onDone }: { connection: ConnectionDto; onDone: () => void }) {
  const meta = connectionMeta(connection.type);
  const invalidate = useInvalidateArchive();
  const { play } = useSound();
  const decide = async (status: 'confirmed' | 'dismissed') => {
    await api.patch(`/connections/${connection.id}`, { status });
    play(status === 'confirmed' ? 'pluck' : 'tap');
    invalidate();
    onDone();
  };
  return (
    <div>
      <p className="text-sm font-bold" style={{ color: meta.color }}>
        {meta.glyph} {connection.label} {connection.status === 'suggested' ? '· suggested' : ''}
      </p>
      <p className="mt-2 text-[0.97rem]">{connection.explanation}</p>
      <div className="mt-4 flex flex-col gap-3">
        {connection.endpoints.map((e) => (
          <Link
            key={e.nodeId}
            to={`/memories/${e.nodeId}`}
            viewTransition
            className="block rounded-2xl bg-cream/70 p-3 transition hover:bg-cream"
          >
            <span className="block font-display font-semibold">{e.title}</span>
            {e.ageLabel && (
              <span className="block text-xs font-bold text-ink-soft">{e.ageLabel}</span>
            )}
            {e.evidence && (
              <span className="mt-1 block text-sm italic text-ink-soft">“{e.evidence.quote}”</span>
            )}
          </Link>
        ))}
      </div>
      {connection.status === 'suggested' ? (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            icon={<Check className="size-4" />}
            onClick={() => void decide('confirmed')}
            sound={false}
          >
            Pin it
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void decide('dismissed')} sound={false}>
            Not really
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void decide('dismissed')}
          className="mt-4 text-sm font-semibold text-ink-soft hover:text-rose-deep"
        >
          Unpin this thread
        </button>
      )}
    </div>
  );
}

export function ConnectDialog({
  memoryIds,
  onClose,
  onDone,
}: {
  memoryIds: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const { data: types } = useConnectionTypes();
  const [type, setType] = useState('full_circle');
  const [explanation, setExplanation] = useState('');
  const [note, setNote] = useState('');
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const hint = types?.find((t) => t.id === type)?.hint;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Connect these memories"
      description="Say what links them, in your own words. It'll show as a thread on your board."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!explanation.trim()}
            sound="pluck"
            onClick={async () => {
              await api.post('/connections', {
                type,
                memoryIds,
                explanation: explanation.trim(),
                note: note.trim() || null,
                status: 'confirmed',
              });
              invalidate();
              toast('Thread pinned.');
              onDone?.();
              onClose();
            }}
          >
            Pin the thread
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Kind of connection</span>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <optgroup label="Common">
              {types
                ?.filter((t) => t.group === 'core')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="More">
              {types
                ?.filter((t) => t.group === 'more')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
          </Select>
          {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">What connects them?</span>
          <TextArea
            rows={3}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="At nine I ate alone. At sixteen I made sure someone else didn't have to."
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">A note for yourself (optional)</span>
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}

function MapList({ data, connections }: { data: MapDto; connections: ConnectionDto[] }) {
  const [onlyPinned, setOnlyPinned] = useState(false);
  const shown = connections.filter((c) => (onlyPinned ? c.status === 'confirmed' : true));
  return (
    <div className="cork absolute inset-0 overflow-y-auto px-4 pb-28 pt-24 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Toggle checked={onlyPinned} onChange={setOnlyPinned} label="Only pinned threads" />
        <ul className="mt-4 flex flex-col gap-4">
          {shown.map((c) => {
            const meta = connectionMeta(c.type);
            return (
              <li
                key={c.id}
                className="paper rounded-3xl border-l-[6px] p-5"
                style={{
                  borderLeftColor: meta.color,
                  borderLeftStyle: c.status === 'suggested' ? 'dashed' : 'solid',
                }}
              >
                <p className="text-sm font-bold" style={{ color: meta.color }}>
                  {meta.glyph} {c.label} {c.status === 'suggested' && '· suggested'}
                </p>
                <p className="mt-1">{c.explanation}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.endpoints.map((e) => (
                    <Link
                      key={e.nodeId}
                      to={`/memories/${e.nodeId}`}
                      viewTransition
                      className="rounded-full bg-cream px-3 py-1 text-sm font-semibold hover:bg-linen"
                    >
                      {e.title}
                    </Link>
                  ))}
                </div>
              </li>
            );
          })}
          {!shown.length && (
            <li className="paper rounded-3xl p-6 text-center text-ink-soft">
              No threads yet. Try “Find connections”.
            </li>
          )}
        </ul>
        <h2 className="mt-10 text-xl font-semibold">Everything on the board</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.nodes
            .filter((n) => n.kind === 'memory')
            .map((n) => (
              <li key={n.id}>
                <Link
                  to={`/memories/${n.refId}`}
                  viewTransition
                  className="paper block rounded-2xl p-3"
                >
                  <span className="block font-semibold">{n.title}</span>
                  <CertaintyMark
                    temporal={{
                      certainty: 'certain',
                      label: n.subtitle,
                      placedAges: [],
                      explanation: '',
                    }}
                    compact
                  />
                </Link>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function clusterByChapter(data: MapDto, collapsed: number[]): MapDto {
  const memories = data.nodes.filter((n) => n.kind === 'memory' && n.ageMin !== null);
  const ages = [...new Set(memories.map((n) => n.ageMin!))].sort((a, b) => a - b);
  const hidden = new Map<string, string>();
  const periods: Array<MapDto['nodes'][number] & { collapsed: boolean }> = ages.map((age) => {
    const members = memories.filter((n) => n.ageMin === age);
    const id = `period:${age}`;
    if (collapsed.includes(age)) for (const m of members) hidden.set(m.id, id);
    return {
      id,
      kind: 'period',
      refId: String(age),
      title: chapterTitle(age),
      subtitle: `${members.length}`,
      ageMin: age,
      cover: null,
      emotions: members.flatMap((m) => m.emotions).slice(0, 1),
      x: null,
      y: null,
      collapsed: collapsed.includes(age),
    };
  });
  const seen = new Set<string>();
  const edges: MapDto['edges'] = [];
  for (const edge of data.edges) {
    const source = hidden.get(edge.source) ?? edge.source;
    const target = hidden.get(edge.target) ?? edge.target;
    if (source === target) continue;
    const key = `${source}|${target}|${edge.kind}|${edge.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      ...edge,
      id: hidden.has(edge.source) || hidden.has(edge.target) ? `${edge.id}:${key}` : edge.id,
      source,
      target,
    });
  }
  for (const node of memories) {
    if (hidden.has(node.id)) continue;
    edges.push({
      id: `period-edge:${node.id}`,
      source: `period:${node.ageMin}`,
      target: node.id,
      kind: 'period',
      connectionId: null,
      type: 'chronology',
      label: '',
      status: 'confirmed',
    });
  }
  return { ...data, nodes: [...data.nodes.filter((n) => !hidden.has(n.id)), ...periods], edges };
}
