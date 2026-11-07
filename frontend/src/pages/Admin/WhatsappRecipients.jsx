import React, { useEffect, useMemo, useRef, useState } from 'react';
import { read, utils, writeFile } from '@e965/xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low (less)' },
];

const normalizePriority = (value) => {
  const priority = String(value || 'medium').trim().toLowerCase();
  if (['less', 'low'].includes(priority)) return 'low';
  if (['normal', 'medium', 'med'].includes(priority)) return 'medium';
  if (priority === 'high') return 'high';
  return '';
};

const normalizeImportedRow = (row) => {
  const fields = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [
      String(key).trim().toLowerCase().replace(/[\s_-]+/g, ''),
      value,
    ])
  );
  const name = String(fields.name || fields.fullname || fields.recipientname || '').trim();
  const phoneNumber = String(
    fields.whatsappnumber || fields.whatsappno || fields.phonenumber || fields.phone || fields.mobile || ''
  ).trim();
  const priority = normalizePriority(fields.priority);
  return {
    name,
    phoneNumber,
    priority,
    error: !name ? 'Name is required.' : !phoneNumber ? 'WhatsApp number is required.' : !priority ? 'Priority must be high, medium, or low.' : '',
  };
};

const priorityClass = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

const WhatsappRecipients = () => {
  const [recipients, setRecipients] = useState([]);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [priority, setPriority] = useState('medium');
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef(null);

  const loadRecipients = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/whatsapp/recipients');
      setRecipients(result.recipients || []);
    } catch (loadError) {
      setError(loadError.message || 'Recipients could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipients();
  }, []);

  const filteredRecipients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recipients.filter((recipient) =>
      (!filterPriority || recipient.priority === filterPriority) &&
      (!query || `${recipient.name} ${recipient.phoneNumber}`.toLowerCase().includes(query))
    );
  }, [recipients, search, filterPriority]);

  const addRecipient = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch('/whatsapp/recipients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: [{ name, phoneNumber, priority }] }),
      });
      setName('');
      setPhoneNumber('');
      setPriority('medium');
      setNotice(result.updated ? 'Recipient details updated.' : 'Recipient added.');
      await loadRecipients();
    } catch (saveError) {
      setError(saveError.message || 'Recipient could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = utils.aoa_to_sheet([
      ['Name', 'WhatsApp Number', 'Priority'],
    ]);
    worksheet['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 16 }];
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Recipients');
    writeFile(workbook, 'whatsapp-recipients-sample.xlsx');
  };

  const readImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setNotice('');
    try {
      const workbook = read(await file.arrayBuffer(), { cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('The selected workbook has no worksheet.');
      const parsed = utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!parsed.length) throw new Error('The selected worksheet has no recipient rows.');
      if (parsed.length > 1000) throw new Error('Import up to 1,000 recipients at a time.');
      setImportRows(parsed.map(normalizeImportedRow));
    } catch (parseError) {
      setImportRows([]);
      setError(parseError.message || 'Excel file could not be read.');
    }
  };

  const importValidRows = async () => {
    const validRows = importRows.filter((row) => !row.error);
    if (!validRows.length) {
      setError('There are no valid rows to import.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch('/whatsapp/recipients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: validRows.map(({ name: rowName, phoneNumber: rowPhone, priority: rowPriority }) => ({
            name: rowName,
            phoneNumber: rowPhone,
            priority: rowPriority,
          })),
        }),
      });
      setNotice(`${result.saved} contacts saved · ${result.inserted} added · ${result.updated} updated · ${result.duplicatesIgnored} duplicate rows ignored.`);
      setImportRows([]);
      await loadRecipients();
    } catch (importError) {
      setError(importError.message || 'Recipient import failed.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecipient = async (recipient) => {
    if (!window.confirm(`Remove ${recipient.name} from the recipient list?`)) return;
    setDeletingId(recipient.id);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/whatsapp/recipients/${encodeURIComponent(recipient.id)}`, { method: 'DELETE' });
      setRecipients((current) => current.filter((item) => item.id !== recipient.id));
      setNotice(`${recipient.name} removed.`);
    } catch (deleteError) {
      setError(deleteError.message || 'Recipient could not be removed.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <main className="min-h-screen flex-1 space-y-6 p-4 text-slate-900 sm:p-6">
      <header className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black"><Users className="h-6 w-6 text-emerald-700" /> WhatsApp Recipients</h1>
          <p className="mt-1 text-sm text-slate-500">Manage saved contacts and choose their priority for messaging.</p>
        </div>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50">
          <Download className="h-4 w-4" /> Sample Excel
        </button>
      </header>

      {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</div>}

      <section className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={addRecipient} className="glass-card space-y-4 rounded-3xl p-5">
          <h2 className="font-extrabold">Add a recipient</h2>
          <label className="block space-y-1 text-sm font-bold">
            Name
            <input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 font-medium outline-none focus:border-emerald-500" placeholder="Contact name" />
          </label>
          <label className="block space-y-1 text-sm font-bold">
            WhatsApp number
            <input required type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 font-medium outline-none focus:border-emerald-500" placeholder="+91 98765 43210" />
            <span className="block text-xs font-medium text-slate-500">10-digit Indian numbers are saved with +91.</span>
          </label>
          <label className="block space-y-1 text-sm font-bold">
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium">
              {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add recipient
          </button>
        </form>

        <section className="glass-card space-y-4 rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="font-extrabold">Bulk import from Excel</h2>
              <p className="text-xs text-slate-500">Columns: Name, WhatsApp Number, Priority (High/Medium/Low).</p>
            </div>
          </div>
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={readImportFile} className="hidden" />
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50">
            <Upload className="h-4 w-4" /> Choose Excel or CSV
          </button>
          {importRows.length > 0 && (
            <div className="space-y-3 rounded-xl bg-white/70 p-3">
              <p className="text-sm font-bold">{importRows.filter((row) => !row.error).length} valid · {importRows.filter((row) => row.error).length} invalid rows</p>
              <div className="max-h-44 overflow-auto text-xs">
                {importRows.slice(0, 100).map((row, index) => (
                  <p key={`${row.phoneNumber}-${index}`} className={row.error ? 'py-1 text-red-700' : 'py-1 text-slate-600'}>
                    Row {index + 2}: {row.name || '—'} · {row.phoneNumber || '—'} {row.error ? `· ${row.error}` : ''}
                  </p>
                ))}
                {importRows.length > 100 && <p className="pt-1 font-semibold text-slate-500">Showing first 100 rows.</p>}
              </div>
              <button type="button" onClick={importValidRows} disabled={saving || !importRows.some((row) => !row.error)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import valid rows
              </button>
            </div>
          )}
        </section>
      </section>

      <section className="glass-card space-y-4 rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-extrabold">Saved recipients <span className="text-sm text-slate-500">({recipients.length})</span></h2></div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or number" className="w-44 bg-transparent text-sm outline-none" />
            </label>
            <select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
              <option value="">All priorities</option>
              {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading recipients…</p> : filteredRecipients.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No recipients found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Name</th><th>WhatsApp number</th><th>Priority</th><th className="text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecipients.map((recipient) => (
                  <tr key={recipient.id}>
                    <td className="py-3 font-bold">{recipient.name}</td>
                    <td className="py-3 font-mono text-slate-600">+{recipient.phoneNumber}</td>
                    <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityClass[recipient.priority]}`}>{recipient.priority === 'low' ? 'Low (less)' : recipient.priority}</span></td>
                    <td className="py-3 text-right"><button type="button" onClick={() => deleteRecipient(recipient)} disabled={deletingId === recipient.id} aria-label={`Remove ${recipient.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default WhatsappRecipients;
