import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, type ReplayData, type ReplayState } from '../api/client';

const date = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function Replay() {
  const id = Number(useParams().id);
  const query = useQuery({
    queryKey: ['replay', id],
    queryFn: () => api.replay(id),
    enabled: Number.isInteger(id) && id > 0,
  });
  if (!id) return <ReplayPicker />;
  if (query.isLoading)
    return <main className="record-page text-secondary">loading captured evidence…</main>;
  if (query.error || !query.data)
    return (
      <main className="record-page">
        <p>Evidence replay unavailable for this IOC.</p>
        <Link className="action" to="/replay">
          choose another IOC
        </Link>
      </main>
    );
  return <ReplayRecord key={id} data={query.data} />;
}

function ReplayPicker() {
  const [value, setValue] = useState('');
  const leaders = useQuery({
    queryKey: ['graph-leaders'],
    queryFn: api.graphLeaders,
    staleTime: 60000,
  });
  const results = useQuery({
    queryKey: ['replay-search', value],
    queryFn: () => api.search(value),
    enabled: value.length > 2,
  });
  const items = value.length > 2 ? results.data?.items : leaders.data?.items;
  return (
    <main className="record-page replay-page">
      <header className="record-header">
        <div>
          <p className="section-label">evidence replay</p>
          <h1>Captured evidence over time</h1>
          <p>
            Compare a recorded state with the current IOC, including source origins and explicit
            relationships.
          </p>
        </div>
      </header>
      <input
        className="field replay-search"
        aria-label="Find replay IOC"
        placeholder="find an IP, domain, URL, or hash"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <section className="record-section">
        <h2>{value.length > 2 ? 'Matching IOCs' : 'Connected starting points'}</h2>
        {items?.map((item) => (
          <Link className="replay-pick" key={item.id} to={`/replay/${item.id}`}>
            <span>{item.value}</span>
            <small>{'connections' in item ? `${item.connections} relationships` : item.type}</small>
            <span>replay ›</span>
          </Link>
        ))}
        {value.length > 2 && !results.isFetching && !items?.length && (
          <p className="record-note">No matching IOCs.</p>
        )}
      </section>
      <p className="record-note">
        Replay starts when a state is captured. Source observation dates do not reconstruct missing
        history. Demo walkthroughs are labeled.
      </p>
    </main>
  );
}

