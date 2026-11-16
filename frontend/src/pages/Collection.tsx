import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { addTrailItem } from '../hooks/useInvestigationTrail';

const FILTERS: Record<string, string> = {
  type: 'type',
  source: 'source',
  family: 'family',
  actor: 'actor',
  tag: 'tag',
  country: 'country',
  asn: 'asn',
};

export function Collection() {
  const { kind = '', value = '' } = useParams();
  const decoded = decodeURIComponent(value);
  const filter = FILTERS[kind];
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filter) params.set(filter, decoded);
    return params.toString();
  }, [decoded, filter]);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [kind, decoded]);
  const entity = useQuery({
    queryKey: ['collection-entity', kind, decoded],
    queryFn: () => api.exploreEntity(kind, decoded),
    enabled: Boolean(filter),
  });
  const summary = useQuery({
    queryKey: ['collection-summary', query],
    queryFn: () => api.exploreSummary(query),
    enabled: Boolean(filter),
  });
  const series = useQuery({
    queryKey: ['collection-series', query],
    queryFn: () => api.exploreTimeseries(query, 'day', 'none', 'first_seen'),
    enabled: Boolean(filter),
  });
  const rows = useQuery({
    queryKey: ['collection-indicators', query, page],
    queryFn: () => api.exploreIndicators(query, page, 'last_seen', 'desc'),
    enabled: Boolean(filter),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!entity.data) return;
    addTrailItem({
      key: `collection:${kind}:${decoded}`,
      label: entity.data.title,
      meta: kind,
      path: `/collection/${kind}/${encodeURIComponent(decoded)}`,
    });
  }, [decoded, entity.data, kind]);

  if (!filter) return <State text="unknown collection" />;
  if (entity.isLoading) return <State text="loading collection..." />;
  if (entity.error || !entity.data) return <State text="collection unavailable" />;
  const totalPages = Math.max(1, Math.ceil((rows.data?.total ?? 0) / 25));

  return (
    <main className="record-page">
      <nav className="record-crumb" aria-label="Collection position">
        <Link to="/">Atlas</Link> / <span>{kind}</span> / <b>{entity.data.title}</b>
      </nav>
      <header className="record-header">
        <div>
          <p className="section-label">{kind} collection</p>
          <h1>{entity.data.title}</h1>
          <p>{entity.data.description}</p>
        </div>
        <Link className="action" to={`/?${query}`}>
          open in atlas
        </Link>
      </header>

      <section className="record-stats" aria-label="Collection summary">
        <div>
          <b>{summary.data?.total.toLocaleString() ?? '—'}</b>
          <span>indicators</span>
        </div>
        <div>
          <b>{summary.data?.types ?? '—'}</b>
          <span>types</span>
        </div>
        <div>
          <b>{summary.data?.sources ?? '—'}</b>
          <span>sources</span>
        </div>
        <div>
          <b>{summary.data?.families ?? '—'}</b>
          <span>families</span>
        </div>
        <div>
          <b>{summary.data?.actors ?? '—'}</b>
          <span>actors</span>
        </div>
      </section>

      <div className="record-grid">
        <section className="record-section collection-activity">
          <h2>Activity / first observed</h2>
          <ActivityStrip items={series.data?.items ?? []} />
        </section>
        <section className="record-section">
          <h2>Context</h2>
          {Object.keys(entity.data.meta).length ? (
            <dl className="record-definition">
              {Object.entries(entity.data.meta).map(([key, item]) => (
                <div key={key}>
                  <dt>{key.replaceAll('_', ' ')}</dt>
                  <dd>{format(item)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="record-note">No additional metadata is stored for this collection.</p>
          )}
        </section>
        <section className="record-section">
          <h2>Continue exploring</h2>
          {entity.data.related.length ? (
            <div className="continuation-list">
              {entity.data.related.map((item) => (
                <Link
                  key={`${item.kind}:${item.value}`}
                  to={`/collection/${item.kind}/${encodeURIComponent(item.value)}`}
                >
                  <span>{item.label}</span>
                  <small>{item.kind}</small>
                </Link>
              ))}
            </div>
          ) : (
            <p className="record-note">No related collections are stored.</p>
          )}
        </section>
      </div>

      <section className="record-section collection-table">
        <div className="record-section-heading">
          <h2>Indicators</h2>
          <span>{rows.data?.total.toLocaleString() ?? '—'} records</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>type</th>
              <th>indicator</th>
              <th>verdict</th>
              <th>confidence</th>
              <th>last observed</th>
            </tr>
          </thead>
          <tbody>
            {rows.data?.items.map((item) => (
              <tr key={item.id}>
                <td>{item.type}</td>
                <td>
                  <Link className="table-link" to={`/ioc/${item.id}`}>
                    {item.value}
                  </Link>
                </td>
                <td className={`verdict-${item.verdict}`}>{item.verdict}</td>
                <td>{item.confidence}/100</td>
                <td>{shortDate(item.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <footer className="table-pager">
          <button
            className="action"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            previous
          </button>
          <span>
            page {page} / {totalPages}
          </span>
          <button
            className="action"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            next
          </button>
        </footer>
      </section>
    </main>
  );
}

function ActivityStrip({ items }: { items: { date: string; total: number }[] }) {
  const recent = items.slice(-84);
  const max = Math.max(1, ...recent.map((item) => item.total));
  return (
    <div className="activity-strip" aria-label="Recent collection activity">
      {recent.map((item) => {
        const level = item.total === max ? 4 : Math.min(3, Math.ceil((item.total / max) * 4));
        return <i key={item.date} data-level={level} title={`${item.date}: ${item.total}`} />;
      })}
      {!recent.length && <span>no activity in current data</span>}
    </div>
  );
}

function format(value: unknown) {
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '—');
}
const shortDate = (value: string) => new Date(value).toISOString().slice(0, 10);
function State({ text }: { text: string }) {
  return <main className="record-page text-secondary">{text}</main>;
}
