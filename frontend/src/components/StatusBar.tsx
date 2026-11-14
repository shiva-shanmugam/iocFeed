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
    <footer className="fixed bottom-0 inset-x-0 z-50 h-8 border-t border-cyan/30 bg-void/95 px-4 flex items-center justify-between text-[11px] tracking-widest text-slate-400">
      <span>
        <b className="text-cyan">FEEDS:</b> {data?.online_feeds ?? '—'} ONLINE
      </span>
      <span>
        <b className="text-cyan">INDICATORS:</b> {data?.total?.toLocaleString() ?? '—'}
      </span>
      <span>
        <b className="text-cyan">LAST SYNC:</b> {mins}M AGO
      </span>
    </footer>
  );
}
