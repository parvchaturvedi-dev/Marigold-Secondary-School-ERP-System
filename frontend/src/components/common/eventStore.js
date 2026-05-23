import { API_BASE_URL, authFetch, withAuthHeaders } from './api';

export const EVENT_STORAGE_KEY = 'mgps_erp_events';
export const EVENT_UPDATED_EVENT = 'mgps-erp-events-updated';

const EVENTS_API_URL = `${API_BASE_URL}/events`;

const todayIso = new Date().toISOString().slice(0, 10);

let eventCache = [];

const broadcastEventUpdate = () => {
  window.dispatchEvent(new Event(EVENT_UPDATED_EVENT));
};

export const readEvents = () => eventCache;

const writeEvents = (events) => {
  eventCache = Array.isArray(events) ? events : [];
};

const toFormData = (payload) => {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('durationType', payload.durationType);
  formData.append('date', payload.date || '');
  formData.append('fromDate', payload.fromDate || '');
  formData.append('toDate', payload.toDate || '');
  formData.append('participationEnabled', String(payload.participationEnabled));
  formData.append('createdByRole', payload.createdByRole);
  formData.append('createdByUsername', payload.createdByUsername);
  formData.append('removeImage', String(payload.removeImage || false));

  if (payload.imageFile) {
    formData.append('image', payload.imageFile);
  }

  return formData;
};

const cacheApiEvents = (events) => {
  writeEvents(events);
  broadcastEventUpdate();
};

export const fetchEvents = async () => {
  try {
    const response = await authFetch(EVENTS_API_URL);

    if (response.ok) {
      const events = await response.json();
      cacheApiEvents(events);
      return events;
    }
  } catch (error) {
    alert(`Event sync failed: ${error.message}`);
    return readEvents();
  }

  return readEvents();
};

export const createEvent = async (payload) => {
  try {
    const response = await authFetch(EVENTS_API_URL, {
      method: 'POST',
      body: toFormData(payload),
    });

    if (response.ok) {
      const event = await response.json();
      cacheApiEvents([event, ...readEvents().filter((item) => item.id !== event.id)]);
      return event;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Event could not be saved.');
  } catch (error) {
    alert(`Event save failed: ${error.message}`);
    return null;
  }

};

export const updateEvent = async (eventId, payload) => {
  try {
    const response = await authFetch(`${EVENTS_API_URL}/${eventId}`, {
      method: 'PATCH',
      body: toFormData(payload),
    });

    if (response.ok) {
      const event = await response.json();
      writeEvents(readEvents().map((item) => (item.id === event.id ? event : item)));
      broadcastEventUpdate();
      return event;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Event could not be updated.');
  } catch (error) {
    alert(`Event update failed: ${error.message}`);
    return null;
  }
};

export const removeEvent = async (eventId) => {
  try {
    const response = await authFetch(`${EVENTS_API_URL}/${eventId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      writeEvents(readEvents().filter((event) => event.id !== eventId));
      broadcastEventUpdate();
      return true;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Event could not be removed.');
  } catch (error) {
    alert(`Event removal failed: ${error.message}`);
    return false;
  }
};

export const participateInEvent = async (eventId, participant) => {
  try {
    const response = await authFetch(`${EVENTS_API_URL}/${eventId}/participate`, {
      method: 'PATCH',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(participant),
    });

    if (response.ok) {
      const event = await response.json();
      writeEvents(readEvents().map((item) => (item.id === event.id ? event : item)));
      broadcastEventUpdate();
      return event;
    }
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Participation could not be saved.');
  } catch (error) {
    alert(`Participation failed: ${error.message}`);
    return null;
  }
};

export const getStudentParticipantProfile = (session) => {
  if (session?.activeStudent) {
    return {
      admissionNumber: session.activeStudent.admissionNumber,
      name: session.activeStudent.displayName,
      fatherName: session.activeStudent.fatherName,
      className: `${session.activeStudent.className}-${session.activeStudent.section}`,
      username: session.activeStudent.id,
    };
  }

  const username = session?.username || '';

  return {
    admissionNumber: session?.admissionNumber || username,
    name: session?.displayName || username || 'Student',
    fatherName: session?.fatherName || '',
    className: session?.className || '',
    username,
  };
};

export const formatEventDate = (event) => {
  if (!event) return 'TBD';

  const formatDate = (date) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (event.durationType === 'multiple') {
    return `${formatDate(event.fromDate)} to ${formatDate(event.toDate)}`;
  }

  return formatDate(event.date || todayIso);
};
