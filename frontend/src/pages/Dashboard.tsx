import * as Dialog from '@radix-ui/react-dialog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type EntityData, type ExploreRow, type FacetItem } from '../api/client';
import { type FilterKey, useExploreFilters } from '../hooks/useExploreFilters';

function useCountUp(value = 0) {
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value);
    const from = previous.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 320);
      setShown(Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else previous.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

export function Dashboard() {
  const filters = useExploreFilters();
  const [contains, setContains] = useState(filters.params.get('contains') ?? '');
  const [basis, setBasis] = useState('first_seen');
  const [sort, setSort] = useState('last_seen');
  const [order, setOrder] = useState('desc');
  const page = Number(filters.params.get('page') ?? 1);
  const apiQuery = (() => {
    const next = new URLSearchParams(filters.params);
    next.delete('modal');
    next.delete('page');
    return next.toString();
  })();
  useEffect(() => {
    const timer = window.setTimeout(() => filters.setOne('contains', contains || undefined), 250);
    return () => clearTimeout(timer);
    // setOne is derived from the current URL; typing is the only trigger for this debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contains]);
  const summary = useQuery({
    queryKey: ['explore-summary', apiQuery],
    queryFn: () => api.exploreSummary(apiQuery),
    placeholderData: keepPreviousData,
  });
  const facets = useQuery({
    queryKey: ['explore-facets', apiQuery],
    queryFn: () => api.exploreFacets(apiQuery),
    placeholderData: keepPreviousData,
  });
  const series = useQuery({
    queryKey: ['explore-series', apiQuery, basis],
    queryFn: () => api.exploreTimeseries(apiQuery, 'day', 'none', basis),
    placeholderData: keepPreviousData,
  });
  const rows = useQuery({
    queryKey: ['explore-indicators', apiQuery, page, sort, order],
    queryFn: () => api.exploreIndicators(apiQuery, page, sort, order),
    placeholderData: keepPreviousData,
  });
  const count = useCountUp(summary.data?.total);
  const open = (kind: string, value: string) => filters.setOne('modal', `${kind}:${value}`);

  return (
    <main className="explore-page">
      <header className="explore-header">
        <div>
          <h1>IOC Atlas</h1>
          <p>
            {count.toLocaleString()} indicators across {summary.data?.sources ?? 0} sources ·{' '}
            {summary.data?.families ?? 0} families · {summary.data?.actors ?? 0} adversaries
          </p>
        </div>
        <span
          className={summary.isFetching || facets.isFetching ? 'query-state active' : 'query-state'}
        >
          {summary.isFetching || facets.isFetching ? 'querying' : 'ready'}
        </span>
      </header>
      <nav className="atlas-lenses" aria-label="Atlas lenses">
        <span>lenses</span>
        <a href="#activity">activity</a>
        <a href="#types">IOC types</a>
        <a href="#families">families</a>
        <a href="#actors">actors</a>
        <a href="#sources">sources</a>
        <a href="#geography">infrastructure</a>
      </nav>
      <section className="filter-shell" aria-label="Global filters">
        <input
          className="field contains-field"
          value={contains}
          onChange={(event) => setContains(event.target.value)}
          placeholder="contains value..."
          aria-label="Filter indicator values"
        />
        <div className="filter-selects">
          {(['type', 'source', 'family', 'actor', 'tag', 'country', 'asn'] as FilterKey[]).map(
            (key) => (
              <select
                key={key}
                className="field"
                value=""
                onChange={(event) => event.target.value && filters.toggle(key, event.target.value)}
                aria-label={`Filter by ${key}`}
              >
                <option value="">+ {key}</option>
                {(facets.data?.[key] ?? []).slice(0, 30).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            ),
          )}
          <input
            className="field date-field"
            type="date"
            value={filters.params.get('date_from') ?? ''}
            onChange={(event) => filters.setOne('date_from', event.target.value)}
            aria-label="From date"
          />
          <input
            className="field date-field"
            type="date"
            value={filters.params.get('date_to') ?? ''}
            onChange={(event) => filters.setOne('date_to', event.target.value)}
            aria-label="To date"
          />
        </div>
        {filters.active.length > 0 && (
          <div className="filter-chips">
            {filters.active.map(({ key, value }) => (
              <button key={`${key}-${value}`} onClick={() => filters.remove(key, value)}>
                {key}:{value} ×
              </button>
            ))}
            <button onClick={filters.clear}>clear all</button>
          </div>
        )}
      </section>
      <div className="explore-grid">
        <HeatMap
          data={series.data?.items ?? []}
          basis={basis}
          setBasis={setBasis}
          openDate={filters.openDate}
        />
        <FacetPanel
          id="types"
          title="Indicator types"
          kind="type"
          items={facets.data?.type}
          selected={filters.values('type')}
          onToggle={(v) => filters.toggle('type', v)}
        />
        <FacetPanel
          id="families"
          title="Malware families"
          kind="family"
          items={facets.data?.family}
          selected={filters.values('family')}
          onToggle={(v) => filters.toggle('family', v)}
        />
        <FacetPanel
          id="actors"
          title="Adversaries"
          kind="actor"
          items={facets.data?.actor}
          selected={filters.values('actor')}
          onToggle={(v) => filters.toggle('actor', v)}
        />
        <FacetPanel
          id="sources"
          title="Sources"
          kind="source"
          items={facets.data?.source}
          selected={filters.values('source')}
          onToggle={(v) => filters.toggle('source', v)}
        />
        <FacetPanel
          id="tags"
          title="Tags"
          kind="tag"
          items={facets.data?.tag}
          selected={filters.values('tag')}
          onToggle={(v) => filters.toggle('tag', v)}
          compact
        />
        <section id="geography" className="panel geography-panel">
          <h2 className="section-label">Geography</h2>
          <div className="geography-columns">
            <MiniFacet
              title="Countries"
              kind="country"
              items={facets.data?.country}
              selected={filters.values('country')}
              toggle={(v) => filters.toggle('country', v)}
            />
            <MiniFacet
              title="Networks"
              kind="asn"
              items={facets.data?.asn}
              selected={filters.values('asn')}
              toggle={(v) => filters.toggle('asn', v)}
            />
          </div>
        </section>
        <IndicatorTable
          data={rows.data}
          page={page}
          sort={sort}
          order={order}
          setPage={filters.setPage}
          setSort={(value) => {
            if (sort === value) setOrder(order === 'asc' ? 'desc' : 'asc');
            else {
              setSort(value);
              setOrder('desc');
            }
          }}
          open={(id) => open('indicator', String(id))}
        />
      </div>
      <EntityModal
        token={filters.params.get('modal')}
        close={() => filters.setOne('modal')}
        apply={(kind, value) => {
          const map: Record<string, FilterKey> = {
            family: 'family',
            actor: 'actor',
            type: 'type',
            source: 'source',
            tag: 'tag',
            country: 'country',
            asn: 'asn',
          };
          if (map[kind]) filters.applyFilter(map[kind], value);
          else filters.setOne('modal');
        }}
        open={open}
      />
    </main>
  );
}

function FacetPanel({
  id,
  title,
  kind,
  items = [],
  selected,
  onToggle,
  compact = false,
}: {
  id: string;
  title: string;
  kind: string;
  items?: FacetItem[];
  selected: string[];
  onToggle: (value: string) => void;
  compact?: boolean;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section id={id} className="panel facet-panel">
      <h2 className="section-label">{title}</h2>
      <div className={compact ? 'facet-list compact' : 'facet-list'}>
        {items.slice(0, compact ? 14 : 9).map((item) => (
          <div
            className={selected.includes(item.value) ? 'facet-row selected' : 'facet-row'}
            key={item.value}
          >
            <button className="facet-main" onClick={() => onToggle(item.value)}>
              <span>{item.label}</span>
              <span className="facet-bar">
                <i style={{ width: `${(100 * item.count) / max}%` }} />
              </span>
              <b>{item.count.toLocaleString()}</b>
            </button>
            <Link
              className="row-more"
              to={`/collection/${kind}/${encodeURIComponent(item.value)}`}
              aria-label={`Details for ${item.label}`}
            >
              ›
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniFacet({
  title,
  kind,
  items = [],
  selected,
  toggle,
}: {
  title: string;
  kind: string;
  items?: FacetItem[];
  selected: string[];
  toggle: (v: string) => void;
}) {
  return (
    <div>
      <h3>{title}</h3>
      {items.slice(0, 7).map((item) => (
        <div
          className={selected.includes(item.value) ? 'mini-row selected' : 'mini-row'}
          key={item.value}
        >
          <button onClick={() => toggle(item.value)}>{item.label}</button>
          <span>{item.count}</span>
          <Link
            to={`/collection/${kind}/${encodeURIComponent(item.value)}`}
            aria-label={`Details for ${item.label}`}
          >
            ›
          </Link>
        </div>
      ))}
    </div>
  );
}

function HeatMap({ data, basis, setBasis, openDate }: any) {
  const cell = 13;
  const gap = 3;
  const left = 34;
  const top = 24;
  const counts = new Map<string, number>(data.map((item: any) => [item.date, Number(item.total)]));
  const end = data.length ? new Date(`${data.at(-1).date}T00:00:00Z`) : new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);
  const dates: Date[] = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date;
  });
  const firstOffset = dates[0].getUTCDay();
  const positions = dates.map((date: Date, index: number) => {
    const slot = index + firstOffset;
    return { row: date.getUTCDay(), column: Math.floor(slot / 7) };
  });
  const columns = Math.max(1, ...positions.map((position: any) => position.column + 1));
  const width = left + columns * (cell + gap) + 8;
  const height = top + 7 * (cell + gap) + 20;
  const max = Math.max(1, ...data.map((item: any) => item.total));
  const colors = [
    'var(--color-heat-0)',
    'var(--color-heat-1)',
    'var(--color-heat-2)',
    'var(--color-heat-3)',
    'var(--color-heat-4)',
  ];
  const color = (value: number) =>
    colors[value === max ? 4 : Math.min(3, Math.ceil((value / max) * 4))];
  const months = dates.reduce<{ key: string; label: string; column: number }[]>(
    (items, date, index) => {
      const label = date.toLocaleString('en', { month: 'short', timeZone: 'UTC' });
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      const column = positions[index]?.column ?? 0;
      if (!items.some((item) => item.key === key)) items.push({ key, label, column });
      return items;
    },
    [],
  );

  return (
    <section id="activity" className="panel timeseries-panel">
      <div className="panel-heading">
        <h2 className="section-label">Indicator activity</h2>
        <div className="chart-controls">
          <label>
            basis{' '}
            <select value={basis} onChange={(event) => setBasis(event.target.value)}>
              <option value="first_seen">first seen</option>
              <option value="last_seen">last seen</option>
            </select>
          </label>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Indicator activity heat map"
        className="heatmap-svg"
      >
        {months.map((month) => (
          <text key={month.key} x={left + month.column * (cell + gap)} y="12">
            {month.label}
          </text>
        ))}
        {[
          [1, 'Mon'],
          [3, 'Wed'],
          [5, 'Fri'],
        ].map(([row, label]) => (
          <text key={label} x="0" y={top + Number(row) * (cell + gap) + 10}>
            {label}
          </text>
        ))}
        {dates.map((date: Date, index: number) => {
          const dateValue = date.toISOString().slice(0, 10);
          const total = counts.get(dateValue) ?? 0;
          return (
            <rect
              key={dateValue}
              x={left + positions[index].column * (cell + gap)}
              y={top + positions[index].row * (cell + gap)}
              width={cell}
              height={cell}
              fill={color(total)}
              stroke="var(--color-border)"
              tabIndex={0}
              onClick={() => openDate(dateValue)}
            >
              <title>
                {dateValue}: {total} indicators
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="heatmap-legend">
        <span>less</span>
        {colors.map((item) => (
          <i key={item} style={{ background: item }} />
        ))}
        <span>more</span>
        <small>
          {dates[0].toISOString().slice(0, 10)} — {dates.at(-1)?.toISOString().slice(0, 10)} · click
          a cell to filter
        </small>
      </div>
    </section>
  );
}

function IndicatorTable({
  data,
  page,
  sort,
  order,
  setPage,
  setSort,
  open,
}: {
  data?: { items: ExploreRow[]; total: number; page_size: number };
  page: number;
  sort: string;
  order: string;
  setPage: (v: number) => void;
  setSort: (v: string) => void;
  open: (id: number) => void;
}) {
  const heading = (label: string, key: string) => (
    <button onClick={() => setSort(key)}>
      {label}
      {sort === key ? (order === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? 25)));
  return (
    <section className="panel indicators-panel">
      <div className="panel-heading">
        <h2 className="section-label">Indicators</h2>
        <span>{(data?.total ?? 0).toLocaleString()} rows</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{heading('type', 'type')}</th>
              <th>{heading('value', 'value')}</th>
              <th>family / actor</th>
              <th>source</th>
              <th>geo</th>
              <th>{heading('first seen', 'first_seen')}</th>
              <th>{heading('last seen', 'last_seen')}</th>
              <th>{heading('conf', 'confidence')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id} onClick={() => open(row.id)}>
                <td>{row.type}</td>
                <td className="ioc-value">{row.value}</td>
                <td>
                  {row.families[0] ?? '—'}
                  <small>{row.actors[0] ?? ''}</small>
                </td>
                <td>{row.sources[0] ?? '—'}</td>
                <td>{row.country ? `${row.country} / AS${row.asn}` : '—'}</td>
                <td>{row.first_seen.slice(0, 10)}</td>
                <td>{row.last_seen.slice(0, 10)}</td>
                <td className={`verdict-${row.verdict}`}>{row.confidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          previous
        </button>
        <span>
          page {page} / {pages}
        </span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>
          next
        </button>
      </footer>
    </section>
  );
}

function EntityModal({
  token,
  close,
  apply,
  open,
}: {
  token: string | null;
  close: () => void;
  apply: (kind: string, value: string) => void;
  open: (kind: string, value: string) => void;
}) {
  const split = token?.indexOf(':') ?? -1;
  const kind = split > 0 ? token!.slice(0, split) : '';
  const value = split > 0 ? token!.slice(split + 1) : '';
  const query = useQuery({
    queryKey: ['entity', kind, value],
    queryFn: () => api.exploreEntity(kind, value),
    enabled: Boolean(kind && value),
  });
  const data = query.data as EntityData | undefined;
  return (
    <Dialog.Root open={Boolean(token)} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim" />
        <Dialog.Content className="entity-modal">
          <nav className="entity-crumb" aria-label="Entity position">
            Atlas / {kind || 'entity'} / {data?.title ?? value}
          </nav>
          <div className="modal-top">
            <div>
              <span className="section-label">{kind}</span>
              <Dialog.Title>{data?.title ?? value}</Dialog.Title>
            </div>
            <Dialog.Close aria-label="Close">×</Dialog.Close>
          </div>
          <Dialog.Description>
            {query.isLoading ? 'loading entity...' : data?.description}
          </Dialog.Description>
          {data && (
            <>
              {Object.keys(data.meta).length > 0 && (
                <section>
                  <h3 className="section-label">Context</h3>
                  <dl>
                    {Object.entries(data.meta).map(([key, item]) => (
                      <div key={key}>
                        <dt>{key.replaceAll('_', ' ')}</dt>
                        <dd>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {data.related.length > 0 && (
                <section>
                  <h3 className="section-label">Relationships</h3>
                  <p className="entity-section-note">
                    Open a related entity without losing the filters behind this drawer.
                  </p>
                  {data.related.map((item) => (
                    <button
                      className="related-row"
                      key={`${item.kind}-${item.value}`}
                      onClick={() => open(item.kind, item.value)}
                    >
                      {item.label}
                      <span>›</span>
                    </button>
                  ))}
                </section>
              )}
              <footer>
                {kind === 'indicator' && (
                  <Link className="action-primary" to={`/ioc/${value}`}>
                    open full record
                  </Link>
                )}
                {kind !== 'indicator' && kind !== 'bucket' && (
                  <>
                    <Link
                      className="action"
                      to={`/collection/${kind}/${encodeURIComponent(value)}`}
                    >
                      open collection
                    </Link>
                    <button className="action-primary" onClick={() => apply(kind, value)}>
                      apply as filter
                    </button>
                  </>
                )}
                <Dialog.Close className="action">close</Dialog.Close>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Panel({
  title,
  className = '',
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-3 border-b border-line pb-2 flex items-baseline justify-between">
      <h1 className="section-label mb-0">{title}</h1>
      <p className="m-0 text-[11px] text-secondary">{subtitle}</p>
    </header>
  );
}
