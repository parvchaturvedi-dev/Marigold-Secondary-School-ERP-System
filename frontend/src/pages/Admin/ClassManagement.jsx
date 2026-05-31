import React, { useState } from 'react';
import { Layers, ArrowRightLeft, Users, UserCheck } from 'lucide-react';
import ClassDetail from './ClassDetail';
import { useMongoState } from '../../components/common/mongoState';
import { getClassName, sortClassNames, useMasterData } from '../../components/common/masterData';

const getTeacherId = (teacher = {}) => teacher.id || teacher.teacherId || teacher.empId || teacher.employeeId || '';

const normalizeClassKey = (className = '') => String(className).trim().toLowerCase();

const getStudentClassName = (student = {}) =>
  student.className || student.class || student.targetClass || student.rawProfile?.targetClass || '';

const updateStudentClass = (student, nextClassName, currentClassName) => ({
  ...student,
  previousClass: currentClassName,
  class: nextClassName,
  className: nextClassName,
  targetClass: nextClassName,
  promotedOut: !nextClassName,
  status: nextClassName ? student.status || 'Active' : 'Promoted Out',
  rawProfile: {
    ...(student.rawProfile || {}),
    targetClass: nextClassName,
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
  const handleNextJourneyPromotion = () => {
    const confirmation = window.confirm(
      "CRITICAL ACTION:\nAre you sure you want to trigger the 'Next Journey' promotion?\nAll students will be shifted to their immediate next hierarchal class level."
    );
    if (!confirmation) return;

    if (hierarchySequence.length === 0) {
      alert('Please configure class hierarchy in Class Preferences before promotion.');
      return;
    }

    const classIndexByName = new Map(
      hierarchySequence.map((className, index) => [normalizeClassKey(className), index])
    );
    let movedCount = 0;
    let retainedCount = 0;
    let promotedOutCount = 0;

    const promotedStudents = raw.students.map((student) => {
      const currentClassName = getStudentClassName(student);
      const currentRankIndex = classIndexByName.get(normalizeClassKey(currentClassName));

      if (student.isRepeating || currentRankIndex === undefined) {
        if (student.isRepeating) retainedCount += 1;
        return student;
      }

      if (currentRankIndex === hierarchySequence.length - 1) {
        promotedOutCount += 1;
        return updateStudentClass(student, '', currentClassName);
      }

      const nextClassName = hierarchySequence[currentRankIndex + 1];
      movedCount += 1;
      return updateStudentClass(student, nextClassName, currentClassName);
    });

    const studentCountByClass = promotedStudents.reduce((acc, student) => {
      const className = getStudentClassName(student);
      if (className) acc[className] = (acc[className] || 0) + 1;
      return acc;
    }, {});

    if (movedCount === 0 && promotedOutCount === 0) {
      alert('No eligible students found for promotion. Please check class hierarchy and roster allocation.');
      return;
    }

    actions.setStudents(promotedStudents);
    setClasses((currentClasses) => {
      const classMap = new Map(currentClasses.map((classRecord) => [getClassName(classRecord), classRecord]));
      hierarchySequence.forEach((className) => {
        if (!classMap.has(className)) {
          classMap.set(className, { id: className, name: className });
        }
      });

      return [...classMap.values()].map((classRecord) => ({
        ...classRecord,
        studentCount: studentCountByClass[getClassName(classRecord)] || 0,
      }));
    });
    alert(`Academic journey shifted successfully!\nMoved to next class: ${movedCount}\nPromoted out: ${promotedOutCount}\nRetained/repeating: ${retainedCount}`);
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
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* CONTROL ACTIONS BANNER */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1A1A1A]" /> Class Management
          </h3>
          <p className="text-xs text-[#555555] mt-1">
            Click on any operational card grid below to explore detailed rosters, metrics and records.
          </p>
        </div>

        {/* PROMOTION JOURNEY TRIGGER BUTTON */}
        <button 
          onClick={handleNextJourneyPromotion}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#E1FA6C] text-[#1A1A1A] rounded-full text-sm font-semibold shadow-xs hover:bg-[#d4ee59] transition-all shrink-0 border border-[#C8C8C8]/60"
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
            className="bg-[#ffffff] border border-[#C8C8C8] p-5 rounded-3xl flex flex-col justify-between group hover:border-[#1A1A1A] transition-all cursor-pointer min-h-[150px]"
          >
            {/* Top Identity Block */}
            <div className="flex items-center gap-4 border-b border-[#EAEAEA] pb-3">
              <div className="w-11 h-9 rounded-xl bg-[#EAEAEA] text-[#1A1A1A] flex items-center justify-center font-bold text-sm border border-[#C8C8C8]/40 shadow-xs">
                {cls.name.replace(/\D/g, "") || cls.name.charAt(0)}
              </div>
              <span className="text-sm font-bold text-[#1A1A1A] group-hover:text-black transition-colors">{cls.name}</span>
            </div>

            {/* Center Dynamic Metadata Blocks */}
            <div className="py-3 space-y-2">
              {/* Teacher Display Tracker */}
              <div className="flex items-center gap-2 text-xs text-[#555555]">
                <UserCheck className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span className="font-medium">Class Teacher:</span>
                <span className={`font-bold ${cls.classTeacherName ? 'text-[#1A1A1A]' : 'text-red-600/80'}`}>
                  {cls.classTeacherName || 'N/A'}
                </span>
              </div>

              {/* Live Student Count Metrics */}
              <div className="flex items-center gap-2 text-xs text-[#555555]">
                <Users className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span className="font-medium">Strength:</span>
                <span className="font-bold text-[#1A1A1A]">{cls.studentCount} Students</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ClassManagement;
