import React, { useState } from 'react';
import { UserPlus, Upload } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { useMasterData } from '../../components/common/masterData';

const StudentAssigning = () => {
  const { classNames: activeClasses } = useMasterData();
  
  // Dynamic Document Checklists pulled from Admin Documents Matrix
  const [roleDocuments] = useMongoState('admin-document-requirements', { Student: [] });
  const dynamicAdminDocs = roleDocuments.Student || [];
  const [studentsDb, setStudentsDb] = useMongoState('admin-student-management-students', []);
  // Also read the alumni-pending bucket so a passed-out student's admission
  // number is treated as "already used" and can't be silently re-assigned.
  const [alumniPending] = useMongoState('admin-finance-alumni-pending', []);

  // Comprehensive Form State Bucket
  const [studentForm, setStudentForm] = useState({
    // Personal Details
    studentName: '',
    mobileNo: '',
    altMobileNo: '',
    email: '',
    gender: '',
    dob: '',
    category: '',
    religion: '',
    tempAddress: '',
    permAddress: '',
    isSameAddress: false,

    // Identity & Institutional (Admission Number is the Primary Manual Key)
    admissionNumber: '', 
    studentAadhar: '',
    fatherAadhar: '',
    motherAadhar: '',
    penNumber: '', 
    dateOfAdmission: '',
    targetClass: '',
    lastSchoolName: '',

    // Family Structure
    fatherName: '',
    motherName: '',
    livingWith: 'Parents', // Options: Parents / Guardian
    guardianName: '',
    guardianMobile: '',
    guardianAadhar: '',

    // Dynamic Document File Storage Tracker
    uploadedFiles: {}
  });

  // Handle Temporary to Permanent Address Mirroring
  const handleAddressCheckbox = (e) => {
    const checked = e.target.checked;
    setStudentForm(prev => ({
      ...prev,
      isSameAddress: checked,
      permAddress: checked ? prev.tempAddress : ''
    }));
  };

  // Generic Input Tracker
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setStudentForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle Dynamic File Attachments
  const handleFileChange = (docName, fileName) => {
    setStudentForm(prev => ({
      ...prev,
      uploadedFiles: { ...prev.uploadedFiles, [docName]: fileName }
    }));
  };

  // Form Submission Engine
  const handleSubmitAdmission = (e) => {
    e.preventDefault();

    if (!studentForm.targetClass) {
      alert('Please allocate an active target class!');
      return;
    }

    // DUPLICATE ADMISSION NUMBER GUARD: reject if this admission number is already in use
    const normalizedAdmissionNumber = studentForm.admissionNumber.trim().toUpperCase();
    const isDuplicateAdmission = studentsDb.some(
      (student) =>
        (student.admissionNumber || student.id || '').trim().toUpperCase() === normalizedAdmissionNumber
    );
    const isAlumniAdmission = (Array.isArray(alumniPending) ? alumniPending : []).some(
      (student) =>
        (student.admissionNumber || student.id || '').trim().toUpperCase() === normalizedAdmissionNumber
    );
    if (isDuplicateAdmission || isAlumniAdmission) {
      alert(`Admission Number "${normalizedAdmissionNumber}" is already in use${isAlumniAdmission ? ' (alumni bucket)' : ''}. Please enter a unique one.`);
      return;
    }

    // Processing Final Payload with Manual Admission Number as main Unique Identifier
    const submissionPayload = {
      ...studentForm,
      id: normalizedAdmissionNumber, // Primary Key is now exactly the Manual Admission Number
      documents: Object.entries(studentForm.uploadedFiles)
        .filter(([, file]) => file)
        .map(([name, file]) => ({
          name,
          file,
          status: 'Pending',
          uploadedAt: new Date().toISOString(),
        })),
      timestamp: new Date().toISOString()
    };

    setStudentsDb((students) => [
      {
        admissionNumber: submissionPayload.id,
        id: submissionPayload.id,
        displayName: submissionPayload.studentName,
        name: submissionPayload.studentName,
        className: submissionPayload.targetClass,
        class: submissionPayload.targetClass,
        section: submissionPayload.section || '',
        rollNo: submissionPayload.rollNo || '',
        gender: submissionPayload.gender,
        category: submissionPayload.category,
        lastSchoolName: submissionPayload.lastSchoolName,
        mobile: submissionPayload.mobileNo,
        email: submissionPayload.email,
        fatherName: submissionPayload.fatherName,
        motherName: submissionPayload.motherName,
        guardianName: submissionPayload.guardianName,
        guardianPhone: submissionPayload.guardianMobile || submissionPayload.mobileNo,
        guardianEmail: submissionPayload.email,
        address: submissionPayload.permAddress || submissionPayload.tempAddress,
        paidFees: Number(submissionPayload.paidFees || 0),
        pendingFees: Number(submissionPayload.pendingFees || 0),
        yearlyFee: Number(submissionPayload.yearlyFee || submissionPayload.paidFees || 0) +
          Number(submissionPayload.pendingFees || 0),
        status: 'Active',
        documents: submissionPayload.documents,
        rawProfile: submissionPayload,
      },
      ...students.filter((student) => student.admissionNumber !== submissionPayload.id),
    ]);
    alert(`Admission Form Processed Successfully!\nAdmission Number registered as main ID: ${submissionPayload.id}\n\nAuto-Sorting Alphabetical Engine will recalculate roll numbers dynamically inside Student Management.`);

    setStudentForm({
      studentName: '',
      mobileNo: '',
      altMobileNo: '',
      email: '',
      gender: '',
      dob: '',
      category: '',
      religion: '',
      tempAddress: '',
      permAddress: '',
      isSameAddress: false,
      admissionNumber: '',
      studentAadhar: '',
      fatherAadhar: '',
      motherAadhar: '',
      penNumber: '',
      dateOfAdmission: '',
      targetClass: '',
      lastSchoolName: '',
      fatherName: '',
      motherName: '',
      livingWith: 'Parents',
      guardianName: '',
      guardianMobile: '',
      guardianAadhar: '',
      uploadedFiles: {},
    });
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">
      
      {/* HEADER BANNER */}
      <div className="glass-card p-6 rounded-3xl mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-slate-900" /> Student Admission Desk & Assigning
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Register new student profiles. The manually entered Admission Number will act as the student's unique primary identifier across the system.
        </p>
      </div>

      {/* MAIN REGISTRATION FORM */}
      <form onSubmit={handleSubmitAdmission} className="space-y-6">
        
        {/* SECTION 1: PERSONAL DETAILS */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <h4 className="text-sm font-black border-b border-slate-100/80 pb-2 text-slate-900 tracking-wide flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-indigo-400 inline-block rounded-xs"></span> Personal Details
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Student Full Name <span className="text-red-500">*</span></label>
              <input type="text" name="studentName" required placeholder="e.g. Parv Choudhary" value={studentForm.studentName} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Mobile Number <span className="text-red-500">*</span></label>
              <input type="tel" name="mobileNo" required maxLength="10" placeholder="10 Digit Number" value={studentForm.mobileNo} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Alternative Mobile Number</label>
              <input type="tel" name="altMobileNo" maxLength="10" placeholder="Emergency Backup Contact" value={studentForm.altMobileNo} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Email Address</label>
              <input type="email" name="email" placeholder="student@domain.com" value={studentForm.email} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Gender <span className="text-red-500">*</span></label>
              <select name="gender" required value={studentForm.gender} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-bold">
                <option value="">-- Select Gender --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Date of Birth (DOB) <span className="text-red-500">*</span></label>
              <input type="date" name="dob" required value={studentForm.dob} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-bold text-slate-900" />
            </div>
          </div>

          {/* ADDRESS CONFIGURATION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Temporary Address <span className="text-red-500">*</span></label>
              <textarea name="tempAddress" required rows="2" placeholder="Current residential address..." value={studentForm.tempAddress} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl resize-none" />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-500">Permanent Address <span className="text-red-500">*</span></label>
                <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-900 font-bold select-none">
                  <input type="checkbox" checked={studentForm.isSameAddress} onChange={handleAddressCheckbox} className="rounded accent-indigo-500" /> Same as Temporary
                </label>
              </div>
              <textarea name="permAddress" required disabled={studentForm.isSameAddress} rows="2" placeholder="Permanent home address..." value={studentForm.permAddress} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl resize-none disabled:opacity-60" />
            </div>
          </div>
        </div>

        {/* SECTION 2: RELIGION, CATEGORY & GOVERNMENT IDENTITIES */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <h4 className="text-sm font-black border-b border-slate-100/80 pb-2 text-slate-900 tracking-wide flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-indigo-400 inline-block rounded-xs"></span> Religion & Category
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Category Bracket <span className="text-red-500">*</span></label>
              <select name="category" required value={studentForm.category} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-bold">
                <option value="">-- Choose Category --</option>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Religion <span className="text-red-500">*</span></label>
              <input type="text" name="religion" required placeholder="e.g. Hinduism, Islam, Sikhism" value={studentForm.religion} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Student Aadhaar ID <span className="text-red-500">*</span></label>
              <input type="text" name="studentAadhar" required placeholder="XXXX XXXX XXXX" value={studentForm.studentAadhar} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-mono" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Student PEN Identifier <span className="text-gray-400 font-normal">(Optional)</span></label>
              <input type="text" name="penNumber" placeholder="Permanent Education No." value={studentForm.penNumber} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl uppercase font-mono" />
            </div>
          </div>
        </div>

        {/* SECTION 3: ADMISSION & INSTITUTIONAL SETUP (MANUAL ADMISSION NUMBER) */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <h4 className="text-sm font-black border-b border-slate-100/80 pb-2 text-slate-900 tracking-wide flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-indigo-400 inline-block rounded-xs"></span> Admission Details
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold">
            {/* MANUAL ADMISSION NUMBER INPUT FIELD */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-900 font-bold">Admission Number (Unique ID) <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="admissionNumber" 
                required 
                placeholder="Enter Manually (e.g. MGPS-2026-041)" 
                value={studentForm.admissionNumber} 
                onChange={handleInputChange} 
                className="w-full p-3 bg-white/70 border-2 border-indigo-400 rounded-xl outline-none font-mono font-bold tracking-wide uppercase focus:ring-4 focus:ring-indigo-100 transition-all" 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Allocate Core Class <span className="text-red-500">*</span></label>
              <select name="targetClass" required value={studentForm.targetClass} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-bold">
                <option value="">-- Allocate Class Bracket --</option>
                {activeClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Date of Admission <span className="text-red-500">*</span></label>
              <input type="date" name="dateOfAdmission" required value={studentForm.dateOfAdmission} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-bold text-slate-900" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Last School Name</label>
              <input type="text" name="lastSchoolName" placeholder="Previous Qualification Institute" value={studentForm.lastSchoolName} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>
          </div>
        </div>

        {/* SECTION 4: HOUSEHOLD PARENT & GUARDIAN CONFIGURATION */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100/80 pb-2">
            <h4 className="text-sm font-black text-slate-900 tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-indigo-400 inline-block rounded-xs"></span> Parent Details
            </h4>
            
            {/* LIVING WITH TOGGLE SWITCH */}
            <div className="flex items-center gap-3 bg-white/50 p-1 rounded-xl border border-slate-200/70 text-xs font-bold">
              <button type="button" onClick={() => setStudentForm(prev => ({ ...prev, livingWith: 'Parents' }))} className={`px-3 py-1 rounded-lg transition-all ${studentForm.livingWith === 'Parents' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-xs' : 'text-slate-500'}`}>With Parents</button>
              <button type="button" onClick={() => setStudentForm(prev => ({ ...prev, livingWith: 'Guardian' }))} className={`px-3 py-1 rounded-lg transition-all ${studentForm.livingWith === 'Guardian' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-xs' : 'text-slate-500'}`}>With Guardian</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Father's Name <span className="text-red-500">*</span></label>
              <input type="text" name="fatherName" required placeholder="Father Full Name" value={studentForm.fatherName} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Mother's Name <span className="text-red-500">*</span></label>
              <input type="text" name="motherName" required placeholder="Mother Full Name" value={studentForm.motherName} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Father Aadhaar ID <span className="text-red-500">*</span></label>
              <input type="text" name="fatherAadhar" required placeholder="XXXX XXXX XXXX" value={studentForm.fatherAadhar} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-mono" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Mother Aadhaar ID <span className="text-red-500">*</span></label>
              <input type="text" name="motherAadhar" required placeholder="XXXX XXXX XXXX" value={studentForm.motherAadhar} onChange={handleInputChange} className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl font-mono" />
            </div>
          </div>

          {/* DYNAMIC GUARDIAN MATRIX PANELS */}
          {studentForm.livingWith === 'Guardian' && (
            <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold animate-fadeIn mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-amber-900">Guardian Name <span className="text-red-500">*</span></label>
                <input type="text" name="guardianName" required={studentForm.livingWith === 'Guardian'} placeholder="Guardian Full Name" value={studentForm.guardianName} onChange={handleInputChange} className="w-full p-3 bg-white border border-amber-300 rounded-xl outline-none focus:border-amber-600 text-slate-900" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-amber-900">Guardian Mobile <span className="text-red-500">*</span></label>
                <input type="tel" name="guardianMobile" required={studentForm.livingWith === 'Guardian'} maxLength="10" placeholder="Primary Phone" value={studentForm.guardianMobile} onChange={handleInputChange} className="w-full p-3 bg-white border border-amber-300 rounded-xl outline-none focus:border-amber-600 text-slate-900" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-amber-900">Guardian Aadhaar ID <span className="text-red-500">*</span></label>
                <input type="text" name="guardianAadhar" required={studentForm.livingWith === 'Guardian'} placeholder="XXXX XXXX XXXX" value={studentForm.guardianAadhar} onChange={handleInputChange} className="w-full p-3 bg-white border border-amber-300 rounded-xl outline-none focus:border-amber-600 font-mono text-slate-900" />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: DYNAMIC DOCUMENTS UPLOADER */}
        <div className="glass-card p-6 rounded-3xl space-y-4">
          <h4 className="text-sm font-black border-b border-slate-100/80 pb-2 text-slate-900 tracking-wide flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-indigo-400 inline-block rounded-xs"></span> Required Documents Vault
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dynamicAdminDocs.map((doc, index) => (
              <div key={index} className="p-4 glass-soft rounded-2xl flex flex-col justify-between gap-3 text-xs font-semibold">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Field Check #{index+1}</span>
                  <label className="text-slate-900 font-black mt-0.5 block">{doc} <span className="text-red-500">*</span></label>
                </div>

                <div className="relative">
                  <input 
                    type="file" 
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => handleFileChange(doc, e.target.files[0]?.name || '')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <div className="w-full p-3 bg-white/60 border border-slate-200/70 border-dashed rounded-xl flex items-center justify-center gap-2 hover:border-indigo-400 transition-all">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                      {studentForm.uploadedFiles[doc] || 'Upload File (.PDF, .JPG)'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ACTION CONTROLS */}
        <div className="flex items-center justify-end gap-3 glass-card p-4 rounded-3xl">
          <button type="reset" onClick={() => window.location.reload()} className="px-6 py-2.5 bg-white/50 border border-slate-200/70 text-slate-500 hover:text-black font-bold text-xs rounded-full transition-all">
            Reset Form
          </button>
          <button type="submit" className="px-8 py-2.5 font-black text-xs rounded-full shadow-md transition-all btn-primary">
            Submit & Onboard Student
          </button>
        </div>

      </form>
    </div>
  );
};

export default StudentAssigning;
