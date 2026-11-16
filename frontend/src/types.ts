export type Verdict = 'malicious' | 'suspicious' | 'unknown';
export interface Indicator {
  id: number;
  type: string;
  value: string;
  first_seen: string;
  last_seen: string;
  confidence: number;
  verdict: Verdict;
  sources?: { name: string; url?: string; first_seen: string; last_seen: string }[];
  tags?: string[];
  families?: string[];
  actors?: string[];
  raw?: unknown[];
  geo?: {
    country: string;
    asn: number;
    as_name: string;
    lat: number;
    lon: number;
  } | null;
  relationship_count?: number;
  decision?: {
    action: string;
    summary: string;
    factors: string[];
    age_days: number;
  };
}
export interface GraphData {
  nodes: Indicator[];
  edges: { id: number; source: number; target: number; type: string }[];
  truncated: boolean;
}
