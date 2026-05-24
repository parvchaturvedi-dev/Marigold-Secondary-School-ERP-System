import { API_BASE_URL, authFetch } from './api';

export const ACADEMIC_CALENDAR_STORAGE_KEY = 'mgps_academic_calendar_pdf';
export const ACADEMIC_CALENDAR_UPDATED_EVENT = 'mgps-academic-calendar-updated';

const ACADEMIC_CALENDAR_API_URL = `${API_BASE_URL}/academic-calendar`;
let academicCalendarCache = null;

export const formatFileSize = (size = 0) => {
  if (!size) return '0 KB';
  const mb = size / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(size / 1024).toFixed(1)} KB`;
};

export const readAcademicCalendar = () => academicCalendarCache;

const cacheCalendar = (calendarPayload) => {
  academicCalendarCache = calendarPayload || null;
};

const broadcastCalendarUpdate = () => {
  window.dispatchEvent(new Event(ACADEMIC_CALENDAR_UPDATED_EVENT));
};

export const saveAcademicCalendar = async (file, uploadedBy = 'Admin') => {
  try {
    const payload = new FormData();
    payload.append('calendarPdf', file);
    payload.append('uploadedBy', uploadedBy);

    const response = await authFetch(ACADEMIC_CALENDAR_API_URL, {
      method: 'POST',
      body: payload,
    });

    if (response.ok) {
      const calendarPayload = await response.json();
      cacheCalendar(calendarPayload);
      broadcastCalendarUpdate();
      return calendarPayload;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Academic calendar could not be saved.');
  } catch (error) {
    alert(`Academic calendar save failed: ${error.message}`);
    return null;
  }
};

export const fetchAcademicCalendar = async ({ broadcast = false } = {}) => {
  try {
    const response = await authFetch(`${ACADEMIC_CALENDAR_API_URL}/latest`);

    if (response.ok) {
      const calendarPayload = await response.json();
      cacheCalendar(calendarPayload);
      if (broadcast) broadcastCalendarUpdate();
      return calendarPayload;
    }

    if (response.status === 404) {
      cacheCalendar(null);
      if (broadcast) broadcastCalendarUpdate();
      return null;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Academic calendar could not be loaded.');
  } catch (error) {
    alert(`Academic calendar loading failed: ${error.message}`);
    return readAcademicCalendar();
  }
};

export const removeAcademicCalendar = async () => {
  try {
    const response = await authFetch(ACADEMIC_CALENDAR_API_URL, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message || 'Academic calendar could not be removed.');
    }
  } catch (error) {
    alert(`Academic calendar removal failed: ${error.message}`);
    return;
  }

  cacheCalendar(null);
  broadcastCalendarUpdate();
};

export const formatCalendarDate = (isoDate) => {
  if (!isoDate) return 'Not published';

  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
