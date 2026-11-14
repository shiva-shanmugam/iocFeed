export type Verdict = 'malicious' | 'suspicious' | 'unknown';
export interface Indicator {
  id: number;
  type: string;
  value: string;
  first_seen: string;
  last_seen: string;
  confidence: number;
  verdict: Verdict;
  sources?: { name: string; first_seen: string; last_seen: string }[];
  tags?: string[];
  families?: string[];
  raw?: unknown[];
}
export interface GraphData {
  nodes: Indicator[];
  edges: { id: number; source: number; target: number; type: string }[];
  truncated: boolean;
}
