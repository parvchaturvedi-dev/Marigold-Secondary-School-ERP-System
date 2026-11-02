import { useEffect, useMemo, useState } from 'react';
import { BellRing, LoaderCircle, Send } from 'lucide-react';
import { apiFetch } from '../../components/common/api';

const initialForm = {
  title: '',
  description: '',
  recipientRole: '',
  recipientClassName: '',
  recipientDesignation: '',
  linkPage: '',
};

const roleLabels = {
  admin: 'Admin',
  clerk: 'Clerk',
  teacher: 'Teacher',
  student: 'Student / Parent',
  employee: 'Employee',
};

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100';

export default function Notifications() {
  const [targets, setTargets] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/notifications/admin-targets')
      .then((payload) => {
        if (active) setTargets(Array.isArray(payload?.roles) ? payload.roles : []);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedTarget = useMemo(
    () => targets.find((item) => item.role === form.recipientRole),
    [targets, form.recipientRole]
  );
  const audienceCount = form.recipientClassName
    ? selectedTarget?.classes.find((item) => item.name === form.recipientClassName)?.count || 0
    : form.recipientDesignation
      ? selectedTarget?.designations.find((item) => item.name === form.recipientDesignation)?.count || 0
      : selectedTarget?.count || 0;

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setSuccess('');
  };

  const handleRoleChange = (recipientRole) => {
    setForm({
      ...initialForm,
      recipientRole,
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSending(true);
    try {
      const result = await apiFetch('/notifications/admin-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSuccess(
        `Notification delivered to ${result.recipientCount} account${result.recipientCount === 1 ? '' : 's'}. ` +
        `${result.pushSent} mobile push${result.pushSent === 1 ? '' : 'es'} sent.` +
        (result.pushErrors ? ` ${result.pushErrors} push delivery or cleanup error${result.pushErrors === 1 ? '' : 's'} occurred.` : '')
      );
      setForm(initialForm);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Admin Broadcast</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Send Notification</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Send an in-app notification and mobile push to a role, a student class, or a staff designation.
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-xl sm:p-8">
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {success}
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Notification content</h2>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Title</span>
            <input
              className={fieldClass}
              maxLength={120}
              required
              value={form.title}
              onChange={(event) => updateForm('title', event.target.value)}
              placeholder="e.g. School will remain closed tomorrow"
            />
            <span className="block text-right text-[10px] font-semibold text-slate-400">{form.title.length}/120</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Description / message</span>
            <textarea
              className={`${fieldClass} min-h-28 resize-y`}
              maxLength={2000}
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="Write the message that appears in the app and mobile push."
            />
            <span className="block text-right text-[10px] font-semibold text-slate-400">{form.description.length}/2000</span>
          </label>
        </section>

        <section className="space-y-4 border-t border-slate-200/80 pt-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Choose recipients</h2>
          {isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm font-semibold text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading recipient groups...
            </div>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Role</span>
                <select
                  className={fieldClass}
                  required
                  value={form.recipientRole}
                  onChange={(event) => handleRoleChange(event.target.value)}
                >
                  <option value="">Select a role</option>
                  {targets.map((target) => (
                    <option key={target.role} value={target.role}>
                      {roleLabels[target.role] || target.role} ({target.count} active)
                    </option>
                  ))}
                </select>
              </label>

              {form.recipientRole === 'student' && selectedTarget?.classes?.length > 0 && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">Class (optional)</span>
                  <select
                    className={fieldClass}
                    value={form.recipientClassName}
                    onChange={(event) => updateForm('recipientClassName', event.target.value)}
                  >
                    <option value="">All student classes</option>
                    {selectedTarget.classes.map((item) => (
                      <option key={item.name} value={item.name}>{item.name} ({item.count})</option>
                    ))}
                  </select>
                </label>
              )}

              {['teacher', 'employee'].includes(form.recipientRole) && selectedTarget?.designations?.length > 0 && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">Designation (optional)</span>
                  <select
                    className={fieldClass}
                    value={form.recipientDesignation}
                    onChange={(event) => updateForm('recipientDesignation', event.target.value)}
                  >
                    <option value="">All {roleLabels[form.recipientRole]?.toLowerCase()}s</option>
                    {selectedTarget.designations.map((item) => (
                      <option key={item.name} value={item.name}>{item.name} ({item.count})</option>
                    ))}
                  </select>
                </label>
              )}

              {selectedTarget && (
                <p className="rounded-xl bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-800">
                  This notification will reach {audienceCount} active account{audienceCount === 1 ? '' : 's'}.
                </p>
              )}
            </>
          )}
        </section>

        <section className="space-y-4 border-t border-slate-200/80 pt-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Optional page link</h2>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Open this page when tapped</span>
            <select
              className={fieldClass}
              disabled={!selectedTarget}
              value={form.linkPage}
              onChange={(event) => updateForm('linkPage', event.target.value)}
            >
              <option value="">No page link</option>
              {(selectedTarget?.linkPages || []).map((page) => (
                <option key={page} value={page}>{page}</option>
              ))}
            </select>
            <span className="block text-xs font-medium text-slate-500">
              Only pages available to the selected role are listed.
            </span>
          </label>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-slate-500">
            Mobile push appearance and text color are controlled by the device operating system.
          </p>
          <button
            type="submit"
            disabled={isLoading || isSending || !form.recipientRole || !form.title.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSending ? 'Sending...' : 'Send notification'}
          </button>
        </div>
      </form>
    </div>
  );
}
