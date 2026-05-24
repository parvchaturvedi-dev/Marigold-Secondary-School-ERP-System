import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, User, CheckCircle, BookOpen, Users, Square, CheckSquare } from 'lucide-react';
import StudentProfile from './StudentProfile'; // Profile preview screen navigation target
import { useMongoState } from '../../components/common/mongoState';

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

  // Live Student Roster state containing the new retention flag rule
  const [allStudents, setAllStudents] = useMongoState('admin-student-management-students', []);
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
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      
      {/* NAVIGATION CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-[#C8C8C8]">
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#555555] hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </button>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsTeacherModalOpen(true)} 
            className="px-4 py-2 bg-[#EAEAEA] hover:bg-[#D9D9D9] text-[#1A1A1A] font-bold text-xs rounded-full transition-all border border-[#C8C8C8]/40"
          >
            Assign Class Teacher
          </button>
          <button 
            onClick={() => setIsSubjectModalOpen(true)} 
            className="px-4 py-2 bg-[#E1FA6C] hover:bg-[#d4ee59] text-[#1A1A1A] font-bold text-xs rounded-full transition-all"
          >
            Map Subjects
          </button>
        </div>
      </div>

      {/* CORE IDENTITY INFRASTRUCTURE BADGE CARD */}
      <div className="bg-white border border-[#C8C8C8] p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#EAEAEA] text-[#1A1A1A] flex items-center justify-center font-bold text-base shrink-0 border border-[#C8C8C8]/30">
            {currentClassTeacher.name !== 'N/A' ? currentClassTeacher.name.split(' ').pop().charAt(0) : '?'}
          </div>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-[#1A1A1A]">{currentClassTeacher.name}</h3>
              {currentClassTeacher.name !== 'N/A' && (
                <span className="text-[9px] bg-[#E1FA6C] text-[#1A1A1A] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border border-[#1A1A1A]/20">
                  CLASS MENTOR
                </span>
              )}
            </div>
            <p className="text-xs text-[#555555] font-bold uppercase tracking-wide">
              {classContext.name} Matrix Dashboard
              {currentClassTeacher.id ? ` | ID: ${currentClassTeacher.id}` : ''}
            </p>
          </div>
        </div>

        {/* Mapped Subjects Preview Pipeline */}
        <div className="flex flex-wrap gap-1.5 max-w-md">
          {assignedSubjects.map((sub, idx) => (
            <span key={idx} className="text-[10px] bg-[#EAEAEA] border border-[#C8C8C8]/60 text-[#1A1A1A] px-2.5 py-1 rounded-lg font-bold">
              {sub}
            </span>
          ))}
        </div>
      </div>

      {/* FACULTY ASSIGNMENT SUMMARY */}
      <div className="bg-white rounded-3xl p-6 border border-[#C8C8C8] space-y-4">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
          <h4 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#1A1A1A]" /> Class Faculty Assignments
          </h4>
          <span className="text-[10px] bg-[#EAEAEA] font-bold text-[#555555] px-2 py-0.5 rounded-md border border-[#C8C8C8]/40">
            Subjects: {subjectTeacherRows.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 bg-[#E1FA6C]/35 border border-[#C8C8C8] rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider font-black text-[#555555]">Class Teacher</p>
            <p className="text-sm font-black text-[#1A1A1A] mt-1">{currentClassTeacher.name}</p>
            <p className="text-[11px] font-mono text-[#555555] mt-0.5">
              {currentClassTeacher.id || 'Teacher ID not assigned'}
            </p>
          </div>

          {subjectTeacherRows.length ? (
            subjectTeacherRows.map((row) => (
              <div key={`${row.teacherId}-${row.subject}`} className="p-4 bg-[#EAEAEA]/50 border border-[#C8C8C8] rounded-2xl">
                <p className="text-[10px] uppercase tracking-wider font-black text-[#555555]">{row.subject}</p>
                <p className="text-sm font-black text-[#1A1A1A] mt-1">{row.teacherName}</p>
                <p className="text-[11px] font-mono text-[#555555] mt-0.5">{row.teacherId}</p>
              </div>
            ))
          ) : (
            <div className="p-4 bg-[#EAEAEA]/50 border border-[#C8C8C8] rounded-2xl text-xs font-bold text-[#555555]">
              No subject teachers are mapped to this class yet.
            </div>
          )}
        </div>
      </div>

      {/* COMPACT CLEAN TABLE ROSTER CONTROL */}
      <div className="bg-white rounded-3xl p-6 border border-[#C8C8C8] space-y-4">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
          <h4 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1A1A1A]" /> Active Enrolled Roll Roster
          </h4>
          <span className="text-[10px] bg-[#EAEAEA] font-bold text-[#555555] px-2 py-0.5 rounded-md border border-[#C8C8C8]/40">
            Count: {studentsList.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#555555] font-bold uppercase tracking-wider border-b border-[#EAEAEA]">
                <th className="pb-3 pl-2">Student ID</th>
                <th className="pb-3">Student Name</th>
                <th className="pb-3 text-center">Session Progress Tracking</th>
                <th className="pb-3 text-center">Attendance Status</th>
                <th className="pb-3 text-right pr-2">Administrative Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA] font-bold text-[#1A1A1A]">
              {studentsList.map((st) => {
                const studentId = st.id || st.admissionNumber;
                const studentName = st.name || st.displayName || 'Student';

                return (
                <tr key={studentId} className="hover:bg-[#EAEAEA]/30 transition-colors">
                  <td className="py-3.5 font-mono text-[#555555] pl-2">{studentId}</td>
                  <td className="py-3.5 text-sm">{studentName}</td>
                  <td className="py-3.5 text-center text-[#555555]">
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
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${st.isRepeating ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-[#C8C8C8] text-[#555555] hover:border-black'}`}
                        title="Toggle Repeat Status"
                      >
                        {st.isRepeating ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        Repeat Class
                      </button>

                      {/* PROFILE INTERCEPTOR LINK */}
                      <button 
                        onClick={() => setActiveStudentProfile(st)}
                        className="px-3 py-1 bg-[#EAEAEA] hover:bg-[#1A1A1A] hover:text-white rounded-full text-[10px] font-bold transition-all border border-[#C8C8C8]/40"
                      >
                        View Profile
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#D9D9D9] rounded-3xl p-6 w-full max-w-sm border border-[#C8C8C8] shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-[#1A1A1A]">Assign Faculty Head</h4>
            <div className="space-y-2">
              {allTeachers.map((t, idx) => (
                <div 
                  key={getTeacherId(t) || idx}
                  onClick={() => persistClassTeacher(t)}
                  className={`p-3 border rounded-xl cursor-pointer text-xs font-bold transition-all flex items-center justify-between ${currentClassTeacher.id === getTeacherId(t) ? 'border-[#1A1A1A] bg-[#E1FA6C] text-[#1A1A1A]' : 'border-[#C8C8C8] bg-white hover:bg-[#EAEAEA]'}`}
                >
                  <div>
                    <p>{t.name}</p>
                    <p className="text-[10px] text-[#555555] font-medium">
                      ID: {getTeacherId(t) || 'N/A'} | Expertise: {t.primarySubject || t.classAssignments?.[0]?.subject || 'Not assigned'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-1 flex justify-end">
              <button onClick={() => setIsTeacherModalOpen(false)} className="px-4 py-1.5 bg-white border border-[#C8C8C8] text-[#1A1A1A] rounded-full text-xs font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MAP SUBJECTS DISCIPLINE */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#D9D9D9] rounded-3xl p-6 w-full max-w-md border border-[#C8C8C8] shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-[#1A1A1A]">Map Course Syllabus</h4>
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto no-scrollbar">
              {availableSubjects.map((sub, idx) => {
                const active = assignedSubjects.includes(sub);
                return (
                  <div 
                    key={idx}
                    onClick={() => handleSubjectToggle(sub)}
                    className={`p-2.5 border rounded-xl font-bold text-[11px] text-center cursor-pointer transition-all ${active ? 'border-[#1A1A1A] bg-[#E1FA6C] text-[#1A1A1A]' : 'border-[#C8C8C8] bg-white text-[#555555]'}`}
                  >
                    {sub}
                  </div>
                );
              })}
            </div>
            <div className="pt-2 flex justify-end gap-2 border-t border-[#C8C8C8]">
              <button onClick={() => setIsSubjectModalOpen(false)} className="px-4 py-1.5 bg-white border border-[#C8C8C8] rounded-full text-xs font-bold">Cancel</button>
              <button onClick={persistSubjectMapping} className="px-5 py-1.5 bg-[#E1FA6C] text-[#1A1A1A] rounded-full text-xs font-bold">Save Matrix</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClassDetail;
