import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, User, CheckCircle, BookOpen, Users, Square, CheckSquare, Trash2, GraduationCap } from 'lucide-react';
import StudentProfile from './StudentProfile'; // Profile preview screen navigation target
import { useMongoState } from '../../components/common/mongoState';
import { studentHasPending } from '../../components/common/financeData';
import {
  readExaminationState,
  fetchExaminationState,
  isBoardClass as isClassMarkedBoard,
  setBoardClassEnabled,
  EXAMINATION_UPDATED_EVENT,
} from '../../components/common/examinationStore';

const getTeacherId = (teacher = {}) => teacher.id || teacher.teacherId || teacher.empId || teacher.employeeId || '';

const getTeacherName = (teacher = {}) => teacher.name || teacher.displayName || '';

const ClassDetail = ({ classContext, onBack }) => {
  // Navigation State for child component rendering
  const [activeStudentProfile, setActiveStudentProfile] = useState(null);

  // Faculty Records Pool
  const [allTeachers] = useMongoState('admin-teacher-management-list', []);
  const [, setClasses] = useMongoState('admin-class-management-classes', []);

  const [globalSubjects] = useMongoState('admin-subjects-global', []);
  const [classSubjectMappings, setClassSubjectMappings] = useMongoState('admin-subjects-class-mapping', []);
  const availableSubjects = globalSubjects.map((subject) => subject.name).filter(Boolean);
  const classSubjectMapping = classSubjectMappings.find((item) => item.className === classContext.name);
  const persistedSubjectNames = useMemo(
    () => (Array.isArray(classSubjectMapping?.subjects) ? classSubjectMapping.subjects : []),
    [classSubjectMapping]
  );

  const storedTeacherId = classContext.classTeacherId || classContext.teacherId || '';
  const fallbackClassTeacher = allTeachers.find(
    (teacher) =>
      teacher.isClassTeacher === 'Yes' &&
      teacher.assignedClassTeacherFor === classContext.name
  );
  const initialClassTeacher =
    (storedTeacherId && allTeachers.find((teacher) => getTeacherId(teacher) === storedTeacherId)) ||
    fallbackClassTeacher ||
    null;

  // Context bound management states
  const [currentClassTeacher, setCurrentClassTeacher] = useState({
    id: initialClassTeacher ? getTeacherId(initialClassTeacher) : storedTeacherId,
    name: initialClassTeacher
      ? getTeacherName(initialClassTeacher)
      : classContext.classTeacherName || classContext.teacher || 'N/A',
  });
  const [assignedSubjects, setAssignedSubjects] = useState(
    persistedSubjectNames.length ? persistedSubjectNames : classContext.subjects || []
  );
  
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);

  // Board-class flag lives in the shared Examination state (state.boardClasses),
  // so the whole Examination module (school vs board exams) reads it from one place.
  const [isBoard, setIsBoard] = useState(() => isClassMarkedBoard(readExaminationState(), classContext.name));

  useEffect(() => {
    let alive = true;
    const sync = () => {
      if (alive) setIsBoard(isClassMarkedBoard(readExaminationState(), classContext.name));
    };
    fetchExaminationState().then(sync).catch(() => {});
    window.addEventListener(EXAMINATION_UPDATED_EVENT, sync);
    return () => {
      alive = false;
      window.removeEventListener(EXAMINATION_UPDATED_EVENT, sync);
    };
  }, [classContext.name]);

  const handleToggleBoardClass = () => {
    const next = !isBoard;
    const message = next
      ? `Mark ${classContext.name} as a BOARD CLASS?\n\nIts final examination will be controlled from the Board Examination desk (external centre timetable + student-wise result upload). School exams stay the same for this class.`
      : `Remove BOARD CLASS status from ${classContext.name}?\n\nIts final exam will go back to being handled inside School Examination.`;
    if (!window.confirm(message)) return;
    setIsBoard(next); // optimistic
    try {
      setBoardClassEnabled(classContext.name, next);
    } catch (error) {
      setIsBoard(!next);
      window.alert('Could not update board-class status. Please try again.');
    }
  };

  // Live Student Roster state containing the new retention flag rule
  const [allStudents, setAllStudents] = useMongoState('admin-student-management-students', []);
  // Alumni / left-student bucket that still retains a fee ledger for pending dues tracking
  const [, setAlumniPending] = useMongoState('admin-finance-alumni-pending', []);
  const studentsList = allStudents.filter(
    (student) => student.class === classContext.name || student.className === classContext.name
  );
  const subjectTeacherRows = allTeachers
    .flatMap((teacher) =>
      (teacher.classAssignments || [])
        .filter((assignment) => assignment.className === classContext.name)
        .map((assignment) => ({
          subject: assignment.subject || 'Subject',
          teacherId: getTeacherId(teacher),
          teacherName: getTeacherName(teacher),
        }))
    )
    .filter(
      (row, index, rows) =>
        row.teacherId &&
        rows.findIndex(
          (item) => item.teacherId === row.teacherId && item.subject === row.subject
        ) === index
    );

  useEffect(() => {
    const storedId = classContext.classTeacherId || classContext.teacherId || '';
    const teacher =
      (storedId && allTeachers.find((item) => getTeacherId(item) === storedId)) ||
      allTeachers.find(
        (item) =>
          item.isClassTeacher === 'Yes' &&
          item.assignedClassTeacherFor === classContext.name
      );

    if (teacher) {
      setCurrentClassTeacher({ id: getTeacherId(teacher), name: getTeacherName(teacher) });
    }
  }, [allTeachers, classContext.classTeacherId, classContext.name, classContext.teacherId]);

  useEffect(() => {
    if (persistedSubjectNames.length) {
      setAssignedSubjects(persistedSubjectNames);
    }
  }, [persistedSubjectNames]);

  // Core toggle with confirmation dialog alert for retention configuration
  const handleToggleRetention = (studentId, studentName, currentStatus) => {
    const actionText = currentStatus 
      ? `Are you sure you want to cancel the class repetition request for ${studentName}? They will be promoted normally in the next journey.` 
      : `Are you sure you want to mark ${studentName} for CLASS REPETITION?\n\nOn triggering 'Next Journey', this student will NOT change grade level and will remain retained in ${classContext.name}.`;

    if (window.confirm(actionText)) {
      setAllStudents((students) => students.map(st => 
        (st.id === studentId || st.admissionNumber === studentId) ? { ...st, isRepeating: !st.isRepeating } : st
      ));
    }
  };

  // Remove a student from the active roster. If they still owe fees, park them
  // in the alumni/pending bucket (with their fee ledger intact) instead of
  // deleting their record outright so dues remain trackable.
  const handleDeleteStudent = (student) => {
    const studentId = student.id || student.admissionNumber;
    const studentName = student.name || student.displayName || 'this student';
    const hasPending = studentHasPending(student);

    const confirmText = hasPending
      ? `Are you sure you want to remove ${studentName} from ${classContext.name}?\n\nThis student has PENDING FEE DUES. They will be moved to the Alumni/Pending Dues records so their outstanding balance stays tracked.`
      : `Are you sure you want to permanently remove ${studentName} from ${classContext.name}? This action cannot be undone.`;

    if (!window.confirm(confirmText)) return;

    if (hasPending) {
      setAlumniPending((records) => [
        ...records.filter((rec) => (rec.id || rec.admissionNumber) !== studentId),
        { ...student, status: 'Removed', removedFrom: classContext.name, removedAt: new Date().toISOString() },
      ]);
    }

    setAllStudents((students) =>
      students.filter((st) => (st.id || st.admissionNumber) !== studentId)
    );
  };

  const handleSubjectToggle = (sub) => {
    if (assignedSubjects.includes(sub)) {
      setAssignedSubjects(assignedSubjects.filter(item => item !== sub));
    } else {
      setAssignedSubjects([...assignedSubjects, sub]);
    }
  };

  const persistClassTeacher = (teacher) => {
    const teacherId = getTeacherId(teacher);
    const teacherName = getTeacherName(teacher);

    setCurrentClassTeacher({ id: teacherId, name: teacherName });
    setClasses((currentClasses) => {
      const hasClass = currentClasses.some((classRecord) => classRecord.name === classContext.name);
      const nextClasses = hasClass
        ? currentClasses
        : [...currentClasses, { id: classContext.id || classContext.name, name: classContext.name }];

      return nextClasses.map((classRecord) =>
        classRecord.name === classContext.name
          ? {
              ...classRecord,
              classTeacherId: teacherId,
              classTeacherName: teacherName,
              teacher: teacherName,
            }
          : classRecord
      );
    });
    setIsTeacherModalOpen(false);
  };

  const persistSubjectMapping = () => {
    setClassSubjectMappings((currentMappings) => {
      const hasMapping = currentMappings.some((mapping) => mapping.className === classContext.name);
      if (!hasMapping) {
        return [...currentMappings, { className: classContext.name, subjects: assignedSubjects }];
      }

      return currentMappings.map((mapping) =>
        mapping.className === classContext.name
          ? { ...mapping, subjects: assignedSubjects }
          : mapping
      );
    });
    setIsSubjectModalOpen(false);
  };

  // Profile navigation intercept router
  if (activeStudentProfile) {
    return (
      <StudentProfile 
        studentContext={activeStudentProfile} 
        onBack={() => setActiveStudentProfile(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">

      {/* NAVIGATION CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 glass-card p-4 rounded-3xl">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTeacherModalOpen(true)}
            className="px-4 py-2 bg-white/50 hover:bg-white/70 text-slate-900 font-bold text-xs rounded-full transition-all border border-slate-200/70"
          >
            Assign Class Teacher
          </button>
          <button
            onClick={() => setIsSubjectModalOpen(true)}
            className="px-4 py-2 font-bold text-xs rounded-full transition-all btn-primary"
          >
            Map Subjects
          </button>
          <button
            onClick={handleToggleBoardClass}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-full transition-all border ${
              isBoard
                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                : 'bg-white/50 text-slate-900 border-slate-200/70 hover:bg-white/70'
            }`}
            title="Board classes take their FINAL exam at an external board centre, controlled from the Board Examination desk."
          >
            <GraduationCap className="w-3.5 h-3.5" />
            {isBoard ? 'Board Class ✓' : 'Mark as Board Class'}
          </button>
        </div>
      </div>

      {/* CORE IDENTITY INFRASTRUCTURE BADGE CARD */}
      <div className="glass-card p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/50 text-slate-900 flex items-center justify-center font-bold text-base shrink-0 border border-slate-200/70">
            {currentClassTeacher.name !== 'N/A' ? currentClassTeacher.name.split(' ').pop().charAt(0) : '?'}
          </div>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-slate-900">{currentClassTeacher.name}</h3>
              {currentClassTeacher.name !== 'N/A' && (
                <span className="text-[9px] bg-indigo-100 text-indigo-700 border border-indigo-200 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  CLASS MENTOR
                </span>
              )}
              {isBoard && (
                <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  BOARD CLASS
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
              {classContext.name} Matrix Dashboard
              {currentClassTeacher.id ? ` | ID: ${currentClassTeacher.id}` : ''}
            </p>
          </div>
        </div>

        {/* Mapped Subjects Preview Pipeline */}
        <div className="flex flex-wrap gap-1.5 max-w-md">
          {assignedSubjects.map((sub, idx) => (
            <span key={idx} className="text-[10px] bg-white/50 border border-slate-200/70 text-slate-900 px-2.5 py-1 rounded-lg font-bold">
              {sub}
            </span>
          ))}
        </div>
      </div>

      {/* FACULTY ASSIGNMENT SUMMARY */}
      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-900" /> Class Faculty Assignments
          </h4>
          <span className="text-[10px] bg-white/50 font-bold text-slate-500 px-2 py-0.5 rounded-md border border-slate-200/70">
            Subjects: {subjectTeacherRows.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 bg-indigo-50/60 border border-slate-200/70 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Class Teacher</p>
            <p className="text-sm font-black text-slate-900 mt-1">{currentClassTeacher.name}</p>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              {currentClassTeacher.id || 'Teacher ID not assigned'}
            </p>
          </div>

          {subjectTeacherRows.length ? (
            subjectTeacherRows.map((row) => (
              <div key={`${row.teacherId}-${row.subject}`} className="p-4 glass-soft rounded-2xl">
                <p className="text-[10px] uppercase tracking-wider font-black text-slate-500">{row.subject}</p>
                <p className="text-sm font-black text-slate-900 mt-1">{row.teacherName}</p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">{row.teacherId}</p>
              </div>
            ))
          ) : (
            <div className="p-4 glass-soft rounded-2xl text-xs font-bold text-slate-500">
              No subject teachers are mapped to this class yet.
            </div>
          )}
        </div>
      </div>

      {/* COMPACT CLEAN TABLE ROSTER CONTROL */}
      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-900" /> Active Enrolled Roll Roster
          </h4>
          <span className="text-[10px] bg-white/50 font-bold text-slate-500 px-2 py-0.5 rounded-md border border-slate-200/70">
            Count: {studentsList.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100/80">
                <th className="pb-3 pl-2">Student ID</th>
                <th className="pb-3">Student Name</th>
                <th className="pb-3 text-center">Session Progress Tracking</th>
                <th className="pb-3 text-center">Attendance Status</th>
                <th className="pb-3 text-right pr-2">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 font-bold text-slate-900">
              {studentsList.map((st) => {
                const studentId = st.id || st.admissionNumber;
                const studentName = st.name || st.displayName || 'Student';

                return (
                <tr key={studentId} className="hover:bg-white/70 transition-colors">
                  <td className="py-3.5 font-mono text-slate-500 pl-2">{studentId}</td>
                  <td className="py-3.5 text-sm">{studentName}</td>
                  <td className="py-3.5 text-center text-slate-500">
                    <span className="text-emerald-700">{st.attendedClasses || 0}</span> / <span className="text-gray-400">{st.totalClasses || 0} Periods</span>
                  </td>
                  <td className="py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${parseFloat(st.attendancePercentage || 0) >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {st.attendancePercentage || '0%'}
                    </span>
                  </td>
                  <td className="py-3.5 text-right pr-2">
                    <div className="flex items-center justify-end gap-3">

                      {/* INTERACTIVE RETENTION CHECKBOX WITH CONFIRMATION WIZARD */}
                      <button
                        onClick={() => handleToggleRetention(studentId, studentName, st.isRepeating)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${st.isRepeating ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white/60 border-white/80 text-slate-500 hover:border-indigo-300'}`}
                        title="Toggle Repeat Status"
                      >
                        {st.isRepeating ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        Repeat Class
                      </button>

                      {/* PROFILE INTERCEPTOR LINK */}
                      <button
                        onClick={() => setActiveStudentProfile(st)}
                        className="px-3 py-1 bg-white/50 hover:bg-slate-900 hover:text-white rounded-full text-[10px] font-bold transition-all border border-slate-200/70"
                      >
                        View Profile
                      </button>

                      {/* DELETE STUDENT ACTION */}
                      <button
                        onClick={() => handleDeleteStudent(st)}
                        className="p-1.5 bg-white/50 hover:bg-red-600 hover:text-white text-red-600 rounded-full transition-all border border-red-200/70"
                        title="Remove Student"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ASSIGN TEACHER FACULTY */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 animate-scaleUp">
            <h4 className="text-sm font-bold text-slate-900">Assign Faculty Head</h4>
            <div className="space-y-2">
              {allTeachers.map((t, idx) => (
                <div
                  key={getTeacherId(t) || idx}
                  onClick={() => persistClassTeacher(t)}
                  className={`p-3 border rounded-xl cursor-pointer text-xs font-bold transition-all flex items-center justify-between ${currentClassTeacher.id === getTeacherId(t) ? 'border-indigo-400 bg-indigo-100 text-indigo-700' : 'border-white/80 bg-white/60 hover:bg-white/70'}`}
                >
                  <div>
                    <p>{t.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      ID: {getTeacherId(t) || 'N/A'} | Expertise: {t.primarySubject || t.classAssignments?.[0]?.subject || 'Not assigned'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-1 flex justify-end">
              <button onClick={() => setIsTeacherModalOpen(false)} className="px-4 py-1.5 bg-white/60 border border-white/80 text-slate-900 rounded-full text-xs font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MAP SUBJECTS DISCIPLINE */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-3xl p-6 w-full max-w-md shadow-xl space-y-4 animate-scaleUp">
            <h4 className="text-sm font-bold text-slate-900">Map Course Syllabus</h4>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto no-scrollbar">
              {availableSubjects.map((sub, idx) => {
                const active = assignedSubjects.includes(sub);
                return (
                  <div
                    key={idx}
                    onClick={() => handleSubjectToggle(sub)}
                    className={`p-2.5 border rounded-xl font-bold text-[11px] text-center cursor-pointer transition-all ${active ? 'border-indigo-400 bg-indigo-100 text-indigo-700' : 'border-white/80 bg-white/60 text-slate-500'}`}
                  >
                    {sub}
                  </div>
                );
              })}
            </div>
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200/70">
              <button onClick={() => setIsSubjectModalOpen(false)} className="px-4 py-1.5 bg-white/60 border border-white/80 rounded-full text-xs font-bold">Cancel</button>
              <button onClick={persistSubjectMapping} className="px-5 py-1.5 rounded-full text-xs font-bold btn-primary">Save Matrix</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClassDetail;
