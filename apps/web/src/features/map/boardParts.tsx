import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  type EdgeProps,
  type Node,
  type NodeProps,
  type Edge,
} from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { MapNodeDto } from '@living-draft/contracts';
import { connectionMeta, emotionMeta, initials, tintFor } from '../../lib/meta';

export type BoardNodeData = MapNodeDto & {
  picked?: boolean;
  dimmed?: boolean;
  collapsed?: boolean;
  count?: number;
} & Record<string, unknown>;
export type BoardNode = Node<BoardNodeData>;
export type ThreadData = {
  type: string;
  label: string;
  status: string;
  kind: string;
  highlighted?: boolean;
  connectionId?: string | null;
};
export type ThreadEdge = Edge<ThreadData>;

const hidden = {
  opacity: 0,
  top: '50%',
  left: '50%',
  width: 1,
  height: 1,
  border: 0,
  minWidth: 0,
  minHeight: 0,
};

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={hidden} isConnectable={false} />
      <Handle type="source" position={Position.Top} style={hidden} isConnectable={false} />
    </>
  );
}

function glowFor(data: BoardNodeData): string {
  return data.emotions[0] ? emotionMeta(data.emotions[0]).ink : '#c4b5fd';
}

export const MemoryPin = memo(function MemoryPin({ data, selected }: NodeProps<BoardNode>) {
  const glow = glowFor(data);
  const lit = selected || data.picked;
  return (
    <div
      className={`relative w-[190px] overflow-hidden rounded-2xl border bg-abyss/88 transition-[box-shadow,opacity] duration-300 ${data.dimmed ? 'opacity-30' : ''}`}
      style={{
        borderColor: lit ? glow : 'rgb(255 255 255 / 0.12)',
        boxShadow: lit
          ? `0 0 0 2px ${glow}, 0 0 46px -6px ${glow}`
          : `0 0 34px -14px ${glow}, 0 18px 30px -18px rgb(0 0 0 / 0.9)`,
      }}
    >
      <Handles />
      {data.cover ? (
        <img
          src={data.cover.url}
          alt=""
          className="aspect-[4/3] w-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="flex aspect-[4/3] w-full items-end p-3"
          style={{
            background: `radial-gradient(circle at 30% 25%, ${glow}55, transparent 60%), radial-gradient(circle at 80% 90%, ${glow}30, transparent 55%), #0b0916`,
          }}
        >
          <span
            className="size-3 rounded-full"
            style={{ background: glow, boxShadow: `0 0 14px ${glow}` }}
            aria-hidden="true"
          />
        </div>
      )}
      <div className="px-3 pb-3 pt-2">
        <p className="font-display text-[0.95rem] font-semibold leading-tight text-snow">
          {data.title}
        </p>
        <p className="text-[0.7rem] font-semibold text-ink-soft">{data.subtitle}</p>
      </div>
    </div>
  );
});

export const PersonCard = memo(function PersonCard({ data, selected }: NodeProps<BoardNode>) {
  const tint = tintFor(data.title);
  return (
    <div
      className={`relative flex w-[160px] items-center gap-2 rounded-full border border-white/12 bg-abyss/88 py-1.5 pl-1.5 pr-3 transition-opacity ${data.dimmed ? 'opacity-30' : ''}`}
      style={{
        boxShadow: selected ? `0 0 0 2px ${tint}, 0 0 30px -6px ${tint}` : `0 0 26px -12px ${tint}`,
      }}
    >
      <Handles />
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold text-abyss"
        style={{ background: tint, boxShadow: `0 0 14px -2px ${tint}` }}
      >
        {initials(data.title)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-snow">{data.title}</span>
        <span className="block truncate text-[0.68rem] text-ink-soft">{data.subtitle}</span>
      </span>
    </div>
  );
});

export const MilestoneTag = memo(function MilestoneTag({ data }: NodeProps<BoardNode>) {
  return (
    <div
      className={`relative rounded-full border border-gold/50 bg-abyss/88 py-1.5 pl-3 pr-4 text-sm font-bold text-gold-deep shadow-[0_0_24px_-6px_var(--color-gold)] ${data.dimmed ? 'opacity-30' : ''}`}
    >
      <Handles />⚑ {data.title}
      <span className="ml-2 text-xs font-semibold text-ink-soft">{data.subtitle}</span>
    </div>
  );
});

export const ChapterCluster = memo(function ChapterCluster({ data }: NodeProps<BoardNode>) {
  const glow = glowFor(data);
  return (
    <div
      className="relative flex items-center gap-2 rounded-full border bg-abyss/90 py-2 pl-2 pr-4"
      style={{ borderColor: `${glow}88`, boxShadow: `0 0 30px -8px ${glow}` }}
      title={data.collapsed ? 'Open this chapter' : 'Fold this chapter'}
    >
      <Handles />
      <span
        className="flex size-9 items-center justify-center rounded-full font-display text-sm font-bold text-abyss"
        style={{ background: `radial-gradient(circle at 35% 30%, #fff, ${glow} 55%)` }}
      >
        {data.ageMin}
      </span>
      <span className="text-sm font-bold text-snow">{data.title}</span>
      <span className="text-xs font-semibold text-ink-soft">{data.subtitle}</span>
      {data.collapsed ? (
        <ChevronRight className="size-4 text-ink-soft" />
      ) : (
        <ChevronDown className="size-4 text-ink-soft" />
      )}
    </div>
  );
});

export function Thread({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps<ThreadEdge>) {
  const meta = connectionMeta(data?.type ?? 'connection');
  const distance = Math.hypot(targetX - sourceX, targetY - sourceY);
  const cx = (sourceX + targetX) / 2;
  const cy = (sourceY + targetY) / 2 + Math.min(120, distance * 0.14);
  const path = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;
  const labelX = 0.25 * sourceX + 0.5 * cx + 0.25 * targetX;
  const labelY = 0.25 * sourceY + 0.5 * cy + 0.25 * targetY;
  const suggested = data?.status === 'suggested';
  const isConnection = data?.kind === 'connection';
  const width = isConnection ? (selected || data?.highlighted ? 4 : 2.5) : 1.2;

  return (
    <>
      {isConnection && (
        <path
          d={path}
          fill="none"
          stroke={meta.color}
          strokeWidth={width + 8}
          opacity={selected || data?.highlighted ? 0.28 : 0.12}
          style={{ filter: 'blur(4px)' }}
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={22}
        style={{
          stroke: meta.color,
          strokeWidth: width,
          strokeDasharray: suggested ? '6 7' : meta.dash === '0' ? undefined : meta.dash,
          opacity: isConnection ? (suggested ? 0.6 : 0.95) : 0.35,
          strokeLinecap: 'round',
        }}
      />
      {isConnection && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: suggested ? 'rgb(8 6 18 / 0.85)' : `${meta.color}33`,
              color: meta.color,
              border: `1px ${suggested ? 'dashed' : 'solid'} ${meta.color}`,
              boxShadow: suggested ? undefined : `0 0 16px -4px ${meta.color}`,
            }}
          >
            {meta.glyph} {data?.label}
            {suggested ? '?' : ''}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
