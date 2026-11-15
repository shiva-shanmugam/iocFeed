import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
export function StatusBar() {
  const { data } = useQuery({
    queryKey: ['summary'],
    queryFn: api.summary,
    refetchInterval: 10000,
  });
  const mins = data?.last_sync
    ? Math.max(0, Math.floor((Date.now() - new Date(data.last_sync).getTime()) / 60000))
    : '—';
  return (
    <footer className="fixed bottom-0 inset-x-0 z-50 h-7 border-t border-line bg-base px-3 flex items-center text-[11px] text-secondary">
      <span>
        feeds {data?.online_feeds ?? '—'} online&nbsp;&nbsp;|&nbsp;&nbsp;indicators{' '}
        {data?.total?.toLocaleString() ?? '—'}&nbsp;&nbsp;|&nbsp;&nbsp;last sync {mins}m ago
      </span>
    </footer>
  );
}
