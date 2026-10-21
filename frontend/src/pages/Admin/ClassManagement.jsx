import React, { useState } from 'react';
import { Layers, Users, UserCheck } from 'lucide-react';
import ClassDetail from './ClassDetail';
import { useMongoState } from '../../components/common/mongoState';
import { getClassName, sortClassNames, useMasterData } from '../../components/common/masterData';

const getTeacherId = (teacher = {}) => teacher.id || teacher.teacherId || teacher.empId || teacher.employeeId || '';

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
  const [classes] = useMongoState('admin-class-management-classes', []);
  const [orderedClasses] = useMongoState('admin-class-preferences', []);
  const { classes: derivedClasses, teachers } = useMasterData();
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
