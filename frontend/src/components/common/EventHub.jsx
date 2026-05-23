import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  FileText,
  Image,
  Plus,
  Trash2,
  Trophy,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import {
  EVENT_UPDATED_EVENT,
  createEvent,
  fetchEvents,
  formatEventDate,
  getStudentParticipantProfile,
  participateInEvent,
  removeEvent,
  updateEvent,
} from './eventStore';

const emptyForm = {
  title: '',
  description: '',
  durationType: 'single',
  date: '',
  fromDate: '',
  toDate: '',
  participationEnabled: false,
  imageFile: null,
  imageName: '',
  removeImage: false,
};

const normalizeClassName = (className) => {
  const normalized = String(className || '').trim();
  return normalized || 'Unassigned Class';
};

const getClassSortValue = (className) => {
  const normalized = normalizeClassName(className)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

  if (normalized.includes('pre nursery')) return -1;
  if (normalized.includes('nursery')) return 0;
  if (/\blkg\b/.test(normalized)) return 1;
  if (/\bukg\b/.test(normalized)) return 2;

  const numericMatch = normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (numericMatch) return 2 + Number(numericMatch[1]);

  return 1000;
};

const sortParticipants = (participants) =>
  [...participants].sort((first, second) => {
    const admissionCompare = String(first.admissionNumber || '').localeCompare(
      String(second.admissionNumber || ''),
      undefined,
      { numeric: true, sensitivity: 'base' }
    );

    if (admissionCompare !== 0) return admissionCompare;

    return String(first.name || '').localeCompare(String(second.name || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

const groupParticipantsByClass = (participants = []) => {
  const groups = participants.reduce((classMap, participant) => {
    const className = normalizeClassName(participant.className);
    return {
      ...classMap,
      [className]: [...(classMap[className] || []), participant],
    };
  }, {});

  return Object.entries(groups)
    .map(([className, classParticipants]) => ({
      className,
      participants: sortParticipants(classParticipants),
    }))
    .sort((first, second) => {
      const orderCompare = getClassSortValue(first.className) - getClassSortValue(second.className);
      if (orderCompare !== 0) return orderCompare;

      return first.className.localeCompare(second.className, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
};

const sanitizeFileName = (value) =>
  String(value || 'event-roster')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'event-roster';

const formatJoinedDate = (date) => {
  if (!date) return '-';

  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const addPdfFooter = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 40, pageHeight - 20, {
      align: 'right',
    });
  }
};

const exportEventParticipantsPdf = (event, classGroups, scopeLabel) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const tableWidth = pageWidth - margin * 2;
  const columns = [
    { label: 'S.No.', x: margin, width: 38 },
    { label: 'Adm. No.', x: margin + 38, width: 94 },
    { label: 'Student Name', x: margin + 132, width: 142 },
    { label: 'Father Name', x: margin + 274, width: 142 },
    { label: 'Joined', x: margin + 416, width: tableWidth - 416 },
  ];
  let y = 42;

  const addPageIfNeeded = (heightNeeded) => {
    if (y + heightNeeded <= pageHeight - 42) return;
    doc.addPage();
    y = 42;
  };

  const addTableHeader = () => {
    doc.setFillColor(26, 26, 26);
    doc.rect(margin, y, tableWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    columns.forEach((column) => {
      doc.text(column.label, column.x + 5, y + 14);
    });
    y += 22;
  };

  doc.setTextColor(26, 26, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MGPS Event Participant Roster', margin, y);
  y += 22;

  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(event.title, tableWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 14 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  const totalParticipants = classGroups.reduce(
    (total, group) => total + group.participants.length,
    0
  );
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.text(`Event Date: ${formatEventDate(event)}`, margin, y);
  y += 13;
  doc.text(`Generated: ${generatedAt}`, margin, y);
  y += 13;
  doc.text(`Total Participants: ${totalParticipants}`, margin, y);
  y += 22;

  classGroups.forEach((group) => {
    addPageIfNeeded(74);
    doc.setFillColor(225, 250, 108);
    doc.rect(margin, y, tableWidth, 24, 'F');
    doc.setTextColor(26, 26, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${group.className} (${group.participants.length})`, margin + 8, y + 16);
    y += 28;

    addTableHeader();

    group.participants.forEach((participant, index) => {
      const nameLines = doc.splitTextToSize(participant.name || '-', columns[2].width - 10);
      const fatherLines = doc.splitTextToSize(
        participant.fatherName || '-',
        columns[3].width - 10
      );
      const rowHeight = Math.max(24, Math.max(nameLines.length, fatherLines.length) * 10 + 12);

      addPageIfNeeded(rowHeight + 22);
      if (y === 42) addTableHeader();

      doc.setDrawColor(234, 234, 234);
      doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 248);
      doc.rect(margin, y, tableWidth, rowHeight, 'FD');
      doc.setTextColor(26, 26, 26);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(String(index + 1), columns[0].x + 5, y + 14);
      doc.text(String(participant.admissionNumber || '-'), columns[1].x + 5, y + 14);
      doc.text(nameLines, columns[2].x + 5, y + 14);
      doc.text(fatherLines, columns[3].x + 5, y + 14);
      doc.text(formatJoinedDate(participant.joinedAt), columns[4].x + 5, y + 14);
      y += rowHeight;
    });

    y += 18;
  });

  addPdfFooter(doc);
  doc.save(`${sanitizeFileName(event.title)}-${sanitizeFileName(scopeLabel)}-participants.pdf`);
};

const EventHub = ({ role, session }) => {
  const canManage = role === 'admin' || role === 'clerk';
  const canParticipate = role === 'student';
  const studentProfile = useMemo(() => getStudentParticipantProfile(session), [session]);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState('');
  const [eventForm, setEventForm] = useState(emptyForm);
  const [confirmParticipationEvent, setConfirmParticipationEvent] = useState(null);
  const [selectedExportClass, setSelectedExportClass] = useState('');

  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
  const participantClassGroups = useMemo(
    () => groupParticipantsByClass(selectedEvent?.participants || []),
    [selectedEvent]
  );
  const resolvedExportClass = participantClassGroups.some(
    (group) => group.className === selectedExportClass
  )
    ? selectedExportClass
    : participantClassGroups[0]?.className || '';

  const loadEvents = async () => {
    const latestEvents = await fetchEvents();
    setEvents(latestEvents);
    return latestEvents;
  };

  useEffect(() => {
    let isActive = true;

    fetchEvents().then((latestEvents) => {
      if (isActive) setEvents(latestEvents);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const refreshEvents = () => {
      fetchEvents().then((latestEvents) => setEvents(latestEvents));
    };

    window.addEventListener(EVENT_UPDATED_EVENT, refreshEvents);
    return () => window.removeEventListener(EVENT_UPDATED_EVENT, refreshEvents);
  }, []);

  const updateFormField = (field, value) => {
    setEventForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'durationType' && value === 'single' ? { fromDate: '', toDate: '' } : {}),
      ...(field === 'durationType' && value === 'multiple' ? { date: '' } : {}),
    }));
  };

  const openCreateModal = () => {
    setEditingEventId('');
    setEventForm(emptyForm);
    setIsEventModalOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEventId(event.id);
    setEventForm({
      title: event.title,
      description: event.description,
      durationType: event.durationType || 'single',
      date: event.date || '',
      fromDate: event.fromDate || '',
      toDate: event.toDate || '',
      participationEnabled: Boolean(event.participationEnabled),
      imageFile: null,
      imageName: event.imageName || '',
      removeImage: false,
    });
    setIsEventModalOpen(true);
  };

  const handleImageAttach = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setEventForm((prev) => ({
      ...prev,
      imageFile: file,
      imageName: file.name,
      removeImage: false,
    }));
  };

  const handleSubmitEvent = async (event) => {
    event.preventDefault();

    if (!eventForm.title.trim() || !eventForm.description.trim()) {
      alert('Please add event title and description.');
      return;
    }

    if (eventForm.durationType === 'single' && !eventForm.date) {
      alert('Please choose the event date.');
      return;
    }

    if (eventForm.durationType === 'multiple' && (!eventForm.fromDate || !eventForm.toDate)) {
      alert('Please choose from and to dates.');
      return;
    }

    const payload = {
      ...eventForm,
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      createdByRole: role,
      createdByUsername: session?.username || role,
    };

    const savedEvent = editingEventId
      ? await updateEvent(editingEventId, payload)
      : await createEvent(payload);

    setIsEventModalOpen(false);
    setEventForm(emptyForm);
    setEditingEventId('');
    setSelectedEventId(savedEvent?.id || '');
    await loadEvents();
  };

  const handleRemoveEvent = async (event) => {
    if (!window.confirm(`Remove "${event.title}" from events?`)) return;

    await removeEvent(event.id);
    setSelectedEventId('');
    await loadEvents();
  };

  const handleConfirmParticipation = async () => {
    if (!confirmParticipationEvent) return;

    const updatedEvent = await participateInEvent(confirmParticipationEvent.id, studentProfile);
    setConfirmParticipationEvent(null);
    setSelectedEventId(updatedEvent?.id || confirmParticipationEvent.id);
    await loadEvents();
  };

  const handleExportParticipantsPdf = (className = '') => {
    if (!selectedEvent || !canManage) return;

    const groupsToExport = className
      ? participantClassGroups.filter((group) => group.className === className)
      : participantClassGroups;

    if (groupsToExport.length === 0) {
      alert('No participants available to export.');
      return;
    }

    exportEventParticipantsPdf(
      selectedEvent,
      groupsToExport,
      className || 'all-classes'
    );
  };

  const hasJoined = (event) =>
    event.participants?.some(
      (participant) => participant.admissionNumber === studentProfile.admissionNumber
    );

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#1A1A1A]" /> Campus Events & Participation Hub
          </h3>
          <p className="text-xs text-[#555555] mt-1">
            {canManage
              ? 'Create events, update schedules, attach optional images, and audit student participation rosters.'
              : 'View campus events, dates, details, and student participation openings.'}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center justify-center gap-1.5 text-xs font-black bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 px-5 py-3 rounded-full hover:bg-[#d4ee59] transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Schedule New Event
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <h4 className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-[#1A1A1A] inline-block rounded-xs"></span>
            Live Institutional Bulletin Tracks ({events.length})
          </h4>

          <div className="space-y-4">
            {events.map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                className={`bg-[#ffffff] border p-5 rounded-3xl transition-all cursor-pointer flex flex-col justify-between gap-4 group text-left w-full ${
                  selectedEventId === event.id
                    ? 'border-2 border-[#1A1A1A] ring-4 ring-[#1A1A1A]/5 shadow-sm'
                    : 'border-[#C8C8C8] hover:border-black'
                }`}
              >
                {event.imageDataUrl && (
                  <div className="w-full h-44 rounded-2xl overflow-hidden border border-[#EAEAEA] bg-[#EAEAEA]">
                    <img
                      src={event.imageDataUrl}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#555555] tracking-tight bg-[#EAEAEA] px-2 py-0.5 rounded-md">
                      ID: {event.id}
                    </span>

                    {event.participationEnabled ? (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-black px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Participation Open
                      </span>
                    ) : (
                      <span className="text-[10px] bg-[#EAEAEA]/80 text-[#555555] font-bold px-2.5 py-0.5 rounded-md">
                        Notice Only
                      </span>
                    )}
                  </div>

                  <h3 className="text-md font-black text-[#1A1A1A] group-hover:text-black transition-colors pt-1">
                    {event.title}
                  </h3>
                  <p className="text-xs text-[#555555] font-medium leading-relaxed line-clamp-2">
                    {event.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#EAEAEA] flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#555555]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#1A1A1A]" /> {formatEventDate(event)}
                    </span>
                    {event.imageName && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-[#555555]/80 max-w-[150px] truncate">
                        <Image className="w-3 h-3 text-[#1A1A1A]" /> {event.imageName}
                      </span>
                    )}
                  </div>

                  {event.participationEnabled && canManage && (
                    <span className="text-[10px] bg-[#1A1A1A] text-[#E1FA6C] font-mono font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Users className="w-3 h-3" /> {event.participants?.length || 0} Joined
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#ffffff] border border-[#C8C8C8] p-6 rounded-3xl min-h-[420px] shadow-xs">
          {!selectedEvent ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#555555] text-xs font-semibold py-24 space-y-2">
              <Users className="w-10 h-10 text-[#C8C8C8]" />
              <p>
                Click any event card on the left panel to inspect details
                {canManage ? ' and participation logs' : ''}.
              </p>
            </div>
          ) : (
            <div className="space-y-5 animate-fadeIn text-xs">
              <div className="border-b border-[#EAEAEA] pb-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[9px] bg-[#1A1A1A] text-white font-mono px-2 py-0.5 rounded uppercase font-bold">
                    Event Workspace
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(selectedEvent)}
                        className="p-2 rounded-xl bg-[#EAEAEA] hover:bg-[#D9D9D9] border border-[#C8C8C8] text-[#1A1A1A]"
                        title="Edit Event"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvent(selectedEvent)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700"
                        title="Remove Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <h2 className="text-md font-black text-[#1A1A1A] leading-tight pt-1">
                  {selectedEvent.title}
                </h2>
                <p className="text-[11px] font-bold text-[#555555] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {formatEventDate(selectedEvent)}
                </p>
              </div>

              {selectedEvent.imageDataUrl && (
                <div className="w-full h-48 rounded-2xl overflow-hidden border border-[#EAEAEA] bg-[#EAEAEA]">
                  <img
                    src={selectedEvent.imageDataUrl}
                    alt={selectedEvent.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-4 rounded-2xl text-[#333333] font-medium leading-relaxed">
                {selectedEvent.description}
              </div>

              {!selectedEvent.participationEnabled ? (
                <div className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-5 rounded-2xl text-center font-bold text-[#555555] space-y-2">
                  <CheckCircle2 className="w-6 h-6 text-[#555555] mx-auto" />
                  <p className="text-xs text-[#1A1A1A] font-black">Informational Event</p>
                  <p className="text-[11px] font-medium leading-relaxed">
                    Participation is not enabled for this event.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {canParticipate && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-[#1A1A1A]">{studentProfile.name}</p>
                        <p className="text-[10px] font-bold text-[#555555]">
                          {studentProfile.admissionNumber} - {studentProfile.className}
                        </p>
                      </div>
                      {hasJoined(selectedEvent) ? (
                        <span className="px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black text-center">
                          Participating
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmParticipationEvent(selectedEvent)}
                          className="px-4 py-2 rounded-full bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 text-xs font-black hover:bg-[#d4ee59]"
                        >
                          Participate
                        </button>
                      )}
                    </div>
                  )}

                  {canManage ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between font-bold text-[#1A1A1A] text-[11px] uppercase mb-2">
                        <span>Registered Student Roster</span>
                        <span className="font-mono bg-[#E1FA6C] border border-[#1A1A1A]/10 px-2 py-0.5 rounded text-[#1A1A1A] font-black">
                          COUNT: {selectedEvent.participants?.length || 0}
                        </span>
                      </div>

                      {(selectedEvent.participants?.length || 0) > 0 && (
                        <div className="bg-[#EAEAEA]/35 border border-[#C8C8C8]/70 rounded-2xl p-3 space-y-2">
                          <button
                            type="button"
                            onClick={() => handleExportParticipantsPdf()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A1A1A] text-[#E1FA6C] text-xs font-black hover:bg-black"
                          >
                            <Download className="w-4 h-4" />
                            Export All Classes PDF
                          </button>

                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                            <select
                              value={resolvedExportClass}
                              onChange={(event) => setSelectedExportClass(event.target.value)}
                              className="min-w-0 bg-white border border-[#C8C8C8] rounded-xl px-3 py-2.5 text-xs font-bold text-[#1A1A1A] outline-none focus:border-black"
                            >
                              {participantClassGroups.map((group) => (
                                <option key={group.className} value={group.className}>
                                  {group.className} ({group.participants.length})
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleExportParticipantsPdf(resolvedExportClass)}
                              disabled={!resolvedExportClass}
                              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 text-xs font-black hover:bg-[#d4ee59] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FileText className="w-4 h-4" />
                              Export Class
                            </button>
                          </div>
                        </div>
                      )}

                      {(selectedEvent.participants?.length || 0) === 0 ? (
                        <div className="text-center py-12 bg-[#EAEAEA]/20 rounded-2xl border border-dashed border-[#C8C8C8] text-[#555555] font-semibold">
                          Roster is currently blank.
                        </div>
                      ) : (
                        <div className="max-h-[340px] overflow-y-auto rounded-2xl border border-[#EAEAEA]">
                          <table className="w-full text-left text-[10px] font-bold min-w-[620px]">
                            <thead className="bg-[#EAEAEA] text-[#555555] uppercase">
                              <tr>
                                <th className="px-3 py-2">Adm. No.</th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Father Name</th>
                                <th className="px-3 py-2">Class</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EAEAEA] bg-white text-[#1A1A1A]">
                              {participantClassGroups.map((group) =>
                                group.participants.map((participant) => (
                                  <tr key={participant.admissionNumber}>
                                    <td className="px-3 py-2 font-mono text-[#555555]">
                                      {participant.admissionNumber}
                                    </td>
                                    <td className="px-3 py-2">{participant.name}</td>
                                    <td className="px-3 py-2">{participant.fatherName}</td>
                                    <td className="px-3 py-2">{group.className}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-5 rounded-2xl text-center font-bold text-[#555555] space-y-2">
                      <Trophy className="w-6 h-6 text-[#555555] mx-auto" />
                      <p className="text-xs text-[#1A1A1A] font-black">Participation Open</p>
                      <p className="text-[11px] font-medium leading-relaxed">
                        Students can register for this event from their portal.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isEventModalOpen && (
        <EventFormModal
          eventForm={eventForm}
          editingEventId={editingEventId}
          onClose={() => setIsEventModalOpen(false)}
          onSubmit={handleSubmitEvent}
          onFieldChange={updateFormField}
          onImageAttach={handleImageAttach}
        />
      )}

      {confirmParticipationEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#1A1A1A] rounded-3xl shadow-xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#E1FA6C] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#1A1A1A]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1A1A1A]">Confirm Participation</h3>
              <p className="text-xs text-[#555555] font-medium mt-1">
                Add {studentProfile.name} to "{confirmParticipationEvent.title}" participant list?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmParticipationEvent(null)}
                className="py-2.5 bg-[#EAEAEA] border border-[#C8C8C8] rounded-full text-xs font-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmParticipation}
                className="py-2.5 bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-full text-xs font-black"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EventFormModal = ({
  eventForm,
  editingEventId,
  onClose,
  onSubmit,
  onFieldChange,
  onImageAttach,
}) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
    <div className="bg-[#ffffff] border-2 border-black w-full max-w-lg rounded-3xl p-6 relative animate-scaleUp text-xs font-bold text-[#1A1A1A] space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
        <h3 className="text-md font-black text-[#1A1A1A] flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> {editingEventId ? 'Update Event' : 'Configure Campus Event'}
        </h3>
        <button type="button" onClick={onClose} className="p-1 hover:bg-[#EAEAEA] rounded-full transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[#555555]">Event Title</label>
          <input
            type="text"
            required
            value={eventForm.title}
            onChange={(event) => onFieldChange('title', event.target.value)}
            placeholder="e.g. Inter-School Cricket Tournament"
            className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-semibold"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[#555555]">Description</label>
          <textarea
            required
            rows="3"
            value={eventForm.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
            placeholder="Write event details, eligibility, schedule, or instructions..."
            className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black resize-none font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#EAEAEA]/60 border border-[#C8C8C8] p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => onFieldChange('durationType', 'single')}
            className={`py-2 rounded-xl text-xs font-black ${
              eventForm.durationType === 'single' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#555555]'
            }`}
          >
            Single Day
          </button>
          <button
            type="button"
            onClick={() => onFieldChange('durationType', 'multiple')}
            className={`py-2 rounded-xl text-xs font-black ${
              eventForm.durationType === 'multiple' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#555555]'
            }`}
          >
            Multiple Days
          </button>
        </div>

        {eventForm.durationType === 'single' ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[#555555]">Event Date</label>
            <input
              type="date"
              value={eventForm.date}
              onChange={(event) => onFieldChange('date', event.target.value)}
              className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-bold font-mono text-[#1A1A1A]"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#555555]">From</label>
              <input
                type="date"
                value={eventForm.fromDate}
                onChange={(event) => onFieldChange('fromDate', event.target.value)}
                className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-bold font-mono text-[#1A1A1A]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[#555555]">To</label>
              <input
                type="date"
                value={eventForm.toDate}
                onChange={(event) => onFieldChange('toDate', event.target.value)}
                className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-bold font-mono text-[#1A1A1A]"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[#555555]">Optional Image</label>
          <div className="relative">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={onImageAttach}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
            />
            <div className="w-full p-3 bg-[#EAEAEA]/50 border border-[#C8C8C8] border-dashed rounded-xl flex items-center justify-center gap-2 hover:border-black transition-all">
              <UploadCloud className="w-4 h-4 text-[#555555]" />
              <span className="text-[#555555] font-medium truncate max-w-[280px]">
                {eventForm.imageName || 'Attach event image'}
              </span>
            </div>
          </div>
          {eventForm.imageName && (
            <button
              type="button"
              onClick={() => {
                onFieldChange('imageName', '');
                onFieldChange('imageFile', null);
                onFieldChange('removeImage', true);
              }}
              className="text-[10px] font-black text-rose-600 text-left"
            >
              Remove attached image
            </button>
          )}
        </div>

        <div className="p-3 bg-[#E1FA6C]/10 border border-[#1A1A1A]/10 rounded-2xl flex items-center justify-between gap-4">
          <div>
            <label className="text-[#1A1A1A] font-black block">Enable Student Participation?</label>
            <span className="text-[10px] text-[#555555] font-semibold block mt-0.5">
              Students will see a participation button with this event.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={eventForm.participationEnabled}
              onChange={(event) => onFieldChange('participationEnabled', event.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-[#C8C8C8] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-[#C8C8C8] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1A1A1A]"></div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EAEAEA]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#EAEAEA] border border-[#C8C8C8] rounded-full hover:text-black transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-full font-black hover:bg-[#d4ee59] transition-all shadow-xs"
          >
            {editingEventId ? 'Update Event' : 'Publish Event'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default EventHub;
