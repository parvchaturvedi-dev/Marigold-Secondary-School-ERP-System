import React, { useState } from 'react';
import { UserSquare2, Plus, Trash2, GraduationCap, Briefcase, FileText, CheckCircle2, BookOpen } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { useMasterData } from '../../components/common/masterData';

const TeacherAssignment = () => {
  const { classNames, globalSubjectNames, subjectsByClass } = useMasterData();
  // CORE MASTER REGISTER STATE FORM INITIALIZER
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
    mobile: '',
    gender: '',
    dob: '',
    maritalStatus: '',
    category: '',
    address: '',
    aadharNumber: '', // Handled safely as per professional mock layout placeholders
    fatherName: '',
    husbandName: '',
    dateOfJoining: '',
    
    // Dynamic Repeater Sub-Pools
    experience: [{ organization: '', position: '', years: '' }],
    classAssignments: [{ className: '', subject: '' }],
    
    // Class Teacher Conditional Node
    isClassTeacher: 'No',
    assignedClassTeacherFor: ''
  });

  const [, setTeachersDb] = useMongoState('admin-teacher-management-list', []);
  const [, setClassesDb] = useMongoState('admin-class-management-classes', []);

  // Native Standard Inputs Mutator
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTeacherForm(prev => ({ ...prev, [name]: value }));
  };

  // =========================================================
  // DYNAMIC REPEATER LOGIC CHANNEL 1: WORK EXPERIENCE POOL
  // =========================================================
  const handleExperienceChange = (index, field, value) => {
    const updatedExp = [...teacherForm.experience];
    updatedExp[index][field] = value;
    setTeacherForm(prev => ({ ...prev, experience: updatedExp }));
  };

  const addExperienceBlock = () => {
    setTeacherForm(prev => ({
      ...prev,
      experience: [...prev.experience, { organization: '', position: '', years: '' }]
    }));
  };

  const removeExperienceBlock = (index) => {
    if (teacherForm.experience.length === 1) return;
    const updatedExp = teacherForm.experience.filter((_, i) => i !== index);
    setTeacherForm(prev => ({ ...prev, experience: updatedExp }));
  };

  // =========================================================
  // DYNAMIC REPEATER LOGIC CHANNEL 2: CLASS & SUBJECT SCHEDULER
  // =========================================================
  const handleAssignmentChange = (index, field, value) => {
    const updatedAssign = [...teacherForm.classAssignments];
    updatedAssign[index][field] = value;
    setTeacherForm(prev => ({ ...prev, classAssignments: updatedAssign }));
  };

  const addAssignmentBlock = () => {
    setTeacherForm(prev => ({
      ...prev,
      classAssignments: [...prev.classAssignments, { className: '', subject: '' }]
    }));
  };

  const removeAssignmentBlock = (index) => {
    if (teacherForm.classAssignments.length === 1) return;
    const updatedAssign = teacherForm.classAssignments.filter((_, i) => i !== index);
    setTeacherForm(prev => ({ ...prev, classAssignments: updatedAssign }));
  };

  // Mock document file target scanner
  const [attachedFiles, setAttachedFiles] = useState([]);
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).map(f => f.name);
      setAttachedFiles(filesArray);
    }
  };

  // CORE FORM EXECUTION ENGINE SUBMIT ACTION
  const handleSubmitTeacherForm = (e) => {
    e.preventDefault();

    // Verification check for aadhar mask layout rules mapping
    const isAadharValid = /^\d{12}$/.test(teacherForm.aadharNumber);
    if (teacherForm.aadharNumber && !isAadharValid) {
      alert("Please check validation parameters: Aadhaar formatting requires exactly 12 continuous numeric indices.");
      return;
    }

    // Capture snapshot record inside master context pool
    const finalRecord = {
      ...teacherForm,
      id: `TCH-2026-${Math.floor(100 + Math.random() * 900)}`,
      documentsAttached: attachedFiles
    };

    setTeachersDb(prev => [finalRecord, ...prev]);
    if (finalRecord.isClassTeacher === 'Yes' && finalRecord.assignedClassTeacherFor) {
      setClassesDb((classes) => {
        const hasClass = classes.some((classRecord) => classRecord.name === finalRecord.assignedClassTeacherFor);
        const nextClasses = hasClass
          ? classes
          : [
              ...classes,
              {
                id: finalRecord.assignedClassTeacherFor,
                name: finalRecord.assignedClassTeacherFor,
                studentCount: 0,
              },
            ];

        return nextClasses.map((classRecord) =>
          classRecord.name === finalRecord.assignedClassTeacherFor
            ? {
                ...classRecord,
                classTeacherId: finalRecord.id,
                classTeacherName: finalRecord.name,
                teacher: finalRecord.name,
              }
            : classRecord
        );
      });
    }
    alert(`Teacher Profile Registered & Workspace Context Setup Successfully!\nGenerated Access Key ID: ${finalRecord.id}`);
    
    // Total System State Reset Controls
    setTeacherForm({
      name: '', email: '', mobile: '', gender: '', dob: '', maritalStatus: '', category: '', address: '', aadharNumber: '',
      fatherName: '', husbandName: '', dateOfJoining: '',
      experience: [{ organization: '', position: '', years: '' }],
      classAssignments: [{ className: '', subject: '' }],
      isClassTeacher: 'No', assignedClassTeacherFor: ''
    });
    setAttachedFiles([]);
  };

  // SMART LOGIC FLAGS FOR PARENT IDENTITY INPUT BLOCKS
  // Block Father Name if Female and Married
  const isFatherNameBlocked = teacherForm.gender === 'Female' && teacherForm.maritalStatus === 'Married';
  // Enable Husband Name ONLY if Female and Married
  const isHusbandNameActive = teacherForm.gender === 'Female' && teacherForm.maritalStatus === 'Married';

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* SECTION TOP BANNER LINK OVERVIEW */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <UserSquare2 className="w-5 h-5 text-[#1A1A1A]" /> Teacher Allocation & Workspace Onboarding
        </h3>
        <p className="text-xs text-[#555555] mt-1">
          Perform administrative mapping profiles for newly recruited core human assets. Implements context-sensitive relationship locking rules and dynamic assignment repeater blocks.
        </p>
      </div>

      {/* COMPREHENSIVE ONBOARDING ENGINE CONTROLLER WORKSPACE */}
      <form onSubmit={handleSubmitTeacherForm} className="space-y-6 text-xs font-bold text-[#1A1A1A]">
        
        {/* BLOCK PART 1: CORE INDIVIDUAL BIOMETRIC METRICS BLOCK */}
        <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] space-y-4">
          <h4 className="text-[11px] uppercase tracking-wider text-[#555555] border-b border-[#EAEAEA] pb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-[#1A1A1A] inline-block rounded-xs"></span>
            1. Core Identity & Biographical Demographics Matrix
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Teacher Full Name <span className="text-red-500">*</span></label>
              <input type="text" name="name" required placeholder="e.g. Dr. Ramesh Verma" value={teacherForm.name} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Official Email Address <span className="text-red-500">*</span></label>
              <input type="email" name="email" required placeholder="ramesh.verma@academy.com" value={teacherForm.email} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-medium" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Primary Mobile Connection <span className="text-red-500">*</span></label>
              <input type="text" name="mobile" required placeholder="e.g. 9829011223" value={teacherForm.mobile} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Date of Birth (DOB) <span className="text-red-500">*</span></label>
              <input type="date" name="dob" required value={teacherForm.dob} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Gender Allocation <span className="text-red-500">*</span></label>
              <select name="gender" required value={teacherForm.gender} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black">
                <option value="">-- Choose Gender --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Marital Status Flag <span className="text-red-500">*</span></label>
              <select name="maritalStatus" required value={teacherForm.maritalStatus} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black">
                <option value="">-- Select Status --</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Social Category Stream <span className="text-red-500">*</span></label>
              <select name="category" required value={teacherForm.category} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black">
                <option value="">-- Select Category --</option>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[#555555]">Aadhaar Identity Code Block <span className="text-red-500">*</span></label>
              <input type="text" name="aadharNumber" required placeholder="4231 XXXX XXXX (12 Digits)" value={teacherForm.aadharNumber} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono tracking-wider" maxLength={12} />
            </div>
          </div>

          {/* CRITICAL CONTEXT DYNAMIC LOGIC MAPPING FOR PARENT BLOCKS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex flex-col gap-1">
              <label className={`text-[#555555] ${isFatherNameBlocked ? 'opacity-30' : ''}`}>
                Father's Full Name {!isFatherNameBlocked && <span className="text-red-500">*</span>}
              </label>
              <input 
                type="text" 
                name="fatherName" 
                disabled={isFatherNameBlocked}
                required={!isFatherNameBlocked}
                placeholder={isFatherNameBlocked ? "[BLOCKED - Husband Line Assigned]" : "Enter father name"} 
                value={isFatherNameBlocked ? "" : teacherForm.fatherName} 
                onChange={handleInputChange} 
                className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black disabled:bg-neutral-200/60 disabled:cursor-not-allowed font-semibold" 
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={`text-[#555555] ${!isHusbandNameActive ? 'opacity-30' : ''}`}>
                Husband's Full Name {isHusbandNameActive && <span className="text-red-500">*</span>}
              </label>
              <input 
                type="text" 
                name="husbandName" 
                disabled={!isHusbandNameActive}
                required={isHusbandNameActive}
                placeholder={!isHusbandNameActive ? "[BLOCKED - Father Line Enabled]" : "Enter husband name"} 
                value={!isHusbandNameActive ? "" : teacherForm.husbandName} 
                onChange={handleInputChange} 
                className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black disabled:bg-neutral-200/60 disabled:cursor-not-allowed font-semibold" 
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 pt-1">
            <label className="text-[#555555]">Residential Address Coordinates (Permanent / Current) <span className="text-red-500">*</span></label>
            <input type="text" name="address" required placeholder="Complete home mapping house number, block sector, landmark, state location pin" value={teacherForm.address} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-semibold" />
          </div>
        </div>

        {/* BLOCK PART 2: DYNAMIC REPEATER SYSTEM FOR WORK EXPERIENCES */}
        <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-2">
            <h4 className="text-[11px] uppercase tracking-wider text-[#555555] flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#1A1A1A]" /> 2. Prior Employment & Tenure History
            </h4>
            <button 
              type="button" 
              onClick={addExperienceBlock}
              className="flex items-center gap-1 bg-[#1A1A1A] text-[#E1FA6C] px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors text-[10px] font-black"
            >
              <Plus className="w-3.5 h-3.5" /> Add Experience Track
            </button>
          </div>

          <div className="space-y-3">
            {teacherForm.experience.map((exp, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[#EAEAEA]/30 p-4 rounded-2xl border border-[#EAEAEA]">
                <div className="md:col-span-5 flex flex-col gap-1">
                  <label className="text-[10px] text-[#555555] uppercase">Organization Name</label>
                  <input type="text" required placeholder="e.g. St. Anselms Sr. Sec School" value={exp.organization} onChange={(e) => handleExperienceChange(index, 'organization', e.target.value)} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none" />
                </div>
                <div className="md:col-span-4 flex flex-col gap-1">
                  <label className="text-[10px] text-[#555555] uppercase">Designation / Position</label>
                  <input type="text" required placeholder="e.g. PGT Mathematics Head" value={exp.position} onChange={(e) => handleExperienceChange(index, 'position', e.target.value)} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none" />
                </div>
                <div className="md:col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] text-[#555555] uppercase">Duration (Years)</label>
                  <input type="number" required min="0" placeholder="e.g. 4" value={exp.years} onChange={(e) => handleExperienceChange(index, 'years', e.target.value)} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none font-mono" />
                </div>
                <div className="md:col-span-1 flex justify-center">
                  <button 
                    type="button" 
                    disabled={teacherForm.experience.length === 1}
                    onClick={() => removeExperienceBlock(index)}
                    className="p-2.5 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BLOCK PART 3: REPEATER FOR CLASS ROOM SCHEDULING SUBJECT ASSIGNMENTS */}
        <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-2">
            <h4 className="text-[11px] uppercase tracking-wider text-[#555555] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#1A1A1A]" /> 3. Academic Room Allocation & Subject Assignment Map
            </h4>
            <button 
              type="button" 
              onClick={addAssignmentBlock}
              className="flex items-center gap-1 bg-[#1A1A1A] text-[#E1FA6C] px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors text-[10px] font-black"
            >
              <Plus className="w-3.5 h-3.5" /> Add Room Route
            </button>
          </div>

          <div className="space-y-3">
            {teacherForm.classAssignments.map((assign, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[#EAEAEA]/30 p-4 rounded-2xl border border-[#EAEAEA]">
                <div className="md:col-span-5 flex flex-col gap-1">
                  <label className="text-[10px] text-[#555555] uppercase">Target Class Bracket</label>
                  <select required value={assign.className} onChange={(e) => handleAssignmentChange(index, 'className', e.target.value)} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none">
                    <option value="">-- Choose Grade --</option>
                    {classNames.map((className) => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-6 flex flex-col gap-1">
                  <label className="text-[10px] text-[#555555] uppercase">Assigned Subject Domain</label>
                  <select required value={assign.subject} onChange={(e) => handleAssignmentChange(index, 'subject', e.target.value)} className="p-2.5 bg-white border border-[#C8C8C8] rounded-xl outline-none">
                    <option value="">-- Choose Subject --</option>
                    {[
                      ...(subjectsByClass[assign.className] || []).map((item) => item.subject),
                      ...globalSubjectNames,
                    ].filter((value, optionIndex, values) => value && values.indexOf(value) === optionIndex).map((subjectName) => (
                      <option key={subjectName} value={subjectName}>{subjectName}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1 flex justify-center">
                  <button 
                    type="button" 
                    disabled={teacherForm.classAssignments.length === 1}
                    onClick={() => removeAssignmentBlock(index)}
                    className="p-2.5 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BLOCK PART 4: OPERATIONAL RECRUITMENT LOGS & CLASS TEACHER DETECTOR */}
        <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="flex flex-col gap-1">
            <label className="text-[#555555]">Official Date of Joining (DOJ) <span className="text-red-500">*</span></label>
            <input type="date" name="dateOfJoining" required value={teacherForm.dateOfJoining} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[#555555]">Is Designated As Class Teacher? <span className="text-red-500">*</span></label>
            <select name="isClassTeacher" value={teacherForm.isClassTeacher} onChange={handleInputChange} className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black">
              <option value="No">No (Standard Room Domain Expert)</option>
              <option value="Yes">Yes (Master Grade Incharge)</option>
            </select>
          </div>

          {/* DYNAMIC DISCOVERY CONDITION BLOCK */}
          <div className="flex flex-col gap-1">
            <label className={`text-[#555555] ${teacherForm.isClassTeacher === 'No' ? 'opacity-30' : ''}`}>
              Select Autonomous Grade Charge Slot {teacherForm.isClassTeacher === 'Yes' && <span className="text-red-500">*</span>}
            </label>
            <select 
              name="assignedClassTeacherFor" 
              disabled={teacherForm.isClassTeacher === 'No'}
              required={teacherForm.isClassTeacher === 'Yes'}
              value={teacherForm.isClassTeacher === 'No' ? "" : teacherForm.assignedClassTeacherFor} 
              onChange={handleInputChange} 
              className="p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black disabled:bg-neutral-200/60 disabled:cursor-not-allowed"
            >
              <option value="">-- Choose Assigned Class --</option>
              {classNames.map((className) => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          </div>
        </div>

        {/* BLOCK PART 5: STANDARD DOCUMENT ASSETS VAULT TRACK */}
        <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] space-y-3">
          <h4 className="text-[11px] uppercase tracking-wider text-[#555555] flex items-center gap-1.5 border-b border-[#EAEAEA] pb-2">
            <FileText className="w-3.5 h-3.5 text-[#1A1A1A]" /> 4. Document Verification Pack Attachments
          </h4>
          <div className="relative">
            <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" />
            <div className="w-full py-6 bg-[#EAEAEA]/40 border border-dashed border-[#C8C8C8] rounded-2xl text-center font-medium text-[#555555] hover:border-black transition-all">
              <span>Click to map scanned assets packet copies (.PDF degree credentials, experience cards, verification slips)</span>
              {attachedFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 justify-center font-mono text-[10px]">
                  {attachedFiles.map((f, i) => (
                    <span key={i} className="bg-white border border-[#C8C8C8] text-[#1A1A1A] px-2 py-0.5 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON FOOTER CONTROL ACTION BAR */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button 
            type="submit" 
            className="px-8 py-3.5 bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 text-xs font-black rounded-full hover:bg-[#d4ee59] shadow-md transition-all uppercase tracking-wide"
          >
            Authorize Asset & Deploy Teacher
          </button>
        </div>

      </form>
    </div>
  );
};

export default TeacherAssignment;
