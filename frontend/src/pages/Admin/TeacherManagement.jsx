import React, { useState } from 'react';
import { UserCheck, MoreVertical, Edit2, UserX, Mail, Phone, BookOpen, GraduationCap, Calendar, Search, X, Plus, Trash2, FileText, CheckCircle2 } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { useMasterData } from '../../components/common/masterData';

const TeacherManagement = ({ role = 'admin' }) => {
  const canRemoveTeacher = role !== 'clerk';
  const { classNames, globalSubjectNames, subjectsByClass } = useMasterData();
  // Master State for Teachers Database Directory
  const [teachersList, setTeachersList] = useMongoState('admin-teacher-management-list', []);

  // UI Interactive States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  
  // EDIT MODAL COMPREHENSIVE STATE HOOK
  const [editingTeacher, setEditingTeacher] = useState(null);

  const toggleDropdown = (id) => {
    setActiveDropdownId(activeDropdownId === id ? null : id);
  };

  // ACTION 1: REMOVE TEACHER DATA BLOCK
  const handleRemoveTeacher = (id, name) => {
    if (!canRemoveTeacher) {
      setActiveDropdownId(null);
      alert('Clerk access cannot remove faculty records.');
      return;
    }

    setActiveDropdownId(null);
    const confirmDelete = window.confirm(`⚠️ Permanently purge ${name} (ID: ${id}) from institute files?`);
    if (confirmDelete) {
      setTeachersList(prev => prev.filter(t => t.id !== id));
      alert('Asset removed from system logs.');
    }
  };

  // ACTION 2: OPEN EDIT FOLLOWER DRAWING ALL VALUES
  const handleOpenEditModal = (teacher) => {
    setActiveDropdownId(null);
    // Deep clone to safely isolate edit workspace state
    setEditingTeacher(JSON.parse(JSON.stringify(teacher)));
  };

  // EDIT STATE MUTATORS
  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditingTeacher(prev => ({ ...prev, [name]: value }));
  };

  // EXPERIENCE REPEATER INSIDE EDIT WORKSPACE
  const handleEditExperienceChange = (index, field, value) => {
    const updatedExp = [...editingTeacher.experience];
    updatedExp[index][field] = value;
    setEditingTeacher(prev => ({ ...prev, experience: updatedExp }));
  };

  const addEditExperienceBlock = () => {
    setEditingTeacher(prev => ({
      ...prev,
      experience: [...prev.experience, { organization: '', position: '', years: '' }]
    }));
  };

  const removeEditExperienceBlock = (index) => {
    if (editingTeacher.experience.length === 1) return;
    const updatedExp = editingTeacher.experience.filter((_, i) => i !== index);
    setEditingTeacher(prev => ({ ...prev, experience: updatedExp }));
  };

  // ASSIGNMENTS REPEATER INSIDE EDIT WORKSPACE
  const handleEditAssignmentChange = (index, field, value) => {
    const updatedAssign = [...editingTeacher.classAssignments];
    updatedAssign[index][field] = value;
    setEditingTeacher(prev => ({ ...prev, classAssignments: updatedAssign }));
  };

  const addEditAssignmentBlock = () => {
    setEditingTeacher(prev => ({
      ...prev,
      classAssignments: [...prev.classAssignments, { className: '', subject: '' }]
    }));
  };

  const removeEditAssignmentBlock = (index) => {
    if (editingTeacher.classAssignments.length === 1) return;
    const updatedAssign = editingTeacher.classAssignments.filter((_, i) => i !== index);
    setEditingTeacher(prev => ({ ...prev, classAssignments: updatedAssign }));
  };

  // EDIT WORKSPACE FILE WATCHER MOCK
  const handleEditFileChange = (e) => {
    if (e.target.files.length > 0) {
      const fileNames = Array.from(e.target.files).map(f => f.name);
      setEditingTeacher(prev => ({
        ...prev,
        documentsAttached: [...prev.documentsAttached, ...fileNames]
      }));
    }
  };

  // ACTION 3: COMMIT UPDATE CLOSING CYCLE
  const handleUpdateTeacherForm = (e) => {
    e.preventDefault();

    // Re-verify validation mapping criteria
    const isAadharValid = /^\d{12}$/.test(editingTeacher.aadharNumber);
    if (editingTeacher.aadharNumber && !isAadharValid) {
      alert("Validation Error: Aadhaar entry requires exactly 12 continuous numeric index positions.");
      return;
    }

    const sanitizedTeacher = {
      ...editingTeacher,
      fatherName:
        editingTeacher.gender === 'Female' && editingTeacher.maritalStatus === 'Married'
          ? ''
          : editingTeacher.fatherName,
      husbandName:
        editingTeacher.gender === 'Female' && editingTeacher.maritalStatus === 'Married'
          ? editingTeacher.husbandName
          : '',
    };

    setTeachersList(prev => prev.map(t => t.id === sanitizedTeacher.id ? sanitizedTeacher : t));
    setEditingTeacher(null);
    alert('Teacher registry updated successfully!');
  };

  const filteredTeachers = teachersList.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // EVALUATE LOCKING FLAGS FOR CURRENTLY OPENED EDIT SNAPSHOT
  const isEditFatherBlocked = editingTeacher?.gender === 'Female' && editingTeacher?.maritalStatus === 'Married';
  const isEditHusbandActive = editingTeacher?.gender === 'Female' && editingTeacher?.maritalStatus === 'Married';

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* DIRECTORY BAR HEADER CONTROLS */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#1A1A1A]" /> Teacher Management Directory
          </h3>
          <p className="text-xs text-[#555555] mt-1">
            Review active deployments. Use the tracking nodes drop-menu to invoke comprehensive dynamic data modifications.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#EAEAEA] px-4 py-2.5 rounded-xl border border-[#C8C8C8]/60 w-full md:w-72">
          <Search className="w-4 h-4 text-[#555555]" />
          <input 
            type="text"
            placeholder="Search Name or Teacher ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-xs font-bold text-[#1A1A1A]"
          />
        </div>
      </div>

      {/* CORE CARDS SYSTEM GRID DISPLAY */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map((teacher) => (
          <div key={teacher.id} className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 relative flex flex-col justify-between group hover:border-black transition-all">
            
            {/* INLINE ACTION DROPDOWN LAYER CONTROL */}
            <div className="absolute top-4 right-4">
              <button onClick={() => toggleDropdown(teacher.id)} className="p-1.5 hover:bg-[#EAEAEA] rounded-full text-[#555555] hover:text-black transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
              {activeDropdownId === teacher.id && (
                <div className="absolute right-0 mt-1 bg-white border border-[#C8C8C8] rounded-xl shadow-lg w-32 py-1 text-xs font-black z-30 overflow-hidden">
                  <button type="button" onClick={() => handleOpenEditModal(teacher)} className="w-full text-left px-3 py-2 hover:bg-[#EAEAEA] flex items-center gap-2 text-blue-600">
                    <Edit2 className="w-3.5 h-3.5" /> Edit Master
                  </button>
                  {canRemoveTeacher && (
                    <button type="button" onClick={() => handleRemoveTeacher(teacher.id, teacher.name)} className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-[#EAEAEA]">
                      <UserX className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* CARD IDENTITY ELEMENTS HEADER */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pr-6">
                <div className="w-12 h-12 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl flex items-center justify-center text-sm font-black text-[#555555]">
                  {teacher.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-[9px] bg-[#EAEAEA] px-2 py-0.5 rounded border border-[#C8C8C8]/60 uppercase font-bold">{teacher.id}</span>
                  <h4 className="text-sm font-black text-[#1A1A1A] truncate mt-0.5">{teacher.name}</h4>
                  <p className="text-[10px] text-[#555555] font-semibold">
                    {teacher.isClassTeacher === 'Yes' ? `Class Teacher: ${teacher.assignedClassTeacherFor}` : 'Subject Instructor'}
                  </p>
                </div>
              </div>

              <hr className="border-[#EAEAEA]" />

              {/* CARD CORE LABELS SNAPSHOT INFO */}
              <div className="space-y-1.5 text-[11px] font-bold text-[#555555]">
                <p className="text-[#1A1A1A] truncate"><Mail className="w-3.5 h-3.5 inline mr-1 text-[#555555]" /> {teacher.email}</p>
                <p className="text-[#1A1A1A] font-mono"><Phone className="w-3.5 h-3.5 inline mr-1 text-[#555555]" /> {teacher.mobile}</p>
                <p><BookOpen className="w-3.5 h-3.5 inline mr-1 text-[#555555]" /> Allotted: <span className="text-[#1A1A1A]">{teacher.classAssignments.map(c => c.className).join(', ')}</span></p>
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* FULL-SCALE DATA EDIT MASTER MODAL WORKSPACE */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] border-2 border-black w-full max-w-3xl rounded-3xl p-6 relative max-h-[92vh] overflow-y-auto font-bold text-xs text-[#1A1A1A] space-y-6 shadow-2xl">
            
            {/* Modal Closer Header Bar */}
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
              <h3 className="text-md font-black text-[#1A1A1A] flex items-center gap-2">
                <GraduationCap className="w-5 h-5" /> Comprehensive Faculty File Synchronizer
              </h3>
              <button type="button" onClick={() => setEditingTeacher(null)} className="p-1 hover:bg-[#EAEAEA] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacherForm} className="space-y-6">
              
              {/* BLOCK STEP 1: BIOGRAPHICAL EDIT PATHS */}
              <div className="space-y-3 bg-[#EAEAEA]/20 p-4 rounded-2xl border border-[#EAEAEA]">
                <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider">1. Master Demographics Block Updates</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Full Name</label>
                    <input type="text" name="name" required value={editingTeacher.name} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Email Address</label>
                    <input type="email" name="email" required value={editingTeacher.email} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-medium" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Mobile Connection</label>
                    <input type="text" name="mobile" required value={editingTeacher.mobile} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Gender</label>
                    <select name="gender" required value={editingTeacher.gender} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Date of Birth (DOB)</label>
                    <input type="date" name="dob" required value={editingTeacher.dob} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Marital Status</label>
                    <select name="maritalStatus" required value={editingTeacher.maritalStatus} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black">
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Category Stream</label>
                    <select name="category" required value={editingTeacher.category} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black">
                      <option value="General">General</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[#555555]">Aadhaar Identification Code</label>
                    <input type="text" name="aadharNumber" required placeholder="12 Digits" value={editingTeacher.aadharNumber} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono" maxLength={12} />
                  </div>
                </div>

                {/* PARENTAL CONDITIONAL RE-LOCK CONSTRAINTS ARCHITECTURE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col gap-1">
                    <label className={`text-[#555555] ${isEditFatherBlocked ? 'opacity-30' : ''}`}>Father's Name</label>
                    <input type="text" name="fatherName" disabled={isEditFatherBlocked} required={!isEditFatherBlocked} placeholder={isEditFatherBlocked ? "[LOCK - Husband Line Active]" : "Father name"} value={isEditFatherBlocked ? "" : editingTeacher.fatherName} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black disabled:bg-neutral-200/50 disabled:cursor-not-allowed" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={`text-[#555555] ${!isEditHusbandActive ? 'opacity-30' : ''}`}>Husband's Name</label>
                    <input type="text" name="husbandName" disabled={!isEditHusbandActive} required={isEditHusbandActive} placeholder={!isEditHusbandActive ? "[LOCK - Father Line Active]" : "Husband name"} value={!isEditHusbandActive ? "" : editingTeacher.husbandName} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black disabled:bg-neutral-200/50 disabled:cursor-not-allowed" />
                  </div>
                </div>

                <div className="flex flex-col gap-1 pt-1">
                  <label className="text-[#555555]">Home Address Location coordinates</label>
                  <input type="text" name="address" required value={editingTeacher.address} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none focus:border-black" />
                </div>
              </div>

              {/* BLOCK STEP 2: PRIOR EXPERIENCES DYNAMIC ENGINE REPEATER FOR EDIT MODAL */}
              <div className="space-y-3 bg-[#EAEAEA]/20 p-4 rounded-2xl border border-[#EAEAEA]">
                <div className="flex items-center justify-between border-b border-[#C8C8C8]/60 pb-1">
                  <span className="text-[10px] text-[#555555] uppercase font-black tracking-wider">2. History Employment Verification Repeaters</span>
                  <button type="button" onClick={addEditExperienceBlock} className="bg-[#1A1A1A] text-[#E1FA6C] px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1"><Plus className="w-3 h-3" /> Add Exp Node</button>
                </div>
                
                <div className="space-y-2">
                  {editingTeacher.experience.map((exp, expIdx) => (
                    <div key={expIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-3 rounded-xl border border-[#C8C8C8]/60">
                      <div className="sm:col-span-5 flex flex-col gap-0.5">
                        <label className="text-[9px] text-[#555555]">Organization</label>
                        <input type="text" required placeholder="School name" value={exp.organization} onChange={(e) => handleEditExperienceChange(expIdx, 'organization', e.target.value)} className="p-2 bg-[#EAEAEA]/40 border border-[#C8C8C8] rounded-lg outline-none" />
                      </div>
                      <div className="sm:col-span-4 flex flex-col gap-0.5">
                        <label className="text-[9px] text-[#555555]">Designation</label>
                        <input type="text" required placeholder="Role profile" value={exp.position} onChange={(e) => handleEditExperienceChange(expIdx, 'position', e.target.value)} className="p-2 bg-[#EAEAEA]/40 border border-[#C8C8C8] rounded-lg outline-none" />
                      </div>
                      <div className="sm:col-span-2 flex flex-col gap-0.5">
                        <label className="text-[9px] text-[#555555]">Tenure (Yrs)</label>
                        <input type="number" required placeholder="Yrs" value={exp.years} onChange={(e) => handleEditExperienceChange(expIdx, 'years', e.target.value)} className="p-2 bg-[#EAEAEA]/40 border border-[#C8C8C8] rounded-lg outline-none font-mono" />
                      </div>
                      <div className="sm:col-span-1 flex justify-center">
                        <button type="button" disabled={editingTeacher.experience.length === 1} onClick={() => removeEditExperienceBlock(expIdx)} className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-200 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BLOCK STEP 3: CLASS ASSIGNMENT MAP REPEATER FOR EDIT MODAL */}
              <div className="space-y-3 bg-[#EAEAEA]/20 p-4 rounded-2xl border border-[#EAEAEA]">
                <div className="flex items-center justify-between border-b border-[#C8C8C8]/60 pb-1">
                  <span className="text-[10px] text-[#555555] uppercase font-black tracking-wider">3. Classroom Router Mapping Channels</span>
                  <button type="button" onClick={addEditAssignmentBlock} className="bg-[#1A1A1A] text-[#E1FA6C] px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1"><Plus className="w-3 h-3" /> Add Route Node</button>
                </div>

                <div className="space-y-2">
                  {editingTeacher.classAssignments.map((assign, asIdx) => (
                    <div key={asIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-3 rounded-xl border border-[#C8C8C8]/60">
                      <div className="sm:col-span-5 flex flex-col gap-0.5">
                        <label className="text-[9px] text-[#555555]">Target Grade</label>
                        <select required value={assign.className} onChange={(e) => handleEditAssignmentChange(asIdx, 'className', e.target.value)} className="p-2 bg-[#EAEAEA]/40 border border-[#C8C8C8] rounded-lg outline-none">
                          <option value="">-- Select Class --</option>
                          {classNames.map((className) => (
                            <option key={className} value={className}>{className}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-6 flex flex-col gap-0.5">
                        <label className="text-[9px] text-[#555555]">Subject Domain Specialty</label>
                        <select required value={assign.subject} onChange={(e) => handleEditAssignmentChange(asIdx, 'subject', e.target.value)} className="p-2 bg-[#EAEAEA]/40 border border-[#C8C8C8] rounded-lg outline-none">
                          <option value="">-- Select Subject --</option>
                          {[
                            ...(subjectsByClass[assign.className] || []).map((item) => item.subject),
                            ...globalSubjectNames,
                          ].filter((value, optionIndex, values) => value && values.indexOf(value) === optionIndex).map((subjectName) => (
                            <option key={subjectName} value={subjectName}>{subjectName}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-1 flex justify-center">
                        <button type="button" disabled={editingTeacher.classAssignments.length === 1} onClick={() => removeEditAssignmentBlock(asIdx)} className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-200 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BLOCK STEP 4: CLASS TEACHER CONDITIONAL FOR EDIT MODAL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#EAEAEA]/20 p-4 rounded-2xl border border-[#EAEAEA]">
                <div className="flex flex-col gap-1">
                  <label className="text-[#555555]">Date of Joining (DOJ)</label>
                  <input type="date" name="dateOfJoining" required value={editingTeacher.dateOfJoining} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[#555555]">Is Designated Class Teacher?</label>
                  <select name="isClassTeacher" value={editingTeacher.isClassTeacher} onChange={handleEditInputChange} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={`text-[#555555] ${editingTeacher.isClassTeacher === 'No' ? 'opacity-30' : ''}`}>Grade Incharge Assignment</label>
                  <select 
                    name="assignedClassTeacherFor" 
                    disabled={editingTeacher.isClassTeacher === 'No'}
                    required={editingTeacher.isClassTeacher === 'Yes'}
                    value={editingTeacher.isClassTeacher === 'No' ? "" : editingTeacher.assignedClassTeacherFor} 
                    onChange={handleEditInputChange} 
                    className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none disabled:bg-neutral-200/50"
                  >
                    <option value="">-- Select Class --</option>
                    {classNames.map((className) => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BLOCK STEP 5: DOCUMENT MANAGEMENT VAULT ATTACHMENT */}
              <div className="space-y-2 bg-[#EAEAEA]/20 p-4 rounded-2xl border border-[#EAEAEA]">
                <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider">4. Verification Asset Vault Sync</span>
                <div className="relative">
                  <input type="file" multiple onChange={handleEditFileChange} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" />
                  <div className="w-full py-4 bg-white border border-dashed border-[#C8C8C8] rounded-xl text-center font-medium text-[#555555] hover:border-black transition-all">
                    <span>Append additional scanned certification documents bundle</span>
                  </div>
                </div>
                {/* Render current lists files */}
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px] pt-1">
                  {editingTeacher.documentsAttached.map((file, fIdx) => (
                    <span key={fIdx} className="bg-white border border-[#C8C8C8] text-[#1A1A1A] px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {file}
                    </span>
                  ))}
                </div>
              </div>

              {/* MODAL CONTROL STRIP - SUBMIT REPLACED BY UPDATE */}
              <div className="flex items-center justify-end gap-2 border-t border-[#EAEAEA] pt-4">
                <button type="button" onClick={() => setEditingTeacher(null)} className="px-5 py-2.5 bg-[#EAEAEA] border border-[#C8C8C8] rounded-full text-[#555555] hover:text-black transition-colors">Cancel</button>
                <button type="submit" className="px-7 py-2.5 bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-full font-black hover:bg-[#d4ee59] shadow-md transition-all uppercase tracking-wide">Update Database</button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherManagement;
