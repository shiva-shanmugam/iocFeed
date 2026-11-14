import { DragEvent, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { API, api } from '../api/client';
import { DetailDrawer } from '../components/DetailDrawer';
import type { Indicator } from '../types';
import { Header } from './Dashboard';
export function Bulk() {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('all');
  const [drawer, setDrawer] = useState<number | null>(null);
  const mutation = useMutation({ mutationFn: api.bulk });
  const rows = useMemo(
    () =>
      mutation.data?.results?.filter(
        (r: any) => filter === 'all' || (r.indicator?.verdict ?? r.status) === filter,
      ) ?? [],
    [mutation.data, filter],
  );
  function run(content = text) {
    const values = content
      .split(/[\n,;]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (values.length) mutation.mutate(values);
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file)
      file.text().then((v) => {
        setText(v);
        run(v);
      });
  }
  return (
    <main className="p-6 pb-14 max-w-[1500px] mx-auto">
      <Header title="BULK TRIAGE MATRIX" subtitle="LOCAL BATCH ANALYSIS // MAX 5,000" />
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={drop}
        className="border border-dashed border-cyan/40 bg-cyan/[.03] p-5"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste one IOC per line, or drop a CSV/txt file here…"
          className="w-full h-28 bg-transparent outline-none resize-none font-mono text-sm"
        />
        <div className="flex justify-between">
          <span className="text-xs text-slate-500">DROP FILE // CSV, TXT</span>
          <button
            onClick={() => run()}
            disabled={mutation.isPending}
            className="bg-cyan text-void font-bold text-xs px-5 py-2 disabled:opacity-40"
          >
            {mutation.isPending ? 'SCANNING…' : 'RUN TRIAGE'}
          </button>
        </div>
      </div>
      {mutation.error && (
        <p className="text-magenta my-4">Bulk request failed. Check the API connection.</p>
      )}
      {mutation.data && (
        <>
          <div className="grid grid-cols-4 border border-slate-800 my-4">
            {Object.entries(mutation.data.summary).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setFilter(k === 'checked' ? 'all' : k)}
                className="p-4 border-r border-slate-800 last:border-0 text-left"
              >
                <b
                  className={
                    k === 'malicious'
                      ? 'text-magenta'
                      : k === 'suspicious'
                        ? 'text-amber'
                        : 'text-cyan'
                  }
                >
                  {String(v)}
                </b>
                <p className="text-[10px] tracking-widest uppercase text-slate-500">{k}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 mb-3">
            {['csv', 'json', 'blocklist'].map((x) => (
              <a key={x} href={`${API}/api/bulk/export?format=${x}`} className="action">
                EXPORT {x.toUpperCase()}
              </a>
            ))}
          </div>
          <div className="border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-500 tracking-widest">
                <tr>
                  <th className="p-3">INPUT</th>
                  <th>TYPE</th>
                  <th>VERDICT</th>
                  <th>CONFIDENCE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((r: any, i: number) => (
                    <tr
                      key={`${r.input}-${i}`}
                      onClick={() => r.indicator && setDrawer(r.indicator.id)}
                      className="border-t border-slate-800 hover:bg-cyan/5 cursor-pointer"
                    >
                      <td className="p-3 font-mono max-w-xl truncate">{r.input}</td>
                      <td>{r.indicator?.type ?? '—'}</td>
                      <td
                        className={
                          r.indicator?.verdict === 'malicious'
                            ? 'text-magenta'
                            : r.indicator?.verdict === 'suspicious'
                              ? 'text-amber'
                              : 'text-slate-500'
                        }
                      >
                        {r.indicator?.verdict ?? 'unknown'}
                      </td>
                      <td>{r.indicator?.confidence ?? '—'}</td>
                      <td>
                        <span className="border border-slate-700 px-2 py-1">{r.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-500">
                      No rows match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <DetailDrawer id={drawer} onClose={() => setDrawer(null)} onPivot={(_: Indicator[]) => {}} />
    </main>
  );
}
