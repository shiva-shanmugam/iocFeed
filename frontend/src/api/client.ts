import type { GraphData, Indicator } from '../types';
export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, options);
  if (!response.ok)
    throw new Error((await response.json().catch(() => null))?.detail ?? `HTTP ${response.status}`);
  return response.json();
}
export type FacetItem = { value: string; label: string; count: number };
export type ExploreSummary = {
  total: number;
  types: number;
  sources: number;
  families: number;
  actors: number;
  first_seen: string | null;
  last_seen: string | null;
};
export type ExploreRow = {
  id: number;
  type: string;
  value: string;
  first_seen: string;
  last_seen: string;
  confidence: number;
  verdict: string;
  sources: string[];
  families: string[];
  actors: string[];
  tags: string[];
  country: string | null;
  asn: number | null;
};
export type EntityData = {
  kind: string;
  value: string;
  title: string;
  description: string;
  meta: Record<string, unknown>;
  related: { kind: string; value: string; label: string }[];
};
export type EvidenceData = {
  indicator: Indicator;
  source: { name: string; url: string; status: string; last_sync: string | null };
  observation: { first_seen: string; last_seen: string; raw: Record<string, unknown> };
  attribution: string;
};
export type ReplaySource = {
  name: string;
  url: string;
  origin: string | null;
  fingerprint: string;
  synthetic: boolean;
  first_seen: string;
  last_seen: string;
  excerpt: string;
};
export type ReplayEdge = {
  id: number;
  other_id: number;
  value: string;
  type: string;
  relation: string;
};
export type ReplayState = {
  verdict: string;
  confidence: number;
  sources: ReplaySource[];
  families: string[];
  tags: string[];
  relationships: ReplayEdge[];
  relationship_count: number;
  relationships_truncated: boolean;
};
export type ReplayData = {
  indicator: { id: number; type: string; value: string };
  snapshots: {
    id: number;
    recorded_at: string;
    reason: string;
    simulated: boolean;
    state: ReplayState;
  }[];
  current: ReplayState;
  truncated: boolean;
  has_simulated_history: boolean;
  notice: string;
};
export const api = {
  lookup: (q: string) =>
    request<{ indicator: Indicator; refanged: string }>(`/api/lookup?q=${encodeURIComponent(q)}`),
  search: (q: string) =>
    request<{ items: Indicator[] }>(`/api/search?q=${encodeURIComponent(q)}&page_size=8`),
  detail: (id: number) => request<Indicator>(`/api/indicators/${id}`),
  replay: (id: number) => request<ReplayData>(`/api/replay/${id}`),
  graphLeaders: () =>
    request<{ items: { id: number; type: string; value: string; connections: number }[] }>(
      '/api/graph/leaders',
    ),
  evidence: (id: number, source: string) =>
    request<EvidenceData>(`/api/evidence/${id}/${encodeURIComponent(source)}`),
  graph: (id: number) => request<GraphData>(`/api/graph/${id}?depth=2&max_nodes=250`),
  expand: (id: number) => request<GraphData>(`/api/graph/expand/${id}`),
  path: (a: number, b: number) =>
    request<{ nodes: number[]; edges: GraphData['edges'] }>(`/api/graph/path?from=${a}&to=${b}`),
  pivot: (id: number, by: string) => request<{ items: Indicator[] }>(`/api/pivot/${id}?by=${by}`),
  summary: () => request<any>('/api/stats/summary'),
  families: () => request<{ name: string; count: number }[]>('/api/stats/families'),
  activity: () => request<{ date: string; count: number }[]>('/api/stats/activity'),
  geo: () => request<any[]>('/api/geo/points'),
  timeline: (family = '') =>
    request<Indicator[]>(`/api/timeline${family ? `?family=${encodeURIComponent(family)}` : ''}`),
  logs: () => request<any[]>('/api/ingestion/log'),
  bulk: (values: string[]) =>
    request<any>('/api/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    }),
  exploreSummary: (query: string) =>
    request<ExploreSummary>(`/api/explore/summary${query ? `?${query}` : ''}`),
  exploreFacets: (query: string) =>
    request<Record<string, FacetItem[]>>(`/api/explore/facets${query ? `?${query}` : ''}`),
  exploreTimeseries: (query: string, bucket: string, group: string, basis: string) => {
    const params = new URLSearchParams(query);
    params.set('bucket', bucket);
    params.set('group', group);
    params.set('basis', basis);
    return request<{ items: { date: string; total: number; series: Record<string, number> }[] }>(
      `/api/explore/timeseries?${params}`,
    );
  },
  exploreIndicators: (query: string, page: number, sort: string, order: string) => {
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    params.set('page_size', '25');
    params.set('sort', sort);
    params.set('order', order);
    return request<{ items: ExploreRow[]; total: number; page: number; page_size: number }>(
      `/api/explore/indicators?${params}`,
    );
  },
  exploreEntity: (kind: string, value: string) =>
    request<EntityData>(`/api/explore/entity/${kind}/${encodeURIComponent(value)}`),
};
