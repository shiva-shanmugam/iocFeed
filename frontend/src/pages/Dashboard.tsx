import * as Dialog from '@radix-ui/react-dialog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, type EntityData, type ExploreRow, type FacetItem } from '../api/client';
import { type FilterKey, useExploreFilters } from '../hooks/useExploreFilters';

const palette = ['#7aa2f7', '#8a8a8e', '#606064', '#444448', '#303033', '#55555a'];

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
  const [bucket, setBucket] = useState('day');
  const [group, setGroup] = useState('type');
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
    queryKey: ['explore-series', apiQuery, bucket, group, basis],
    queryFn: () => api.exploreTimeseries(apiQuery, bucket, group, basis),
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
          <h1>Explore</h1>
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
        <TimeSeries
          data={series.data?.items ?? []}
          bucket={bucket}
          group={group}
          basis={basis}
          setBucket={setBucket}
          setGroup={setGroup}
          setBasis={setBasis}
          setDate={filters.setDates}
          open={open}
        />
        <FacetPanel
          title="Indicator types"
          items={facets.data?.type}
          selected={filters.values('type')}
          onToggle={(v) => filters.toggle('type', v)}
          onOpen={(v) => open('type', v)}
        />
        <FacetPanel
          title="Malware families"
          items={facets.data?.family}
          selected={filters.values('family')}
          onToggle={(v) => filters.toggle('family', v)}
          onOpen={(v) => open('family', v)}
        />
        <FacetPanel
          title="Adversaries"
          items={facets.data?.actor}
          selected={filters.values('actor')}
          onToggle={(v) => filters.toggle('actor', v)}
          onOpen={(v) => open('actor', v)}
        />
        <FacetPanel
          title="Sources"
          items={facets.data?.source}
          selected={filters.values('source')}
          onToggle={(v) => filters.toggle('source', v)}
          onOpen={(v) => open('source', v)}
        />
        <FacetPanel
          title="Tags"
          items={facets.data?.tag}
          selected={filters.values('tag')}
          onToggle={(v) => filters.toggle('tag', v)}
          onOpen={(v) => open('tag', v)}
          compact
        />
        <section className="panel geography-panel">
          <h2 className="section-label">Geography</h2>
          <div className="geography-columns">
            <MiniFacet
              title="Countries"
              items={facets.data?.country}
              selected={filters.values('country')}
              toggle={(v) => filters.toggle('country', v)}
              open={(v) => open('country', v)}
            />
            <MiniFacet
              title="Networks"
              items={facets.data?.asn}
              selected={filters.values('asn')}
              toggle={(v) => filters.toggle('asn', v)}
              open={(v) => open('asn', v)}
            />
          </div>
        </section>
        <IndicatorTable
          data={rows.data}
          page={page}
          sort={sort}
          order={order}
          setPage={(v) => filters.setOne('page', String(v))}
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
  title,
  items = [],
  selected,
  onToggle,
  onOpen,
  compact = false,
}: {
  title: string;
  items?: FacetItem[];
  selected: string[];
  onToggle: (value: string) => void;
  onOpen: (value: string) => void;
  compact?: boolean;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="panel facet-panel">
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
            <button
              className="row-more"
              onClick={() => onOpen(item.value)}
              aria-label={`Details for ${item.label}`}
            >
              ›
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniFacet({
  title,
  items = [],
  selected,
  toggle,
  open,
}: {
  title: string;
  items?: FacetItem[];
  selected: string[];
  toggle: (v: string) => void;
  open: (v: string) => void;
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
          <button onClick={() => open(item.value)} aria-label={`Details for ${item.label}`}>
            ›
          </button>
        </div>
      ))}
    </div>
  );
}

