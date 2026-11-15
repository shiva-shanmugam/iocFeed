import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import worldData from 'world-atlas/countries-110m.json';
import { api } from '../api/client';
import { Header, Panel } from './Dashboard';

interface GeoPoint {
  id: number;
  value: string;
  lat: number;
  lon: number;
  country: string;
  asn: number;
  as_name: string;
  verdict: string;
  first_seen: string;
  synthetic: boolean;
}

const mapWidth = 960;
const mapHeight = 480;
const world = feature(
  worldData as any,
  (worldData as any).objects.countries,
) as unknown as FeatureCollection;
const projection = geoEquirectangular().fitExtent(
  [
    [8, 8],
    [mapWidth - 8, mapHeight - 8],
  ],
  world,
);
const path = geoPath(projection);

export function GeoTimeline() {
  const [family, setFamily] = useState('');
  const [frame, setFrame] = useState(100);
  const [playing, setPlaying] = useState(false);
  const geo = useQuery({ queryKey: ['geo'], queryFn: api.geo });
  const families = useQuery({ queryKey: ['families'], queryFn: api.families });
  const timeline = useQuery({
    queryKey: ['timeline', family],
    queryFn: () => api.timeline(family),
  });

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setFrame((value) => (value >= 100 ? 0 : value + 1)),
      160,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  const maxDate = useMemo(() => {
    const sorted = [...(timeline.data ?? [])].sort(
      (a, b) => +new Date(a.first_seen) - +new Date(b.first_seen),
    );
    return sorted[Math.max(0, Math.floor(((sorted.length - 1) * frame) / 100))]?.first_seen;
  }, [timeline.data, frame]);

  const allowed = useMemo(
    () =>
      new Set(
        (timeline.data ?? [])
          .filter((item) => !maxDate || item.first_seen <= maxDate)
          .map((item) => item.id),
      ),
    [timeline.data, maxDate],
  );
  const points = (geo.data ?? ([] as GeoPoint[])).filter((item) => allowed.has(item.id));
  const countries = rank(points, (item) => item.country);
  const asns = rank(points, (item) => `AS${item.asn} ${item.as_name}`);

  if (geo.isLoading) return <State text="loading geo data..." />;
  if (geo.error) return <State text="geo data unavailable" />;

  return (
    <main className="p-4 max-w-[1480px]">
      <Header
        title="geo / timeline"
        subtitle={`${points.length} active IPs · ${maxDate ? new Date(maxDate).toLocaleDateString() : '—'}`}
      />
      <div className="grid grid-cols-12 gap-3">
        <Panel title="global IOC distribution" className="col-span-9">
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="w-full h-[500px] bg-base border border-line"
            role="img"
            aria-label="Equirectangular map of indicator locations"
          >
            <g
              fill="none"
              stroke="var(--color-bar)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            >
              {world.features.map((country, index) => (
                <path key={index} d={path(country) ?? ''} />
              ))}
            </g>
            <g>
              {points.map((point) => {
                const position = projection([point.lon, point.lat]);
                if (!position) return null;
                return (
                  <circle
                    key={point.id}
                    cx={position[0]}
                    cy={position[1]}
                    r="3"
                    fill={
                      point.verdict === 'malicious'
                        ? 'var(--color-malicious)'
                        : point.verdict === 'suspicious'
                          ? 'var(--color-suspicious)'
                          : 'var(--color-text-secondary)'
                    }
                  >
                    <title>{`${point.value} · ${point.country} · AS${point.asn}`}</title>
                  </circle>
                );
              })}
            </g>
          </svg>
          {points.some((point) => point.synthetic) && (
            <p className="m-0 mt-2 text-[11px] text-secondary">synthetic geo data</p>
          )}
        </Panel>

        <div className="col-span-3 space-y-3">
          <Leaderboard title="top countries" data={countries} />
          <Leaderboard title="top ASNs" data={asns} />
        </div>

        <Panel title="timeline" className="col-span-12">
          <div className="grid grid-cols-[64px_1fr_180px_56px] gap-3 items-center">
            <button className="action" onClick={() => setPlaying(!playing)}>
              {playing ? 'pause' : 'play'}
            </button>
            <div>
              <input
                aria-label="Timeline position"
                type="range"
                min="0"
                max="100"
                value={frame}
                onChange={(event) => setFrame(Number(event.target.value))}
                className="w-full block"
              />
              <div className="h-3 border-t border-line flex justify-between mt-1">
                {[0, 25, 50, 75, 100].map((tick) => (
                  <span key={tick} className="h-2 border-l border-line" />
                ))}
              </div>
            </div>
            <select
              value={family}
              onChange={(event) => {
                setFamily(event.target.value);
                setFrame(0);
              }}
              className="field py-1"
            >
              <option value="">all families</option>
              {families.data?.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
            <span className="text-right text-secondary">{frame}%</span>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function rank<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(key(item), (counts.get(key(item)) ?? 0) + 1));
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function Leaderboard({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  return (
    <Panel title={title}>
      <table className="w-full text-[11px]">
        <thead>
          <tr>
            <th className="text-left">name</th>
            <th className="text-right">count</th>
          </tr>
        </thead>
        <tbody>
          {data.length ? (
            data.map((item) => (
              <tr key={item.name}>
                <td className="max-w-40 truncate">{item.name}</td>
                <td className="text-right">{item.count}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={2} className="text-secondary">
                no points
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}

function State({ text }: { text: string }) {
  return <main className="p-4 text-secondary">{text}</main>;
}
