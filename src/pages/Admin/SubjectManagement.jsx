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
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* GLOBAL BANNER HEADER */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#1A1A1A]" /> Curriculum & Subject Routing Terminal
        </h3>
        <p className="text-xs text-[#555555] mt-1">
          Create master course blueprints, organize subject indices, and allocate active academic portfolios to target classes.
        </p>
      </div>

      {/* CORE CONFIGURATION HUB SPLIT ENGINE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN PANEL: SUBJECT DEFINITION CREATOR & VAULT (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* SUB-BLOCK 1: CREATOR FORM */}
          <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider">1. Master Subject Definition Registry</span>
            
            <form onSubmit={handleCreateSubject} className="space-y-3 text-xs font-bold text-[#1A1A1A]">
              <div className="flex flex-col gap-1">
                <label className="text-[#555555]">Subject Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Political Science" 
                  value={newSubject.name}
                  onChange={(e) => setNewSubject(prev => ({ ...prev, name: e.target.value }))}
                  className="p-2.5 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-semibold text-[#1A1A1A]" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[#555555]">System Code Identification</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. POL-402" 
                  value={newSubject.code}
                  onChange={(e) => setNewSubject(prev => ({ ...prev, code: e.target.value }))}
                  className="p-2.5 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono" 
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-2.5 bg-[#1A1A1A] text-[#E1FA6C] rounded-xl font-black hover:opacity-90 transition-all flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide mt-2"
              >
                <Plus className="w-4 h-4" /> Save Subject Definition
              </button>
            </form>
          </div>

          {/* SUB-BLOCK 2: REPOSITORY STORAGE INDEX LIST VIEW */}
          <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 space-y-3 shadow-2xs max-h-[360px] overflow-y-auto">
            <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider">2. Available System Channels ({globalSubjects.length})</span>
            
            <div className="space-y-1.5">
              {globalSubjects.map((sub) => (
                <div key={sub.id} className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-[#1A1A1A]">
                  <div className="min-w-0">
                    <p className="truncate text-xs">{sub.name}</p>
                    <span className="font-mono text-[9px] text-[#555555] uppercase tracking-tighter">Code: {sub.code} • ID: {sub.id}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handlePurgeGlobalSubject(sub.id, sub.name)}
                    className="p-1 hover:bg-red-50 text-[#555555] hover:text-red-600 rounded-lg transition-colors flex-shrink-0"
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
          <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider">3. Classroom Curriculum Mapping Router</span>
            
            <form onSubmit={handleAssignSubjectToClass} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs font-bold text-[#1A1A1A]">
              
              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-[#555555]">Target Classroom Node</label>
                <select 
                  value={mappingForm.targetClass}
                  onChange={(e) => setMappingForm(prev => ({ ...prev, targetClass: e.target.value }))}
                  className="p-2.5 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black"
                >
                  <option value="">Select class</option>
                  {classNames.map(className => (
                    <option key={className} value={className}>{className}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5 flex flex-col gap-1">
                <label className="text-[#555555]">Select Subject Asset to Allocate</label>
                <select 
                  value={mappingForm.selectedSubject}
                  onChange={(e) => setMappingForm(prev => ({ ...prev, selectedSubject: e.target.value }))}
                  className="p-2.5 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black"
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
                  className="w-full py-2.5 bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-xl font-black hover:bg-[#d4ee59] transition-all flex items-center justify-center gap-1 text-[11px] uppercase disabled:opacity-40"
                >
                  <BookmarkPlus className="w-4 h-4" /> Link Node
                </button>
              </div>

            </form>
          </div>

          {/* CLASSROOM ALLOCATION BLUEPRINT INTERVIEW DISPLAY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classNames.map((className) => classSubjectMapping.find((item) => item.className === className) || { className, subjects: [] }).map((item) => (
              <div key={item.className} className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 flex flex-col justify-between min-h-[140px] hover:border-black transition-all">
                
                <div className="space-y-3">
                  {/* Class Identity Label */}
                  <div className="flex items-center gap-1.5 border-b border-[#EAEAEA] pb-2">
                    <Layers className="w-4 h-4 text-[#555555]" />
                    <h4 className="text-sm font-black text-[#1A1A1A]">{item.className}</h4>
                    <span className="ml-auto font-mono text-[9px] bg-[#EAEAEA] text-[#555555] font-black px-2 py-0.5 rounded-md">
                      {item.subjects.length} Core Channels
                    </span>
                  </div>

                  {/* Render Mapped Subject Tags inside the class container */}
                  {item.subjects.length === 0 ? (
                    <p className="text-[11px] text-[#555555] italic font-semibold pt-1">No active courses linked to this grade node.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.subjects.map((subj) => (
                        <span 
                          key={subj} 
                          className="text-[10px] bg-[#EAEAEA]/70 text-[#1A1A1A] font-bold border border-[#C8C8C8]/60 pl-2.5 pr-1.5 py-1 rounded-lg flex items-center gap-1 transition-all group/tag hover:border-red-300"
                        >
                          {subj}
                          <button 
                            type="button" 
                            onClick={() => handleUnassignSubject(item.className, subj)}
                            className="p-0.5 rounded hover:bg-red-50 text-[#555555] hover:text-red-600 transition-colors"
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