function TimeSeries({
  data,
  bucket,
  group,
  basis,
  setBucket,
  setGroup,
  setBasis,
  setDate,
  open,
}: any) {
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(Math.max(0, data.length - 1));
  useEffect(() => setRangeEnd(Math.max(0, data.length - 1)), [data.length]);
  const width = 1000,
    height = 230,
    left = 42,
    bottom = 28;
  const keys = [...new Set<string>(data.flatMap((item: any) => Object.keys(item.series)))].slice(
    0,
    6,
  );
  const max = Math.max(1, ...data.map((item: any) => item.total));
  const x = (index: number) => left + index * ((width - left - 12) / Math.max(1, data.length - 1));
  const y = (value: number) => height - bottom - (value / max) * (height - bottom - 12);
  const cumulative: number[] = data.map(() => 0);
  const bands = keys.map((key) => {
    const lower = [...cumulative];
    const upper = data.map((item: any, index: number) => {
      cumulative[index] += item.series[key] ?? 0;
      return cumulative[index];
    });
    return { key, lower, upper };
  });
  return (
    <section className="panel timeseries-panel">
      <div className="panel-heading">
        <h2 className="section-label">Indicator volume</h2>
        <div className="chart-controls">
          <label>
            bucket{' '}
            <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
              <option>day</option>
              <option>week</option>
              <option>month</option>
            </select>
          </label>
          <label>
            group{' '}
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option>type</option>
              <option>source</option>
              <option>family</option>
              <option>none</option>
            </select>
          </label>
          <label>
            basis{' '}
            <select value={basis} onChange={(e) => setBasis(e.target.value)}>
              <option value="first_seen">first seen</option>
              <option value="last_seen">last seen</option>
            </select>
          </label>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Indicator volume over time"
        className="timeseries-svg"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={left} x2={width - 8} y1={y(max * v)} y2={y(max * v)} />
            <text x={left - 6} y={y(max * v) + 3}>
              {Math.round(max * v)}
            </text>
          </g>
        ))}
        {bands.map((band, keyIndex) => {
          const top = band.upper
            .map((value: number, index: number) => `${index ? 'L' : 'M'}${x(index)},${y(value)}`)
            .join('');
          const bottomPath = band.lower
            .map((value: number, index: number) => `L${x(index)},${y(value)}`)
            .reverse()
            .join('');
          return (
            <path
              key={band.key}
              d={`${top}${bottomPath}Z`}
              fill={palette[keyIndex]}
              stroke="var(--color-bg)"
              strokeWidth="1"
              opacity="0.85"
            />
          );
        })}
        {data.map((item: any, index: number) => (
          <rect
            key={item.date}
            x={x(index) - Math.max(2, 450 / data.length)}
            y="8"
            width={Math.max(4, 900 / data.length)}
            height={height - bottom - 8}
            fill="transparent"
            tabIndex={0}
            onDoubleClick={() => {
              setDate(item.date, item.date);
              open('bucket', item.date);
            }}
          >
            <title>
              {item.date}: {item.total}
            </title>
          </rect>
        ))}
        <line
          className="baseline"
          x1={left}
          x2={width - 8}
          y1={height - bottom}
          y2={height - bottom}
        />
        <text x={left} y={height - 8}>
          {data[0]?.date ?? '—'}
        </text>
        <text textAnchor="end" x={width - 8} y={height - 8}>
          {data.at(-1)?.date ?? '—'}
        </text>
      </svg>
      {data.length > 1 && (
        <div className="series-brush" aria-label="Date range brush">
          <input
            type="range"
            min="0"
            max={data.length - 1}
            value={rangeStart}
            onChange={(event) => setRangeStart(Math.min(Number(event.target.value), rangeEnd))}
            onMouseUp={() => setDate(data[rangeStart]?.date, data[rangeEnd]?.date)}
          />
          <input
            type="range"
            min="0"
            max={data.length - 1}
            value={rangeEnd}
            onChange={(event) => setRangeEnd(Math.max(Number(event.target.value), rangeStart))}
            onMouseUp={() => setDate(data[rangeStart]?.date, data[rangeEnd]?.date)}
          />
          <span>
            {data[rangeStart]?.date} — {data[rangeEnd]?.date}
          </span>
        </div>
      )}
      <div className="chart-legend">
        {keys.map((key, index) => (
          <span key={key}>
            <i style={{ background: palette[index] }} />
            {key}
          </span>
        ))}
        <small>double-click a bucket to filter</small>
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
              <dl>
                {Object.entries(data.meta).map(([key, item]) => (
                  <div key={key}>
                    <dt>{key.replace('_', ' ')}</dt>
                    <dd>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</dd>
                  </div>
                ))}
              </dl>
              {data.related.length > 0 && (
                <section>
                  <h3 className="section-label">Related</h3>
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
                {kind !== 'indicator' && kind !== 'bucket' && (
                  <button className="action-primary" onClick={() => apply(kind, value)}>
                    apply as filter
                  </button>
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
