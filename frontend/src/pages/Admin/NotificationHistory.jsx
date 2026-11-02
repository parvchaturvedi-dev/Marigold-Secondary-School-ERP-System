import { useCallback, useEffect, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import { apiFetch } from '../../components/common/api';

const PAGE_SIZE = 50;

const formatDate = (value) => {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export default function NotificationHistory() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadHistory = useCallback(async (pageNumber) => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await apiFetch(
        `/notifications/admin-history?page=${pageNumber}&pageSize=${PAGE_SIZE}`
      );
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setPage(payload?.page || pageNumber);
      setTotal(payload?.total || 0);
      setTotalPages(payload?.totalPages || 0);
    } catch (loadError) {
      setError(loadError.message || 'Notification history could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  const resetHistory = async () => {
    if (!total || isResetting) return;
    const confirmed = window.confirm(
      `Permanently remove all ${total} notifications from every portal? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsResetting(true);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch('/notifications/admin-history', { method: 'DELETE' });
      setItems([]);
      setPage(1);
      setTotal(0);
      setTotalPages(0);
      setNotice(`${result?.deleted || 0} notifications were removed from all portals.`);
    } catch (resetError) {
      setError(resetError.message || 'Notification history could not be reset.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Notification Desk</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Notification History</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Review notifications sent across roles and portals.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={resetHistory}
          disabled={!total || isLoading || isResetting}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResetting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Reset all portals
        </button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <p className="text-sm font-black text-slate-800">{total} notification{total === 1 ? '' : 's'}</p>
          <button
            type="button"
            onClick={() => loadHistory(page)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm font-semibold text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading history...
          </div>
        ) : items.length ? (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <article key={item.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-black text-slate-900">{item.title}</h2>
                  <time className="text-[11px] font-semibold text-slate-500">{formatDate(item.createdAt || item.time)}</time>
                </div>
                {item.description && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                  <span>Role: {item.recipientRole || '—'}</span>
                  {item.recipientClassName && <span>Class: {item.recipientClassName}</span>}
                  {item.recipientUsername && <span>Account: {item.recipientUsername}</span>}
                  {item.linkPage && <span>Link: {item.linkPage}</span>}
                  {(item.authorName || item.createdByName) && <span>Sent by: {item.authorName || item.createdByName}</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-sm font-semibold text-slate-500">No notification history found.</div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200/80 px-5 py-4">
          <span className="text-xs font-semibold text-slate-500">
            Page {totalPages ? page : 0} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadHistory(page - 1)}
              disabled={isLoading || page <= 1}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => loadHistory(page + 1)}
              disabled={isLoading || page >= totalPages}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
