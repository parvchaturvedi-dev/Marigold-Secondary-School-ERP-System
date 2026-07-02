import React, { useState } from 'react';
import { Layers, ArrowRightLeft, Users, UserCheck } from 'lucide-react';
import ClassDetail from './ClassDetail';
import { useMongoState } from '../../components/common/mongoState';
import { getClassName, sortClassNames, useMasterData } from '../../components/common/masterData';
import { apiFetch } from '../../components/common/api';
import {
  getClassOrder,
  getStudentClassName,
  ensureClassRow,
  isLastClass,
  nextClassName as getNextClassName,
  studentHasPending,
} from '../../components/common/financeData';

const getTeacherId = (teacher = {}) => teacher.id || teacher.teacherId || teacher.empId || teacher.employeeId || '';

const normalizeClassKey = (className = '') => String(className).trim().toLowerCase();

// Promote a student into the next class, keeping the ledger intact and
// pre-creating an empty fee row for the new class so admins can assign it.
const promoteStudentToClass = (student, nextClass, currentClassName) => {
  const withNewRow = ensureClassRow(student, nextClass);
  return {
    ...withNewRow,
    previousClass: currentClassName,
    class: nextClass,
    className: nextClass,
    targetClass: nextClass,
    promotedOut: false,
    status: withNewRow.status || 'Active',
    rawProfile: {
      ...(withNewRow.rawProfile || {}),
      targetClass: nextClass,
    },
  };
};

// Mark a student as graduated/passed-out, moving them out of the active roster.
const markStudentPassedOut = (student, currentClassName) => ({
  ...student,
  previousClass: currentClassName,
  promotedOut: true,
  status: 'Passed Out',
  rawProfile: {
    ...(student.rawProfile || {}),
    targetClass: '',
  },
});

const resolveClassTeacher = (classRecord = {}, teachers = []) => {
  const storedTeacherId = classRecord.classTeacherId || classRecord.teacherId || '';
  const storedTeacherName = classRecord.classTeacherName || classRecord.teacher || '';
  const byStoredId = storedTeacherId
    ? teachers.find((teacher) => getTeacherId(teacher) === storedTeacherId)
    : null;
  const byCharge = teachers.find(
    (teacher) =>
      teacher.isClassTeacher === 'Yes' &&
      teacher.assignedClassTeacherFor === classRecord.name
  );
  const teacher = byStoredId || byCharge;

  return {
    id: teacher ? getTeacherId(teacher) : storedTeacherId,
    name: teacher?.name || storedTeacherName || '',
  };
};

