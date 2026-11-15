import { DragEvent, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { API, api } from '../api/client';
import { DetailDrawer } from '../components/DetailDrawer';
import { Header } from './Dashboard';

export function Bulk() {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('all');
  const [drawer, setDrawer] = useState<number | null>(null);
  const mutation = useMutation({ mutationFn: api.bulk });
  const rows = useMemo(
    () =>
      mutation.data?.results?.filter(
        (row: any) => filter === 'all' || (row.indicator?.verdict ?? row.status) === filter,
      ) ?? [],
    [mutation.data, filter],
  );

  function run(content = text) {
    const values = content
      .split(/[\n,;]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length) mutation.mutate(values);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file)
      file.text().then((value) => {
        setText(value);
        run(value);
      });
  }

  return (
    <main className="p-4 max-w-[1400px]">
      <Header title="bulk triage" subtitle="local batch analysis · maximum 5,000 rows" />
      <section className="panel" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
        <label htmlFor="bulk-input" className="section-label block">
          input / CSV or text
        </label>
        <textarea
          id="bulk-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="one indicator per line"
          className="field w-full h-28 resize-none rounded-none"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[11px] text-secondary">paste values or drop a file</span>
          <button onClick={() => run()} disabled={mutation.isPending} className="action-primary">
            {mutation.isPending ? 'running...' : 'run triage'}
          </button>
        </div>
      </section>

      {mutation.error && (
        <p className="verdict-malicious my-3">bulk request failed; check API connection</p>
      )}

      {mutation.data && (
        <>
          <div className="my-3 border-y border-line py-2 flex items-center gap-6 text-[11px]">
            {Object.entries(mutation.data.summary).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setFilter(key === 'checked' ? 'all' : key)}
                className={`border-0 bg-transparent p-0 rounded-none ${filter === key || (key === 'checked' && filter === 'all') ? 'text-primary' : 'text-secondary'}`}
              >
                <span
                  className={
                    key === 'malicious'
                      ? 'verdict-malicious'
                      : key === 'suspicious'
                        ? 'verdict-suspicious'
                        : ''
                  }
                >
                  {String(value)}
                </span>{' '}
                {key}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              {['csv', 'json', 'blocklist'].map((format) => (
                <a key={format} href={`${API}/api/bulk/export?format=${format}`} className="action">
                  export {format}
                </a>
              ))}
            </div>
          </div>

          <div className="border border-line overflow-hidden rounded-none">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-base">
                <tr>
                  <th>input</th>
                  <th>type</th>
                  <th>verdict</th>
                  <th className="text-right">confidence</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row: any, index: number) => (
                    <tr
                      key={`${row.input}-${index}`}
                      onClick={() => row.indicator && setDrawer(row.indicator.id)}
                      className="cursor-pointer"
                    >
                      <td className="max-w-xl truncate">{row.input}</td>
                      <td className="text-secondary">{row.indicator?.type ?? '—'}</td>
                      <td className={`verdict-${row.indicator?.verdict ?? 'unknown'}`}>
                        {row.indicator?.verdict ?? 'unknown'}
                      </td>
                      <td className="text-right">{row.indicator?.confidence ?? '—'}</td>
                      <td className="text-secondary">{row.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-secondary">
                      no rows match this filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <DetailDrawer id={drawer} onClose={() => setDrawer(null)} />
    </main>
  );
}
