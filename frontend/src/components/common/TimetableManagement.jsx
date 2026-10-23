import React, { useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Plus, WandSparkles } from 'lucide-react';
import { useMasterData } from './masterData';
import { saveTimetableTemplate } from './timetableStore';
import { solveWeeklyTimetable, WEEKDAYS } from '../../utils/timetableGenerator';

const DEFAULT_PERIOD_TIMES = [
  '08:30 - 09:10',
  '09:10 - 09:50',
  '09:50 - 10:30',
  '10:45 - 11:25',
  '11:25 - 12:05',
  '12:05 - 12:45',
  '12:45 - 13:25',
  '13:25 - 14:05',
  '14:05 - 14:45',
  '14:45 - 15:25',
];

const teacherId = (teacher) =>
  String(teacher.id || teacher.empId || teacher.username || teacher.name || '').trim();

const getEligibleTeachers = (teachers, className, subject) =>
  teachers.filter((teacher) =>
    (teacher.classAssignments || []).some(
      (assignment) => assignment.className === className && assignment.subject === subject
    )
  );

const makeDefaultLoads = (teachers) => {
  const seen = new Set();
  return teachers.flatMap((teacher) =>
    (teacher.classAssignments || []).flatMap((assignment) => {
      const className = String(assignment.className || '').trim();
      const subject = String(assignment.subject || '').trim();
      const id = teacherId(teacher);
      const key = `${className}__${subject}`;
      if (!className || !subject || !id || seen.has(key)) return [];
      seen.add(key);
      return [{
        id: `${key}__${id}`,
        className,
        subject,
        teacherId: id,
        teacherName: teacher.name || id,
        periodsPerWeek: 3,
      }];
    })
  );
};

