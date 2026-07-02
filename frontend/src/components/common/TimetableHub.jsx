import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CopyPlus,
  Eye,
  Grid3X3,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useMasterData } from './masterData';
import {
  deleteTimetableTemplate,
  emptyTimetable,
  fetchEffectiveTimetable,
  fetchTimetableTemplates,
  getCellKey,
  getClassDayRows,
  saveTimetableTemplate,
  TIMETABLE_UPDATED_EVENT,
  todayIsoDate,
} from './timetableStore';

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeDraft = (draft, classNames) => {
  const base = draft || emptyTimetable(classNames);
  return {
    ...base,
    classes: base.classes?.length ? base.classes : emptyTimetable(classNames).classes,
    periods: base.periods?.length ? base.periods : emptyTimetable(classNames).periods,
    cells: base.cells || {},
  };
};

const TimetableHub = ({ mode = 'manage', portalLabel = 'Portal', session }) => {
  const isManage = mode === 'manage';
  const { classNames } = useMasterData();
  const [templates, setTemplates] = useState([]);
  const [draft, setDraft] = useState(() => emptyTimetable(classNames));
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const sessionClass =
    session?.activeStudent?.className ||
    session?.studentProfiles?.[0]?.className ||
    session?.profile?.className ||
    '';
  const [selectedClass, setSelectedClass] = useState(sessionClass);
  const [effective, setEffective] = useState(null);
  const [source, setSource] = useState('empty');
  const [status, setStatus] = useState('');

  const availableClasses = useMemo(
    () => [...new Set([...(classNames || []), ...(draft.classes || [])].filter(Boolean))],
    [classNames, draft.classes]
  );

  useEffect(() => {
    if (!selectedClass && availableClasses.length) setSelectedClass(availableClasses[0]);
  }, [availableClasses, selectedClass]);

  const loadTemplates = async () => {
    const payload = await fetchTimetableTemplates();
    const records = payload.timetables || [];
    setTemplates(records);
    setDraft(normalizeDraft(records.find((item) => item.mode === 'default') || emptyTimetable(classNames), classNames));
  };

  const loadEffective = async () => {
    const payload = await fetchEffectiveTimetable({ date: selectedDate, className: selectedClass });
    setEffective(payload.timetable);
    setSource(payload.source);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (isManage) {
          const payload = await fetchTimetableTemplates();
          if (!active) return;
          const records = payload.timetables || [];
          setTemplates(records);
          setDraft(normalizeDraft(records.find((item) => item.mode === 'default') || emptyTimetable(classNames), classNames));
        }
      } catch (error) {
        if (active) setStatus(error.message);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [classNames, isManage]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const payload = await fetchEffectiveTimetable({ date: selectedDate, className: selectedClass });
        if (!active) return;
        setEffective(payload.timetable);
        setSource(payload.source);
      } catch (error) {
        if (active) setStatus(error.message);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [selectedDate, selectedClass]);

  useEffect(() => {
    const refresh = () => {
      if (isManage) loadTemplates().catch((error) => setStatus(error.message));
      loadEffective().catch((error) => setStatus(error.message));
    };
    window.addEventListener(TIMETABLE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(TIMETABLE_UPDATED_EVENT, refresh);
  });

  const updateCell = (periodId, className, field, value) => {
    const key = getCellKey(periodId, className);
    setDraft((current) => ({
      ...current,
      cells: {
        ...(current.cells || {}),
        [key]: {
          ...(current.cells?.[key] || {}),
          [field]: value,
        },
      },
    }));
  };

  const updatePeriod = (periodId, field, value) => {
    setDraft((current) => ({
      ...current,
      periods: current.periods.map((period) =>
        period.id === periodId ? { ...period, [field]: value } : period
      ),
    }));
  };

  const addPeriod = () => {
    setDraft((current) => {
      const nextIndex = current.periods.length + 1;
      return {
        ...current,
        periods: [
          ...current.periods,
          { id: `period-${Date.now()}`, label: `Period ${nextIndex}`, time: '' },
        ],
      };
    });
  };

  const addClass = () => {
    const nextClass = window.prompt('Class column name');
    if (!nextClass) return;
    setDraft((current) => ({
      ...current,
      classes: [...new Set([...current.classes, nextClass.trim()].filter(Boolean))],
    }));
  };

  const removeClass = (className) => {
    setDraft((current) => ({
      ...current,
      classes: current.classes.filter((item) => item !== className),
      cells: Object.fromEntries(
        Object.entries(current.cells || {}).filter(([key]) => !key.endsWith(`__${className}`))
      ),
    }));
  };

  const removePeriod = (periodId) => {
    setDraft((current) => ({
      ...current,
      periods: current.periods.filter((period) => period.id !== periodId),
      cells: Object.fromEntries(
        Object.entries(current.cells || {}).filter(([key]) => !key.startsWith(`${periodId}__`))
      ),
    }));
  };

  const saveDraft = async () => {
    setStatus('Saving...');
    try {
      const payload = await saveTimetableTemplate(draft);
      setStatus('Timetable saved.');
      setDraft(normalizeDraft(payload.timetable, classNames));
      await loadTemplates();
      await loadEffective();
    } catch (error) {
      setStatus(error.message);
    }
  };

  const createOverride = () => {
    setDraft((current) => ({
      ...clone(current),
      id: undefined,
      name: 'Special Timetable',
      mode: 'override',
      fromDate: selectedDate,
      toDate: selectedDate,
    }));
  };

  const dayRows = getClassDayRows(effective, selectedClass);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <CalendarClock className="w-5 h-5" /> Timetable
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {isManage ? 'Admin and Clerk can manage default and date-specific timetables.' : `${portalLabel} live timetable view.`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-3 py-2 text-xs font-bold"
          />
          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            className="bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-3 py-2 text-xs font-bold"
          >
            {availableClasses.map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Eye className="w-4 h-4" /> {selectedClass || 'Class'} View
            </h3>
            <span className="text-[10px] font-black uppercase text-slate-500">{source}</span>
          </div>

          <div className="space-y-3">
            {dayRows.length ? dayRows.map((period) => (
              <div key={`${period.period}-${period.time}`} className="glass-soft rounded-2xl p-3 flex gap-3">
                <span className="w-12 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-black flex items-center justify-center text-xs">
                  {period.period.replace(/^Period\s*/i, '')}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{period.subject}</p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {[period.time, period.teacher, period.room].filter(Boolean).join(' | ') || 'Timing not set'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="glass-soft rounded-2xl p-4 text-xs font-bold text-slate-500">
                No timetable published for this class yet.
              </div>
            )}
          </div>
        </div>

        {isManage && (
          <div className="xl:col-span-8 glass-card rounded-3xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100/80 pb-3 mb-4">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" /> Timetable Builder
              </h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={createOverride} className="px-3 py-2 rounded-2xl btn-ghost text-xs font-black flex items-center gap-2">
                  <CopyPlus className="w-4 h-4" /> Date Override
                </button>
                <button type="button" onClick={addPeriod} className="px-3 py-2 rounded-2xl btn-ghost text-xs font-black flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Row
                </button>
                <button type="button" onClick={addClass} className="px-3 py-2 rounded-2xl btn-ghost text-xs font-black flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Column
                </button>
                <button type="button" onClick={saveDraft} className="px-4 py-2 rounded-2xl btn-primary text-xs font-black flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <input value={draft.name || ''} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="md:col-span-2 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-3 py-2 text-xs font-bold" placeholder="Timetable name" />
              <select value={draft.mode || 'default'} onChange={(event) => setDraft({ ...draft, mode: event.target.value, fromDate: event.target.value === 'default' ? '' : selectedDate, toDate: event.target.value === 'default' ? '' : selectedDate })} className="bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-3 py-2 text-xs font-bold">
                <option value="default">Default</option>
                <option value="override">Date range override</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" disabled={draft.mode === 'default'} value={draft.fromDate || ''} onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })} className="bg-white/60 disabled:opacity-50 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-2 py-2 text-xs font-bold" />
                <input type="date" disabled={draft.mode === 'default'} value={draft.toDate || ''} onChange={(event) => setDraft({ ...draft, toDate: event.target.value })} className="bg-white/60 disabled:opacity-50 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-2 py-2 text-xs font-bold" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
              <table className="w-full min-w-[960px] text-left text-xs font-bold">
                <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2 w-44">Period</th>
                    {draft.classes.map((className) => (
                      <th key={className} className="px-3 py-2 min-w-44">
                        <div className="flex items-center justify-between gap-2">
                          <span>{className}</span>
                          <button type="button" onClick={() => removeClass(className)} className="text-rose-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {draft.periods.map((period) => (
                    <tr key={period.id} className="align-top">
                      <td className="px-3 py-3 bg-white/50">
                        <div className="space-y-2">
                          <input value={period.label} onChange={(event) => updatePeriod(period.id, 'label', event.target.value)} className="w-full bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl px-2 py-2" />
                          <input value={period.time} onChange={(event) => updatePeriod(period.id, 'time', event.target.value)} className="w-full bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl px-2 py-2" placeholder="08:30 - 09:10" />
                          <button type="button" onClick={() => removePeriod(period.id)} className="text-[10px] font-black text-rose-600 flex items-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Remove row
                          </button>
                        </div>
                      </td>
                      {draft.classes.map((className) => {
                        const key = getCellKey(period.id, className);
                        const cell = draft.cells?.[key] || {};
                        return (
                          <td key={key} className="px-3 py-3">
                            <div className="space-y-2">
                              <input value={cell.subject || ''} onChange={(event) => updateCell(period.id, className, 'subject', event.target.value)} className="w-full bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl px-2 py-2" placeholder="Subject" />
                              <input value={cell.teacher || ''} onChange={(event) => updateCell(period.id, className, 'teacher', event.target.value)} className="w-full bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl px-2 py-2" placeholder="Teacher" />
                              <input value={cell.room || ''} onChange={(event) => updateCell(period.id, className, 'room', event.target.value)} className="w-full bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl px-2 py-2" placeholder="Room" />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col lg:flex-row gap-3 justify-between">
              <p className="text-xs font-bold text-slate-500">{status}</p>
              <div className="flex flex-wrap gap-2">
                {templates.map((item) => (
                  <button key={item.id} type="button" onClick={() => setDraft(normalizeDraft(item, classNames))} className="px-3 py-2 rounded-2xl btn-ghost text-[10px] font-black">
                    {item.mode === 'default' ? 'Default' : `${item.fromDate} to ${item.toDate}`}
                  </button>
                ))}
                {templates.filter((item) => item.mode === 'override').map((item) => (
                  <button key={`delete-${item.id}`} type="button" onClick={() => deleteTimetableTemplate(item.id).then(loadTemplates)} className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-100 text-[10px] font-black text-rose-700">
                    Delete {item.fromDate}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default TimetableHub;
