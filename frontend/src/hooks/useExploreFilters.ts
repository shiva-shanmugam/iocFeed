import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export const FILTER_KEYS = ['type', 'source', 'family', 'actor', 'tag', 'country', 'asn'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export function useExploreFilters() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const active = FILTER_KEYS.flatMap((key) => params.getAll(key).map((value) => ({ key, value })));
  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, resetPage = true) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return {
    params,
    query,
    active,
    values: (key: FilterKey) => params.getAll(key),
    toggle: (key: FilterKey, value: string) =>
      update((next) => {
        const values = next.getAll(key);
        next.delete(key);
        for (const item of values.filter((item) => item !== value)) next.append(key, item);
        if (!values.includes(value)) next.append(key, value);
      }),
    setOne: (key: string, value?: string) =>
      update((next) => {
        next.delete(key);
        if (value) next.set(key, value);
      }),
    setPage: (value: number) => update((next) => next.set('page', String(value)), false),
    setDates: (from: string, to: string) =>
      update((next) => {
        next.set('date_from', from);
        next.set('date_to', to);
      }),
    clearDates: () =>
      update((next) => {
        next.delete('date_from');
        next.delete('date_to');
        next.delete('modal');
      }),
    openDate: (value: string) =>
      update((next) => {
        next.set('date_from', value);
        next.set('date_to', value);
        next.delete('modal');
      }),
    applyFilter: (key: FilterKey, value: string) =>
      update((next) => {
        const values = next.getAll(key);
        next.delete('modal');
        if (!values.includes(value)) next.append(key, value);
      }),
    remove: (key: FilterKey, value: string) =>
      update((next) => {
        const values = next.getAll(key).filter((item) => item !== value);
        next.delete(key);
        values.forEach((item) => next.append(key, item));
      }),
    clear: () => setParams(new URLSearchParams(), { replace: true }),
  };
}
