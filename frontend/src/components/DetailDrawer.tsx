import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Link } from 'react-router-dom';

export function DetailDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [tab, setTab] = useState<'intel' | 'raw'>('intel');
  const { data, error, isLoading } = useQuery({
    queryKey: ['detail', id],
    queryFn: () => api.detail(id!),
    enabled: id !== null,
  });
  if (id === null) return null;

  const defang = (value: string) =>
    value
      .replace(/^https:/, 'hxxps:')
      .replace(/^http:/, 'hxxp:')
      .replaceAll('.', '[.]');

  return (
    <aside className="fixed right-0 top-0 bottom-7 z-40 w-[420px] border-l border-line bg-base overflow-y-auto">
      <header className="h-12 px-3 border-b border-line flex items-center justify-between">
        <span className="section-label mb-0">indicator detail / {id}</span>
        <button className="action" onClick={onClose} aria-label="Close detail">
          close
        </button>
      </header>

      {isLoading ? (
        <p className="p-3 text-secondary">loading indicator...</p>
      ) : error || !data ? (
        <p className="p-3 verdict-malicious">unable to load indicator</p>
      ) : (
        <div className="p-3">
          <section
            className={`border-l-2 pl-3 ${data.verdict === 'malicious' ? 'border-malicious' : data.verdict === 'suspicious' ? 'border-suspicious' : 'border-line'}`}
          >
            <div className="flex items-baseline justify-between">
              <strong className={`verdict-${data.verdict} font-semibold uppercase`}>
                {data.verdict}
              </strong>
              <span className="text-secondary">conf {data.confidence}/100</span>
            </div>
            <div className="h-px bg-line mt-2">
              <div
                className={
                  data.verdict === 'malicious'
                    ? 'h-px bg-malicious'
                    : data.verdict === 'suspicious'
                      ? 'h-px bg-suspicious'
                      : 'h-px bg-secondary'
                }
                style={{ width: `${data.confidence}%` }}
              />
            </div>
          </section>

          <p className="entity-crumb">
            graph / {data.type} / indicator {data.id}
          </p>
          <p className="break-all bg-surface p-2 border border-line mt-2">{data.value}</p>
          <div className="flex gap-2 mt-2">
            <button className="action" onClick={() => navigator.clipboard.writeText(data.value)}>
              copy IOC
            </button>
            <button
              className="action"
              onClick={() => navigator.clipboard.writeText(defang(data.value))}
            >
              copy defanged
            </button>
            <Link className="action-primary" to={`/ioc/${data.id}`}>
              full record
            </Link>
          </div>

          <div className="flex gap-4 border-b border-line mt-4 mb-3">
            <button
              className={tab === 'intel' ? 'tab active-tab' : 'tab'}
              onClick={() => setTab('intel')}
            >
              intel
            </button>
            <button
              className={tab === 'raw' ? 'tab active-tab' : 'tab'}
              onClick={() => setTab('raw')}
            >
              raw json
            </button>
          </div>

          {tab === 'raw' ? (
            <pre className="text-[11px] whitespace-pre-wrap text-secondary">
              {JSON.stringify(data.raw, null, 2)}
            </pre>
          ) : (
            <>
              <Label text="sources" />
              <table className="w-full text-[11px]">
                <thead>
                  <tr>
                    <th className="text-left">source</th>
                    <th className="text-right">last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources?.map((source) => (
                    <tr key={source.name}>
                      <td>{source.name}</td>
                      <td className="text-right text-secondary">
                        {new Date(source.last_seen).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Label text="tags / families" />
              <p className="text-secondary">
                {[...(data.tags ?? []), ...(data.families ?? [])].join(', ') || 'none'}
              </p>

              <Label text="continue exploring" />
              <div className="grid grid-cols-2 gap-2">
                {data.families?.[0] && (
                  <Link
                    className="action"
                    to={`/collection/family/${encodeURIComponent(data.families[0])}`}
                  >
                    family dataset
                  </Link>
                )}
                {data.tags?.[0] && (
                  <Link
                    className="action"
                    to={`/collection/tag/${encodeURIComponent(data.tags[0])}`}
                  >
                    tag dataset
                  </Link>
                )}
                {data.sources?.[0] && (
                  <Link
                    className="action"
                    to={`/collection/source/${encodeURIComponent(data.sources[0].name)}`}
                  >
                    source dataset
                  </Link>
                )}
                {data.type === 'ipv4' && (
                  <Link className="action" to="/geo">
                    open on map
                  </Link>
                )}
              </div>
              <p className="graph-note mt-3">
                Clicking the node itself expands only explicit database relationships. These dataset
                links pivot by shared metadata and may contain IOCs that are not directly connected.
              </p>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function Label({ text }: { text: string }) {
  return <h3 className="section-label mt-5">{text}</h3>;
}
