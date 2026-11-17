import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  const stageRef = useRef<HTMLDivElement>(null);
  const fitPending = useRef(true);
  const settled = useRef(false);
  const positions = useRef(new Map<number, any>());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pathEdges, setPathEdges] = useState(new Set<number>());
  const [message, setMessage] = useState('');
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      }),
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
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

  useEffect(() => {
    positions.current.clear();
    setMessage('');
    setPathEdges(new Set());
    fitPending.current = true;
    setExtra({ nodes: [], edges: [], truncated: false });
    setSelected([rootId]);
    setPath(new Set());
    setDrawer(rootId);
  }, [rootId]);

  const merged = useMemo(() => {
    const nodes = new Map<number, Indicator>();
    [...(data?.nodes ?? []), ...extra.nodes].forEach((node) => nodes.set(node.id, node));
    const edges = new Map<number, GraphData['edges'][number]>();
    [...(data?.edges ?? []), ...extra.edges].forEach((edge) => {
      const source = typeof edge.source === 'object' ? (edge.source as Indicator).id : edge.source;
      const target = typeof edge.target === 'object' ? (edge.target as Indicator).id : edge.target;
      edges.set(edge.id, { ...edge, source, target });
    });
    const visibleNodes = [...nodes.values()]
      .filter((node) => types.has(node.type))
      .slice(0, 250)
      .map((node, index) => {
        let positioned = positions.current.get(node.id);
        if (!positioned) {
          const angle = index * 2.39996;
          positioned = {
            ...node,
            x: node.id === rootId ? 0 : Math.cos(angle) * (35 + Math.sqrt(index) * 12),
            y: node.id === rootId ? 0 : Math.sin(angle) * (35 + Math.sqrt(index) * 12),
          };
          positions.current.set(node.id, positioned);
        }
        if (node.id === rootId) {
          positioned.fx = 0;
          positioned.fy = 0;
        }
        return positioned;
      });
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    return {
      nodes: visibleNodes,
      links: [...edges.values()]
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => ({ ...edge })),
    };
  }, [data, extra, types, rootId]);
  useEffect(() => {
    fitPending.current = true;
    settled.current = false;
  }, [merged]);
  useEffect(() => {
    fitPending.current = true;
    if (settled.current) fitGraph();
    // Canvas dimensions also change when the evidence panel is opened or closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  async function selectNode(node: any) {
    setDrawer(node.id);
    const next = [...selected, node.id].slice(-2);
    setSelected(next);
    if (next.length === 2 && next[0] !== next[1]) {
      setMessage('finding stored path…');
      try {
        const result = await api.path(next[0], next[1]);
        setPath(new Set(result.nodes));
        setPathEdges(new Set(result.edges.map((edge) => edge.id)));
        setMessage(`${result.edges.length} hops in the stored path`);
      } catch {
        setPath(new Set());
        setPathEdges(new Set());
        setMessage('No path found in the bounded neighbourhood');
      }
    }
    try {
      const expanded = await api.expand(node.id);
      setExtra((current) => ({
        nodes: [...current.nodes, ...expanded.nodes],
        edges: [...current.edges, ...expanded.edges],
        truncated: current.truncated || expanded.truncated,
      }));
    } catch {
      // Detail remains useful even when a neighbour request fails.
    }
  }

  function paintNode(node: any, context: CanvasRenderingContext2D, scale: number) {
    const size = node.id === rootId ? 7 : 4;
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

  function fitGraph() {
    if (!graphRef.current) return;
    fitPending.current = false;
    if (merged.nodes.length <= 1) {
      const node = merged.nodes[0] as Indicator & { x?: number; y?: number };
      graphRef.current.centerAt(node?.x ?? 0, node?.y ?? 0, 100);
      graphRef.current.zoom(4, 100);
      return;
    }
    graphRef.current.zoomToFit(100, 56);
  }

  return (
    <main className="graph-page">
      <header className="graph-toolbar">
        <h1 className="section-label mb-0 graph-title">
          <Link to="/graph">graph</Link> /{' '}
          {data?.nodes.find((node) => node.id === rootId)?.value ?? rootId}
        </h1>
        <div className="h-4 border-l border-line" />
        {nodeTypes.map((type) => (
          <label key={type} className="flex items-center gap-1.5 text-[11px] text-secondary">
            <input type="checkbox" checked={types.has(type)} onChange={() => toggleType(type)} />
            {type}
          </label>
        ))}
        <div className="ml-auto flex gap-2">
          <button className="action" onClick={fitGraph}>
            fit
          </button>
          <button
            className="action"
            onClick={() => {
              setExtra({ nodes: [], edges: [], truncated: false });
              setPath(new Set());
              setPathEdges(new Set());
              setMessage('');
              fitPending.current = true;
              setSelected([rootId]);
              setDrawer(rootId);
            }}
          >
            reset
          </button>
        </div>
      </header>

      <div className="graph-instructions">
        <b>click node</b> open evidence + load neighbours <span>·</span> <b>click another</b>{' '}
        shortest path <span>·</span> <b>hover</b> show IOC and edge type
      </div>

      <div className="graph-workspace">
        <div className="graph-stage" ref={stageRef}>
          <div className="graph-status">
            {merged.nodes.length}/250 nodes · {merged.links.length} explicit relationships ·
            selected {selected.join(' → ')}
            {(data?.truncated || extra.truncated || merged.nodes.length === 250) && (
              <span> · neighbourhood capped; expand a node to explore</span>
            )}
            {message && <span className="graph-path-message">{message}</span>}
          </div>

          {!isLoading && !error && merged.nodes.length === 1 && merged.links.length === 0 ? (
            <div className="graph-empty-note">
              no explicit relationships stored for this IOC
              <span>
                Open a family, tag, or source dataset in the evidence drawer to continue by
                metadata.
              </span>
            </div>
          ) : null}

          {isLoading ? (
            <State text="loading graph..." />
          ) : error ? (
            <State text="graph unavailable" />
          ) : merged.nodes.length === 0 ? (
            <State text="no relationships" />
          ) : size.width > 0 && size.height > 0 ? (
            <ForceGraph2D
              ref={graphRef}
              graphData={merged}
              width={size.width}
              height={size.height}
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
              linkColor={(link: any) =>
                pathEdges.has(link.id)
                  ? colors.accent
                  : hovered === link.source.id || hovered === link.target.id
                    ? colors.secondary
                    : colors.bar
              }
              linkWidth={(link: any) => (pathEdges.has(link.id) ? 1.5 : 1)}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={0.9}
              linkCanvasObjectMode={() => 'after'}
              linkCanvasObject={(link: any, context, scale) => {
                if (hovered !== link.source.id && hovered !== link.target.id) return;
                const x = (link.source.x + link.target.x) / 2;
                const y = (link.source.y + link.target.y) / 2;
                context.font = `${10 / scale}px JetBrains Mono`;
                context.fillStyle = colors.secondary;
                context.fillText(link.type, x, y);
              }}
              warmupTicks={80}
              cooldownTicks={60}
              maxZoom={8}
              onEngineStop={() => {
                settled.current = true;
                if (fitPending.current) fitGraph();
              }}
            />
          ) : null}
        </div>
        <DetailDrawer id={drawer} onClose={() => setDrawer(null)} embedded />
      </div>
    </main>
  );
}

function State({ text }: { text: string }) {
  return <div className="h-full p-4 text-secondary">{text}</div>;
}
