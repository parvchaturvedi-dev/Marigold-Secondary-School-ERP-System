import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Search,
  ArrowUpDown,
  Eye,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { useMasterData } from '../../components/common/masterData';
import { formatCurrency, normalizeFinanceStudent } from '../../components/common/financeData';

const ClassFinanceList = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const currentClassName = urlParams.get('name') || 'Selected Class';
  const masterData = useMasterData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('none');

  const processedStudents = useMemo(() => {
    const matchQuery = searchTerm.trim().toLowerCase();
    return masterData.raw.students
      .map(normalizeFinanceStudent)
      .filter((student) => student.className === currentClassName)
      .filter((student) => {
        const haystack = [student.name, student.admissionNumber, student.fatherName, student.guardianPhone]
          .join(' ')
          .toLowerCase();
        return !matchQuery || haystack.includes(matchQuery);
      })
      .sort((a, b) => {
        if (sortOrder === 'high-to-low') return b.pendingFees - a.pendingFees;
        if (sortOrder === 'low-to-high') return a.pendingFees - b.pendingFees;
        return a.name.localeCompare(b.name);
      });
  }, [currentClassName, masterData.raw.students, searchTerm, sortOrder]);

  return (
    <div className="w-full min-h-screen bg-[#D9D9D9] p-6 text-neutral-800 font-sans box-border select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl transition-all shadow-sm group"
            title="Return to Financial Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-700 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2 text-neutral-900">
              {currentClassName} Ledger Feed <Sparkles className="w-4 h-4 text-neutral-600" />
            </h2>
            <p className="text-xs text-neutral-600 font-medium font-mono mt-0.5">
              Synced with Student Management fee records
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative bg-white rounded-xl border border-neutral-300 shadow-sm flex items-center px-3 py-1.5 w-full sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Adm No, Name, Father's Name..."
              className="bg-transparent text-xs text-neutral-800 placeholder-neutral-400 outline-none w-full font-medium"
            />
          </div>

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

      <div className="w-full bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden box-border">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-black uppercase tracking-wider text-neutral-500 font-mono">
                <th className="py-3 px-4">Adm. Number</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Father's Name</th>
                <th className="py-3 px-4">Contact Link</th>
                <th className="py-3 px-4 text-right">Total Fees</th>
                <th className="py-3 px-4 text-right">Paid Fees</th>
                <th className="py-3 px-4 text-right">Pending Fees</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-800">
              {processedStudents.length > 0 ? (
                processedStudents.map((student) => (
                  <tr key={student.admissionNumber} className="hover:bg-neutral-50/60 transition-colors duration-150">
                    <td className="py-3.5 px-4 font-mono font-bold text-neutral-600">{student.admissionNumber}</td>
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-neutral-100 border border-neutral-200 rounded-md flex items-center justify-center text-neutral-600 flex-shrink-0">
                          <GraduationCap className="w-3.5 h-3.5" />
                        </div>
                        {student.name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-neutral-600">{student.fatherName || '-'}</td>
                    <td className="py-3.5 px-4 font-mono text-neutral-500">{student.guardianPhone || '-'}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-800">
                      {formatCurrency(student.yearlyFee)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(student.paidFees)}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-mono font-bold ${student.pendingFees > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                      {formatCurrency(student.pendingFees)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `/admin/student-ledger?admNo=${student.admissionNumber}&name=${encodeURIComponent(student.name)}`;
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-800 text-neutral-700 hover:text-white border border-neutral-300 hover:border-neutral-800 px-3 py-1.5 rounded-xl transition-all shadow-sm"
                      >
                        <Eye className="w-3 h-3" /> View Ledger
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="py-10 text-center font-mono text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    No financial records matched the specified search criteria.
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
