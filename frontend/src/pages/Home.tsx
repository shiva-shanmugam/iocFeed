import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useRecent } from '../hooks/useRecent';
const refang = (s: string) =>
  s
    .trim()
    .replaceAll('[.]', '.')
    .replace(/^hxxps:/i, 'https:')
    .replace(/^hxxp:/i, 'http:');
function detect(s: string) {
  const v = refang(s);
  if (/^https?:\/\//.test(v)) return 'URL';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return 'IPv4';
  if (/^[a-f\d]{64}$/i.test(v)) return 'SHA256';
  if (/^[a-f\d]{40}$/i.test(v)) return 'SHA1';
  if (/^[a-f\d]{32}$/i.test(v)) return 'MD5';
  if (v.includes('.')) return 'DOMAIN';
  return 'UNKNOWN';
}
export function Home() {
  const [q, setQ] = useState('');
  const [scanning, setScanning] = useState(false);
  const nav = useNavigate();
  const recent = useRecent();
  const suggestions = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length > 2,
    staleTime: 5000,
  });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('command')?.focus();
      }
    };
    addEventListener('keydown', fn);
    return () => removeEventListener('keydown', fn);
  }, []);
  const type = useMemo(() => detect(q), [q]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!q) return;
    setScanning(true);
    try {
      const r = await api.lookup(q);
      recent.add(q);
      await new Promise((x) => setTimeout(x, 450));
      nav(`/investigate/${r.indicator.id}`);
    } catch {
      setScanning(false);
    }
  }
  return (
    <main className="min-h-[calc(100vh-5.5rem)] grid place-items-center p-8">
      <section className="w-full max-w-4xl">
        <p className="text-xs text-cyan tracking-[.35em] mb-4">
          LOCAL THREAT INTELLIGENCE // READY
        </p>
        <h1 className="text-5xl md:text-7xl font-black leading-none mb-8">
          TRACE THE
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan to-magenta">
            SIGNAL.
          </span>
        </h1>
        <form onSubmit={submit} className="relative">
          <div className="absolute -inset-px bg-gradient-to-r from-cyan/60 to-magenta/60 blur-sm" />
          <div className="relative bg-panel border border-cyan/30 p-5 flex items-center gap-3">
            <span className="text-cyan text-xl">›</span>
            <input
              id="command"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="paste IP, domain, URL, or hash..."
              className="bg-transparent flex-1 outline-none font-mono text-lg placeholder:text-slate-600"
              aria-label="IOC search"
            />
            <kbd className="text-[10px] border border-slate-700 px-2 py-1">CTRL K</kbd>
            <span className="text-[10px] text-cyan border border-cyan/30 px-2 py-1">{type}</span>
          </div>
        </form>
        {q !== refang(q) && (
          <p className="mt-2 text-xs text-amber">
            REFANGED → <span className="font-mono">{refang(q)}</span>
          </p>
        )}
        {scanning && (
          <div className="mt-5 font-mono text-xs text-cyan animate-pulse">
            <p>› refanging and classifying target...</p>
            <p>› querying local PostgreSQL...</p>
            <p>› assembling relationship neighborhood...</p>
          </div>
        )}
        {!scanning && suggestions.data?.items?.length ? (
          <div className="mt-2 border border-slate-800 bg-panel">
            {suggestions.data.items.map((x) => (
              <button
                key={x.id}
                onClick={() => nav(`/investigate/${x.id}`)}
                className="w-full flex justify-between p-3 hover:bg-cyan/5 text-left"
              >
                <span className="font-mono text-sm truncate">{x.value}</span>
                <span className="text-xs text-slate-500">{x.type}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-10 flex gap-3 flex-wrap text-xs text-slate-500">
          <span>RECENT //</span>
          {recent.items.length ? (
            recent.items.map((x) => (
              <button key={x} onClick={() => setQ(x)} className="hover:text-cyan font-mono">
                {x}
              </button>
            ))
          ) : (
            <span>NO INVESTIGATIONS YET</span>
          )}
        </div>
      </section>
    </main>
  );
}
