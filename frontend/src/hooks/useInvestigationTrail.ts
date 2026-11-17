import { useCallback, useEffect, useState } from 'react';

export type TrailItem = {
  key: string;
  label: string;
  meta: string;
  path: string;
};

// Retain the existing keys so the Tracefold rename preserves saved investigation trails.
const STORAGE_KEY = 'iocfeed:investigation-trail';
const EVENT = 'iocfeed:trail-change';

function readTrail(): TrailItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function addTrailItem(item: TrailItem) {
  if (typeof window === 'undefined') return;
  const next = [item, ...readTrail().filter((current) => current.key !== item.key)].slice(0, 6);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function useInvestigationTrail() {
  const [items, setItems] = useState<TrailItem[]>(readTrail);
  useEffect(() => {
    const update = () => setItems(readTrail());
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { items, clear };
}