const TimetableManagement = () => {
  const { classNames, classSubjects, teachers, isLoading } = useMasterData();
  const [selectedClasses, setSelectedClasses] = useState(null);
  const [days, setDays] = useState(WEEKDAYS);
  const [periodsPerDay, setPeriodsPerDay] = useState(6);
  const [loads, setLoads] = useState(null);
  const [availability, setAvailability] = useState({});
  const [generated, setGenerated] = useState(null);
  const [previewDay, setPreviewDay] = useState(WEEKDAYS[0]);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info');
  const defaultLoads = useMemo(() => makeDefaultLoads(teachers), [teachers]);
  const activeLoads = loads ?? defaultLoads;
  const activeClasses = selectedClasses ?? classNames;
  const periods = useMemo(
    () => Array.from({ length: periodsPerDay }, (_, index) => ({
      id: `period-${index + 1}`,
      label: `Period ${index + 1}`,
      time: DEFAULT_PERIOD_TIMES[index] || '',
    })),
    [periodsPerDay]
  );
  const totalWeeklySlots = days.length * periodsPerDay;
  const availableTeacherLoad = useMemo(() => Object.fromEntries(
    teachers.map((teacher) => {
      const id = teacherId(teacher);
      return [id, availability[id] ?? totalWeeklySlots];
    })
  ), [teachers, availability, totalWeeklySlots]);
  const subjectsWithoutTeachers = useMemo(() => {
    const assigned = new Set(teachers.flatMap((teacher) =>
      (teacher.classAssignments || []).map((assignment) =>
        `${assignment.className}__${assignment.subject}`
      )
    ));
    return classSubjects.flatMap((mapping) =>
      (mapping.subjects || [])
        .filter((subject) => !assigned.has(`${mapping.className}__${subject}`))
        .map((subject) => `${mapping.className}: ${subject}`)
    );
  }, [classSubjects, teachers]);

  const updateLoad = (id, changes) => {
    setLoads((current) => (current ?? defaultLoads).map((load) =>
      load.id === id ? { ...load, ...changes } : load
    ));
    setGenerated(null);
  };

  const addLoad = () => {
    const choices = teachers.flatMap((teacher) =>
      (teacher.classAssignments || []).map((assignment) => ({
        className: assignment.className,
        subject: assignment.subject,
        teacher,
      }))
    );
    const choice = choices.find(({ className, subject, teacher }) =>
      !activeLoads.some((load) =>
        load.className === className &&
        load.subject === subject &&
        load.teacherId === teacherId(teacher)
      )
    );
    if (!choice) {
      setStatus('All configured teacher assignments are already listed. Add or update teacher assignments to include more subjects.');
      setStatusType('error');
      return;
    }
    const id = `${choice.className}__${choice.subject}__${teacherId(choice.teacher)}__${Date.now()}`;
    setLoads((current) => [
      ...(current ?? defaultLoads),
      {
        id,
        className: choice.className,
        subject: choice.subject,
        teacherId: teacherId(choice.teacher),
        teacherName: choice.teacher.name || teacherId(choice.teacher),
        periodsPerWeek: 3,
      },
    ]);
    setGenerated(null);
    setStatus('');
  };

  const generate = () => {
    setStatus('');
    setGenerated(null);
    const result = solveWeeklyTimetable({
      days,
      periods,
      classes: activeClasses,
      assignments: activeLoads
        .filter((load) => activeClasses.includes(load.className) && Number(load.periodsPerWeek) > 0),
      teacherAvailability: availableTeacherLoad,
    });
    if (!result.ok) {
      setStatus(result.reason);
      setStatusType('error');
      return;
    }
    setGenerated({
      ...result,
      days: [...days],
      classes: [...activeClasses],
      periods: [...periods],
    });
    if (!days.includes(previewDay)) setPreviewDay(days[0]);
    setStatus(`Conflict-free weekly timetable generated with ${result.scheduled.length} assigned periods.`);
    setStatusType('success');
  };

  const publish = async () => {
    if (!generated) return;
    setStatus('Publishing weekly timetable...');
    setStatusType('info');
    try {
      await saveTimetableTemplate({
        name: 'Generated Weekly Timetable',
        mode: 'weekly',
        days: generated.days,
        classes: generated.classes,
        periods: generated.periods,
        cells: generated.cells,
      });
      setStatus('Weekly timetable published. Student and teacher timetable pages will show the schedule for the selected date.');
      setStatusType('success');
    } catch (error) {
      setStatus(error.message || 'Could not publish the weekly timetable.');
      setStatusType('error');
    }
  };

  const toggleDay = (day) => {
    setDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : WEEKDAYS.filter((item) => item === day || current.includes(item)));
    setGenerated(null);
  };

  const toggleClass = (className) => {
    const current = activeClasses || [];
    const next = current.includes(className)
      ? current.filter((item) => item !== className)
      : classNames.filter((item) => item === className || current.includes(item));
    setSelectedClasses(next);
    setGenerated(null);
  };

  const statusStyles = statusType === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : statusType === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-indigo-100 bg-indigo-50 text-indigo-700';

  return (
    <div className="space-y-6 pb-8 font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <CalendarClock className="h-5 w-5 text-indigo-600" />
              Timetable Management
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Set each class and subject weekly load, teacher availability, and school periods.
              The generator prevents class and teacher clashes.
            </p>
          </div>
          <span className="rounded-full border border-indigo-100 bg-white/70 px-3 py-1 text-xs font-bold text-indigo-700">
            Weekly generator
          </span>
        </div>
      </section>

      {status && (
        <div role="status" className={`flex items-start gap-2 rounded-2xl border p-4 text-sm font-semibold ${statusStyles}`}>
          {statusType === 'error'
            ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            : statusType === 'success'
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              : <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{status}</span>
        </div>
      )}

      <section className="glass-card space-y-5 rounded-3xl p-5 md:p-6">
        <div>
          <h3 className="text-base font-black">1. School week and classes</h3>
          <p className="mt-1 text-xs text-slate-500">Choose the days, periods per day, and classes to include.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label key={day} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${days.includes(day) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
              <input type="checkbox" checked={days.includes(day)} onChange={() => toggleDay(day)} />
              {day}
            </label>
          ))}
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm font-bold">
            Periods per day
            <select
              value={periodsPerDay}
              onChange={(event) => {
                setPeriodsPerDay(Number(event.target.value));
                setGenerated(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1"
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {(classNames || []).map((className) => (
            <label key={className} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${activeClasses.includes(className) ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
              <input type="checkbox" checked={activeClasses.includes(className)} onChange={() => toggleClass(className)} />
              {className}
            </label>
          ))}
          {!classNames.length && !isLoading && <p className="text-sm text-amber-700">No classes configured yet.</p>}
        </div>
      </section>

      <section className="glass-card space-y-4 rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black">2. Class, subject, teacher and weekly load</h3>
            <p className="mt-1 text-xs text-slate-500">Assignments are read from Teacher Management. Set how many periods each subject needs every week.</p>
          </div>
          <button type="button" onClick={addLoad} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50">
            <Plus className="h-4 w-4" /> Add teaching load
          </button>
        </div>
        {!activeLoads.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Configure teacher-to-class and subject assignments in Faculty Desk → Teacher Assignment before generating the timetable.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/60">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Periods / week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeLoads.map((load) => {
                  const eligibleTeachers = getEligibleTeachers(teachers, load.className, load.subject);
                  return (
                    <tr key={load.id}>
                      <td className="px-4 py-3 font-bold">{load.className}</td>
                      <td className="px-4 py-3">{load.subject}</td>
                      <td className="px-4 py-3">
                        <select
                          value={load.teacherId}
                          onChange={(event) => {
                            const selected = eligibleTeachers.find((teacher) => teacherId(teacher) === event.target.value);
                            updateLoad(load.id, {
                              teacherId: selected ? teacherId(selected) : '',
                              teacherName: selected?.name || '',
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          {eligibleTeachers.map((teacher) => (
                            <option key={teacherId(teacher)} value={teacherId(teacher)}>{teacher.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max={totalWeeklySlots}
                          value={load.periodsPerWeek}
                          onChange={(event) => updateLoad(load.id, { periodsPerWeek: event.target.value })}
                          className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-card space-y-4 rounded-3xl p-5 md:p-6">
        <div>
          <h3 className="text-base font-black">3. Teacher availability</h3>
          <p className="mt-1 text-xs text-slate-500">Maximum periods each teacher can teach during the selected week ({totalWeeklySlots} possible slots).</p>
        </div>
        {teachers.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {teachers.map((teacher) => {
              const id = teacherId(teacher);
              return (
                <label key={id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/60 p-3">
                  <span className="min-w-0 truncate text-sm font-bold">{teacher.name || id}</span>
                  <input
                    type="number"
                    min="0"
                    max={totalWeeklySlots}
                    value={availableTeacherLoad[id] ?? totalWeeklySlots}
                    onChange={(event) => {
                      setAvailability((current) => ({ ...current, [id]: event.target.value }));
                      setGenerated(null);
                    }}
                    className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    aria-label={`${teacher.name || id} available periods per week`}
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No teachers configured yet.</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
        >
          <WandSparkles className="h-4 w-4" /> Generate conflict-free timetable
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={!generated}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Publish weekly timetable
        </button>
      </div>

      {generated && (
        <section className="glass-card space-y-4 rounded-3xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black">Generated timetable preview</h3>
              <p className="mt-1 text-xs text-slate-500">{generated.scheduled.length} subject periods placed across {generated.days.length} school days.</p>
            </div>
            <select value={previewDay} onChange={(event) => setPreviewDay(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
              {generated.days.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/70">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Period</th>
                  {generated.classes.map((className) => <th key={className} className="px-3 py-3">{className}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generated.periods.map((period) => (
                  <tr key={period.id}>
                    <th className="whitespace-nowrap px-3 py-3">
                      <div className="font-bold">{period.label}</div>
                      <div className="text-[11px] font-normal text-slate-500">{period.time}</div>
                    </th>
                    {generated.classes.map((className) => {
                      const cell = generated.cells[`${previewDay}__${period.id}__${className}`];
                      return (
                        <td key={`${period.id}-${className}`} className="px-3 py-3">
                          {cell ? (
                            <div className="font-semibold">{cell.subject}<div className="text-xs font-normal text-slate-500">{cell.teacher}</div></div>
                          ) : <span className="text-slate-400">Free</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {subjectsWithoutTeachers.length > 0 && (
        <p className="text-xs text-amber-700">
          Some mapped subjects have no teacher assignment and are not included in the generated schedule.
        </p>
      )}
    </div>
  );
};

export default TimetableManagement;
