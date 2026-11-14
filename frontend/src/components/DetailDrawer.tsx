import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Indicator } from '../types';
export function DetailDrawer({
  id,
  onClose,
  onPivot,
}: {
  id: number | null;
  onClose: () => void;
  onPivot: (nodes: Indicator[]) => void;
}) {
  const [tab, setTab] = useState<'intel' | 'raw'>('intel');
  const { data, error, isLoading } = useQuery({
    queryKey: ['detail', id],
    queryFn: () => api.detail(id!),
    enabled: id !== null,
  });
  if (id === null) return null;
  const defang = (v: string) =>
    v
      .replace(/^https:/, 'hxxps:')
      .replace(/^http:/, 'hxxp:')
      .replaceAll('.', '[.]');
  async function pivot(by: string) {
    if (data) onPivot((await api.pivot(data.id, by)).items);
  }
  return (
    <aside className="fixed right-0 top-14 bottom-8 z-40 w-[420px] border-l border-cyan/30 bg-panel/98 shadow-[-20px_0_60px_#0009] overflow-y-auto">
      <header className="p-5 border-b border-slate-800 flex justify-between">
        <span className="text-xs tracking-widest text-cyan">IOC DETAIL // {id}</span>
        <button onClick={onClose} aria-label="Close detail">
          ✕
        </button>
      </header>
      {isLoading ? (
        <p className="p-6 text-slate-500">Loading intelligence…</p>
      ) : error || !data ? (
        <p className="p-6 text-magenta">Unable to load indicator.</p>
      ) : (
        <div className="p-6">
          <div className="h-32 flex justify-center relative">
            <div className="w-48 h-24 overflow-hidden">
              <div
                className={`w-48 h-48 rounded-full border-[14px] ${data.verdict === 'malicious' ? 'border-magenta' : data.verdict === 'suspicious' ? 'border-amber' : 'border-cyan'} border-b-transparent border-l-transparent rotate-[-45deg]`}
              />
            </div>
            <div className="absolute top-9 text-center">
              <b className="text-3xl">{data.confidence}</b>
              <p className="text-[10px] tracking-widest">{data.verdict.toUpperCase()}</p>
            </div>
          </div>
          <p className="font-mono text-sm break-all bg-void p-3 border border-slate-800">
            {data.value}
          </p>
          <div className="grid grid-cols-3 gap-2 my-3">
            <button className="action" onClick={() => navigator.clipboard.writeText(data.value)}>
              COPY RAW
            </button>
            <button
              className="action"
              onClick={() => navigator.clipboard.writeText(defang(data.value))}
            >
              DEFANGED
            </button>
            <button className="action" onClick={() => navigator.clipboard.writeText(data.value)}>
              REFANGED
            </button>
          </div>
          <div className="flex gap-4 border-b border-slate-800 my-5">
            <button
              className={tab === 'intel' ? 'tab active-tab' : 'tab'}
              onClick={() => setTab('intel')}
            >
              INTEL
            </button>
            <button
              className={tab === 'raw' ? 'tab active-tab' : 'tab'}
              onClick={() => setTab('raw')}
            >
              RAW JSON
            </button>
          </div>
          {tab === 'raw' ? (
            <pre className="text-xs whitespace-pre-wrap text-slate-400">
              {JSON.stringify(data.raw, null, 2)}
            </pre>
          ) : (
            <>
              <Label text="SOURCES" />
              <div className="space-y-2">
                {data.sources?.map((x) => (
                  <div key={x.name} className="border border-slate-800 p-2 text-xs">
                    <b className="text-cyan">{x.name}</b>
                    <span className="float-right text-slate-500">
                      {new Date(x.last_seen).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
              <Label text="TAGS + FAMILIES" />
              <div className="flex flex-wrap gap-2">
                {[...(data.tags ?? []), ...(data.families ?? [])].map((x) => (
                  <span key={x} className="text-xs border border-magenta/30 text-magenta px-2 py-1">
                    {x}
                  </span>
                ))}
              </div>
              <Label text="PIVOT INVESTIGATION" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['family', 'SAME FAMILY'],
                  ['asn', 'SAME ASN'],
                  ['subnet24', 'SAME /24'],
                  ['tag', 'SAME TAG'],
                ].map(([key, label]) => (
                  <button key={key} className="action" onClick={() => pivot(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
function Label({ text }: { text: string }) {
  return <p className="text-[10px] tracking-[.2em] text-slate-500 mt-6 mb-2">{text}</p>;
}
