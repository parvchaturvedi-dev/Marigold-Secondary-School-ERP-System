import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  ArrowUpDown, 
  Eye, 
  SlidersHorizontal,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';

const ClassFinanceList = () => {
  // 1. EXTRACT CURRENT CLASS METADATA FROM URL QUERY PARAMETERS
  const urlParams = new URLSearchParams(window.location.search);
  const currentClassId = urlParams.get('classId') || '';
  const currentClassName = urlParams.get('name') || 'Selected Class';

  // State Management hooks for search, filter & sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('none'); // 'none' | 'high-to-low' | 'low-to-high'

  const [studentRecords] = useMongoState('admin-student-management-students', []);
  const studentsData = studentRecords
    .filter((student) => !currentClassId || student.class === currentClassName || student.className === currentClassName)
    .map((student) => ({
      admNo: student.admissionNumber || student.id || '',
      name: student.name || student.displayName || '',
      fatherName: student.fatherName || '',
      contact: student.mobile || student.mobileNo || student.guardianPhone || '',
      paidFees: String(student.paidFees || 0),
      pendingFees: Number(student.pendingFees) || 0,
    }));

  // BACK NAVIGATION HANDLER TO MAIN FINANCE SCREEN
  const handleBackNavigation = () => {
    window.location.href = '/admin/finance';
  };

  // 3. SEARCH AND SORT PROCESSING MATRIX
  const processedStudents = studentsData
    .filter(student => {
      const matchQuery = searchTerm.toLowerCase();
      return (
        student.name.toLowerCase().includes(matchQuery) ||
        student.admNo.toLowerCase().includes(matchQuery) ||
        student.fatherName.toLowerCase().includes(matchQuery)
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'high-to-low') return b.pendingFees - a.pendingFees;
      if (sortOrder === 'low-to-high') return a.pendingFees - b.pendingFees;
      return 0;
    });

  return (
    <div className="w-full min-h-screen bg-[#D9D9D9] p-6 text-neutral-800 font-sans box-border select-none">
      
      {/* SUB-HEADER COMPONENT BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="p-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl transition-all shadow-sm group"
            title="Return to Financial Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-700 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2 text-neutral-900">
              {currentClassName} Ledger Feed <Sparkles className="w-4 h-4 text-neutral-600" />
            </h2>
            <p className="text-xs text-neutral-600 font-medium font-mono mt-0.5">STUDENT REGISTRY CONTROLS</p>
          </div>
        </div>

        {/* CONTROLS HUB: LIVE SEARCH + SORT DRILL DOWN */}
        <div className="flex flex-wrap items-center gap-2">
          {/* SEARCH FIELD TRANSITION SLOT */}
          <div className="relative bg-white rounded-xl border border-neutral-300 shadow-sm flex items-center px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Adm No, Name, Father's Name..."
              className="bg-transparent text-xs text-neutral-800 placeholder-neutral-400 outline-none w-full font-medium"
            />
          </div>

          {/* DYNAMIC SORT ACTION ACCELERATOR */}
          <button
            type="button"
            onClick={() => {
              if (sortOrder === 'none' || sortOrder === 'low-to-high') setSortOrder('high-to-low');
              else if (sortOrder === 'high-to-low') setSortOrder('low-to-high');
            }}
            className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-2.5 rounded-xl border transition-all shadow-sm ${sortOrder !== 'none' ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" /> 
            Sort Due: {sortOrder === 'high-to-low' ? 'High-Low' : sortOrder === 'low-to-high' ? 'Low-High' : 'Default'}
          </button>
        </div>
      </div>

      {/* RENDER SYSTEM DISPLAY DATA REGISTRY BOX */}
      <div className="w-full bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden box-border">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            
            {/* CORE LEDGER HEADER FIELDS DESCRIPTION MAP */}
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-black uppercase tracking-wider text-neutral-500 font-mono">
                <th className="py-3 px-4">Adm. Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Father's Name</th>
                <th className="py-3 px-4">Contact Link</th>
                <th className="py-3 px-4 text-right">Paid Fees</th>
                <th className="py-3 px-4 text-right">Pending Fees</th>
                <th className="py-3 px-4 text-center">Action Matrix</th>
              </tr>
            </thead>

            {/* LIVE DYNAMIC DATA ROW GENERATORS */}
            <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-800">
              {processedStudents.length > 0 ? (
                processedStudents.map((student) => (
                  <tr 
                    key={student.admNo}
                    className="hover:bg-neutral-50/60 transition-colors duration-150"
                  >
                    {/* Admission Casing Identifier */}
                    <td className="py-3.5 px-4 font-mono font-bold text-neutral-600">
                      {student.admNo}
                    </td>
                    
                    {/* Student Core Title Identifications */}
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-neutral-100 border border-neutral-200 rounded-md flex items-center justify-center text-neutral-600 flex-shrink-0">
                          <GraduationCap className="w-3.5 h-3.5" />
                        </div>
                        {student.name}
                      </div>
                    </td>

                    {/* Parents Registry Node Line */}
                    <td className="py-3.5 px-4 text-neutral-600">
                      {student.fatherName}
                    </td>

                    {/* Communication Link Gateway Node */}
                    <td className="py-3.5 px-4 font-mono text-neutral-500">
                      {student.contact}
                    </td>

                    {/* Total Volume Collected Financial String */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {student.paidFees}
                    </td>

                    {/* Pending Unpaid Delinquent Status Flag */}
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${student.pendingFees > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                      ₹{student.pendingFees.toLocaleString()}
                    </td>

                    {/* DYNAMIC NAVIGATION ROUTER CONTROLLER */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          // Structural Pure Decoupled URL Redirection passing parameters directly to StudentLedger page
                          window.location.href = `/admin/student-ledger?admNo=${student.admNo}&name=${encodeURIComponent(student.name)}`;
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-800 text-neutral-700 hover:text-white border border-neutral-300 hover:border-neutral-800 px-3 py-1.5 rounded-xl transition-all shadow-xs"
                      >
                        <Eye className="w-3 h-3" /> View Ledger
                      </button>
                    </td>

                  </tr>
                ))
              ) : (
                // BLANK MATRIX TERMINAL ERROR EXCEPTIONS
                <tr>
                  <td colSpan="7" className="py-10 text-center font-mono text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    ⚠️ No financial records matched the specified search parameter criteria.
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>
      </div>

    </div>
  );
};

export default ClassFinanceList;
