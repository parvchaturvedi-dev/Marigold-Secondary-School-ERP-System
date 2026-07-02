import React, { useState, useMemo, useRef } from 'react';
import { read, utils, writeFile } from '@e965/xlsx';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Search,
  SlidersHorizontal,
  Upload,
  Users,
} from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { useMasterData, sortClassNames } from '../../components/common/masterData';

const templateColumns = [
  'admissionNumber',
  'studentName',
  'gender',
  'dob',
  'category',
  'religion',
  'mobileNo',
  'altMobileNo',
  'email',
  'dateOfAdmission',
  'targetClass',
  'lastSchoolName',
  'studentAadhar',
  'penNumber',
  'fatherName',
  'motherName',
  'fatherAadhar',
  'motherAadhar',
  'guardianName',
  'guardianMobile',
  'tempAddress',
  'permAddress',
];

const sampleRows = [
  {
    admissionNumber: 'MGPS-2026-001',
    studentName: 'Aarav Sharma',
    gender: 'Male',
    dob: '2014-04-18',
    category: 'General',
    religion: 'Hindu',
    mobileNo: '9876543210',
    altMobileNo: '9876500000',
    email: 'aarav.parent@example.com',
    dateOfAdmission: '2026-04-01',
    targetClass: 'Class 6',
    lastSchoolName: 'Sunrise Public School',
    studentAadhar: '1234 5678 9012',
    penNumber: 'PEN123456',
    fatherName: 'Raj Sharma',
    motherName: 'Nisha Sharma',
    fatherAadhar: '2222 3333 4444',
    motherAadhar: '5555 6666 7777',
    guardianName: '',
    guardianMobile: '',
    tempAddress: 'Civil Lines, Jhansi',
    permAddress: 'Civil Lines, Jhansi',
  },
];

const normalizeCell = (value) => String(value || '').trim();
const normalizeAmount = (value) => {
  const amount = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
};

const buildStudentRecord = (row, selectedClassView) => {
  const admissionNumber = normalizeCell(row.admissionNumber || row['Admission Number']).toUpperCase();
  const studentName = normalizeCell(row.studentName || row.name || row['Student Name']);
  const targetClass = normalizeCell(row.targetClass || row.class || row.className || row['Target Class']) || selectedClassView;

  const rawProfile = {
    studentName,
    mobileNo: normalizeCell(row.mobileNo || row.mobile || row['Mobile Number']),
    altMobileNo: normalizeCell(row.altMobileNo || row['Alternative Mobile Number']),
    email: normalizeCell(row.email),
    gender: normalizeCell(row.gender),
    dob: normalizeCell(row.dob),
    category: normalizeCell(row.category),
    religion: normalizeCell(row.religion),
    tempAddress: normalizeCell(row.tempAddress || row['Temporary Address']),
    permAddress: normalizeCell(row.permAddress || row['Permanent Address']),
    admissionNumber,
    studentAadhar: normalizeCell(row.studentAadhar || row['Student Aadhaar']),
    fatherAadhar: normalizeCell(row.fatherAadhar || row['Father Aadhaar']),
    motherAadhar: normalizeCell(row.motherAadhar || row['Mother Aadhaar']),
    penNumber: normalizeCell(row.penNumber || row['PEN Number']),
    dateOfAdmission: normalizeCell(row.dateOfAdmission || row['Date Of Admission']),
    targetClass,
    lastSchoolName: normalizeCell(row.lastSchoolName || row['Last School Name']),
    fatherName: normalizeCell(row.fatherName || row['Father Name']),
    motherName: normalizeCell(row.motherName || row['Mother Name']),
    livingWith: normalizeCell(row.livingWith) || 'Parents',
    guardianName: normalizeCell(row.guardianName || row['Guardian Name']),
    guardianMobile: normalizeCell(row.guardianMobile || row['Guardian Mobile']),
    guardianAadhar: normalizeCell(row.guardianAadhar || row['Guardian Aadhaar']),
    uploadedFiles: {},
    documents: [],
    importedFrom: 'bulk-excel',
    importedAt: new Date().toISOString(),
  };

  return {
    admissionNumber,
    id: admissionNumber,
    displayName: studentName,
    name: studentName,
    className: targetClass,
    class: targetClass,
    section: rawProfile.section || '',
    rollNo: rawProfile.rollNo || '',
    gender: rawProfile.gender,
    category: rawProfile.category,
    lastSchoolName: rawProfile.lastSchoolName,
    mobile: rawProfile.mobileNo,
    email: rawProfile.email,
    fatherName: rawProfile.fatherName,
    motherName: rawProfile.motherName,
    guardianName: rawProfile.guardianName,
    guardianPhone: rawProfile.guardianMobile || rawProfile.mobileNo,
    guardianEmail: rawProfile.email,
    address: rawProfile.permAddress || rawProfile.tempAddress,
    paidFees: normalizeAmount(row.paidFees || row.collectedFees || row.feesPaid),
    pendingFees: normalizeAmount(row.pendingFees || row.feePending || row.balanceFees || row.unpaidFees),
    yearlyFee: normalizeAmount(row.yearlyFee || row.annualFee || row.totalFees || row.assignedFees),
    status: 'Active',
    documents: [],
    rawProfile,
  };
};

