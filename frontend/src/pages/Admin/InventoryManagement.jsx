import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Boxes,
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
  Save,
  TrendingUp,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';

const emptyItemForm = {
  name: '',
  category: '',
  description: '',
  quantity: '',
  purchasePrice: '',
  sellingPrice: '',
};

const money = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100';
const labelClass = 'mb-1.5 block text-xs font-bold text-slate-600';

const InventoryManagement = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('inventory');
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [restockItem, setRestockItem] = useState(null);
  const [restockForm, setRestockForm] = useState({
    quantity: '',
    purchasePrice: '',
    sellingPrice: '',
  });
  const [isRestocking, setIsRestocking] = useState(false);
  const [className, setClassName] = useState('');
  const [itemId, setItemId] = useState('');
  const [roster, setRoster] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isSavingIssues, setIsSavingIssues] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reportClass, setReportClass] = useState('');
  const [reportItem, setReportItem] = useState('');

  const loadData = useCallback(async () => {
    setError('');
    try {
      const response = await apiFetch('/inventory');
      setData(response);
      setClassName((current) => current || response.classes?.[0]?.name || '');
      setItemId((current) => current || response.items?.[0]?.id || '');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!className || !itemId || !data?.items?.some((item) => item.id === itemId)) {
      setRoster([]);
      setSelectedStudents([]);
      return;
    }

    let isCurrent = true;
    setIsRosterLoading(true);
    apiFetch(
      `/inventory/roster?className=${encodeURIComponent(className)}&itemId=${encodeURIComponent(itemId)}`
    )
      .then((rows) => {
        if (!isCurrent) return;
        setRoster(rows);
        setSelectedStudents([]);
      })
      .catch((loadError) => {
        if (isCurrent) setError(loadError.message);
      })
      .finally(() => {
        if (isCurrent) setIsRosterLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [className, data?.items, itemId]);

  const selectedItem = useMemo(
    () => data?.items?.find((item) => item.id === itemId) || null,
    [data?.items, itemId]
  );
  const pendingStudents = useMemo(() => roster.filter((student) => !student.issued), [roster]);
  const alreadyIssuedCount = roster.length - pendingStudents.length;
  const selectedIssueCost = Number(
    (selectedStudents.length * (selectedItem?.purchasePrice || 0)).toFixed(2)
  );
  const selectedIssueRevenue = Number(
    (selectedStudents.length * (selectedItem?.sellingPrice || 0)).toFixed(2)
  );
  const selectedIssueProfit = Number(
    (selectedIssueRevenue - selectedIssueCost).toFixed(2)
  );
  const filteredItemReports = useMemo(
    () => (data?.itemReports || []).filter((row) => !reportItem || row.itemId === reportItem),
    [data?.itemReports, reportItem]
  );
  const filteredClassReports = useMemo(
    () =>
      (data?.classReports || []).filter(
        (row) =>
          (!reportClass || row.className === reportClass) &&
          (!reportItem || row.itemId === reportItem)
      ),
    [data?.classReports, reportClass, reportItem]
  );
  const reportTotals = useMemo(() => {
    const reportRows = reportClass
      ? filteredClassReports.map((row) => ({
          issuedCost: row.expenses,
          revenue: row.revenue,
          profit: row.profit,
        }))
      : filteredItemReports;
    return reportRows.reduce(
      (totals, row) => ({
        issuedCost: totals.issuedCost + row.issuedCost,
        revenue: totals.revenue + row.revenue,
        profit: totals.profit + row.profit,
      }),
      { issuedCost: 0, revenue: 0, profit: 0 }
    );
  }, [filteredClassReports, filteredItemReports, reportClass]);

  const updateItemForm = (event) => {
    const { name, value } = event.target;
    setItemForm((current) => ({ ...current, [name]: value }));
  };

  const saveNewItem = async (event) => {
    event.preventDefault();
    setIsSavingItem(true);
    setError('');
    setNotice('');
    try {
      await apiFetch('/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemForm),
      });
      setItemForm(emptyItemForm);
      setNotice('Inventory item added. Purchase expense and unit profit are calculated automatically.');
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingItem(false);
    }
  };

  const restock = async (event) => {
    event.preventDefault();
    if (!restockItem) return;
    setIsRestocking(true);
    setError('');
    setNotice('');
    try {
      await apiFetch(`/inventory/items/${restockItem.id}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restockForm),
      });
      setNotice(`${restockItem.name} stock has been updated.`);
      setRestockItem(null);
      setRestockForm({ quantity: '', purchasePrice: '', sellingPrice: '' });
      await loadData();
    } catch (restockError) {
      setError(restockError.message);
    } finally {
      setIsRestocking(false);
    }
  };

  const toggleStudent = (studentId) => {
    setSelectedStudents((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  };

  const toggleAllPending = () => {
    setSelectedStudents((current) =>
      current.length === pendingStudents.length
        ? []
        : pendingStudents.map((student) => student.id)
    );
  };

  const saveIssues = async () => {
    if (!selectedStudents.length || !selectedItem) return;
    setIsSavingIssues(true);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch('/inventory/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, itemId, studentIds: selectedStudents }),
      });
      const notificationMessage = result.notificationFailures
        ? ` ${result.notificationFailures} student notification(s) could not be created.`
        : ' Confirmation notifications are available in the app inbox; push delivery is best-effort.';
      setNotice(`${result.issued} item(s) issued; ${result.alreadyIssued} were already recorded.${notificationMessage}`);
      setSelectedStudents([]);
      await loadData();
      const updatedRoster = await apiFetch(
        `/inventory/roster?className=${encodeURIComponent(className)}&itemId=${encodeURIComponent(itemId)}`
      );
      setRoster(updatedRoster);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSavingIssues(false);
    }
  };

  const sendReminders = async () => {
    if (!pendingStudents.length || !selectedItem) return;
    setIsSendingReminders(true);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch('/inventory/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, itemId }),
      });
      setNotice(
        `${result.reminded} pending reminder(s) created in the app inbox.${result.notificationFailures ? ` ${result.notificationFailures} notification(s) failed.` : ' Push delivery is best-effort.'}`
      );
    } catch (reminderError) {
      setError(reminderError.message);
    } finally {
      setIsSendingReminders(false);
    }
  };

  const tabs = [
    { id: 'inventory', label: 'Items & stock' },
    { id: 'issuance', label: 'Student issue tracking' },
    { id: 'reports', label: 'Reports' },
  ];

  if (isLoading && !data) {
    return <div className="p-6 text-sm font-semibold text-slate-500">Loading inventory…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10 text-slate-900">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">School operations</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Stock & Inventory</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Manage item costs and stock, record student issues by class, and follow pending distribution.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={16} /> Refresh data
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <AlertCircle className="mt-0.5 shrink-0" size={17} /> {error}
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="mt-0.5 shrink-0" size={17} /> {notice}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Active items', value: data?.summary?.itemCount || 0, icon: <Package size={17} className="text-indigo-500" /> },
          { label: 'Units in stock', value: data?.summary?.stockQuantity || 0, icon: <Boxes size={17} className="text-indigo-500" /> },
          { label: 'Issued / pending', value: `${data?.summary?.issued || 0} / ${data?.summary?.pending || 0}`, icon: <CheckCircle2 size={17} className="text-indigo-500" /> },
          { label: 'Purchase expense', value: money(data?.summary?.purchaseExpense), icon: <TrendingUp size={17} className="text-indigo-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500">{label}</span>
              {icon}
            </div>
            <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
          </div>
        ))}
      </section>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === tab.id
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'inventory' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Items & current stock</h2>
                <p className="mt-1 text-xs text-slate-500">Prices and profit are stored at issue time for accurate reporting.</p>
              </div>
              <Package className="shrink-0 text-indigo-500" size={21} />
            </div>
            {data?.items?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-3 pr-3">Item</th>
                      <th className="px-3 py-3 text-right">In stock</th>
                      <th className="px-3 py-3 text-right">Buy</th>
                      <th className="px-3 py-3 text-right">Sell</th>
                      <th className="px-3 py-3 text-right">Unit profit</th>
                      <th className="py-3 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-3">
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-400">{item.category || 'Uncategorized'}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{item.stockQuantity} / {item.quantityReceived}</td>
                        <td className="px-3 py-3 text-right">{money(item.purchasePrice)}</td>
                        <td className="px-3 py-3 text-right">{money(item.sellingPrice)}</td>
                        <td className={`px-3 py-3 text-right font-bold ${item.unitProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {money(item.unitProfit)}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockItem(item);
                              setRestockForm({ quantity: '', purchasePrice: '', sellingPrice: '' });
                            }}
                            className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">No inventory items yet. Add the first item using the form.</div>
            )}
            {restockItem && (
              <form onSubmit={restock} className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-black">Restock {restockItem.name}</h3>
                  <button type="button" onClick={() => setRestockItem(null)} aria-label="Close restock form" className="text-slate-500">×</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label><span className={labelClass}>Units to add</span><input required min="1" step="1" type="number" className={inputClass} value={restockForm.quantity} onChange={(event) => setRestockForm((current) => ({ ...current, quantity: event.target.value }))} /></label>
                  <label><span className={labelClass}>New purchase price (optional)</span><input min="0" step="0.01" type="number" className={inputClass} placeholder={String(restockItem.purchasePrice)} value={restockForm.purchasePrice} onChange={(event) => setRestockForm((current) => ({ ...current, purchasePrice: event.target.value }))} /></label>
                  <label><span className={labelClass}>New selling price (optional)</span><input min="0" step="0.01" type="number" className={inputClass} placeholder={String(restockItem.sellingPrice)} value={restockForm.sellingPrice} onChange={(event) => setRestockForm((current) => ({ ...current, sellingPrice: event.target.value }))} /></label>
                </div>
                <button disabled={isRestocking} type="submit" className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {isRestocking ? 'Saving…' : 'Save restock'}
                </button>
              </form>
            )}
          </section>

          <form onSubmit={saveNewItem} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Plus size={18} /></span>
              <div>
                <h2 className="text-lg font-black">Add inventory item</h2>
                <p className="text-xs text-slate-500">Total purchase expense is calculated from units × buy price.</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block"><span className={labelClass}>Item name</span><input required maxLength="120" name="name" value={itemForm.name} onChange={updateItemForm} className={inputClass} placeholder="e.g. School diary" /></label>
              <label className="block"><span className={labelClass}>Category (optional)</span><input maxLength="100" name="category" value={itemForm.category} onChange={updateItemForm} className={inputClass} placeholder="Books, uniform, stationery…" /></label>
              <label className="block"><span className={labelClass}>Description (optional)</span><textarea maxLength="1000" rows="2" name="description" value={itemForm.description} onChange={updateItemForm} className={inputClass} /></label>
              <div className="grid grid-cols-3 gap-2">
                <label><span className={labelClass}>Quantity</span><input required min="0" max="1000000" step="1" type="number" name="quantity" value={itemForm.quantity} onChange={updateItemForm} className={inputClass} /></label>
                <label><span className={labelClass}>Buy price</span><input required min="0" step="0.01" type="number" name="purchasePrice" value={itemForm.purchasePrice} onChange={updateItemForm} className={inputClass} /></label>
                <label><span className={labelClass}>Sell price</span><input required min="0" step="0.01" type="number" name="sellingPrice" value={itemForm.sellingPrice} onChange={updateItemForm} className={inputClass} /></label>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600">
                {itemForm.quantity && itemForm.purchasePrice
                  ? `Purchase expense: ${money(Number(itemForm.quantity) * Number(itemForm.purchasePrice))} · Unit profit: ${money(Number(itemForm.sellingPrice || 0) - Number(itemForm.purchasePrice))}`
                  : 'Enter prices and quantity to preview expense and profit.'}
              </div>
              <button disabled={isSavingItem} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                <Plus size={16} /> {isSavingItem ? 'Adding item…' : 'Add item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'issuance' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black">Issue items to students</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a class and item, tick students receiving it, then save the issue record.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label><span className={labelClass}>Class</span><select value={className} onChange={(event) => setClassName(event.target.value)} className={inputClass}><option value="">Select a class</option>{(data?.classes || []).map((cls) => <option key={cls.name} value={cls.name}>{cls.name} ({cls.studentCount})</option>)}</select></label>
            <label><span className={labelClass}>Inventory item</span><select value={itemId} onChange={(event) => setItemId(event.target.value)} className={inputClass}><option value="">Select an item</option>{(data?.items || []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stockQuantity} in stock</option>)}</select></label>
          </div>
          {selectedItem && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-900">
              <span>Available: {selectedItem.stockQuantity}</span>
              <span>Purchase: {money(selectedItem.purchasePrice)}</span>
              <span>Selling: {money(selectedItem.sellingPrice)}</span>
              <span>Profit: {money(selectedItem.unitProfit)} / unit</span>
            </div>
          )}
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-col justify-between gap-2 border-b border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center">
              <div className="text-sm font-bold text-slate-700">{className || 'Choose a class'} · Strength: {roster.length} students · {alreadyIssuedCount} issued · {pendingStudents.length} pending</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!pendingStudents.length || isRosterLoading} onClick={toggleAllPending} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
                  {selectedStudents.length === pendingStudents.length && pendingStudents.length ? 'Clear selection' : 'Select pending'}
                </button>
                <button type="button" disabled={!pendingStudents.length || isSendingReminders || isRosterLoading} onClick={sendReminders} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">
                  <Bell size={14} /> {isSendingReminders ? 'Sending…' : 'Remind pending'}
                </button>
                <button type="button" disabled={!selectedStudents.length || isSavingIssues || isRosterLoading || selectedStudents.length > (selectedItem?.stockQuantity || 0)} onClick={saveIssues} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                  <Save size={14} /> {isSavingIssues ? 'Saving…' : 'Save issued items'}
                </button>
              </div>
            </div>
            {isRosterLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">Loading class roster…</div>
            ) : !className || !itemId ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">Select a class and inventory item to view students.</div>
            ) : roster.length ? (
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-slate-400 shadow-sm">
                    <tr><th className="w-12 px-4 py-3">Issue</th><th className="px-3 py-3">Student</th><th className="px-3 py-3">Admission no.</th><th className="px-3 py-3">Section</th><th className="px-3 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roster.map((student) => (
                      <tr key={student.id} className={student.issued ? 'bg-emerald-50/40' : ''}>
                        <td className="px-4 py-3"><input type="checkbox" checked={student.issued || selectedStudents.includes(student.id)} disabled={student.issued} onChange={() => toggleStudent(student.id)} aria-label={`Mark ${student.displayName} as receiving item`} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" /></td>
                        <td className="px-3 py-3 font-bold text-slate-800">{student.displayName}</td>
                        <td className="px-3 py-3 text-slate-500">{student.admissionNumber}</td>
                        <td className="px-3 py-3 text-slate-500">{student.section || '—'}</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${student.issued ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{student.issued ? 'Issued' : 'Pending'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">No students are currently listed in this class.</div>
            )}
          </div>
          {selectedItem && (
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                <h3 className="text-sm font-black text-indigo-950">Selected students · live estimate (not saved)</h3>
                <span className="text-xs font-bold text-indigo-700">{selectedStudents.length} of {roster.length} students selected</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Selected units', String(selectedStudents.length)],
                  ['Purchase cost', money(selectedIssueCost)],
                  ['Selling amount', money(selectedIssueRevenue)],
                  ['Estimated profit', money(selectedIssueProfit)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white/80 p-3">
                    <div className="text-[11px] font-semibold text-slate-500">{label}</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Estimate uses the current average purchase cost per unit. Final report totals use the saved issue records and their cost snapshots.
              </p>
            </div>
          )}
          {selectedItem && selectedStudents.length > selectedItem.stockQuantity && (
            <p role="alert" className="mt-3 text-sm font-semibold text-red-700">Selected students exceed available stock. Select no more than {selectedItem.stockQuantity} pending student(s).</p>
          )}
          <p className="mt-3 text-xs text-slate-400">Students already marked issued cannot be unchecked here. Issue records preserve the price at the time of distribution.</p>
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={labelClass}>Class report</span><select value={reportClass} onChange={(event) => setReportClass(event.target.value)} className={inputClass}><option value="">Whole school</option>{(data?.classes || []).map((cls) => <option key={cls.name} value={cls.name}>{cls.name}</option>)}</select></label>
            <label><span className={labelClass}>Item filter</span><select value={reportItem} onChange={(event) => setReportItem(event.target.value)} className={inputClass}><option value="">All items</option>{(data?.items || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>

          {!reportClass && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4"><h2 className="font-black">School-wide item report</h2><p className="mt-1 text-xs text-slate-500">Purchase expense reflects all stock acquired; issue cost reflects the units distributed.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Item</th><th className="px-3 py-3 text-right">Received</th><th className="px-3 py-3 text-right">Issued</th><th className="px-3 py-3 text-right">Pending</th><th className="px-3 py-3 text-right">Purchase expense</th><th className="px-3 py-3 text-right">Issued cost</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Profit</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItemReports.map((row) => <tr key={row.itemId}><td className="px-4 py-3 font-bold">{row.itemName}</td><td className="px-3 py-3 text-right">{row.quantityReceived}</td><td className="px-3 py-3 text-right">{row.issued}</td><td className="px-3 py-3 text-right">{row.pending}</td><td className="px-3 py-3 text-right">{money(row.purchaseExpense)}</td><td className="px-3 py-3 text-right">{money(row.issuedCost)}</td><td className="px-3 py-3 text-right">{money(row.revenue)}</td><td className={`px-4 py-3 text-right font-bold ${row.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(row.profit)}</td></tr>)}
                    {!filteredItemReports.length && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500">No inventory report data for this filter.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4"><h2 className="font-black">{reportClass ? `${reportClass} item report` : 'Class-by-class distribution'}</h2><p className="mt-1 text-xs text-slate-500">Pending is based on the current class roster. Expenses, revenue, and profit below apply to issued units.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr>{!reportClass && <th className="px-4 py-3">Class</th>}<th className="px-4 py-3">Item</th><th className="px-3 py-3 text-right">Eligible</th><th className="px-3 py-3 text-right">Issued</th><th className="px-3 py-3 text-right">Pending</th><th className="px-3 py-3 text-right">Expenses</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Profit</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClassReports.map((row) => <tr key={`${row.className}-${row.itemId}`}>{!reportClass && <td className="px-4 py-3 font-bold">{row.className}</td>}<td className="px-4 py-3">{row.itemName}</td><td className="px-3 py-3 text-right">{row.eligible}</td><td className="px-3 py-3 text-right">{row.issued}</td><td className="px-3 py-3 text-right">{row.pending}</td><td className="px-3 py-3 text-right">{money(row.expenses)}</td><td className="px-3 py-3 text-right">{money(row.revenue)}</td><td className={`px-4 py-3 text-right font-bold ${row.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(row.profit)}</td></tr>)}
                  {!filteredClassReports.length && <tr><td colSpan={reportClass ? 7 : 8} className="px-4 py-8 text-center text-slate-500">No class report data for this filter.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Issued cost', reportTotals.issuedCost], ['Revenue', reportTotals.revenue], ['Profit', reportTotals.profit]].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-lg font-black">{money(value)}</div></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default InventoryManagement;
