import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { addTrailItem } from '../hooks/useInvestigationTrail';

export function Evidence() {
  const id = Number(useParams().id);
  const source = decodeURIComponent(useParams().source ?? '');
  const evidence = useQuery({
    queryKey: ['evidence', id, source],
    queryFn: () => api.evidence(id, source),
    enabled: Number.isFinite(id) && Boolean(source),
  });
  useEffect(() => {
    if (!evidence.data) return;
    addTrailItem({
      key: `evidence:${id}:${source}`,
      label: `${source} evidence`,
      meta: evidence.data.indicator.type,
      path: `/evidence/${id}/${encodeURIComponent(source)}`,
    });
  }, [evidence.data, id, source]);
  if (evidence.isLoading) return <State text="loading evidence..." />;
  if (evidence.error || !evidence.data) return <State text="evidence unavailable" />;
  const data = evidence.data;
  const fields = Object.entries(data.observation.raw ?? {});
  return (
    <main className="record-page evidence-page">
      <nav className="record-crumb" aria-label="Evidence position">
        <Link to="/">Atlas</Link> / <Link to={`/ioc/${id}`}>{data.indicator.value}</Link> /{' '}
        <b>{data.source.name}</b>
      </nav>
      <header className="record-header">
        <div>
          <p className="section-label">source evidence / IOC {id}</p>
          <h1>{data.source.name}</h1>
          <p>{data.indicator.value}</p>
        </div>
        <div className="record-actions">
          <Link
            className="action"
            to={`/collection/source/${encodeURIComponent(data.source.name)}`}
          >
            source collection
          </Link>
          {/^https?:\/\//.test(data.source.url) && (
            <a className="action-primary" href={data.source.url} target="_blank" rel="noreferrer">
              open source
            </a>
          )}
        </div>
      </header>
      <section className="record-stats">
        <div>
          <b>{date(data.observation.first_seen)}</b>
          <span>first observed</span>
        </div>
        <div>
          <b>{date(data.observation.last_seen)}</b>
          <span>last observed</span>
        </div>
        <div>
          <b>{data.source.status}</b>
          <span>source status</span>
        </div>
        <div>
          <b>{data.source.last_sync ? date(data.source.last_sync) : '—'}</b>
          <span>last synchronized</span>
        </div>
      </section>
      <div className="record-grid">
        <section className="record-section evidence-fields">
          <h2>Normalized source record</h2>
          {fields.length ? (
            <dl className="record-definition">
              {fields.map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll('_', ' ')}</dt>
                  <dd>{format(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="record-note">The source supplied no additional raw fields.</p>
          )}
        </section>
        <section className="record-section">
          <h2>Attribution</h2>
          <p>{data.attribution}</p>
          <p className="record-note">
            This local page preserves the observation used by the IOC decision. Follow the source
            link for its current upstream context.
          </p>
        </section>
      </div>
      <details className="record-section raw-evidence" open>
        <summary>Raw JSON</summary>
        <pre>{JSON.stringify(data.observation.raw, null, 2)}</pre>
      </details>
    </main>
  );
}

function format(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
const date = (value: string) => new Date(value).toISOString().slice(0, 10);
function State({ text }: { text: string }) {
  return <main className="record-page text-secondary">{text}</main>;
}
