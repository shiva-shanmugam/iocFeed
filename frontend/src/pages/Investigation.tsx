import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../api/client';
import type { GraphData, Indicator } from '../types';
import { DetailDrawer } from '../components/DetailDrawer';
const colors: Record<string, string> = {
  ipv4: '#21d4fd',
  domain: '#9c7cff',
  url: '#ffb020',
  md5: '#8b9aaa',
  sha1: '#8b9aaa',
  sha256: '#8b9aaa',
};
export function Investigation() {
  const id = Number(useParams().id);
  const graphRef = useRef<any>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['graph', id],
    queryFn: () => api.graph(id),
  });
  const [extra, setExtra] = useState<GraphData>({ nodes: [], edges: [], truncated: false });
  const [selected, setSelected] = useState<number[]>([]);
  const [drawer, setDrawer] = useState<number | null>(id);
  const [types, setTypes] = useState(new Set(Object.keys(colors)));
  const [path, setPath] = useState(new Set<number>());
  const merged = useMemo(() => {
    const nodes = new Map<number, Indicator>();
    [...(data?.nodes ?? []), ...extra.nodes].forEach((n) => nodes.set(n.id, n));
    const edges = new Map<number, GraphData['edges'][number]>();
    [...(data?.edges ?? []), ...extra.edges].forEach((e) => edges.set(e.id, e));
    return {
      nodes: [...nodes.values()].filter((n) => types.has(n.type)).slice(0, 250),
      links: [...edges.values()],
    };
  }, [data, extra, types]);
  async function click(node: any) {
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
    setExtra((old) => ({
      nodes: [...old.nodes, ...expanded.nodes],
      edges: [...old.edges, ...expanded.edges],
      truncated: old.truncated || expanded.truncated,
    }));
  }
  function canvas(node: any, ctx: CanvasRenderingContext2D, scale: number) {
    const color = path.has(node.id) ? '#fff' : (colors[node.type] ?? '#ff2e88');
    const size = node.id === id ? 7 : 5;
    ctx.beginPath();
    if (node.type === 'url') ctx.rect(node.x - size, node.y - size, size * 2, size * 2);
    else if (node.type.includes('sha') || node.type === 'md5') {
      ctx.moveTo(node.x, node.y - size);
      ctx.lineTo(node.x + size, node.y);
      ctx.lineTo(node.x, node.y + size);
      ctx.lineTo(node.x - size, node.y);
      ctx.closePath();
    } else {
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
    }
    ctx.fillStyle = color;
    ctx.shadowColor = node.verdict === 'malicious' ? '#ff2e88' : color;
    ctx.shadowBlur = node.verdict === 'malicious' ? 14 : 5;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (scale > 1.4) {
      ctx.fillStyle = '#dbe7f3';
      ctx.font = `${10 / scale}px JetBrains Mono`;
      ctx.fillText(node.value.slice(0, 28), node.x + 8, node.y + 3);
    }
  }
  function toggle(t: string) {
    const n = new Set(types);
    if (n.has(t)) n.delete(t);
    else n.add(t);
    setTypes(n);
  }
  return (
    <main className="h-[calc(100vh-5.5rem)] relative overflow-hidden">
      <div className="absolute left-5 top-5 z-20 bg-panel/95 border border-slate-800 p-4 w-52">
        <p className="text-[10px] tracking-widest text-cyan mb-3">GRAPH FILTERS</p>
        {Object.keys(colors).map((t) => (
          <label key={t} className="flex gap-2 text-xs uppercase py-1">
            <input type="checkbox" checked={types.has(t)} onChange={() => toggle(t)} />
            {t}
          </label>
        ))}
        <div className="flex gap-2 mt-4">
          <button className="action" onClick={() => graphRef.current?.zoomToFit(500, 50)}>
            FIT
          </button>
          <button
            className="action"
            onClick={() => {
              setExtra({ nodes: [], edges: [], truncated: false });
              setPath(new Set());
            }}
          >
            RESET
          </button>
        </div>
      </div>
      <div className="absolute left-5 bottom-5 z-20 text-[10px] text-slate-500">
        {merged.nodes.length}/250 NODES // CLICK 2 NODES FOR SHORTEST PATH
      </div>
      {isLoading ? (
        <State text="Mapping relationships…" />
      ) : error ? (
        <State text="Graph unavailable." />
      ) : merged.nodes.length === 0 ? (
        <State text="No relationships found." />
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={merged}
          backgroundColor="#0a0e14"
          nodeCanvasObject={canvas}
          nodePointerAreaPaint={(n: any, c, ctx) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 9, 0, 2 * Math.PI);
            ctx.fill();
          }}
          onNodeClick={click}
          linkColor={(l: any) =>
            path.has(Number(l.source?.id ?? l.source)) && path.has(Number(l.target?.id ?? l.target))
              ? '#fff'
              : '#34404d'
          }
          linkDirectionalParticles={(l) =>
            path.has(Number((l as any).source?.id ?? (l as any).source)) ? 2 : 0
          }
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(l: any, ctx, scale) => {
            const x = (l.source.x + l.target.x) / 2,
              y = (l.source.y + l.target.y) / 2;
            ctx.font = `${8 / scale}px sans-serif`;
            ctx.fillStyle = '#64748b';
            ctx.fillText(l.type, x, y);
          }}
          cooldownTicks={80}
        />
      )}
      <DetailDrawer
        id={drawer}
        onClose={() => setDrawer(null)}
        onPivot={(nodes) => setExtra((old) => ({ ...old, nodes: [...old.nodes, ...nodes] }))}
      />
    </main>
  );
}
function State({ text }: { text: string }) {
  return <div className="h-full grid place-items-center text-slate-500">{text}</div>;
}
