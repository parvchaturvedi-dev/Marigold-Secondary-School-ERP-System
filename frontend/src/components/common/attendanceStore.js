import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';

export const ATTENDANCE_UPDATED_EVENT = 'mgps-erp-attendance:updated';

const normalizeParams = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, value);
    }
  });
  return query.toString();
};

const postJson = (path, body, method = 'POST') =>
  apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const fetchAttendanceOverview = (params = {}) =>
  apiFetch(`/attendance/overview?${normalizeParams(params)}`);

export const fetchAttendanceLogs = (params = {}) =>
  apiFetch(`/attendance/logs?${normalizeParams(params)}`);

export const fetchAttendanceDirectory = (params = {}) =>
  apiFetch(`/attendance/directory?${normalizeParams(params)}`);

export const fetchStaffAttendanceRecords = ({ from, to } = {}) =>
  apiFetch(`/attendance/staff-records?${normalizeParams({ from, to })}`);

export const fetchAttendanceSettings = () =>
  apiFetch('/attendance/settings');

export const saveAttendanceSettings = (settings) =>
  postJson('/attendance/settings', settings, 'PUT');

export const registerBiometric = (payload) =>
  postJson('/attendance/biometrics', payload, 'PUT');

export const scanAttendance = (payload) =>
  postJson('/attendance/scan', payload, 'POST');

export const clockAttendance = (payload) =>
  postJson('/attendance/clock', payload, 'POST');

export const saveStudentAttendanceBatch = (payload) =>
  postJson('/attendance/students/batch', payload, 'POST');

export const useAttendanceOverview = ({ date, className, period } = {}) => {
  const [state, setState] = useState({
    isLoading: true,
    error: '',
    overview: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: '' }));
    try {
      const overview = await fetchAttendanceOverview({ date, className, period });
      setState({ isLoading: false, error: '', overview });
    } catch (error) {
      setState((current) => ({ ...current, isLoading: false, error: error.message }));
    }
  }, [className, date, period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleUpdate = () => load();
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(ATTENDANCE_UPDATED_EVENT, handleUpdate);
  }, [load]);

  return useMemo(() => ({ ...state, reload: load }), [load, state]);
};
