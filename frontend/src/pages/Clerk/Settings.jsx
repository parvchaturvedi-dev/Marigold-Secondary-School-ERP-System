import React, { useEffect, useState } from 'react';
import {
  Archive,
  BellRing,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { getClerkProfile } from './clerkPortalData';
import { apiFetch } from '../../components/common/api';

const Settings = ({ session }) => {
  const profile = getClerkProfile(session);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordFeedback, setPasswordFeedback] = useState({ type: '', text: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [preferences, setPreferences] = useState({
    attendanceAlerts: true,
    documentAlerts: true,
    meetingReminders: true,
    printQueueLock: false,
    compactTables: false,
  });

  const togglePreference = (field) => {
    setPreferences((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updatePasswordField = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordFeedback({ type: '', text: '' });

    if (!passwordForm.currentPassword) {
      setPasswordFeedback({ type: 'error', text: 'Current password is required.' });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', text: 'New password must contain at least 6 characters.' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });
      setPasswordFeedback({ type: 'success', text: 'Password changed successfully.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordFeedback({ type: 'error', text: error?.message || 'Unable to change password right now.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" /> Clerk Settings
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">
          Configure clerk desk notifications, security, print controls, and table preferences.
        </p>
      </section>

      {window.mgpsDesktop?.isDesktop && <DesktopSessionManager />}

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <aside className="xl:col-span-4 space-y-6">
          <div className="glass-card rounded-3xl p-5 space-y-4">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">
              Desk Identity
            </span>

            <div className="space-y-2 text-xs font-bold">
              <label className="text-slate-500">Username</label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={profile.username}
                  className="w-full p-3 bg-white/50 border border-white/70 text-slate-500 rounded-2xl cursor-not-allowed font-mono font-black"
                />
              </div>
              <p className="text-[10px] text-red-600 flex items-center gap-1 font-semibold pt-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Username is locked by admin user management.
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-3">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">
              Desk Controls
            </span>

            <ToggleRow
              label="Print queue lock"
              description="Require confirmation before sending ID batches to printer."
              checked={preferences.printQueueLock}
              onClick={() => togglePreference('printQueueLock')}
            />
            <ToggleRow
              label="Compact tables"
              description="Use tighter rows on attendance and document screens."
              checked={preferences.compactTables}
              onClick={() => togglePreference('compactTables')}
            />
          </div>
        </aside>

        <div className="xl:col-span-8 space-y-6">
          <form
            onSubmit={handlePasswordSubmit}
            className="glass-card rounded-3xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100/80 pb-3">
              <KeyRound className="w-4 h-4" />
              <h3 className="text-sm font-black">Password Update</h3>
            </div>

            <PasswordField
              label="Current Password"
              value={passwordForm.currentPassword}
              visible={showPassword.current}
              onChange={(value) => updatePasswordField('currentPassword', value)}
              onToggle={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
            />
            <PasswordField
              label="New Password"
              value={passwordForm.newPassword}
              visible={showPassword.next}
              onChange={(value) => updatePasswordField('newPassword', value)}
              onToggle={() => setShowPassword((prev) => ({ ...prev, next: !prev.next }))}
            />
            <PasswordField
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              visible={showPassword.confirm}
              onChange={(value) => updatePasswordField('confirmPassword', value)}
              onToggle={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
            />

            {passwordFeedback.text && (
              <div
                className={`text-xs font-bold px-3 py-2.5 rounded-2xl border ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-rose-50 text-rose-700 border-rose-100'
                }`}
              >
                {passwordFeedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full btn-primary rounded-2xl py-3 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {savingPassword ? 'Saving...' : 'Save Password'}
            </button>
          </form>

          <div className="glass-card rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100/80 pb-3">
              <BellRing className="w-4 h-4" />
              <h3 className="text-sm font-black">Notifications</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <ToggleRow
                label="Attendance alerts"
                description="Notify when a class register is still pending."
                checked={preferences.attendanceAlerts}
                onClick={() => togglePreference('attendanceAlerts')}
              />
              <ToggleRow
                label="Document alerts"
                description="Notify when a packet is held for correction."
                checked={preferences.documentAlerts}
                onClick={() => togglePreference('documentAlerts')}
              />
              <ToggleRow
                label="Meeting reminders"
                description="Show reminders before office meetings."
                checked={preferences.meetingReminders}
                onClick={() => togglePreference('meetingReminders')}
              />
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Lock className="w-4 h-4" /> Clerk Permissions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold">
              {[
                'Create assignments and events',
                'Verify documents',
                'Generate ID cards',
                'Edit staff and student records',
                'Publish notices and meetings',
                'View but not delete restricted faculty records',
              ].map((permission) => (
                <div key={permission} className="glass-soft rounded-2xl p-3">
                  {permission}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const DesktopSessionManager = () => {
  const createPastSessionOption = '__upload_past_session__';
  const classSetupNamespaces = [
    'admin-class-management-classes',
    'admin-class-preferences',
    'admin-subjects-global',
    'admin-subjects-class-mapping',
  ];
  const [archives, setArchives] = useState([]);
  const [currentSession, setCurrentSession] = useState('2026-27');
  const [selectedId, setSelectedId] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [editorValue, setEditorValue] = useState('');
  const [showCreateSessionDialog, setShowCreateSessionDialog] = useState(false);
  const [newPastSessionName, setNewPastSessionName] = useState('');
  const [copyClassSetup, setCopyClassSetup] = useState(true);
  const [rolloverPreview, setRolloverPreview] = useState(null);
  const [targetSession, setTargetSession] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshArchives = async () => {
    const entries = await window.mgpsDesktop.archives.list();
    setArchives(entries);
  };

  useEffect(() => {
    Promise.all([
      refreshArchives(),
      apiFetch('/desktop-sessions/current-session', {
        headers: { 'X-MGPS-Desktop': '1' },
      }).then(({ currentSession: name }) => setCurrentSession(name)),
    ]).catch((error) => setFeedback(error.message || 'Unable to load desktop sessions.'));
  }, []);

  const openArchive = async (id) => {
    setSelectedId(id);
    setSelectedArchive(null);
    setEditorValue('');
    setFeedback('');
    if (!id) {
      await window.mgpsDesktop.archives.setActive('');
      return;
    }
    try {
      const entries = await window.mgpsDesktop.archives.list();
      const archive = entries.find((entry) => entry.id === id);
      if (!archive) throw new Error('Session archive not found.');
      await window.mgpsDesktop.archives.setActive(archive.id);
      setSelectedArchive(archive);
      if (archive.kind === 'past') {
        const record = await window.mgpsDesktop.archives.read(id);
        setEditorValue(JSON.stringify(record.payload, null, 2));
      }
    } catch (error) {
      setFeedback(error.message || 'Unable to open local session.');
    }
  };

  const createPastSession = async (event) => {
    event.preventDefault();
    const name = newPastSessionName.trim();
    if (!name) {
      setFeedback('Enter a name for the past session.');
      return;
    }
    setBusy(true);
    setFeedback('');
    try {
      let classSetup = null;
      if (copyClassSetup) {
        const entries = await Promise.all(
          classSetupNamespaces.map((namespace) =>
            apiFetch(`/module-state/${encodeURIComponent(namespace)}`)
          )
        );
        classSetup = Object.fromEntries(
          entries.map((entry, index) => {
            if (!Array.isArray(entry?.value)) {
              throw new Error(
                `Could not copy ${classSetupNamespaces[index]}. Check the current session data and try again.`
              );
            }
            return [classSetupNamespaces[index], entry.value];
          })
        );
      }
      const archive = await window.mgpsDesktop.archives.create(name, classSetup);
      await window.mgpsDesktop.archives.setActive(archive.id);
      setShowCreateSessionDialog(false);
      setNewPastSessionName('');
      await refreshArchives();
      await openArchive(archive.id);
      setFeedback(
        copyClassSetup
          ? `Local session “${archive.name}” created with classes, class order, and subject setup copied. Student and teacher records are blank.`
          : `Blank local session “${archive.name}” created.`
      );
    } catch (error) {
      setFeedback(error.message || 'Unable to create local session.');
    } finally {
      setBusy(false);
    }
  };

  const backupCurrentSession = async () => {
    setBusy(true);
    setFeedback('');
    try {
      await window.mgpsDesktop.archives.setActive('');
      setSelectedId('');
      setSelectedArchive(null);
      const archive = await createVerifiedLocalSnapshot();
      await refreshArchives();
      await openArchive(archive.id);
      setFeedback(`Encrypted local backup created: ${archive.recordCount} records.`);
    } catch (error) {
      setFeedback(error.message || 'Unable to create a local backup of the current session.');
    } finally {
      setBusy(false);
    }
  };

  const createVerifiedLocalSnapshot = async () => {
    const verified = await apiFetch('/desktop-sessions/current-snapshot', {
      headers: { 'X-MGPS-Desktop': '1' },
    });
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 17);
    const suffix = ` Backup ${timestamp}`;
    const archiveName = `${verified.snapshot.sessionName.slice(0, 32 - suffix.length)}${suffix}`;
    const archive = await window.mgpsDesktop.archives.createSnapshot(
      archiveName,
      verified,
      verified.snapshot.recordCount
    );
    return { ...archive, sha256: verified.sha256, sourceSession: verified.snapshot.sessionName };
  };

  const prepareRollover = async () => {
    setBusy(true);
    setFeedback('');
    setRolloverPreview(null);
    try {
      await window.mgpsDesktop.archives.setActive('');
      setSelectedId('');
      setSelectedArchive(null);
      const result = await apiFetch('/desktop-sessions/rollover-preview', {
        headers: { 'X-MGPS-Desktop': '1' },
      });
      setCurrentSession(result.currentSession);
      setRolloverPreview(result.preview);
      const year = result.currentSession.match(/^(\d{4})-(\d{2})$/);
      setTargetSession(year ? `${Number(year[1]) + 1}-${String((Number(year[1]) + 1 + 1) % 100).padStart(2, '0')}` : '');
    } catch (error) {
      setFeedback(error.message || 'Unable to prepare the session rollover.');
    } finally {
      setBusy(false);
    }
  };

  const confirmRollover = async () => {
    if (!rolloverPreview || !targetSession.trim()) {
      setFeedback('Enter the new session name before continuing.');
      return;
    }
    if (!window.confirm(
      `Start ${targetSession.trim()}?\n\nA verified encrypted local backup of ${currentSession} will be created first. Students will be promoted, past attendance/marks/assignments/notices will be archived and cleared, and fee ledgers will remain unchanged.`
    )) return;

    setBusy(true);
    setFeedback('Creating encrypted local backup before changing online data…');
    let archive;
    try {
      archive = await createVerifiedLocalSnapshot();
      await refreshArchives();
      setFeedback('Local backup verified. Applying the session rollover…');
      const result = await apiFetch('/desktop-sessions/rollover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MGPS-Desktop': '1',
        },
        body: JSON.stringify({
          sourceSession: archive.sourceSession,
          targetSession: targetSession.trim(),
          snapshotSha256: archive.sha256,
          archiveId: archive.id,
        }),
      });
      setCurrentSession(result.currentSession);
      await window.mgpsDesktop.archives.setActive('');
      setRolloverPreview(null);
      setTargetSession('');
      setSelectedId('');
      setSelectedArchive(null);
      setEditorValue('');
      setFeedback(
        `Session ${result.currentSession} started. Promoted ${result.promotedCount}; retained ${result.retainedCount}; graduated ${result.graduatedCount}; moved to alumni pending ${result.movedToPendingCount}. ${result.attendanceRecordsReset} attendance records and ${result.examinationStatesReset} examination states were reset. The local backup is stored on this computer.`
      );
      await refreshArchives();
    } catch (error) {
      const backupNote = archive
        ? ` Local backup “${archive.name}” is safely stored; no rollover was applied if the server rejected it.`
        : '';
      setFeedback(`${error.message || 'Session rollover failed.'}${backupNote}`);
    } finally {
      setBusy(false);
    }
  };

  const saveArchive = async () => {
    if (!selectedArchive || selectedArchive.kind !== 'past') return;
    setBusy(true);
    setFeedback('');
    try {
      const payload = JSON.parse(editorValue);
      await window.mgpsDesktop.archives.save(selectedArchive.id, payload);
      setFeedback('Local session saved securely on this computer.');
      await refreshArchives();
    } catch (error) {
      setFeedback(error instanceof SyntaxError ? 'Invalid JSON: correct the format before saving.' : error.message);
    } finally {
      setBusy(false);
    }
  };

  const renameArchive = async () => {
    if (!selectedArchive || selectedArchive.kind !== 'past') return;
    const name = window.prompt('Rename this past session:', selectedArchive.name);
    if (!name?.trim()) return;
    setBusy(true);
    setFeedback('');
    try {
      await window.mgpsDesktop.archives.rename(selectedArchive.id, name);
      await refreshArchives();
      await openArchive(selectedArchive.id);
      setFeedback('Session name updated.');
    } catch (error) {
      setFeedback(error.message || 'Unable to rename the session.');
    } finally {
      setBusy(false);
    }
  };

  const deleteArchive = async () => {
    if (!selectedArchive || selectedArchive.kind !== 'past') return;
    if (!window.confirm(`Permanently delete “${selectedArchive.name}” and all data saved in it?`)) return;
    setBusy(true);
    setFeedback('');
    try {
      await window.mgpsDesktop.archives.deleteDraft(selectedArchive.id);
      await window.mgpsDesktop.archives.setActive('');
      setSelectedId('');
      setSelectedArchive(null);
      setEditorValue('');
      await refreshArchives();
      setFeedback('Local session draft deleted.');
    } catch (error) {
      setFeedback(error.message || 'Unable to delete the local session.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-card rounded-3xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 pb-3">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4" />
          <div>
            <h3 className="text-sm font-black">Desktop session archives</h3>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              Local records are encrypted on this computer. Web users cannot access these archives.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={backupCurrentSession}
            disabled={busy}
            className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Archive className="w-4 h-4" /> Backup current session
          </button>
        </div>
      </div>

      <label className="block space-y-1 text-xs font-bold">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Change session</span>
        <span className="relative block">
          <select
            value={selectedId}
            onChange={(event) => {
              if (event.target.value === createPastSessionOption) {
                setNewPastSessionName('');
                setCopyClassSetup(true);
                setShowCreateSessionDialog(true);
              } else {
                openArchive(event.target.value);
              }
            }}
            className="w-full appearance-none rounded-2xl border border-white/80 bg-white/70 px-4 py-3 pr-10 text-sm font-bold"
          >
            <option value={createPastSessionOption}>Upload past sessions…</option>
            <option value="">{currentSession} — Current session (online)</option>
            {archives.map((archive) => (
              <option key={archive.id} value={archive.id}>
                {archive.name}{archive.kind === 'snapshot' ? ' — Archived snapshot' : ' — Local past session'}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={prepareRollover}
          disabled={busy}
          className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          Move to Next Journey
        </button>
        <p className="text-[10px] font-semibold text-slate-500">
          Available only in the Clerk desktop app. It creates and verifies the local backup before promoting students.
        </p>
      </div>

      {rolloverPreview && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <h4 className="text-sm font-black text-amber-950">Review rollover: {currentSession}</h4>
            <p className="mt-1 text-xs font-semibold text-amber-900">
              This will promote {rolloverPreview.promotedCount}, retain {rolloverPreview.retainedCount},
              graduate {rolloverPreview.graduatedCount}, and move {rolloverPreview.movedToPendingCount}
              final-class students with outstanding fees to alumni pending.
            </p>
            <p className="mt-1 text-[10px] font-semibold text-amber-800">
              Class order: {rolloverPreview.classOrder.join(' → ')}. Fee ledgers are preserved; attendance,
              examination state, assignments, and notices are reset only after the local backup is verified.
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
              onClick={() => setRolloverPreview(null)}
              disabled={busy}
              className="rounded-xl border border-amber-300 px-4 py-2 text-xs font-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRollover}
              disabled={busy || !targetSession.trim()}
              className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              Backup & start new session
            </button>
          </div>
        </div>
      )}

      {selectedArchive && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-700">
              {selectedArchive.name} · {selectedArchive.kind === 'snapshot' ? `${selectedArchive.recordCount} records` : 'editable local data'}
            </p>
            {selectedArchive.kind === 'past' && (
              <div className="flex gap-2">
                <button type="button" onClick={renameArchive} disabled={busy} className="rounded-lg border px-3 py-2 text-[10px] font-black">
                  <Pencil className="mr-1 inline h-3 w-3" /> Rename
                </button>
                <button type="button" onClick={deleteArchive} disabled={busy} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-700">
                  <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
          {selectedArchive.kind === 'past' && (
            <>
              <textarea
                value={editorValue}
                onChange={(event) => setEditorValue(event.target.value)}
                spellCheck={false}
                aria-label={`${selectedArchive.name} session data`}
                className="min-h-64 w-full rounded-2xl border border-slate-200 bg-white/80 p-4 font-mono text-xs leading-relaxed outline-none focus:border-indigo-400"
              />
              <button type="button" onClick={saveArchive} disabled={busy} className="btn-primary rounded-xl px-4 py-2 text-xs font-black disabled:opacity-50">
                <Save className="mr-2 inline h-4 w-4" /> Save local session
              </button>
            </>
          )}
          {selectedArchive.kind === 'snapshot' && (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs font-semibold text-slate-600">
              This completed session is read-only. Its records are loaded from the encrypted local backup
              while you use supported ERP pages; no data is sent to or changed in the current online session.
            </div>
          )}
        </div>
      )}

      {!selectedArchive && (
        <p className="text-xs font-semibold text-slate-500">
          The current session continues to use the online database. Select a local past session to view or edit its structured data.
        </p>
      )}

      {showCreateSessionDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={createPastSession}
            className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div>
              <h4 className="text-base font-black text-slate-900">Upload past session</h4>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Create an editable session stored securely on this computer. Choose whether to reuse the current class setup.
              </p>
            </div>
            <label className="block space-y-1 text-xs font-bold">
              <span>Session name</span>
              <input
                autoFocus
                required
                maxLength={32}
                value={newPastSessionName}
                onChange={(event) => setNewPastSessionName(event.target.value)}
                placeholder="For example, 2024-25"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <fieldset className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <legend className="px-1 text-xs font-black text-slate-800">
                Keep classes and their subject setup the same?
              </legend>
              <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="radio"
                  name="copyClassSetup"
                  checked={copyClassSetup}
                  onChange={() => setCopyClassSetup(true)}
                  className="mt-0.5 accent-indigo-600"
                />
                <span>
                  Yes — copy the current class list/order, global subjects, and subjects linked to each class.
                  Student and teacher records stay empty.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="radio"
                  name="copyClassSetup"
                  checked={!copyClassSetup}
                  onChange={() => setCopyClassSetup(false)}
                  className="mt-0.5 accent-indigo-600"
                />
                <span>No — start with an empty class and subject setup.</span>
              </label>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateSessionDialog(false)}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary rounded-xl px-4 py-2 text-xs font-black disabled:opacity-50"
              >
                {copyClassSetup ? 'Create session with same setup' : 'Create blank session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {feedback && <p role="status" className="text-xs font-bold text-indigo-700">{feedback}</p>}
      {busy && <p className="text-[10px] font-semibold text-slate-500"><RefreshCw className="mr-1 inline h-3 w-3 animate-spin" /> Working…</p>}
    </section>
  );
};

const PasswordField = ({ label, value, visible, onChange, onToggle }) => (
  <label className="block space-y-1 text-xs font-bold">
    <span className="text-[10px] font-black uppercase text-slate-500">{label}</span>
    <span className="relative flex items-center">
      <input
        type={visible ? 'text' : 'password'}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter secure token"
        className="w-full bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-3 py-3 pr-10 text-xs font-mono font-bold"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 text-slate-500 hover:text-indigo-600"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </span>
  </label>
);

const ToggleRow = ({ label, description, checked, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full glass-soft glass-hover rounded-2xl p-3 flex items-center justify-between gap-3 text-left min-h-24"
  >
    <span>
      <span className="block text-xs font-black">{label}</span>
      <span className="block text-[10px] font-semibold text-slate-500 mt-1 leading-relaxed">
        {description}
      </span>
    </span>
    {checked ? (
      <ToggleRight className="w-9 h-9 text-indigo-500 shrink-0" />
    ) : (
      <ToggleLeft className="w-9 h-9 text-slate-400 shrink-0" />
    )}
  </button>
);

export default Settings;
