import { API_BASE_URL, apiFetch } from './api';

export const TIMETABLE_UPDATED_EVENT = 'mgps-timetable-updated';
export const TIMETABLE_API_URL = `${API_BASE_URL}/timetable`;

export const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const emptyTimetable = (classNames = []) => {
  const classes = (classNames.length ? classNames : ['Class 1', 'Class 2', 'Class 3']).slice(0, 6);
  const periods = [
    { id: 'period-1', label: 'Period 1', time: '08:30 - 09:10' },
    { id: 'period-2', label: 'Period 2', time: '09:10 - 09:50' },
    { id: 'period-3', label: 'Period 3', time: '09:50 - 10:30' },
    { id: 'period-4', label: 'Period 4', time: '10:45 - 11:25' },
    { id: 'period-5', label: 'Period 5', time: '11:25 - 12:05' },
  ];

  return {
    name: 'Default Timetable',
    mode: 'default',
    fromDate: '',
    toDate: '',
    classes,
    periods,
    cells: {},
  };
};

export const getCellKey = (periodId, className) => `${periodId}__${className}`;

export const getClassDayRows = (timetable, className) => {
  if (!timetable || !className) return [];

  return (timetable.periods || []).map((period, index) => {
    const cell = timetable.cells?.[getCellKey(period.id, className)] || {};
    return {
      period: period.label || String(index + 1),
      time: period.time || '',
      subject: cell.subject || 'Free / Not assigned',
      teacher: cell.teacher || '',
      room: cell.room || '',
      note: cell.note || '',
    };
  });
};

export const fetchEffectiveTimetable = async ({ date = todayIsoDate(), className = '' } = {}) =>
  apiFetch(`/timetable?date=${encodeURIComponent(date)}&className=${encodeURIComponent(className)}`);

export const fetchTimetableTemplates = async () => apiFetch('/timetable/templates');

export const saveTimetableTemplate = async (payload) => {
  const response = await apiFetch('/timetable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  window.dispatchEvent(new Event(TIMETABLE_UPDATED_EVENT));
  return response;
};

export const deleteTimetableTemplate = async (id) => {
  const response = await apiFetch(`/timetable/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  window.dispatchEvent(new Event(TIMETABLE_UPDATED_EVENT));
  return response;
};
