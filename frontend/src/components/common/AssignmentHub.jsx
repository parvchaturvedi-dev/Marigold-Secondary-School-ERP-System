import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit2,
  FileImage,
  FileText,
  Layers,
  Paperclip,
  PlusCircle,
  Send,
  User,
  Video,
  X,
} from 'lucide-react';
import {
  ASSIGNMENT_UPDATED_EVENT,
  createAssignment,
  extendAssignmentDate,
  fetchAssignments,
  formatAssignmentDateTime,
  formatCheckingDate,
  getStudentOptions,
  getTeacherAllowedClasses,
  updateAssignment,
} from './assignmentStore';
import { sortClassNames, useMasterData } from './masterData';

const emptyForm = {
  title: '',
  description: '',
  subject: '',
  targetClasses: [],
  checkingDate: '',
  attachmentFile: null,
  attachmentName: '',
  removeAttachment: false,
};

const AssignmentHub = ({ role, session }) => {
  const canCreate = ['admin', 'clerk', 'teacher'].includes(role);
  const canManageAll = role === 'admin' || role === 'clerk';
  const { classNames } = useMasterData();
  const studentOptions = useMemo(() => getStudentOptions(session), [session]);
  const teacherAllowedClasses = useMemo(
    () => sortClassNames(getTeacherAllowedClasses(session), classNames),
    [classNames, session]
  );
  const availableClasses = canManageAll ? classNames : teacherAllowedClasses;
  const [selectedStudentId, setSelectedStudentId] = useState(studentOptions[0]?.id || '');
  const selectedStudent =
    studentOptions.find((student) => student.id === selectedStudentId) || studentOptions[0];
  const defaultClass = role === 'student' ? selectedStudent?.className : availableClasses[0];
  const [selectedClass, setSelectedClass] = useState(defaultClass || 'Class 9');
  const [assignments, setAssignments] = useState([]);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState('');
  const [assignmentForm, setAssignmentForm] = useState(emptyForm);
  const [extensionAssignment, setExtensionAssignment] = useState(null);
  const [extendedDate, setExtendedDate] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const activeSelectedClass =
    role === 'student' ? selectedStudent?.className || selectedClass : selectedClass;
  const visibleClasses = role === 'student' ? [selectedStudent?.className].filter(Boolean) : availableClasses;
  const visibleAssignments = assignments.filter((assignment) =>
    assignment.targetClasses?.includes(activeSelectedClass)
  );

  const loadAssignments = async () => {
    const latestAssignments = await fetchAssignments(session, selectedStudent);
    setAssignments(latestAssignments);
    return latestAssignments;
  };

  useEffect(() => {
    let isActive = true;
    const sessionScope = { role: session?.role, username: session?.username };
    const studentScope = selectedStudent?.className ? { className: selectedStudent.className } : null;

    fetchAssignments(sessionScope, studentScope).then((latestAssignments) => {
      if (isActive) setAssignments(latestAssignments);
    });

    return () => {
      isActive = false;
    };
  }, [selectedStudent?.className, session?.role, session?.username]);

  useEffect(() => {
    const refreshAssignments = () => {
      const sessionScope = { role: session?.role, username: session?.username };
      const studentScope = selectedStudent?.className ? { className: selectedStudent.className } : null;

      fetchAssignments(sessionScope, studentScope).then((latestAssignments) => {
        setAssignments(latestAssignments);
      });
    };

    window.addEventListener(ASSIGNMENT_UPDATED_EVENT, refreshAssignments);
    return () => window.removeEventListener(ASSIGNMENT_UPDATED_EVENT, refreshAssignments);
  }, [selectedStudent?.className, session?.role, session?.username]);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [isCameraOpen]);

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  const updateFormField = (field, value) => {
    setAssignmentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getActor = () => ({
    role,
    username: session?.username || role,
    name: session?.displayName || session?.username || role,
  });

  const canMutateAssignment = (assignment) => {
    if (!assignment || assignment.isLocked || role === 'student') return false;
    if (canManageAll) return true;
    return assignment.createdByUsername === session?.username;
  };

  const getAttachmentMeta = (attachment) => {
    const name = attachment?.name || '';
    const mimeType = attachment?.mimeType || '';
    const lowerName = name.toLowerCase();

    if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(lowerName)) {
      return { icon: FileImage, tone: 'text-blue-600 bg-blue-50', label: 'Image' };
    }
    if (mimeType.startsWith('video/') || /\.(mp4|mov|mkv|webm)$/i.test(lowerName)) {
      return { icon: Video, tone: 'text-rose-600 bg-rose-50', label: 'Video' };
    }
    return { icon: FileText, tone: 'text-purple-600 bg-purple-50', label: 'PDF / Document' };
  };

  const openCreateModal = () => {
    setEditingAssignmentId('');
    setAssignmentForm({
      ...emptyForm,
      targetClasses: role === 'teacher' ? teacherAllowedClasses.slice(0, 1) : [],
    });
    setIsAssignmentModalOpen(true);
  };

  const openEditModal = (assignment) => {
    setEditingAssignmentId(assignment.id);
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description,
      subject: assignment.subject || '',
      targetClasses: assignment.targetClasses || [],
      checkingDate: assignment.checkingDate,
      attachmentFile: null,
      attachmentName: assignment.attachment?.name || '',
      removeAttachment: false,
    });
    setIsAssignmentModalOpen(true);
  };

  const toggleTargetClass = (className) => {
    setAssignmentForm((prev) => ({
      ...prev,
      targetClasses: prev.targetClasses.includes(className)
        ? prev.targetClasses.filter((item) => item !== className)
        : [...prev.targetClasses, className],
    }));
  };

  const selectAllTargetClasses = () => {
    setAssignmentForm((prev) => ({
      ...prev,
      targetClasses:
        prev.targetClasses.length === availableClasses.length ? [] : [...availableClasses],
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAssignmentForm((prev) => ({
      ...prev,
      attachmentFile: file,
      attachmentName: file.name,
      removeAttachment: false,
    }));
  };

  const startCamera = async () => {
    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch {
      setCameraError('Camera permission denied or camera not available.');
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
  };

  const captureCameraImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-assignment-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      setAssignmentForm((prev) => ({
        ...prev,
        attachmentFile: file,
        attachmentName: file.name,
        removeAttachment: false,
      }));
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const handleSubmitAssignment = async (event) => {
    event.preventDefault();

    if (!assignmentForm.title.trim() || !assignmentForm.description.trim()) {
      alert('Title and description are mandatory.');
      return;
    }

    if (!editingAssignmentId && !assignmentForm.checkingDate) {
      alert('Checking date is mandatory.');
      return;
    }

    if (assignmentForm.targetClasses.length === 0) {
      alert('Please select at least one class.');
      return;
    }

    const actor = getActor();
    const payload = {
      ...assignmentForm,
      title: assignmentForm.title.trim(),
      description: assignmentForm.description.trim(),
      subject: assignmentForm.subject.trim() || 'General',
      targetClasses: sortClassNames(assignmentForm.targetClasses, classNames),
      checkingDate: assignmentForm.checkingDate,
      createdByRole: actor.role,
      createdByUsername: actor.username,
      createdByName: actor.name,
      actorRole: actor.role,
      actorUsername: actor.username,
      actorName: actor.name,
    };

    const savedAssignment = editingAssignmentId
      ? await updateAssignment(editingAssignmentId, payload)
      : await createAssignment(payload);

    setIsAssignmentModalOpen(false);
    setEditingAssignmentId('');
    setAssignmentForm(emptyForm);
    setSelectedClass(savedAssignment?.targetClasses?.[0] || selectedClass);
    await loadAssignments();
  };

  const openExtensionModal = (assignment) => {
    setExtensionAssignment(assignment);
    setExtendedDate('');
  };

  const handleExtendDate = async (event) => {
    event.preventDefault();
    if (!extensionAssignment || !extendedDate) return;

    const actor = getActor();
    const updatedAssignment = await extendAssignmentDate(extensionAssignment.id, {
      checkingDate: extendedDate,
      actorRole: actor.role,
      actorUsername: actor.username,
      actorName: actor.name,
    });

    setExtensionAssignment(null);
    setExtendedDate('');
    setSelectedClass(updatedAssignment?.targetClasses?.[0] || selectedClass);
    await loadAssignments();
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans">
      <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#8b5cf6]" /> Assignment Control Room
          </h3>
          <p className="text-xs text-[#666666] mt-0.5">
            {role === 'student'
              ? 'View assignments assigned to your class.'
              : 'Create, update, and monitor assignment reports with checking-date controls.'}
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#E1FA6C] text-[#1A1A1A] rounded-full text-xs font-bold shadow-sm hover:scale-[1.02] transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Issue Assignment
          </button>
        )}
      </div>

      {role === 'student' && studentOptions.length > 1 && (
        <div className="bg-white border border-[#EAEAEA] rounded-3xl p-4 shadow-sm">
          <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">
            Select student before viewing assignments
          </label>
          <select
            value={selectedStudentId}
            onChange={(event) => {
              const nextStudentId = event.target.value;
              const nextStudent = studentOptions.find((student) => student.id === nextStudentId);
              setSelectedStudentId(nextStudentId);
              if (nextStudent?.className) setSelectedClass(nextStudent.className);
            }}
            className="w-full md:w-80 bg-[#EAEAEA] border border-[#C8C8C8] rounded-2xl px-3 py-2.5 text-xs font-bold outline-none"
          >
            {studentOptions.map((student) => (
              <option key={student.id} value={student.id}>
                {student.displayName} - {student.className}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-[#EAEAEA] p-4 rounded-3xl flex flex-col gap-2 shadow-sm max-h-[640px] overflow-y-auto no-scrollbar">
          <h4 className="text-xs font-bold text-[#1A1A1A] px-1 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Classrooms Grid
          </h4>
          <div className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            {visibleClasses.map((className) => (
              <button
                key={className}
                type="button"
                onClick={() => setSelectedClass(className)}
                className={`px-4 py-2.5 rounded-full text-xs font-bold text-left transition-all whitespace-nowrap w-full ${
            activeSelectedClass === className
                    ? 'bg-[#8b5cf6] text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {className}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white p-6 rounded-3xl border border-[#EAEAEA] shadow-sm min-h-[580px] flex flex-col">
          <div className="border-b border-gray-100 pb-3 mb-6 flex items-center justify-between">
            <h4 className="text-sm font-black text-[#1A1A1A]">Assignment Feed Stack: {activeSelectedClass}</h4>
            <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-bold uppercase">
              {visibleAssignments.length} Logs
            </span>
          </div>

          {visibleAssignments.length > 0 ? (
            <div className="relative border-l-2 border-gray-100 ml-4 pl-6 space-y-6 flex-1">
              {visibleAssignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  classOrder={availableClasses}
                  getAttachmentMeta={getAttachmentMeta}
                  canMutate={canMutateAssignment(assignment)}
                  onEdit={() => openEditModal(assignment)}
                  onExtend={() => openExtensionModal(assignment)}
                />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 my-auto">
              <ClipboardList className="w-12 h-12 stroke-[1.2] mb-1.5" />
              <p className="text-xs font-bold text-[#1A1A1A]">No Assignments Found</p>
            </div>
          )}

          {canManageAll && (
            <AssignmentReport
              assignments={visibleAssignments}
              selectedClass={activeSelectedClass}
              classOrder={availableClasses}
            />
          )}
        </div>
      </div>

      {isAssignmentModalOpen && (
        <AssignmentModal
          assignmentForm={assignmentForm}
          editingAssignmentId={editingAssignmentId}
          availableClasses={availableClasses}
          canSelectAll={canManageAll}
          fileInputRef={fileInputRef}
          cameraError={cameraError}
          onClose={() => setIsAssignmentModalOpen(false)}
          onFieldChange={updateFormField}
          onToggleClass={toggleTargetClass}
          onSelectAll={selectAllTargetClasses}
          onFileChange={handleFileChange}
          onCameraOpen={startCamera}
          onSubmit={handleSubmitAssignment}
        />
      )}

      {extensionAssignment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-gray-100 shadow-2xl space-y-4">
            <div>
              <h4 className="text-sm font-black text-[#1A1A1A]">Checking Date Extension</h4>
              <p className="text-[11px] text-gray-400">
                Assignment: <b>{extensionAssignment.title}</b>
              </p>
            </div>

            <form onSubmit={handleExtendDate} className="space-y-4 text-xs font-semibold">
              <div className="p-3 bg-gray-50 rounded-xl text-gray-600 space-y-1">
                <p>
                  Current Checking Date:{' '}
                  <span className="font-bold text-purple-700">
                    {formatCheckingDate(extensionAssignment.checkingDate)}
                  </span>
                </p>
                <p>
                  Given By: <span className="font-bold text-gray-800">{extensionAssignment.createdByName}</span>
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-bold text-gray-700">New Checking Date</label>
                <input
                  type="date"
                  required
                  value={extendedDate}
                  onChange={(event) => setExtendedDate(event.target.value)}
                  className="p-2.5 border border-gray-200 rounded-xl outline-none font-bold text-gray-800 focus:border-[#8b5cf6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtensionAssignment(null)}
                  className="px-4 py-2 bg-gray-100 rounded-full font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8b5cf6] text-white rounded-full font-bold shadow-sm"
                >
                  Confirm Extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-xl border border-gray-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-[#1A1A1A] flex items-center gap-2">
                <Camera className="w-4 h-4" /> Camera Capture
              </h4>
              <button type="button" onClick={stopCamera} className="p-1 hover:bg-[#EAEAEA] rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl bg-black aspect-video" />
            <canvas ref={canvasRef} className="hidden" />
            <button
              type="button"
              onClick={captureCameraImage}
              className="w-full py-3 bg-[#E1FA6C] rounded-2xl text-xs font-black"
            >
              Capture and Attach Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AssignmentCard = ({ assignment, classOrder, getAttachmentMeta, canMutate, onEdit, onExtend }) => {
  const latestExtension = assignment.extensionLogs?.[assignment.extensionLogs.length - 1];
  const attachmentMeta = assignment.attachment ? getAttachmentMeta(assignment.attachment) : null;
  const AttachmentIcon = attachmentMeta?.icon;

  return (
    <div className="relative group animate-fadeIn">
      <span className="absolute -left-[33px] top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm ring-2 ring-purple-400 bg-purple-400" />

      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 group-hover:border-gray-300 transition-all">
        {assignment.isLocked && (
          <div className="mb-3 px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-xl flex items-center gap-1.5 text-[10px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Checking date has passed. This assignment is view only.
          </div>
        )}

        {latestExtension && (
          <div className="mb-3 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1.5 text-[10px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Extended from <span className="underline">{formatCheckingDate(latestExtension.fromDate)}</span> to{' '}
            <span className="underline font-black text-amber-900">{formatCheckingDate(latestExtension.toDate)}</span> by{' '}
            {latestExtension.extendedByName}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-gray-200 text-gray-700 uppercase">
              {sortClassNames(assignment.targetClasses, classOrder).join(', ')}
            </span>
            <h5 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-gray-400" /> {assignment.subject}
            </h5>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
            <Clock className="w-3 h-3" /> <span>Issued: {formatAssignmentDateTime(assignment.createdAt)}</span>
          </div>
        </div>

        <p className="text-sm font-black text-gray-900 leading-snug">{assignment.title}</p>
        <p className="mt-1 text-xs text-gray-600 font-medium leading-relaxed">{assignment.description}</p>

        {assignment.attachment && attachmentMeta && AttachmentIcon && (
          <a
            href={assignment.attachment.dataUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 p-2 rounded-xl border border-gray-200 bg-white flex items-center justify-between max-w-sm"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className={`p-1.5 rounded ${attachmentMeta.tone}`}>
                <AttachmentIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-gray-700 truncate">{assignment.attachment.name}</span>
            </div>
            <span className="text-[9px] font-black text-gray-400">{attachmentMeta.label}</span>
          </a>
        )}

        <div className="mt-4 pt-2.5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500 font-medium">
          <p className="text-gray-700 flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Issued By: <b className="font-semibold">{assignment.createdByName}</b>
          </p>

          <div className="flex items-center gap-2">
            <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-bold border border-purple-100">
              Checking Date: {formatCheckingDate(assignment.checkingDate)}
            </span>
            {canMutate && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="px-3 py-1 bg-white hover:bg-gray-900 hover:text-white border border-gray-300 text-gray-700 rounded-full text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" /> Update
                </button>
                <button
                  type="button"
                  onClick={onExtend}
                  className="px-3 py-1 bg-white hover:bg-[#8b5cf6] hover:text-white border border-[#8b5cf6] text-[#8b5cf6] rounded-full text-[10px] font-bold transition-all shadow-xs"
                >
                  Extend Checking Date
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AssignmentReport = ({ assignments, selectedClass, classOrder }) => (
  <div className="mt-8 border-t border-gray-100 pt-5">
    <h4 className="text-xs font-black uppercase text-[#1A1A1A] mb-3">
      Class Assignment Report: {selectedClass}
    </h4>
    <div className="overflow-x-auto rounded-2xl border border-gray-200">
      <table className="w-full min-w-[780px] text-left text-[10px] font-bold">
        <thead className="bg-[#EAEAEA] text-[#555555] uppercase">
          <tr>
            <th className="px-3 py-2">Teacher / Sender</th>
            <th className="px-3 py-2">Date & Time</th>
            <th className="px-3 py-2">Class</th>
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Assignment</th>
            <th className="px-3 py-2">Checking Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white text-[#1A1A1A]">
          {assignments.map((assignment) => (
            <tr key={assignment.id}>
              <td className="px-3 py-2">{assignment.createdByName}</td>
              <td className="px-3 py-2 font-mono text-gray-500">{formatAssignmentDateTime(assignment.createdAt)}</td>
              <td className="px-3 py-2">{sortClassNames(assignment.targetClasses, classOrder).join(', ')}</td>
              <td className="px-3 py-2">{assignment.subject}</td>
              <td className="px-3 py-2">{assignment.title}</td>
              <td className="px-3 py-2">{formatCheckingDate(assignment.checkingDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const AssignmentModal = ({
  assignmentForm,
  editingAssignmentId,
  availableClasses,
  canSelectAll,
  fileInputRef,
  cameraError,
  onClose,
  onFieldChange,
  onToggleClass,
  onSelectAll,
  onFileChange,
  onCameraOpen,
  onSubmit,
}) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
    <div className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-gray-100 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
      <div className="border-b border-gray-100 pb-2 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-[#1A1A1A]">
            {editingAssignmentId ? 'Update Assignment' : 'Compose Assignment'}
          </h4>
          <p className="text-[11px] text-gray-400">
            Title and description are mandatory. Assignment cannot be deleted after upload.
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-1 hover:bg-[#EAEAEA] rounded-full">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-gray-700">Subject</label>
            <input
              type="text"
              placeholder="e.g. Science"
              value={assignmentForm.subject}
              onChange={(event) => onFieldChange('subject', event.target.value)}
              className="p-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#8b5cf6]"
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="font-bold text-gray-700">Title</label>
            <input
              type="text"
              required
              placeholder="Assignment title"
              value={assignmentForm.title}
              onChange={(event) => onFieldChange('title', event.target.value)}
              className="p-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#8b5cf6]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-bold text-gray-700">Description</label>
          <textarea
            required
            rows={4}
            placeholder="Write assignment instructions..."
            value={assignmentForm.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
            className="p-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#8b5cf6] resize-none"
          />
        </div>

        {!editingAssignmentId && (
          <div className="flex flex-col gap-1">
            <label className="font-bold text-purple-700">Checking Date</label>
            <input
              type="date"
              required
              value={assignmentForm.checkingDate}
              onChange={(event) => onFieldChange('checkingDate', event.target.value)}
              className="p-2.5 border border-purple-200 bg-purple-50/50 rounded-xl outline-none font-bold text-purple-900 focus:border-[#8b5cf6]"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <label className="font-bold text-gray-700">Target Classes</label>
            {canSelectAll && (
              <button type="button" onClick={onSelectAll} className="text-[10px] font-black text-[#8b5cf6]">
                {assignmentForm.targetClasses.length === availableClasses.length ? 'Clear All' : 'Select All'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-200 max-h-32 overflow-y-auto no-scrollbar">
            {availableClasses.map((className) => (
              <label
                key={className}
                className={`flex items-center gap-2 p-1.5 border rounded-xl cursor-pointer transition-all font-bold text-[11px] ${
                  assignmentForm.targetClasses.includes(className)
                    ? 'bg-purple-50 border-[#8b5cf6] text-[#8b5cf6]'
                    : 'bg-white border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={assignmentForm.targetClasses.includes(className)}
                  onChange={() => onToggleClass(className)}
                  className="accent-[#8b5cf6]"
                />
                {className}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-bold text-gray-700">Resource Attachments</label>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm"
            onChange={onFileChange}
            className="hidden"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 border border-dashed border-gray-300 hover:border-[#8b5cf6] rounded-xl flex items-center justify-center gap-1.5 font-bold text-gray-600 bg-gray-50/50"
            >
              <Paperclip className="w-3.5 h-3.5" /> Attach Image / Video / PDF
            </button>
            <button
              type="button"
              onClick={onCameraOpen}
              className="p-2.5 border border-dashed border-blue-200 hover:border-blue-500 rounded-xl flex items-center justify-center gap-1.5 font-bold text-blue-600 bg-blue-50/30"
            >
              <Camera className="w-3.5 h-3.5" /> Capture Photo
            </button>
          </div>

          {cameraError && <p className="text-[10px] font-bold text-rose-600">{cameraError}</p>}

          {assignmentForm.attachmentName && (
            <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between font-bold text-[10px]">
              <span className="text-emerald-800 truncate">Selected: {assignmentForm.attachmentName}</span>
              <X
                className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-red-500"
                onClick={() => {
                  onFieldChange('attachmentFile', null);
                  onFieldChange('attachmentName', '');
                  onFieldChange('removeAttachment', true);
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-full font-bold text-gray-600">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 bg-[#E1FA6C] text-[#1A1A1A] rounded-full font-bold shadow-sm flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> {editingAssignmentId ? 'Update' : 'Broadcast'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default AssignmentHub;
