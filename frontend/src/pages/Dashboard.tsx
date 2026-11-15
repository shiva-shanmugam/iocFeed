import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const heatSteps = [
  'var(--color-heat-0)',
  'var(--color-heat-1)',
  'var(--color-heat-2)',
  'var(--color-heat-3)',
  'var(--color-heat-4)',
];

export function Dashboard() {
  const [family, setFamily] = useState('');
  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary, refetchInterval: 10000 });
  const families = useQuery({
    queryKey: ['families'],
    queryFn: api.families,
    refetchInterval: 10000,
  });
  const activity = useQuery({ queryKey: ['activity'], queryFn: api.activity });
  const logs = useQuery({ queryKey: ['logs'], queryFn: api.logs, refetchInterval: 3000 });

  if (summary.isLoading) return <State text="loading dashboard..." />;
  if (summary.error) return <State text="dashboard unavailable" />;

  const familyData = [...(families.data ?? [])].sort((a, b) => b.count - a.count);
  const maxFamily = Math.max(1, ...familyData.map((item) => item.count));
  const typeData = Object.entries(summary.data.by_type ?? {})
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);
  const sourceData = [...(summary.data.sources ?? [])].sort((a: any, b: any) => b.count - a.count);
  const maxSource = Math.max(1, ...sourceData.map((item: any) => item.count));
  const maxActivity = Math.max(1, ...(activity.data ?? []).map((item) => item.count));

  return (
    <main className="p-4 max-w-[1480px]">
      <Header
        title="dashboard"
        subtitle={`${summary.data.total.toLocaleString()} indicators · live`}
      />
      <div className="grid grid-cols-12 gap-3">
        <Panel title="malware families" className="col-span-7">
          <div className="space-y-1">
            {familyData.map((item) => (
              <button
                key={item.name}
                onClick={() => setFamily(family === item.name ? '' : item.name)}
                className={`w-full border-0 border-l-2 bg-transparent px-2 py-1 text-left rounded-none hover:bg-base ${family === item.name ? 'border-accent' : 'border-transparent'}`}
              >
                <div className="grid grid-cols-[140px_1fr_64px] items-center gap-3">
                  <span className="truncate">{item.name}</span>
                  <div className="h-2 bg-base border border-line">
                    <div
                      className="h-full bg-bar"
                      style={{ width: `${(item.count / maxFamily) * 100}%` }}
                    />
                  </div>
                  <span className="text-right text-secondary">{item.count}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="indicator types" className="col-span-5">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>type</th>
                <th className="text-right">count</th>
                <th className="text-right">share</th>
              </tr>
            </thead>
            <tbody>
              {typeData.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td className="text-right">{item.value.toLocaleString()}</td>
                  <td className="text-right text-secondary">
                    {((item.value / summary.data.total) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="90-day first-seen activity" className="col-span-7">
          <div className="grid grid-cols-[repeat(18,1fr)] gap-1">
            {(activity.data ?? []).map((item) => {
              const bucket =
                item.count === maxActivity
                  ? 4
                  : Math.min(3, Math.floor((item.count / maxActivity) * 4));
              return (
                <div
                  key={item.date}
                  title={`${item.date}: ${item.count}`}
                  className="aspect-square border border-line rounded-none"
                  style={{ backgroundColor: heatSteps[bucket] }}
                />
              );
            })}
          </div>
          <div className="flex justify-end gap-1 mt-2 text-[10px] text-secondary items-center">
            <span>less</span>
            {heatSteps.map((color) => (
              <span
                key={color}
                className="w-3 h-3 border border-line"
                style={{ backgroundColor: color }}
              />
            ))}
            <span>more</span>
          </div>
        </Panel>

        <Panel title="sources" className="col-span-5">
          <div className="space-y-2">
            {sourceData.map((item: any) => (
              <div key={item.name} className="grid grid-cols-[120px_1fr_64px] gap-3 items-center">
                <span className="truncate">{item.name}</span>
                <div className="h-2 bg-base border border-line">
                  <div
                    className="h-full bg-bar"
                    style={{ width: `${(item.count / maxSource) * 100}%` }}
                  />
                </div>
                <span className="text-right text-secondary">{item.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="ingestion log" className="col-span-12">
          <div className="h-44 overflow-auto text-[11px]">
            {logs.data?.length ? (
              logs.data.map((item: any) => (
                <p key={item.id} className="m-0 leading-6 border-b border-line last:border-b-0">
                  <span className="text-secondary">{new Date(item.ts).toLocaleTimeString()}</span>{' '}
                  <span
                    className={
                      item.level === 'error'
                        ? 'verdict-malicious'
                        : item.level === 'warning'
                          ? 'verdict-suspicious'
                          : 'text-secondary'
                    }
                  >
                    [{item.source}]
                  </span>{' '}
                  {item.message}
                </p>
              ))
            ) : (
              <p className="text-secondary">no ingestion events</p>
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}

export function Panel({
  title,
  className = '',
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-3 border-b border-line pb-2 flex items-baseline justify-between">
      <h1 className="section-label mb-0">{title}</h1>
      <p className="m-0 text-[11px] text-secondary">{subtitle}</p>
    </header>
  );
}

function State({ text }: { text: string }) {
  return <main className="p-4 text-secondary">{text}</main>;
}
