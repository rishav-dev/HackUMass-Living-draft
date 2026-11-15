import type { ConnectionDto, MemoryCardDto } from '@living-draft/contracts';
import type { Mesh, MeshBasicMaterial, Points, Sprite, SpriteMaterial, Texture } from 'three';

type Three = typeof import('three');
type SpriteTextClass = typeof import('three-spritetext').default;
type SpriteTextInstance = InstanceType<SpriteTextClass>;

export interface GraphNode {
  id: string;
  title: string;
  color: string;
  radius: number;
  linked: boolean;
  memory: MemoryCardDto;
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  connection: ConnectionDto;
  color: string;
  curve: number;
}

export interface NodeParts {
  node: GraphNode;
  core: Mesh;
  halo: Sprite;
  label: SpriteTextInstance;
}

type Focus =
  { kind: 'memory'; memory: MemoryCardDto } | { kind: 'link'; connection: ConnectionDto };

interface AttachedGraph {
  scene: () => { add: (o: unknown) => void; remove: (o: unknown) => void };
  graphData: () => { nodes: GraphNode[]; links: GraphLink[] };
  linkColor: ((fn?: unknown) => unknown) & (() => unknown);
  linkWidth: ((fn?: unknown) => unknown) & (() => unknown);
  linkDirectionalParticleWidth: ((fn?: unknown) => unknown) & (() => unknown);
}

const BACKDROP = '#0b0910';

export function mix(color: string, toward: string, amount: number): string {
  const parse = (hex: string) => {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const a = parse(color);
  const b = parse(toward);
  return `#${a
    .map((v, i) => Math.round(v + (b[i]! - v) * amount))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

function glowTexture(THREE: Three): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function starfield(THREE: Three): Points {
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const u = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const r = 900 + Math.random() * 900;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = Math.cos(angle) * s * r;
    positions[i * 3 + 1] = u * r;
    positions[i * 3 + 2] = Math.sin(angle) * s * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#d8d0f0',
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

const endId = (end: string | GraphNode) => (typeof end === 'string' ? end : end.id);

export function threadStyle(THREE: Three, SpriteText: SpriteTextClass) {
  const glow = glowTexture(THREE);
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const parts = new Map<string, NodeParts>();
  const litNodes = new Set<string>();
  const litLinks = new Set<string>();
  let showAll = false;
  let graph: AttachedGraph | null = null;
  let stars: Points | null = null;

  const isLit = (link: GraphLink) => litLinks.has(link.id);
  const anyLit = () => litLinks.size > 0 || litNodes.size > 0;

  const paintNode = (p: NodeParts) => {
    const lit = litNodes.has(p.node.id);
    const dim = anyLit() && !lit;
    const core = p.core.material as MeshBasicMaterial;
    const halo = p.halo.material as SpriteMaterial;
    core.opacity = dim ? 0.22 : p.node.linked || lit ? 1 : 0.6;
    halo.opacity = dim ? 0.08 : lit ? 0.95 : p.node.linked ? 0.55 : 0.25;
    const grow = lit ? 1.25 : 1;
    p.core.scale.setScalar(p.node.radius * grow);
    p.halo.scale.setScalar(p.node.radius * (lit ? 9 : 6.5));
    p.label.visible = lit || (!dim && (showAll || p.node.linked));
    (p.label.material as SpriteMaterial).opacity = dim ? 0.3 : 1;
  };

  const restyleLinks = () => {
    if (!graph) return;
    graph.linkColor(graph.linkColor());
    graph.linkWidth(graph.linkWidth());
    graph.linkDirectionalParticleWidth(graph.linkDirectionalParticleWidth());
  };

  return {
    buildNode(node: GraphNode) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        sphere,
        new THREE.MeshBasicMaterial({ color: mix(node.color, '#ffffff', 0.15), transparent: true }),
      );
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: node.color,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const title = node.title.length > 28 ? `${node.title.slice(0, 26).trimEnd()}…` : node.title;
      const label = new SpriteText(title, 11, '#ece4d8');
      label.fontFace = 'Inter Variable, Segoe UI, system-ui, sans-serif';
      label.fontWeight = '600';
      label.strokeWidth = 0.6;
      label.strokeColor = BACKDROP;
      label.position.y = -(node.radius * 1.25 + 9);
      (label.material as SpriteMaterial).depthWrite = false;
      halo.raycast = () => undefined;
      label.raycast = () => undefined;
      group.add(halo, core, label);
      const entry = { node, core, halo, label };
      parts.set(node.id, entry);
      paintNode(entry);
      return group;
    },
    linkColor(link: GraphLink) {
      const base =
        link.connection.status === 'confirmed' ? link.color : mix(link.color, BACKDROP, 0.35);
      if (!anyLit()) return base;
      return isLit(link) ? mix(link.color, '#ffffff', 0.2) : mix(link.color, BACKDROP, 0.82);
    },
    linkWidth(link: GraphLink) {
      if (isLit(link)) return 3.4;
      return link.connection.status === 'confirmed' ? 1.8 : 0.9;
    },
    particleWidth(link: GraphLink) {
      if (anyLit() && !isLit(link)) return 0;
      return isLit(link) ? 3.2 : 2.2;
    },
    light(focus: Focus | null) {
      litNodes.clear();
      litLinks.clear();
      if (focus && graph) {
        for (const link of graph.graphData().links) {
          const a = endId(link.source);
          const b = endId(link.target);
          const hit =
            focus.kind === 'link'
              ? link.connection.id === focus.connection.id
              : a === focus.memory.id || b === focus.memory.id;
          if (hit) {
            litLinks.add(link.id);
            litNodes.add(a);
            litNodes.add(b);
          }
        }
        if (focus.kind === 'memory') litNodes.add(focus.memory.id);
      }
      for (const p of parts.values()) paintNode(p);
      restyleLinks();
    },
    reset(all: boolean) {
      showAll = all;
      parts.clear();
      litNodes.clear();
      litLinks.clear();
    },
    attach(target: AttachedGraph) {
      graph = target;
      stars = starfield(THREE);
      target.scene().add(stars);
    },
    dispose() {
      if (stars && graph) graph.scene().remove(stars);
      stars?.geometry.dispose();
      glow.dispose();
      sphere.dispose();
      parts.clear();
    },
  };
}