const ClassManagement = () => {
  // Navigation State for tracking inner sub views
  const [selectedClassContext, setSelectedClassContext] = useState(null);

  // Main Dashboard Workspace State
  const [classes, setClasses] = useMongoState('admin-class-management-classes', []);
  const [orderedClasses] = useMongoState('admin-class-preferences', []);
  const [, setAlumniPending] = useMongoState('admin-finance-alumni-pending', []);
  const { classes: derivedClasses, teachers, raw, actions } = useMasterData();
  const hierarchySequence = orderedClasses.length
    ? orderedClasses.map(getClassName).filter(Boolean)
    : sortClassNames([...(derivedClasses.length ? derivedClasses : classes).map(getClassName)]);
  const rankClass = (className = '') => {
    const index = hierarchySequence.indexOf(className);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const sourceClasses = derivedClasses.length ? derivedClasses : classes;
  const displayClasses = [...sourceClasses]
    .map((classRecord) => {
      const classTeacher = resolveClassTeacher(classRecord, teachers);
      return {
        ...classRecord,
        classTeacherId: classTeacher.id,
        classTeacherName: classTeacher.name,
        teacher: classTeacher.name,
      };
    })
    .sort((a, b) => rankClass(a.name) - rankClass(b.name) || String(a.name).localeCompare(String(b.name)));

  // MOVE TO NEXT JOURNEY (Session Promotion Core Business Logic)
  const handleNextJourneyPromotion = async () => {
    const confirmation = window.confirm(
      "CRITICAL ACTION:\nAre you sure you want to trigger the 'Next Journey' promotion?\nAll students will be shifted to their immediate next hierarchal class level."
    );
    if (!confirmation) return;

    const classOrder = getClassOrder(orderedClasses);

    if (classOrder.length === 0) {
      alert('Please configure class hierarchy in Class Preferences before promotion.');
      return;
    }

    let promotedCount = 0;
    let retainedCount = 0;
    let graduatedCount = 0;
    let movedToPendingCount = 0;
    const newAlumni = [];

    const remainingStudents = [];

    raw.students.forEach((student) => {
      const currentClassName = getStudentClassName(student);

      // Retained: repeating students stay exactly as-is.
      if (student.isRepeating) {
        retainedCount += 1;
        remainingStudents.push(student);
        return;
      }

      // Unknown/unranked class: leave untouched (can't determine next step).
      if (!currentClassName || classOrder.every((name) => normalizeClassKey(name) !== normalizeClassKey(currentClassName))) {
        remainingStudents.push(student);
        return;
      }

      if (isLastClass(currentClassName, classOrder)) {
        if (studentHasPending(student)) {
          // Fees still due at the last class -> move to alumni pending bucket.
          movedToPendingCount += 1;
          newAlumni.push(markStudentPassedOut(student, currentClassName));
        } else {
          // Fully paid -> graduated, drop from active roster entirely.
          graduatedCount += 1;
        }
        return;
      }

      const nextClass = getNextClassName(currentClassName, classOrder);
      promotedCount += 1;
      remainingStudents.push(promoteStudentToClass(student, nextClass, currentClassName));
    });

    if (promotedCount === 0 && graduatedCount === 0 && movedToPendingCount === 0) {
      alert('No eligible students found for promotion. Please check class hierarchy and roster allocation.');
      return;
    }

    const studentCountByClass = remainingStudents.reduce((acc, student) => {
      const className = getStudentClassName(student);
      if (className) acc[className] = (acc[className] || 0) + 1;
      return acc;
    }, {});

    actions.setStudents(remainingStudents);
    if (newAlumni.length) {
      setAlumniPending((currentAlumni) => [...(currentAlumni || []), ...newAlumni]);
    }
    setClasses((currentClasses) => {
      const classMap = new Map(currentClasses.map((classRecord) => [getClassName(classRecord), classRecord]));
      classOrder.forEach((className) => {
        if (!classMap.has(className)) {
          classMap.set(className, { id: className, name: className });
        }
      });

      return [...classMap.values()].map((classRecord) => ({
        ...classRecord,
        studentCount: studentCountByClass[getClassName(classRecord)] || 0,
      }));
    });

    let resetNote = '';
    try {
      await apiFetch('/assignments/reset', { method: 'POST' });
    } catch (resetError) {
      resetNote = `\n\nNote: Assignment reset for the new session failed (${resetError.message}). Please retry from Assignments.`;
    }

    alert(
      `Academic journey shifted successfully!\nPromoted: ${promotedCount}\nRetained/repeating: ${retainedCount}\nGraduated (fully paid): ${graduatedCount}\nMoved to pending (alumni dues): ${movedToPendingCount}${resetNote}`
    );
  };

  // If a card was triggered, swap engine to detail component view dynamically
  if (selectedClassContext) {
    return (
      <ClassDetail 
        classContext={selectedClassContext} 
        onBack={() => setSelectedClassContext(null)} 
      />
    );
  }

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">
      
      {/* CONTROL ACTIONS BANNER */}
      <div className="glass-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-900" /> Class Management
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Click on any operational card grid below to explore detailed rosters, metrics and records.
          </p>
        </div>

        {/* PROMOTION JOURNEY TRIGGER BUTTON */}
        <button 
          onClick={handleNextJourneyPromotion}
          className="flex items-center justify-center gap-2 px-6 py-2.5 btn-primary rounded-full text-sm font-semibold shadow-xs "
        >
          <ArrowRightLeft className="w-4 h-4" /> Move to Next Journey
        </button>
      </div>

      {/* CLASSCARDS DYNAMIC WORKSPACE GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayClasses.map((cls) => (
          <div 
            key={cls.id}
            onClick={() => setSelectedClassContext(cls)}
            className="glass-card glass-hover p-5 rounded-3xl flex flex-col justify-between group transition-all cursor-pointer min-h-[150px]"
          >
            {/* Top Identity Block */}
            <div className="flex items-center gap-4 border-b border-slate-100/80 pb-3">
              <div className="w-11 h-9 rounded-xl bg-indigo-50/60 text-slate-900 flex items-center justify-center font-bold text-sm border border-slate-200/70 shadow-xs">
                {cls.name.replace(/\D/g, "") || cls.name.charAt(0)}
              </div>
              <span className="text-sm font-bold text-slate-900 group-hover:text-black transition-colors">{cls.name}</span>
            </div>

            {/* Center Dynamic Metadata Blocks */}
            <div className="py-3 space-y-2">
              {/* Teacher Display Tracker */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <UserCheck className="w-3.5 h-3.5 text-slate-900" />
                <span className="font-medium">Class Teacher:</span>
                <span className={`font-bold ${cls.classTeacherName ? 'text-slate-900' : 'text-red-600/80'}`}>
                  {cls.classTeacherName || 'N/A'}
                </span>
              </div>

              {/* Live Student Count Metrics */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Users className="w-3.5 h-3.5 text-slate-900" />
                <span className="font-medium">Strength:</span>
                <span className="font-bold text-slate-900">{cls.studentCount} Students</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ClassManagement;
