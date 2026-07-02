import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, Layers, CheckCircle2, BookmarkPlus, X } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { useMasterData } from '../../components/common/masterData';

const SubjectManagement = () => {
  const { classNames } = useMasterData();
  // Master Subject Pool (The Institution's Global Subject Registry)
  const [globalSubjects, setGlobalSubjects] = useMongoState('admin-subjects-global', []);

  // Classwise Subject Assignment Configuration Matrix State
  const [classSubjectMapping, setClassSubjectMapping] = useMongoState('admin-subjects-class-mapping', []);

  // UI Interactive Form States
  const [newSubject, setNewSubject] = useState({ name: '', code: '' });
  const [mappingForm, setMappingForm] = useState({ targetClass: '', selectedSubject: '' });

  // ACTION 1: CREATE NEW GLOBAL SUBJECT ENTRY
  const handleCreateSubject = (e) => {
    e.preventDefault();
    if (!newSubject.name.trim() || !newSubject.code.trim()) return;

    // Check for duplicate codes
    if (globalSubjects.some(s => s.code.toLowerCase() === newSubject.code.toLowerCase())) {
      alert('A subject with this identification code already exists in the registry.');
      return;
    }

    const createdItem = {
      id: `SUB-${Math.floor(100 + Math.random() * 900)}`,
      name: newSubject.name.trim(),
      code: newSubject.code.trim().toUpperCase()
    };

    setGlobalSubjects(prev => [...prev, createdItem]);
    setNewSubject({ name: '', code: '' });
    alert(`"${createdItem.name}" injected into global subject database successfully!`);
  };

  // ACTION 2: ASSIGN SUBJECT TO A TARGET CLASS
  const handleAssignSubjectToClass = (e) => {
    e.preventDefault();
    const { targetClass, selectedSubject } = mappingForm;
    if (!targetClass || !selectedSubject) {
      alert('Select both class and subject before assigning.');
      return;
    }

    setClassSubjectMapping(prev => {
      const existing = prev.find((item) => item.className === targetClass);
      if (!existing) {
        alert(`Assigned "${selectedSubject}" to ${targetClass} successfully.`);
        return [...prev, { className: targetClass, subjects: [selectedSubject] }];
      }

      return prev.map(item => {
        if (item.className === targetClass) {
          // Check if subject is already assigned to this specific class
          if (item.subjects.includes(selectedSubject)) {
            alert(`"${selectedSubject}" is already mapped inside ${targetClass} routine parameters.`);
            return item;
          }
          alert(`Assigned "${selectedSubject}" to ${targetClass} successfully.`);
          return { ...item, subjects: [...item.subjects, selectedSubject] };
        }
        return item;
      });
    });
  };

  // ACTION 3: REVOKE/UNASSIGN SUBJECT FROM A SPECIFIC CLASS
  const handleUnassignSubject = (className, subjectName) => {
    const confirmRevoke = window.confirm(`⚠️ Remove "${subjectName}" tracking from ${className}?`);
    if (confirmRevoke) {
      setClassSubjectMapping(prev => prev.map(item => {
        if (item.className === className) {
          return { ...item, subjects: item.subjects.filter(s => s !== subjectName) };
        }
        return item;
      }));
    }
  };

  // ACTION 4: PURGE SUBJECT COMPLETELY FROM GLOBAL REGISTRY
  const handlePurgeGlobalSubject = (id, name) => {
    const confirmPurge = window.confirm(`⚠️ Purging "${name}" will NOT auto-wipe historical class assignments but removes it from onboarding options. Proceed?`);
    if (confirmPurge) {
      setGlobalSubjects(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">

      {/* GLOBAL BANNER HEADER */}
      <div className="glass-card p-6 rounded-3xl mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-slate-900" /> Curriculum & Subject Routing Terminal
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Create master course blueprints, organize subject indices, and allocate active academic portfolios to target classes.
        </p>
      </div>

      {/* CORE CONFIGURATION HUB SPLIT ENGINE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN PANEL: SUBJECT DEFINITION CREATOR & VAULT (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* SUB-BLOCK 1: CREATOR FORM */}
          <div className="glass-card rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">1. Master Subject Definition Registry</span>

            <form onSubmit={handleCreateSubject} className="space-y-3 text-xs font-bold text-slate-900">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Political Science"
                  value={newSubject.name}
                  onChange={(e) => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                  className="p-2.5 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-500">System Code Identification</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. POL-402"
                  value={newSubject.code}
                  onChange={(e) => setNewSubject(prev => ({ ...prev, code: e.target.value }))}
                  className="p-2.5 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide mt-2 btn-primary"
              >
                <Plus className="w-4 h-4" /> Save Subject Definition
              </button>
            </form>
          </div>

          {/* SUB-BLOCK 2: REPOSITORY STORAGE INDEX LIST VIEW */}
          <div className="glass-card rounded-3xl p-5 space-y-3 shadow-2xs max-h-[360px] overflow-y-auto">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">2. Available System Channels ({globalSubjects.length})</span>

            <div className="space-y-1.5">
              {globalSubjects.map((sub) => (
                <div key={sub.id} className="glass-soft p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-slate-900">
                  <div className="min-w-0">
                    <p className="truncate text-xs">{sub.name}</p>
                    <span className="font-mono text-[9px] text-slate-500 uppercase tracking-tighter">Code: {sub.code} • ID: {sub.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePurgeGlobalSubject(sub.id, sub.name)}
                    className="p-1 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors flex-shrink-0"
                    title="Purge Definition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN PANEL: ROUTING MAPPER ENGINE & TIMETABLE GRID (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* COMPONENT ALLOCATION ROUTER BOX */}
          <div className="glass-card rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">3. Classroom Curriculum Mapping Router</span>

            <form onSubmit={handleAssignSubjectToClass} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs font-bold text-slate-900">

              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-slate-500">Target Classroom Node</label>
                <select
                  value={mappingForm.targetClass}
                  onChange={(e) => setMappingForm(prev => ({ ...prev, targetClass: e.target.value }))}
                  className="p-2.5 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl"
                >
                  <option value="">Select class</option>
                  {classNames.map(className => (
                    <option key={className} value={className}>{className}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-slate-500">Select Subject Asset to Allocate</label>
                <select
                  value={mappingForm.selectedSubject}
                  onChange={(e) => setMappingForm(prev => ({ ...prev, selectedSubject: e.target.value }))}
                  className="p-2.5 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl"
                >
                  <option value="">Select subject</option>
                  {globalSubjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={globalSubjects.length === 0}
                  className="w-full py-2.5 rounded-xl font-black transition-all flex items-center justify-center gap-1 text-[11px] uppercase disabled:opacity-40 btn-primary"
                >
                  <BookmarkPlus className="w-4 h-4" /> Link Node
                </button>
              </div>

            </form>
          </div>

          {/* CLASSROOM ALLOCATION BLUEPRINT INTERVIEW DISPLAY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classNames.map((className) => classSubjectMapping.find((item) => item.className === className) || { className, subjects: [] }).map((item) => (
              <div key={item.className} className="glass-card glass-hover rounded-3xl p-5 flex flex-col justify-between min-h-[140px] transition-all">

                <div className="space-y-3">
                  {/* Class Identity Label */}
                  <div className="flex items-center gap-1.5 border-b border-slate-100/80 pb-2">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <h4 className="text-sm font-black text-slate-900">{item.className}</h4>
                    <span className="ml-auto font-mono text-[9px] bg-white/50 text-slate-500 font-black px-2 py-0.5 rounded-md">
                      {item.subjects.length} Core Channels
                    </span>
                  </div>

                  {/* Render Mapped Subject Tags inside the class container */}
                  {item.subjects.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic font-semibold pt-1">No active courses linked to this grade node.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.subjects.map((subj) => (
                        <span
                          key={subj}
                          className="text-[10px] glass-soft text-slate-900 font-bold pl-2.5 pr-1.5 py-1 rounded-lg flex items-center gap-1 transition-all group/tag hover:border-red-300"
                        >
                          {subj}
                          <button
                            type="button"
                            onClick={() => handleUnassignSubject(item.className, subj)}
                            className="p-0.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                            title="Unlink Subject"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
};

export default SubjectManagement;
