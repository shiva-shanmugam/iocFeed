import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { addTrailItem } from '../hooks/useInvestigationTrail';

export function IOCRecord() {
  const id = Number(useParams().id);
  const detail = useQuery({
    queryKey: ['ioc-record', id],
    queryFn: () => api.detail(id),
    enabled: Number.isFinite(id),
  });
  const graph = useQuery({
    queryKey: ['ioc-neighbours', id],
    queryFn: () => api.expand(id),
    enabled: Number.isFinite(id),
  });
  useEffect(() => {
    if (!detail.data) return;
    addTrailItem({
      key: `ioc:${id}`,
      label: detail.data.value,
      meta: detail.data.type,
      path: `/ioc/${id}`,
    });
  }, [detail.data, id]);
  if (detail.isLoading) return <State text="loading IOC record..." />;
  if (detail.error || !detail.data) return <State text="IOC record unavailable" />;
  const data = detail.data;
  const neighbours = (graph.data?.nodes ?? []).filter((node) => node.id !== id);
  const edgeByNode = new Map<number, string>();
  for (const edge of graph.data?.edges ?? [])
    edgeByNode.set(edge.source === id ? edge.target : edge.source, edge.type);

  return (
    <main className="record-page">
      <nav className="record-crumb" aria-label="IOC position">
        <Link to="/">Atlas</Link> / <Link to={`/collection/type/${data.type}`}>{data.type}</Link> /{' '}
        <b>IOC {data.id}</b>
      </nav>
      <header className="record-header ioc-record-header">
        <div>
          <p className="section-label">indicator record / {data.id}</p>
          <h1>{data.value}</h1>
          <p>
            {data.type} · first observed {date(data.first_seen)} · last observed{' '}
            {date(data.last_seen)}
          </p>
        </div>
        <div className="record-actions">
          <button className="action" onClick={() => navigator.clipboard.writeText(data.value)}>
            copy IOC
          </button>
          <Link className="action-primary" to={`/investigate/${data.id}`}>
            open graph
          </Link>
        </div>
      </header>

      <section className={`decision-block verdict-border-${data.verdict}`}>
        <div className="decision-line">
          <strong className={`verdict-${data.verdict}`}>{data.verdict.toUpperCase()}</strong>
          <span>confidence {data.confidence}/100</span>
        </div>
        <div className="decision-bar">
          <i style={{ width: `${data.confidence}%` }} />
        </div>
        <p>{data.decision?.summary ?? 'Stored verdict from the current evidence set.'}</p>
        <b>recommended disposition: {data.decision?.action ?? 'review the supporting evidence'}</b>
        <ul>
          {data.decision?.factors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
      </section>

      <div className="record-grid ioc-grid">
        <section className="record-section">
          <h2>Evidence reports</h2>
          <p className="record-note">Locally stored source observations supporting this IOC.</p>
          <div className="evidence-list">
            {data.sources?.map((source) => (
              <Link
                key={source.name}
                to={`/evidence/${data.id}/${encodeURIComponent(source.name)}`}
              >
                <span>
                  <b>{source.name}</b>
                  <small>
                    {date(source.first_seen)} → {date(source.last_seen)}
                  </small>
                </span>
                <em>read evidence ›</em>
              </Link>
            ))}
            {!data.sources?.length && (
              <p className="record-note">No source observations are attached.</p>
            )}
          </div>
        </section>

        <section className="record-section">
          <h2>Classification</h2>
          <dl className="record-definition">
            <div>
              <dt>families</dt>
              <dd>{data.families?.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>actors</dt>
              <dd>{data.actors?.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>tags</dt>
              <dd>{data.tags?.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>relationships</dt>
              <dd>{data.relationship_count ?? 0}</dd>
            </div>
            {data.geo && (
              <>
                <div>
                  <dt>country</dt>
                  <dd>{data.geo.country}</dd>
                </div>
                <div>
                  <dt>network</dt>
                  <dd>
                    AS{data.geo.asn} {data.geo.as_name}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>

        <section className="record-section">
          <h2>Continue exploring</h2>
          <div className="continuation-list">
            {data.families?.map((value) => (
              <CollectionLink key={`family:${value}`} kind="family" value={value} />
            ))}
            {data.actors?.map((value) => (
              <CollectionLink key={`actor:${value}`} kind="actor" value={value} />
            ))}
            {data.tags?.map((value) => (
              <CollectionLink key={`tag:${value}`} kind="tag" value={value} />
            ))}
            {data.sources?.map((source) => (
              <CollectionLink key={`source:${source.name}`} kind="source" value={source.name} />
            ))}
            {data.geo && (
              <CollectionLink kind="asn" value={String(data.geo.asn)} label={`AS${data.geo.asn}`} />
            )}
          </div>
        </section>

        <section className="record-section">
          <h2>Explicit relationships</h2>
          {neighbours.length ? (
            <div className="continuation-list">
              {neighbours.map((node) => (
                <Link key={node.id} to={`/ioc/${node.id}`}>
                  <span>{node.value}</span>
                  <small>
                    {edgeByNode.get(node.id) ?? 'related'} · {node.type}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <p className="record-note">
              No explicit relationships are stored. Metadata collections above may still provide
              useful pivots.
            </p>
          )}
        </section>
      </div>

      <details className="record-section raw-evidence">
        <summary>Raw stored observations</summary>
        <pre>{JSON.stringify(data.raw, null, 2)}</pre>
      </details>
    </main>
  );
}

function CollectionLink({ kind, value, label }: { kind: string; value: string; label?: string }) {
  return (
    <Link to={`/collection/${kind}/${encodeURIComponent(value)}`}>
      <span>{label ?? value}</span>
      <small>{kind}</small>
    </Link>
  );
}
const date = (value: string) => new Date(value).toISOString().slice(0, 10);
function State({ text }: { text: string }) {
  return <main className="record-page text-secondary">{text}</main>;
}
