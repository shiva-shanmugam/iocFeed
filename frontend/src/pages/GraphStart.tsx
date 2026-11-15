import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Header, Panel } from './Dashboard';

export function GraphStart() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const results = useQuery({
    queryKey: ['graph-start', query],
    queryFn: () => api.search(query),
    enabled: query.trim().length > 2,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const first = results.data?.items?.[0];
    if (first) navigate(`/investigate/${first.id}`);
  }

  return (
    <main className="p-4 max-w-[1120px]">
      <Header title="relationship graph" subtitle="choose one IOC as the starting node" />
      <form onSubmit={submit} className="flex max-w-[900px]">
        <input
          className="field flex-1 rounded-none border-r-0"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="find an IP, domain, URL, or hash"
          aria-label="Find graph root"
          autoFocus
        />
        <button className="action-primary rounded-none" disabled={!results.data?.items?.length}>
          open first match
        </button>
      </form>
      {results.data?.items?.length ? (
        <section className="border border-line max-w-[900px] mt-2">
          <h2 className="section-label px-2 pt-2">matching roots</h2>
          {results.data.items.map((item) => (
            <button
              key={item.id}
              className="graph-result"
              onClick={() => navigate(`/investigate/${item.id}`)}
            >
              <span>{item.value}</span>
              <span>
                {item.type} · {item.verdict}
              </span>
              <b>open ›</b>
            </button>
          ))}
        </section>
      ) : query.length > 2 && !results.isFetching ? (
        <p className="text-secondary mt-3">no matching indicators</p>
      ) : null}
      <Panel title="How the graph behaves" className="mt-5 max-w-[900px]">
        <ol className="graph-help-list">
          <li>
            <b>1</b>
            <span>
              The IOC you choose becomes the root. The first view contains its recorded one- and
              two-hop relationships.
            </span>
          </li>
          <li>
            <b>2</b>
            <span>
              Click a node to open its evidence drawer and fetch that node's immediate neighbours
              into the same graph.
            </span>
          </li>
          <li>
            <b>3</b>
            <span>
              Click a second node and the graph highlights the shortest known path between your last
              two selections.
            </span>
          </li>
          <li>
            <b>4</b>
            <span>
              Use the drawer's Explore links to leave the relationship view and inspect the node's
              family, tags, or source as filtered datasets.
            </span>
          </li>
        </ol>
        <p className="graph-note">
          An edge only appears when the database contains an explicit relationship. Similar-looking
          IOCs are not connected automatically.
        </p>
      </Panel>
    </main>
  );
}
