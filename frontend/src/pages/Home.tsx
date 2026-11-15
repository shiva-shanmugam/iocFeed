import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useRecent } from '../hooks/useRecent';

const refang = (value: string) =>
  value
    .trim()
    .replaceAll('[.]', '.')
    .replace(/^hxxps:/i, 'https:')
    .replace(/^hxxp:/i, 'http:');

function detect(value: string) {
  const normalized = refang(value);
  if (/^https?:\/\//.test(normalized)) return 'url';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) return 'ipv4';
  if (/^[a-f\d]{64}$/i.test(normalized)) return 'sha256';
  if (/^[a-f\d]{40}$/i.test(normalized)) return 'sha1';
  if (/^[a-f\d]{32}$/i.test(normalized)) return 'md5';
  if (normalized.includes('.')) return 'domain';
  return 'unknown';
}

export function Home() {
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<string>('');
  const navigate = useNavigate();
  const recent = useRecent();
  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const suggestions = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.length > 2,
    staleTime: 5000,
  });

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        document.getElementById('command')?.focus();
      }
    };
    addEventListener('keydown', focusSearch);
    return () => removeEventListener('keydown', focusSearch);
  }, []);

  const type = useMemo(() => detect(query), [query]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query) return;
    const started = performance.now();
    setFeedback('querying local database...');
    try {
      const result = await api.lookup(query);
      const elapsed = Math.max(1, Math.round(performance.now() - started));
      setFeedback(`1 hit in ${elapsed} ms`);
      recent.add(query);
      window.setTimeout(() => navigate(`/investigate/${result.indicator.id}`), 180);
    } catch {
      const elapsed = Math.max(1, Math.round(performance.now() - started));
      setFeedback(`0 hits in ${elapsed} ms`);
    }
  }

  return (
    <main className="max-w-[1040px] p-4">
      <header className="mb-4 border-b border-line pb-2">
        <h1 className="section-label mb-0">indicator lookup</h1>
      </header>

      <form onSubmit={submit} className="flex items-stretch max-w-[920px]">
        <span className="border border-r-0 border-line bg-surface px-3 flex items-center text-secondary">
          &gt;
        </span>
        <input
          id="command"
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setFeedback('');
          }}
          placeholder="IP, domain, URL, or hash"
          className="field min-w-0 flex-1 border-r-0 rounded-none"
          aria-label="IOC search"
        />
        <span className="border border-line bg-surface px-3 flex items-center text-[11px] text-secondary min-w-20 justify-center">
          {type}
        </span>
        <button type="submit" className="action-primary rounded-none border-l-0">
          lookup
        </button>
      </form>

      <div className="h-6 mt-1 text-[11px] text-secondary">
        {query !== refang(query) ? `refanged: ${refang(query)}` : feedback || 'ctrl+k to focus'}
      </div>

      {suggestions.data?.items?.length ? (
        <div className="border border-line max-w-[920px] mb-4">
          <div className="section-label px-2 pt-2">matches</div>
          {suggestions.data.items.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/investigate/${item.id}`)}
              className="w-full border-0 border-t border-line bg-transparent px-2 py-1.5 flex justify-between text-left hover:bg-surface rounded-none"
            >
              <span className="truncate">{item.value}</span>
              <span className="text-secondary ml-4">{item.type}</span>
            </button>
          ))}
        </div>
      ) : null}

      <section className="mt-6 max-w-[920px]">
        <h2 className="section-label">recent lookups</h2>
        <div className="border-y border-line">
          {recent.items.length ? (
            recent.items.map((item, index) => (
              <button
                key={item}
                onClick={() => setQuery(item)}
                className="w-full border-0 border-b border-line last:border-b-0 bg-transparent px-2 py-1.5 text-left hover:bg-surface rounded-none"
              >
                <span className="inline-block w-8 text-secondary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {item}
              </button>
            ))
          ) : (
            <p className="px-2 py-2 text-secondary">no recent lookups</p>
          )}
        </div>
      </section>

      <p className="mt-4 text-[11px] text-secondary">
        dataset: {summary.data?.total?.toLocaleString() ?? '—'} indicators ·{' '}
        {summary.data?.online_feeds ?? '—'} feed online · local PostgreSQL
      </p>
    </main>
  );
}
