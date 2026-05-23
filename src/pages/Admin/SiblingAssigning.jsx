import React, { useState, useMemo } from 'react';
import { Users2, Link2, Unlink, ShieldCheck, AlertCircle } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';

const SiblingAssigning = () => {
  // Global Academic Institutional Database Pool
  const [studentsPool, setStudentsPool] = useMongoState('admin-student-management-students', []);

  // UI Selection Node Workspaces
  const [selectedClassA, setSelectedClassA] = useState('');
  const [studentA, setStudentA] = useState(null);

  const [selectedClassB, setSelectedClassB] = useState('');
  const [studentB, setStudentB] = useState(null);

  const classOptions = useMemo(
    () => [...new Set(studentsPool.map((student) => student.class).filter(Boolean))].sort(),
    [studentsPool]
  );

  // 1. Compute filtered list for Side A
  const eligibleStudentsA = useMemo(() => {
    if (!selectedClassA) return [];
    return studentsPool.filter(s => s.class === selectedClassA);
  }, [selectedClassA, studentsPool]);

  // 2. Compute filtered list for Side B (Excludes currently picked student A)
  const eligibleStudentsB = useMemo(() => {
    if (!selectedClassB) return [];
    return studentsPool.filter(s => s.class === selectedClassB && s.admissionNumber !== studentA?.admissionNumber);
  }, [selectedClassB, studentA, studentsPool]);

  // CORE ENGINE ACTION 1: TRIGGER SIBLING LINKING COUPLING
  const handleLinkSiblings = () => {
    if (!studentA || !studentB) {
      alert('Please select two valid distinct student nodes to map family link!');
      return;
    }

    if (studentA.mobile !== studentB.mobile) {
      const confirmMismatch = window.confirm(`⚠️ Notice Contact Mismatch:\n\n${studentA.name} uses ${studentA.mobile}\n${studentB.name} uses ${studentB.mobile}\n\nDo you want to override and unify their credentials setup under a single master phone login?`);
      if (!confirmMismatch) return;
    }

    // Generate unique unified Family Household Group ID
    const generatedFamilyId = studentA.siblingGroupId || studentB.siblingGroupId || `FAM-${Math.floor(1000 + Math.random() * 9000)}`;

    setStudentsPool(prev => prev.map(student => {
      if (student.admissionNumber === studentA.admissionNumber || student.admissionNumber === studentB.admissionNumber) {
        return { ...student, siblingGroupId: generatedFamilyId };
      }
      return student;
    }));

    alert(`Dynamic Mapping Successful!\nUnified Family Group ID: ${generatedFamilyId}\nBoth profiles can now seamlessly share identical credentials with dynamic classwise notice dashboards.`);
    
    // Clear Workspace
    setStudentA(null);
    setStudentB(null);
  };

  // CORE ENGINE ACTION 2: SIMULATE PASSOUT LIFECYCLE DEACTIVATION
  const handleTogglePassoutStatus = (admissionNumber) => {
    setStudentsPool(prev => prev.map(student => {
      if (student.admissionNumber === admissionNumber) {
        const nextStatus = student.status === 'Active' ? 'Passout (Archived)' : 'Active';
        return { ...student, status: nextStatus };
      }
      return student;
    }));
  };

  // Grouped Visual View Calculation for Admin Auditing
  const siblingGroupsMap = useMemo(() => {
    const groups = {};
    studentsPool.forEach(s => {
      if (s.siblingGroupId) {
        if (!groups[s.siblingGroupId]) groups[s.siblingGroupId] = [];
        groups[s.siblingGroupId].push(s);
      }
    });
    return groups;
  }, [studentsPool]);

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* HEADER META BANNER */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-[#1A1A1A]" />
          <h3 className="text-xl font-bold">Sibling Cross-Mapping & Lifecycle Matrix</h3>
        </div>
        <p className="text-xs text-[#555555] mt-1">
          Link multi-student households to shared single-device logins. Passout status toggling automatically revokes individual portal access blocks while retaining lower active grade streams.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COMPONENT: CORE STRUCTIONAL COUPLING WORKSPACE (5 COLS) */}
        <div className="lg:col-span-5 bg-[#ffffff] border border-[#C8C8C8] p-6 rounded-3xl space-y-6">
          <h4 className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#EAEAEA] pb-2">
            <span className="w-1.5 h-3 bg-[#E1FA6C] inline-block rounded-xs"></span> Assign New Household Connection
          </h4>

          {/* STUDENT CHANNEL A CHOICE SETUP */}
          <div className="space-y-3 bg-[#EAEAEA]/30 p-4 rounded-2xl border border-[#EAEAEA]">
            <span className="text-[10px] uppercase text-[#555555] font-black tracking-wide block">Select Student Node A</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <select 
                value={selectedClassA} 
                onChange={(e) => { setSelectedClassA(e.target.value); setStudentA(null); }}
                className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none"
              >
                <option value="">-- Class A --</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>

              <select 
                disabled={!selectedClassA}
                value={studentA ? JSON.stringify(studentA) : ''}
                onChange={(e) => setStudentA(e.target.value ? JSON.parse(e.target.value) : null)}
                className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none disabled:opacity-50"
              >
                <option value="">-- Choose Kid --</option>
                {eligibleStudentsA.map(s => (
                  <option key={s.admissionNumber} value={JSON.stringify(s)}>{s.name} ({s.admissionNumber})</option>
                ))}
              </select>
            </div>
          </div>

          {/* DYNAMIC PIPELINE LINK SYMBOL */}
          <div className="flex items-center justify-center">
            <div className="bg-[#1A1A1A] text-[#E1FA6C] p-2.5 rounded-full shadow-xs">
              <Link2 className="w-4 h-4" />
            </div>
          </div>

          {/* STUDENT CHANNEL B CHOICE SETUP */}
          <div className="space-y-3 bg-[#EAEAEA]/30 p-4 rounded-2xl border border-[#EAEAEA]">
            <span className="text-[10px] uppercase text-[#555555] font-black tracking-wide block">Select Sibling Student Node B</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <select 
                value={selectedClassB} 
                onChange={(e) => { setSelectedClassB(e.target.value); setStudentB(null); }}
                className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none"
              >
                <option value="">-- Class B --</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>

              <select 
                disabled={!selectedClassB}
                value={studentB ? JSON.stringify(studentB) : ''}
                onChange={(e) => setStudentB(e.target.value ? JSON.parse(e.target.value) : null)}
                className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none disabled:opacity-50"
              >
                <option value="">-- Choose Sibling --</option>
                {eligibleStudentsB.map(s => (
                  <option key={s.admissionNumber} value={JSON.stringify(s)}>{s.name} ({s.admissionNumber})</option>
                ))}
              </select>
            </div>
          </div>

          {/* WORKSPACE EXECUTION BUTTON */}
          <button
            type="button"
            onClick={handleLinkSiblings}
            disabled={!studentA || !studentB}
            className="w-full py-3 bg-[#E1FA6C] text-[#1A1A1A] font-black text-xs rounded-xl shadow-md border border-[#1A1A1A]/10 transition-all hover:bg-[#d4ee59] disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
          >
            Bind Accounts Credentials Array
          </button>
        </div>

        {/* RIGHT COMPONENT: VERIFIED HOUSEHOLD MAPS & LIFECYCLE CONTROLLER (7 COLS) */}
        <div className="lg:col-span-7 bg-[#ffffff] border border-[#C8C8C8] p-6 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAEAEA] pb-3">
            <h4 className="text-xs font-black text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-[#1A1A1A] inline-block rounded-xs"></span>
              Live Household Registry Maps ({Object.keys(siblingGroupsMap).length})
            </h4>
          </div>

          {/* RENDER ACTIVE LINKED LINKED GROUPS CHANNELS */}
          {Object.keys(siblingGroupsMap).length === 0 ? (
            <div className="text-center py-12 text-xs text-[#555555] font-semibold">
              No active compound house sibling clusters detected in the current structural framework loop.
            </div>
          ) : (
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {Object.entries(siblingGroupsMap).map(([groupId, members]) => (
                <div key={groupId} className="border border-[#C8C8C8] rounded-2xl bg-white overflow-hidden text-xs">
                  
                  {/* Household Head Title */}
                  <div className="bg-[#EAEAEA] p-3 font-bold text-[#1A1A1A] flex items-center justify-between border-b border-[#C8C8C8]">
                    <span className="font-mono text-[11px] tracking-wide uppercase">Unified Account ID: <span className="font-black">{groupId}</span></span>
                    <span className="text-[10px] bg-white border border-[#C8C8C8] px-2 py-0.5 rounded-md font-mono text-[#555555] font-black">
                      {members.length} Linked Members
                    </span>
                  </div>

                  {/* Members Mapping Table Sequence */}
                  <div className="p-3 divide-y divide-[#EAEAEA]">
                    {members.map(m => (
                      <div key={m.admissionNumber} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between font-bold">
                        <div>
                          <p className="text-sm font-black text-[#1A1A1A]">{m.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[#555555] mt-0.5 font-semibold">
                            <span className="bg-[#EAEAEA] px-1.5 py-0.5 rounded text-[#1A1A1A]">{m.class}</span>
                            <span className="font-mono">Adm No: {m.admissionNumber}</span>
                            <span className="font-mono">📞 {m.mobile}</span>
                          </div>
                        </div>

                        {/* HIGHLY CRITICAL: PASSOUT ARCHIVE ACTION BLOCK TOGGLER TRIGGER */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] border font-black ${m.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {m.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTogglePassoutStatus(m.admissionNumber)}
                            className={`px-3 py-1.5 rounded-lg border font-black text-[10px] transition-all ${m.status === 'Active' ? 'bg-white hover:bg-red-50 text-red-600 border-[#C8C8C8]' : 'bg-[#1A1A1A] text-white border-black'}`}
                          >
                            {m.status === 'Active' ? 'Mark Passout' : 'Restore Active'}
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* DYNAMIC SYSTEM ARCHITECTURE RULES EDUCATIONAL BANNER */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl text-[11px] text-[#555555] font-semibold leading-relaxed">
            <span className="text-blue-800 font-bold flex items-center gap-1 mb-1">
              <AlertCircle className="w-3.5 h-3.5" /> Single-Device Unified Roster Architecture Notice:
            </span>
            Khi bhi shared login setup me jab admin kisi student ko <span className="font-bold text-[#1A1A1A]">"Passout"</span> mark karega, toh system unke data structural pipelines ko completely break nahi karta. Bada bhai/behan passout hokar archive block me chala jayega, unka data matrix client login portal se disappear ho jayega, aur chote bhai/behan ka active profile data bina kisi distraction ke continuous live tracking view par makkhan chalta rahega!
          </div>

        </div>
      </div>

    </div>
  );
};

export default SiblingAssigning;