const StudentManagement = ({ setActivePage }) => {
  // Phase 1 Context: Track selected class card
  const [selectedClassView, setSelectedClassView] = useState(null);

  // Active Structural Pool
  const [classCards] = useMongoState('admin-student-management-class-cards', []);
  const [managedClasses] = useMongoState('admin-class-management-classes', []);
  const { classes: derivedClasses, classNames } = useMasterData();

  // Updated Roster Pool matching Student Assigning parameters exactly
  const [studentsDb, setStudentsDb] = useMongoState('admin-student-management-students', []);
  const bulkFileInputRef = useRef(null);

  // Operational Filters State Layout
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // Alphabetical toggler state

  // ----------------------------------------------------
  // ENGINE AUTOMATION: ALPHABETICAL MULTI-SORT CALCULATOR
  // ----------------------------------------------------
  const processedStudentsRoster = useMemo(() => {
    if (!selectedClassView) return [];

    // Step 1: Filter array subset by class context allocation
    let filteredList = studentsDb.filter(student => student.class === selectedClassView);

    // Step 2: Strictly enforce absolute Alphabetical calculation priority bounds
    filteredList.sort((a, b) => {
      const nameA = a.name.trim().toLowerCase();
      const nameB = b.name.trim().toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    // Step 3: Run structural iteration map to overlay fresh index positions as Roll Numbers
    const autoRollAssignedList = filteredList.map((student, index) => ({
      ...student,
      rollNo: index + 1
    }));

    // Step 4: Run top search query & configuration modifiers over final output
    return autoRollAssignedList.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGender = genderFilter ? student.gender === genderFilter : true;
      const matchesCategory = categoryFilter ? student.category === categoryFilter : true;
      return matchesSearch && matchesGender && matchesCategory;
    });
  }, [selectedClassView, studentsDb, searchTerm, genderFilter, categoryFilter, sortOrder]);

  const displayedClassCards = useMemo(() => {
    if (derivedClasses.length > 0) return derivedClasses;
    if (classCards.length > 0) {
      const orderedClassNames = sortClassNames(classCards.map((item) => item.name), classNames);
      return orderedClassNames.map((name) => classCards.find((item) => item.name === name)).filter(Boolean);
    }
    if (managedClasses.length > 0) {
      const orderedClassNames = sortClassNames(managedClasses.map((item) => item.name), classNames);
      return orderedClassNames.map((name) => managedClasses.find((item) => item.name === name)).filter(Boolean);
    }

    return sortClassNames(studentsDb.map((student) => student.class), classNames).map((className) => ({
      id: className,
      name: className,
    }));
  }, [classCards, classNames, derivedClasses, managedClasses, studentsDb]);

  const downloadSampleWorkbook = () => {
    const sheet = utils.json_to_sheet(sampleRows, { header: templateColumns });
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, 'Students');
    writeFile(workbook, 'mgps-student-bulk-import-template.xlsx');
  };

  const handleBulkImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: 'array', cellDates: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = utils.sheet_to_json(firstSheet, { defval: '' });

      if (rows.length === 0) {
        alert('Selected Excel sheet is empty. Please use the sample template columns.');
        return;
      }

      const validStudents = [];
      const skippedRows = [];

      rows.forEach((row, index) => {
        const student = buildStudentRecord(row, selectedClassView);
        if (!student.admissionNumber || !student.name || !student.class) {
          skippedRows.push(index + 2);
          return;
        }
        validStudents.push(student);
      });

      if (validStudents.length === 0) {
        alert('No valid students found. Admission number, student name, and class are required.');
        return;
      }

      setStudentsDb((students) => {
        const incomingIds = new Set(validStudents.map((student) => student.admissionNumber));
        return [
          ...validStudents,
          ...students.filter((student) => !incomingIds.has(student.admissionNumber)),
        ];
      });

      alert(
        `Bulk import complete.\nAdded/updated: ${validStudents.length} students${
          skippedRows.length ? `\nSkipped rows: ${skippedRows.join(', ')}` : ''
        }\n\nDocuments can be uploaded later from each student's profile > Document Vault.`
      );
    } catch (error) {
      alert(`Could not read this Excel file. Please use .xlsx/.xls format.\n\n${error.message}`);
    }
  };

  // SAFE NATIVE ROUTING FLOW (Fixes Hook Invalid Crash)
  const handleProfileNavigation = (admissionNumber) => {
    localStorage.setItem('mgps_selected_student_profile', admissionNumber);
    if (typeof setActivePage === 'function') {
      setActivePage('Student Profile');
    }
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">

      {/* HEADER CONTROLS BANNER PANEL */}
      <div className="glass-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-900" /> Student Management Console
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {selectedClassView
              ? `Live dynamic roster indices for ${selectedClassView}. Alphabetically calculated.`
              : "Access the class cards below to audit metrics, filters, and records."
            }
          </p>
        </div>

        {selectedClassView && (
          <button
            onClick={() => {
              setSelectedClassView(null);
              setSearchTerm('');
              setGenderFilter('');
              setCategoryFilter('');
            }}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-black transition-colors px-4 py-2.5 bg-white/50 border border-slate-200/70 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" /> Switch Class Matrix
          </button>
        )}
      </div>

      {/* VIEW PANEL 1: CLASS SELECTION BRACKETS */}
      {!selectedClassView ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {displayedClassCards.map((cls) => {
            const currentCount = studentsDb.filter(s => s.class === cls.name).length;
            return (
              <div
                key={cls.name}
                onClick={() => setSelectedClassView(cls.name)}
                className="glass-card glass-hover rounded-3xl p-5 flex flex-col justify-between group hover:border-indigo-300/70 transition-all cursor-pointer min-h-[130px]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-9 rounded-xl bg-indigo-50/60 text-slate-900 flex items-center justify-center font-bold text-sm border border-white/70">
                    {cls.name.replace(/\D/g, "") || cls.name.charAt(0)}
                  </div>
                  <span className="text-sm font-bold text-slate-900 group-hover:text-black transition-colors">{cls.name}</span>
                </div>

                <div className="text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-100/80 mt-4 flex justify-between items-center">
                  <span>Active Strength:</span>
                  <span className="bg-indigo-100 text-indigo-700 border-indigo-200 px-2 py-0.5 rounded font-mono border">
                    {currentCount} Students
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        
        // VIEW PANEL 2: INTEGRATED TABLE CONTROL DATA SYSTEM
        <div className="space-y-4 animate-fadeIn">
          
          {/* SEARCH METADATA MODIFIERS TOOLBAR */}
          <div className="glass-card p-4 rounded-3xl flex flex-wrap items-center justify-between gap-3 text-xs font-bold">

            <div className="flex items-center gap-2 bg-white/60 border border-white/80 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 outline-none transition-all px-3 py-2 rounded-xl w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search Name or Admission Number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-xs text-slate-900 font-medium placeholder-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={downloadSampleWorkbook}
                className="flex items-center gap-1.5 bg-white/60 hover:bg-white/70 transition-all px-3 py-1.5 rounded-xl border border-slate-200/70"
                title="Download sample Excel template"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample Excel</span>
              </button>

              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className="btn-primary flex items-center gap-1.5 transition-all px-3 py-1.5 rounded-xl"
                title="Add students in bulk from Excel"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Add Students in Bulk</span>
              </button>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBulkImport}
                className="hidden"
              />

              <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1.5 rounded-xl border border-slate-200/70">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="bg-transparent outline-none border-none text-slate-900 cursor-pointer">
                  <option value="">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1.5 rounded-xl border border-slate-200/70">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-transparent outline-none border-none text-slate-900 cursor-pointer">
                  <option value="">All Categories</option>
                  <option value="General">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                </select>
              </div>

              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1.5 bg-white/50 hover:bg-slate-900 hover:text-white transition-all px-3 py-1.5 rounded-xl border border-slate-200/70"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
              </button>
            </div>
          </div>

          {/* MAIN ROSTER TRACK SHEET */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-indigo-400 inline-block rounded-xs"></span>
                Live Grade Roster Record Data
              </h4>
              <span className="text-[10px] bg-indigo-50/60 px-2.5 py-1 rounded-md font-bold font-mono">
                MATCHES: {processedStudentsRoster.length}
              </span>
            </div>

            <div className="glass-soft rounded-2xl p-3 text-[11px] font-bold text-slate-500 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
              <span>
                Bulk Excel import creates student records without document files. Open any student's workspace profile and use Document Vault to upload, replace, and save files.
              </span>
            </div>

            {processedStudentsRoster.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-medium">
                No active records matching standard filter conditions inside {selectedClassView}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead>
                    <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100/80">
                      <th className="pb-3 pl-2 text-center w-20">Roll No</th>
                      <th className="pb-3">Admission Number</th>
                      <th className="pb-3">Student Full Name</th>
                      <th className="pb-3 text-center w-24">Gender</th>
                      <th className="pb-3 text-center w-28">Category</th>
                      <th className="pb-3">Last School Name</th>
                      <th className="pb-3">Contact Connection</th>
                      <th className="pb-3 text-right pr-2">Action Node</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-bold text-slate-900">
                    {processedStudentsRoster.map((st) => (
                      <tr key={st.admissionNumber} className="hover:bg-white/70 transition-colors">

                        {/* 1. ROLL NUMBER CELL */}
                        <td className="py-3.5 text-center">
                          <span className="w-7 h-6 rounded-md bg-indigo-50/60 text-slate-900 inline-flex items-center justify-center font-mono font-black text-[11px] border border-white/70">
                            {st.rollNo}
                          </span>
                        </td>

                        {/* 2. ADMISSION NUMBER CELL */}
                        <td className="py-3.5 font-mono text-xs uppercase tracking-wide text-slate-900">{st.admissionNumber}</td>

                        {/* 3. NAME CELL */}
                        <td className="py-3.5 text-sm font-black text-slate-900">{st.name}</td>

                        {/* 4. GENDER CELL */}
                        <td className="py-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] ${st.gender === 'Female' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}`}>
                            {st.gender}
                          </span>
                        </td>
                        
                        {/* 5. CATEGORY CELL */}
                        <td className="py-3.5 text-center text-slate-500">{st.category}</td>

                        {/* 6. LAST SCHOOL NAME CELL */}
                        <td className="py-3.5 text-slate-500 font-medium">{st.lastSchoolName || 'N/A'}</td>

                        {/* 7. CONTACT CELL */}
                        <td className="py-3.5 font-mono text-slate-500">{st.mobile}</td>

                        {/* 8. WORKSPACE NAVIGATION ANCHOR */}
                        <td className="py-3.5 text-right pr-2">
                          <button
                            onClick={() => handleProfileNavigation(st.admissionNumber)}
                            className="btn-primary px-4 py-1.5 rounded-full text-[10px] font-black tracking-wide transition-all inline-flex items-center gap-1.5"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" /> View Workspace Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

export default StudentManagement;
