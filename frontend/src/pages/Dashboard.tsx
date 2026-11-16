import * as Dialog from '@radix-ui/react-dialog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const containsInitialized = useRef(false);
  const [basis, setBasis] = useState('first_seen');
  const [sort, setSort] = useState('last_seen');
  const [order, setOrder] = useState('desc');
  const page = Number(filters.params.get('page') ?? 1);
  const apiQuery = (() => {
    const next = new URLSearchParams(filters.params);
    next.delete('modal');
    next.delete('page');
    if (next.has('date_from') || next.has('date_to')) next.set('date_basis', basis);
    else next.delete('date_basis');
    return next.toString();
  })();
  const seriesQuery = (() => {
    const next = new URLSearchParams(filters.params);
    next.delete('modal');
    next.delete('page');
    next.delete('date_from');
    next.delete('date_to');
    return next.toString();
  })();
  useEffect(() => {
    if (!containsInitialized.current) {
      containsInitialized.current = true;
      return;
    }
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
    queryKey: ['explore-series', seriesQuery, basis],
    queryFn: () => api.exploreTimeseries(seriesQuery, 'day', 'none', basis),
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
        <TemporalArchive
          data={series.data?.items ?? []}
          basis={basis}
          setBasis={setBasis}
          openDate={filters.openDate}
          selectedDate={
            filters.params.get('date_from') === filters.params.get('date_to')
              ? filters.params.get('date_from')
              : null
          }
          clearDate={filters.clearDates}
          rows={rows.isFetching ? undefined : rows.data}
          page={page}
          setPage={filters.setPage}
          openIOC={(id) => open('indicator', String(id))}
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
        {!(
          filters.params.get('date_from') &&
          filters.params.get('date_from') === filters.params.get('date_to')
        ) && (
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
        )}
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

type TimePoint = { date: string; total: number };
const HEAT_COLORS = [
  'var(--color-heat-0)',
  'var(--color-heat-1)',
  'var(--color-heat-2)',
  'var(--color-heat-3)',
  'var(--color-heat-4)',
];

function TemporalArchive({
  data,
  basis,
  setBasis,
  openDate,
  selectedDate,
  clearDate,
  rows,
  page,
  setPage,
  openIOC,
}: {
  data: TimePoint[];
  basis: string;
  setBasis: (value: string) => void;
  openDate: (value: string) => void;
  selectedDate: string | null;
  clearDate: () => void;
  rows?: { items: ExploreRow[]; total: number; page_size: number };
  page: number;
  setPage: (value: number) => void;
  openIOC: (id: number) => void;
}) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { counts, years } = useMemo(() => {
    const counts = new Map(data.map((item) => [item.date, Number(item.total)]));
    const totals = new Map<number, number>();
    data.forEach((item) => {
      const year = Number(item.date.slice(0, 4));
      totals.set(year, (totals.get(year) ?? 0) + Number(item.total));
    });
    return {
      counts,
      years: Array.from(totals, ([year, total]) => ({ year, total })).sort(
        (a, b) => a.year - b.year,
      ),
    };
  }, [data]);
  const yearStart = selectedYear === null ? null : new Date(Date.UTC(selectedYear, 0, 1));
  const daysInYear = yearStart
    ? Math.round((Date.UTC(selectedYear! + 1, 0, 1) - yearStart.getTime()) / 86_400_000)
    : 0;
  const slots = yearStart
    ? [
        ...Array.from({ length: yearStart.getUTCDay() }, () => null),
        ...Array.from({ length: daysInYear }, (_, index) => {
          const day = new Date(Date.UTC(selectedYear!, 0, index + 1));
          const date = day.toISOString().slice(0, 10);
          return { date, total: counts.get(date) ?? 0, month: day.getUTCMonth() };
        }),
      ]
    : [];
  const max = Math.max(1, ...slots.map((item) => item?.total ?? 0));
  const monthLabels = slots.reduce<{ name: string; column: number }[]>((labels, item, index) => {
    if (item && (index === 0 || item.date.endsWith('-01'))) {
      labels.push({
        name: new Date(Date.UTC(selectedYear!, item.month, 1)).toLocaleString('en', {
          month: 'short',
          timeZone: 'UTC',
        }),
        column: Math.floor(index / 7),
      });
    }
    return labels;
  }, []);
  const totalPages = Math.max(1, Math.ceil((rows?.total ?? 0) / (rows?.page_size ?? 25)));
  const chooseYear = (year: number) => {
    setSelectedYear((current) => (current === year ? null : year));
    if (selectedDate) clearDate();
  };

  return (
    <section id="activity" className="panel timeseries-panel archive-panel">
      <div className="panel-heading">
        <div>
          <h2 className="section-label">Temporal archive</h2>
          <p className="archive-note">open a year / select a day / inspect its IOCs</p>
        </div>
        <div className="chart-controls">
          <label>
            basis{' '}
            <select
              value={basis}
              onChange={(event) => {
                setBasis(event.target.value);
                if (selectedDate) clearDate();
              }}
            >
              <option value="first_seen">first seen</option>
              <option value="last_seen">last seen</option>
            </select>
          </label>
        </div>
      </div>
      <div className="archive-stack-shell">
        <div className="archive-depth-labels" aria-hidden="true">
          <span>oldest / back</span>
          <span>newest / front</span>
        </div>
        <div className="archive-stack" aria-label="Archive year files">
          {years.map((item, index) => {
            const isOpen = item.year === selectedYear;
            return (
              <article
                key={item.year}
                className={isOpen ? 'archive-folder selected' : 'archive-folder'}
                style={{ '--folder-index': index, '--tab-slot': index % 4 } as React.CSSProperties}
              >
                <button
                  className="archive-folder-tab"
                  onClick={() => chooseYear(item.year)}
                  aria-expanded={isOpen}
                  aria-label={`${item.year}: ${item.total.toLocaleString()} indicators`}
                >
                  {item.year}
                </button>
                <div className="archive-folder-face">
                  <div className="archive-folder-meta">
                    <strong>{item.total.toLocaleString()} IOC</strong>
                    <small>
                      {item.year} / {basis.replace('_', ' ')}
                    </small>
                  </div>
                  <span className="archive-folder-state">
                    {isOpen ? 'close file' : 'open file'}
                  </span>
                  {isOpen && (
                    <div className="archive-folder-drawer">
                      <div className="archive-drawer-heading">
                        <span>activity / {item.year}</span>
                        <small>each square is a day; select one for IOC records</small>
                      </div>
                      <div
                        className="archive-year-calendar"
                        role="group"
                        aria-label={`${item.year} daily IOC heat map`}
                      >
                        <div className="archive-month-axis" aria-hidden="true">
                          {monthLabels.map((month) => (
                            <span key={month.name} style={{ gridColumn: month.column + 1 }}>
                              {month.name}
                            </span>
                          ))}
                        </div>
                        <div className="archive-year-grid">
                          {slots.map((cell, slot) =>
                            cell ? (
                              <button
                                key={cell.date}
                                className={selectedDate === cell.date ? 'selected' : ''}
                                style={{
                                  backgroundColor:
                                    HEAT_COLORS[
                                      cell.total === max
                                        ? 4
                                        : Math.min(3, Math.ceil((cell.total / max) * 4))
                                    ],
                                }}
                                onClick={() => openDate(cell.date)}
                                aria-label={`${cell.date}: ${cell.total} indicators`}
                                title={`${cell.date}: ${cell.total.toLocaleString()} indicators`}
                              />
                            ) : (
                              <i key={`offset-${slot}`} />
                            ),
                          )}
                        </div>
                      </div>
                      <div className="heatmap-legend">
                        <span>less</span>
                        {HEAT_COLORS.map((color) => (
                          <i key={color} style={{ background: color }} />
                        ))}
                        <span>more</span>
                      </div>
                      {selectedDate && selectedDate.startsWith(`${item.year}-`) && (
                        <div className="archive-results">
                          <div className="archive-results-heading">
                            <strong>{selectedDate} / IOC records</strong>
                            <button onClick={clearDate}>clear day filter</button>
                          </div>
                          <div className="archive-results-scroll">
                            {!rows && <p>Loading IOC records…</p>}
                            {rows?.items.map((row) => (
                              <button
                                key={row.id}
                                className="archive-result"
                                onClick={() => openIOC(row.id)}
                              >
                                <span>{row.type}</span>
                                <span>{row.value}</span>
                                <span className={`verdict-${row.verdict}`}>{row.verdict}</span>
                              </button>
                            ))}
                            {rows && rows.items.length === 0 && (
                              <p>No matching IOCs on this day.</p>
                            )}
                          </div>
                          <div className="archive-results-page">
                            <span>
                              {(rows?.total ?? 0).toLocaleString()} IOCs · page {page} /{' '}
                              {totalPages}
                            </span>
                            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                              previous
                            </button>
                            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                              next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
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
