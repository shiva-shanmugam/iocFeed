import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Header, Panel } from './Dashboard';

export function Feeds() {
  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const logs = useQuery({ queryKey: ['logs'], queryFn: api.logs, refetchInterval: 5000 });
  return (
    <main className="p-4 max-w-[1200px]">
      <Header title="feeds" subtitle="source health and ingestion activity" />
      <Panel title="sources">
        <table className="w-full">
          <thead>
            <tr>
              <th>source</th>
              <th>status</th>
              <th className="text-right">indicators</th>
              <th>last sync</th>
            </tr>
          </thead>
          <tbody>
            {summary.data?.sources?.map((source: any) => (
              <tr key={source.name}>
                <td>{source.name}</td>
                <td>{source.status}</td>
                <td className="text-right">{source.count.toLocaleString()}</td>
                <td>{source.last_sync ? new Date(source.last_sync).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="ingestion log" className="mt-3">
        <div className="h-64 overflow-auto">
          {logs.data?.map((item: any) => (
            <p key={item.id} className="m-0 py-1 border-b border-line">
              <span className="text-secondary">{new Date(item.ts).toLocaleString()}</span> [
              {item.source}] {item.message}
            </p>
          ))}
        </div>
      </Panel>
    </main>
  );
}
