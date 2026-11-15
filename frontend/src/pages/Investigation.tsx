import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../api/client';
import type { GraphData, Indicator } from '../types';
import { DetailDrawer } from '../components/DetailDrawer';
import { colorToken } from '../lib/theme';

const nodeTypes = ['ipv4', 'domain', 'url', 'md5', 'sha1', 'sha256'];
const colors = {
  bg: colorToken('--color-bg'),
  text: colorToken('--color-text'),
  secondary: colorToken('--color-text-secondary'),
  accent: colorToken('--color-accent'),
  malicious: colorToken('--color-malicious'),
  bar: colorToken('--color-bar'),
};

export function Investigation() {
  const rootId = Number(useParams().id);
  const graphRef = useRef<any>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['graph', rootId],
    queryFn: () => api.graph(rootId),
  });
  const [extra, setExtra] = useState<GraphData>({ nodes: [], edges: [], truncated: false });
  const [selected, setSelected] = useState<number[]>([rootId]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [drawer, setDrawer] = useState<number | null>(rootId);
  const [types, setTypes] = useState(new Set(nodeTypes));
  const [path, setPath] = useState(new Set<number>());

  const merged = useMemo(() => {
    const nodes = new Map<number, Indicator>();
    [...(data?.nodes ?? []), ...extra.nodes].forEach((node) => nodes.set(node.id, node));
    const edges = new Map<number, GraphData['edges'][number]>();
    [...(data?.edges ?? []), ...extra.edges].forEach((edge) => edges.set(edge.id, edge));
    const visibleNodes = [...nodes.values()].filter((node) => types.has(node.type)).slice(0, 250);
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    return {
      nodes: visibleNodes,
      links: [...edges.values()].filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
      ),
    };
  }, [data, extra, types]);

  async function selectNode(node: any) {
    setDrawer(node.id);
    const next = [...selected, node.id].slice(-2);
    setSelected(next);
    if (next.length === 2) {
      try {
        const result = await api.path(next[0], next[1]);
        setPath(new Set(result.nodes));
      } catch {
        setPath(new Set());
      }
    }
    const expanded = await api.expand(node.id);
    setExtra((current) => ({
      nodes: [...current.nodes, ...expanded.nodes],
      edges: [...current.edges, ...expanded.edges],
      truncated: current.truncated || expanded.truncated,
    }));
  }

  function paintNode(node: any, context: CanvasRenderingContext2D, scale: number) {
    const size = node.id === rootId ? 6 : 4;
    const isSelected = selected.includes(node.id) || path.has(node.id);
    context.beginPath();
    if (node.type === 'url') {
      context.rect(node.x - size, node.y - size, size * 2, size * 2);
    } else if (node.type === 'domain') {
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 3) * index - Math.PI / 2;
        const x = node.x + Math.cos(angle) * size;
        const y = node.y + Math.sin(angle) * size;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
    } else if (node.type.includes('sha') || node.type === 'md5') {
      context.moveTo(node.x, node.y - size);
      context.lineTo(node.x + size, node.y);
      context.lineTo(node.x, node.y + size);
      context.lineTo(node.x - size, node.y);
      context.closePath();
    } else {
      context.arc(node.x, node.y, size, 0, Math.PI * 2);
    }
    context.fillStyle = colors.secondary;
    context.fill();
    context.lineWidth = isSelected ? 1.5 : 1;
    context.strokeStyle = isSelected
      ? colors.accent
      : node.verdict === 'malicious'
        ? colors.malicious
        : colors.secondary;
    context.stroke();

    if (hovered === node.id || isSelected) {
      context.font = `${10 / scale}px JetBrains Mono`;
      context.fillStyle = colors.text;
      context.fillText(node.value.slice(0, 36), node.x + 8, node.y + 3);
    }
  }

  function toggleType(type: string) {
    const next = new Set(types);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setTypes(next);
  }

  return (
    <main className="h-[calc(100vh-28px)] relative overflow-hidden">
      <header className="h-12 border-b border-line px-3 flex items-center gap-4">
        <h1 className="section-label mb-0">relationship graph / {rootId}</h1>
        <div className="h-4 border-l border-line" />
        {nodeTypes.map((type) => (
          <label key={type} className="flex items-center gap-1.5 text-[11px] text-secondary">
            <input type="checkbox" checked={types.has(type)} onChange={() => toggleType(type)} />
            {type}
          </label>
        ))}
        <div className="ml-auto flex gap-2">
          <button className="action" onClick={() => graphRef.current?.zoomToFit(100, 40)}>
            fit
          </button>
          <button
            className="action"
            onClick={() => {
              setExtra({ nodes: [], edges: [], truncated: false });
              setPath(new Set());
              setSelected([rootId]);
            }}
          >
            reset
          </button>
        </div>
      </header>

      <div className="absolute left-3 bottom-3 z-20 text-[11px] text-secondary">
        {merged.nodes.length}/250 nodes · select two nodes for shortest path
      </div>

      {isLoading ? (
        <State text="loading graph..." />
      ) : error ? (
        <State text="graph unavailable" />
      ) : merged.nodes.length === 0 ? (
        <State text="no relationships" />
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={merged}
          backgroundColor={colors.bg}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node: any, color, context) => {
            context.fillStyle = color;
            context.beginPath();
            context.arc(node.x, node.y, 8, 0, 2 * Math.PI);
            context.fill();
          }}
          onNodeHover={(node: any) => setHovered(node?.id ?? null)}
          onNodeClick={selectNode}
          linkColor={() => colors.bar}
          linkWidth={() => 1}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link: any, context, scale) => {
            if (hovered !== link.source.id && hovered !== link.target.id) return;
            const x = (link.source.x + link.target.x) / 2;
            const y = (link.source.y + link.target.y) / 2;
            context.font = `${10 / scale}px JetBrains Mono`;
            context.fillStyle = colors.secondary;
            context.fillText(link.type, x, y);
          }}
          cooldownTicks={60}
        />
      )}

      <DetailDrawer
        id={drawer}
        onClose={() => setDrawer(null)}
        onPivot={(nodes) =>
          setExtra((current) => ({ ...current, nodes: [...current.nodes, ...nodes] }))
        }
      />
    </main>
  );
}

function State({ text }: { text: string }) {
  return <div className="h-full p-4 text-secondary">{text}</div>;
}
