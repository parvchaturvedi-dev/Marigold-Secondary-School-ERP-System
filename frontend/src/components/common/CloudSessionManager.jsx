import React, { useEffect, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { apiFetch } from './api';

const nextSessionName = (sessionName) => {
  const match = String(sessionName || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]) + 1;
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
};

const formatBytes = (value) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const CloudSessionManager = ({ canEditCurrentSession = false, canDeleteArchives = false }) => {
  const [currentSession, setCurrentSession] = useState('');
  const [editingCurrentSession, setEditingCurrentSession] = useState(false);
  const [editedSessionName, setEditedSessionName] = useState('');
  const [archives, setArchives] = useState([]);
  const [targetSession, setTargetSession] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableRows, setTableRows] = useState([]);
  const [tableOffset, setTableOffset] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [sessionResult, archiveResult] = await Promise.all([
      apiFetch('/desktop-sessions/current-session'),
      apiFetch('/desktop-sessions/archives'),
    ]);
    setCurrentSession(sessionResult.currentSession);
    setArchives(archiveResult);
  };

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message || 'Unable to load sessions.'));
  }, []);

  const openArchive = async (archiveId) => {
    setSelectedArchiveId(archiveId);
    setSelectedArchive(null);
    setSelectedTable('');
    setTableRows([]);
    setTableOffset(0);
    setError('');
    if (!archiveId) return;

    setBusy(true);
    try {
      const result = await apiFetch(`/desktop-sessions/archives/${encodeURIComponent(archiveId)}`);
      setSelectedArchive(result);
      setSelectedTable(result.tables[0]?.name || '');
    } catch (loadError) {
      setError(loadError.message || 'Unable to open session archive.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!selectedArchiveId || !selectedTable) return;
    let active = true;
    setBusy(true);
    setError('');
    apiFetch(
      `/desktop-sessions/archives/${encodeURIComponent(selectedArchiveId)}?table=${encodeURIComponent(selectedTable)}&offset=${tableOffset}&limit=25`
    )
      .then((result) => {
        if (active) setTableRows(result.rows || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load archived records.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [selectedArchiveId, selectedTable, tableOffset]);

  const prepareRollover = async () => {
    setBusy(true);
    setFeedback('');
    setError('');
    try {
      const result = await apiFetch('/desktop-sessions/rollover-preview');
      setCurrentSession(result.currentSession);
      setPreview(result.preview);
      setTargetSession(nextSessionName(result.currentSession));
    } catch (loadError) {
      setError(loadError.message || 'Unable to prepare the session rollover.');
    } finally {
      setBusy(false);
    }
  };

  const saveCurrentSessionName = async () => {
    const sessionName = editedSessionName.trim();
    if (!sessionName) {
      setError('Enter a session name.');
      return;
    }
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const result = await apiFetch('/desktop-sessions/current-session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName }),
      });
      setCurrentSession(result.currentSession);
      setEditingCurrentSession(false);
      setFeedback(`Current session renamed to ${result.currentSession}. Past archives were not changed.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to rename the current session.');
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedArchive = async () => {
    const archive = archives.find((item) => item.id === selectedArchiveId);
    if (!archive) return;
    const confirmed = window.confirm(
      `Permanently delete the ${archive.source_session} archive? Its saved snapshot and all archived records will be removed and cannot be recovered. The current session will not be changed.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await apiFetch(`/desktop-sessions/archives/${encodeURIComponent(archive.id)}`, {
        method: 'DELETE',
      });
      setSelectedArchiveId('');
      setSelectedArchive(null);
      setSelectedTable('');
      setTableRows([]);
      setTableOffset(0);
      await refresh();
      setFeedback(`The ${archive.source_session} archive was permanently deleted.`);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete the session archive.');
    } finally {
      setBusy(false);
    }
  };

  const applyRollover = async () => {
    const target = targetSession.trim();
    if (!preview || !target) {
      setError('Enter the new session name before continuing.');
      return;
    }
    const confirmed = window.confirm(
      `Start ${target}?\n\nA verified server-side snapshot of ${currentSession} will be saved first. Students will be promoted, past attendance, marks, assignments and notices will be archived or reset, and fee ledgers will remain unchanged. This affects the shared online database.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError('');
    setFeedback('Saving a verified server-side archive and applying rollover…');
    try {
      const result = await apiFetch('/desktop-sessions/rollover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSession: currentSession,
          targetSession: target,
          archiveId: crypto.randomUUID(),
        }),
      });
      setCurrentSession(result.currentSession);
      setTargetSession('');
      setPreview(null);
      setSelectedArchiveId('');
      setSelectedArchive(null);
      await refresh();
      setFeedback(
        `Session ${result.currentSession} started. Promoted ${result.promotedCount}; retained ${result.retainedCount}; graduated ${result.graduatedCount}; moved to alumni pending ${result.movedToPendingCount}. A server-side archive is available below.`
      );
    } catch (rolloverError) {
      setError(rolloverError.message || 'Session rollover failed.');
      setFeedback('');
    } finally {
      setBusy(false);
    }
  };

  const currentTableRowCount =
    selectedArchive?.tables?.find((table) => table.name === selectedTable)?.rowCount || 0;

  return (
    <section className="glass-card space-y-5 rounded-3xl p-5 text-slate-900">
      <div>
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-black">Academic sessions</h3>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Current session:{' '}
          {editingCurrentSession ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <input
                aria-label="Current session name"
                value={editedSessionName}
                onChange={(event) => setEditedSessionName(event.target.value)}
                maxLength={32}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-800"
              />
              <button
                type="button"
                onClick={saveCurrentSessionName}
                disabled={busy || !editedSessionName.trim()}
                className="rounded-lg bg-indigo-600 px-2 py-1 text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingCurrentSession(false)}
                disabled={busy}
                className="rounded-lg border border-slate-300 px-2 py-1"
              >
                Cancel
              </button>
            </span>
          ) : (
            <>
              <span className="text-slate-800">{currentSession || 'Loading…'}</span>
              {canEditCurrentSession && (
                <button
                  type="button"
                  onClick={() => {
                    setEditedSessionName(currentSession);
                    setEditingCurrentSession(true);
                    setError('');
                  }}
                  disabled={busy || !currentSession}
                  className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-black text-indigo-700 disabled:opacity-50"
                >
                  Edit
                </button>
              )}
            </>
          )}
          .
          Past-session snapshots are stored on the ERP server and are read-only.
        </p>
        <p className="mt-1 text-[10px] font-semibold text-slate-500">
          Archives include copied records and media, so each rollover uses additional server database storage.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={prepareRollover}
          disabled={busy}
          className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          <RefreshCw className="mr-2 inline h-4 w-4" />
          Move to Next Journey
        </button>
        <span className="text-[10px] font-semibold text-slate-500">
          Admin and Clerk can start a session. A server-side snapshot is required first.
        </span>
      </div>

      {preview && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <h4 className="text-sm font-black text-amber-950">Review rollover: {currentSession}</h4>
            <p className="mt-1 text-xs font-semibold text-amber-900">
              Promote {preview.promotedCount}, retain {preview.retainedCount}, graduate {preview.graduatedCount},
              and move {preview.movedToPendingCount} final-class students with outstanding fees to alumni pending.
            </p>
            <p className="mt-1 text-[10px] font-semibold text-amber-800">
              Class order: {preview.classOrder.join(' → ')}. Fee ledgers remain; attendance, examinations,
              assignments and notices reset only after the server archive is committed.
            </p>
          </div>
          <label className="block space-y-1 text-xs font-bold">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">New session name</span>
            <input
              value={targetSession}
              onChange={(event) => setTargetSession(event.target.value)}
              maxLength={32}
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-bold"
              placeholder="For example, 2027-28"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={busy}
              className="rounded-xl border border-amber-300 px-4 py-2 text-xs font-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyRollover}
              disabled={busy || !targetSession.trim()}
              className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Archive & start new session'}
            </button>
          </div>
        </div>
      )}

      {archives.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-60 flex-1 space-y-1 text-xs font-bold">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Past sessions</span>
              <select
                value={selectedArchiveId}
                onChange={(event) => openArchive(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">Select a past session archive</option>
                {archives.map((archive) => (
                  <option key={archive.id} value={archive.id}>
                    {archive.source_session} → {archive.target_session} · {new Date(archive.created_at).toLocaleString()} · {formatBytes(archive.compressed_bytes)}
                  </option>
                ))}
              </select>
            </label>
            {canDeleteArchives && (
              <button
                type="button"
                onClick={deleteSelectedArchive}
                disabled={busy || !selectedArchiveId}
                className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40"
              >
                Delete selected archive
              </button>
            )}
          </div>

          {selectedArchive && (
            <>
              <p className="text-xs font-semibold text-slate-600">
                {selectedArchive.archive.record_count} records · archived by {selectedArchive.archive.created_by}
                · SHA-256 verified
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-60 flex-1 space-y-1 text-xs font-bold">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Archived table</span>
                  <select
                    value={selectedTable}
                    onChange={(event) => {
                      setTableOffset(0);
                      setSelectedTable(event.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    {selectedArchive.tables.map((table) => (
                      <option key={table.name} value={table.name}>
                        {table.name} ({table.rowCount})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setTableOffset((offset) => Math.max(0, offset - 25))}
                    disabled={busy || tableOffset === 0}
                    aria-label="Previous archived records"
                    className="rounded-lg border p-2 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>
                    {currentTableRowCount ? tableOffset + 1 : 0}–
                    {Math.min(tableOffset + tableRows.length, currentTableRowCount)} of {currentTableRowCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTableOffset((offset) => offset + 25)}
                    disabled={busy || tableOffset + 25 >= currentTableRowCount}
                    aria-label="Next archived records"
                    className="rounded-lg border p-2 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <pre className="max-h-[28rem] overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-relaxed text-emerald-100">
                {busy ? 'Loading archived records…' : JSON.stringify(tableRows, null, 2)}
              </pre>
              <p className="text-[10px] font-semibold text-slate-500">
                Archive data is read-only. Media bytes are preserved in the snapshot but omitted from this viewer.
              </p>
            </>
          )}
        </div>
      )}

      {!archives.length && (
        <p className="text-xs font-semibold text-slate-500">No archived sessions yet.</p>
      )}
      {feedback && <p className="text-xs font-bold text-emerald-700" role="status">{feedback}</p>}
      {error && <p className="text-xs font-bold text-rose-700" role="alert">{error}</p>}
    </section>
  );
};

export default CloudSessionManager;