function ReplayRecord({ data }: { data: ReplayData }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('at');
  const requestedIndex = requested
    ? data.snapshots.reduce(
        (last, s, i) => (s.recorded_at.slice(0, 10) <= requested ? i : last),
        -1,
      )
    : -1;
  const captureIndex = data.snapshots.findIndex((s) => String(s.id) === params.get('capture'));
  const [index, setIndex] = useState(
    captureIndex >= 0 ? captureIndex : requested ? requestedIndex : 0,
  );
  const snapshot = data.snapshots[index];
  const before = snapshot?.state;
  const now = data.current;
  const select = (next: number) => {
    setIndex(next);
    const p = new URLSearchParams();
    p.set('capture', String(data.snapshots[next].id));
    setParams(p, { replace: true });
  };
  const knownOrigins = new Set(before?.sources.map((s) => s.origin).filter(Boolean));
  const unassigned = before?.sources.filter((s) => !s.origin).length ?? 0;
  const sourceNames = new Set(
    data.snapshots.flatMap((s) => s.state.sources.map((source) => source.name)),
  );
  now.sources.forEach((s) => sourceNames.add(s.name));
  const added = now.sources.filter((s) => !before?.sources.some((old) => old.name === s.name));
  const removed =
    before?.sources.filter((s) => !now.sources.some((latest) => latest.name === s.name)) ?? [];
  const oldEdges = new Set(before?.relationships.map((e) => e.id));
  const newEdges = new Set(now.relationships.map((e) => e.id));
  const addedEdges = now.relationships.filter((e) => !oldEdges.has(e.id));
  const removedEdges = before?.relationships.filter((e) => !newEdges.has(e.id)) ?? [];
  return (
    <main className="record-page replay-page">
      <nav className="record-crumb">
        <Link to="/replay">Replay</Link> /{' '}
        <Link to={`/ioc/${data.indicator.id}`}>IOC {data.indicator.id}</Link>
      </nav>
      <header className="record-header">
        <div>
          <p className="section-label">evidence replay / {data.indicator.type}</p>
          <h1>{data.indicator.value}</h1>
          <p>{data.snapshots.length} captured states · UTC</p>
        </div>
        <div className="record-actions">
          <Link className="action" to={`/ioc/${data.indicator.id}`}>
            full record
          </Link>
          <Link className="action" to={`/investigate/${data.indicator.id}`}>
            open relation graph
          </Link>
        </div>
      </header>
      {data.has_simulated_history && (
        <p className="replay-notice">
          DEMO HISTORY · Earlier stages are simulated campaign fixtures. Captures marked “recorded”
          are stored baselines; the underlying IOC data is synthetic.
        </p>
      )}
      <section className="record-section replay-timeline">
        <div className="record-section-heading">
          <h2>Capture timeline</h2>
          <span>{snapshot ? date(snapshot.recorded_at) : 'No capture selected'}</span>
        </div>
        <CaptureChart data={data} selected={index} />
        {data.snapshots.length > 1 && (
          <input
            className="replay-range"
            aria-label="Evidence capture"
            type="range"
            min="0"
            max={data.snapshots.length - 1}
            value={Math.max(0, index)}
            onChange={(e) => select(Number(e.target.value))}
          />
        )}
        <div className="replay-captures">
          {data.snapshots.map((s, i) => (
            <button
              key={s.id}
              className={index === i ? 'selected' : ''}
              aria-pressed={index === i}
              onClick={() => select(i)}
            >
              <span>{date(s.recorded_at)}</span>
              <b>{s.reason}</b>
              <small>
                {s.simulated ? 'simulated' : 'recorded'} · conf {s.state.confidence}
              </small>
            </button>
          ))}
        </div>
        <p className="record-note">
          {data.notice}
          {data.truncated ? ' Showing the latest 500 captures.' : ''}
        </p>
      </section>
      {!before ? (
        <section className="record-section">
          <h2>No captured state for this date</h2>
          <p className="record-note">
            {requested
              ? `The requested day (${requested}) precedes stored capture history.`
              : 'This IOC has no recorded history yet. Its current record remains available.'}
          </p>
          {data.snapshots.length > 0 && (
            <button className="action" onClick={() => select(0)}>
              open earliest capture
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="replay-comparison" aria-label="Captured and current verdict">
            <div>
              <span className="section-label">selected capture</span>
              <b className={`verdict-${before.verdict}`}>{before.verdict.toUpperCase()}</b>
              <span>conf {before.confidence}/100</span>
              <i>
                <em style={{ width: `${before.confidence}%` }} />
              </i>
            </div>
            <div className="replay-comparison-arrow" aria-hidden="true">
              →
            </div>
            <div>
              <span className="section-label">current record</span>
              <b className={`verdict-${now.verdict}`}>{now.verdict.toUpperCase()}</b>
              <span>
                conf {now.confidence}/100 · {now.confidence - before.confidence >= 0 ? '+' : ''}
                {now.confidence - before.confidence}
              </span>
              <i>
                <em style={{ width: `${now.confidence}%` }} />
              </i>
            </div>
            <div className="replay-change-counts">
              <span>
                {before.sources.length} → {now.sources.length} source mentions
              </span>
              <span>
                {before.relationship_count} → {now.relationship_count} relationships
              </span>
              <span>
                {added.length} source additions · {removed.length} removals
              </span>
            </div>
          </section>
          <div className="replay-visual-grid">
            <section className="record-section">
              <h2>Source trail</h2>
              <p className="record-note">
                A point marks a source present in that capture. The vertical line is your selected
                capture.
              </p>
              <div className="replay-lanes">
                {[...sourceNames].slice(0, 16).map((name) => (
                  <div className="replay-lane" key={name}>
                    <span>{name}</span>
                    <svg
                      viewBox="0 0 400 24"
                      role="img"
                      aria-label={`${name} presence over capture history`}
                    >
                      <line x1="12" y1="12" x2="388" y2="12" className="replay-baseline" />
                      {data.snapshots.map((s, i) => {
                        const x = position(i, data.snapshots.length, 400, 12);
                        return (
                          <g key={s.id}>
                            {index === i && (
                              <line x1={x} y1="1" x2={x} y2="23" className="replay-selected-line" />
                            )}
                            {s.state.sources.some((source) => source.name === name) && (
                              <circle
                                cx={x}
                                cy="12"
                                r="3"
                                className={index === i ? 'replay-point selected' : 'replay-point'}
                              />
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ))}
              </div>
              <div className="replay-origin-summary">
                <b>
                  {before.sources.length} mentions / {knownOrigins.size} declared origins
                </b>
                <span>
                  {unassigned} with unknown origin. A shared origin is grouped; separate feed names
                  do not establish independence.
                </span>
              </div>
            </section>
            <section className="record-section">
              <h2>Relationship changes</h2>
              <p className="record-note">
                Same positions in both views. Accent outlines show links added since this capture.
              </p>
              <Neighbourhood before={before} now={now} />
              <p className="record-note">
                {addedEdges.length} added · {removedEdges.length} removed in the captured edge
                sample. Miniatures show up to 18 neighbours;{' '}
                <Link to={`/investigate/${data.indicator.id}`}>open the graph</Link> for expansion.
              </p>
            </section>
          </div>
          <section className="record-section">
            <h2>Evidence at this capture</h2>
            <div className="replay-evidence-list">
              {before.sources.map((source) => (
                <article key={source.name}>
                  <div>
                    <b>{source.name}</b>
                    <span>{source.synthetic ? 'synthetic fixture' : 'stored observation'}</span>
                  </div>
                  <p>{source.excerpt}</p>
                  <dl>
                    <dt>upstream origin</dt>
                    <dd>{source.origin ?? 'not supplied'}</dd>
                    <dt>source observation</dt>
                    <dd>
                      {source.first_seen.slice(0, 10)} → {source.last_seen.slice(0, 10)}
                    </dd>
                  </dl>
                  {now.sources.some((s) => s.name === source.name) && (
                    <Link to={`/evidence/${data.indicator.id}/${encodeURIComponent(source.name)}`}>
                      current source record ›
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function position(index: number, count: number, width: number, padding: number) {
  return count <= 1 ? width / 2 : padding + (index / (count - 1)) * (width - 2 * padding);
}
function CaptureChart({ data, selected }: { data: ReplayData; selected: number }) {
  const points = data.snapshots.map((s, i) => ({
    x: position(i, data.snapshots.length, 960, 20),
    y: 100 - s.state.confidence * 0.75,
  }));
  const path = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `H${p.x}V${p.y}`)).join(' ');
  return (
    <svg
      className="replay-confidence-chart"
      viewBox="0 0 960 126"
      role="img"
      aria-label="Confidence at recorded captures"
    >
      <line x1="20" y1="100" x2="940" y2="100" className="replay-baseline" />
      <path d={path} className="replay-step" />
      {points.map((p, i) => (
        <g key={i}>
          {selected === i && (
            <line x1={p.x} x2={p.x} y1="8" y2="100" className="replay-selected-line" />
          )}
          <circle
            cx={p.x}
            cy={p.y}
            r="3"
            className={selected === i ? 'replay-point selected' : 'replay-point'}
          />
          <text x={p.x} y={Math.max(12, p.y - 10)} textAnchor="middle">
            {data.snapshots[i].state.confidence}
          </text>
          <text x={p.x} y="119" textAnchor="middle">
            {new Date(data.snapshots[i].recorded_at).toISOString().slice(5, 10)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Neighbourhood({ before, now }: { before: ReplayState; now: ReplayState }) {
  const old = new Set(before.relationships.map((e) => e.other_id));
  const latest = new Set(now.relationships.map((e) => e.other_id));
  const added = [...latest].filter((id) => !old.has(id));
  const removed = [...old].filter((id) => !latest.has(id));
  const shared = [...old].filter((id) => latest.has(id));
  const ids = [
    ...new Set([
      ...added.slice(0, 8),
      ...removed.slice(0, 4),
      ...shared.slice(0, 6),
      ...added,
      ...removed,
      ...shared,
    ]),
  ].slice(0, 18);
  return (
    <div className="replay-miniatures">
      {[
        { label: 'selected capture', present: old },
        { label: 'current record', present: latest },
      ].map(({ label, present }) => (
        <figure key={label}>
          <figcaption>{label}</figcaption>
          <svg viewBox="0 0 260 190" role="img" aria-label={`${label} relationship neighbourhood`}>
            {ids.map((id, i) => {
              const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
              const x = 130 + Math.cos(angle) * 80,
                y = 95 + Math.sin(angle) * 72;
              const edge = [...now.relationships, ...before.relationships].find(
                (e) => e.other_id === id,
              )!;
              return (
                <g key={id} opacity={present.has(id) ? 1 : 0.13}>
                  <line
                    x1="130"
                    y1="95"
                    x2={x}
                    y2={y}
                    className={
                      !old.has(id) && present === latest ? 'replay-added-edge' : 'replay-baseline'
                    }
                  />
                  <Link to={`/ioc/${id}`}>
                    <title>
                      {edge.value} / {edge.relation}
                    </title>
                    {edge.type === 'url' ? (
                      <rect
                        x={x - 3}
                        y={y - 3}
                        width="6"
                        height="6"
                        className={
                          !old.has(id) && present === latest
                            ? 'replay-neighbour added'
                            : 'replay-neighbour'
                        }
                      />
                    ) : (
                      <circle
                        cx={x}
                        cy={y}
                        r="3"
                        className={
                          !old.has(id) && present === latest
                            ? 'replay-neighbour added'
                            : 'replay-neighbour'
                        }
                      />
                    )}
                  </Link>
                </g>
              );
            })}
            <circle cx="130" cy="95" r="5" className="replay-root" />
          </svg>
        </figure>
      ))}
    </div>
  );
}
