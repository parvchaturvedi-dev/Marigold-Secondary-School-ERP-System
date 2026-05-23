import React, { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Download,
  IdCard as IdCardIcon,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import {
  CLERK_STAFF,
  CLERK_STUDENTS,
  getInitials,
} from './clerkPortalData';

const templateOptions = [
  { id: 'student', label: 'Student Cards' },
  { id: 'staff', label: 'Staff Cards' },
];

const batchRows = [
  { id: 'BATCH-9A', label: 'Class 9-A', count: 41, status: 'Ready' },
  { id: 'BATCH-10B', label: 'Class 10-B', count: 39, status: 'Photo Review' },
  { id: 'BATCH-STAFF', label: 'Staff Renewals', count: 12, status: 'Ready' },
];

const IdCard = () => {
  const [template, setTemplate] = useState('student');
  const [selectedId, setSelectedId] = useState(CLERK_STUDENTS[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [cardOptions, setCardOptions] = useState({
    includeTransport: true,
    includeEmergency: true,
    includeQr: true,
  });

  const records = template === 'student' ? CLERK_STUDENTS : CLERK_STAFF;
  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return records.filter((record) =>
      [record.name, record.id, record.admissionNumber, record.className, record.department]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [records, searchTerm]);

  const activeRecord =
    records.find((record) => record.id === selectedId) || filteredRecords[0] || records[0];

  const handleTemplateChange = (nextTemplate) => {
    setTemplate(nextTemplate);
    setSelectedId(nextTemplate === 'student' ? CLERK_STUDENTS[0].id : CLERK_STAFF[0].id);
  };

  const toggleOption = (option) => {
    setCardOptions((prev) => ({ ...prev, [option]: !prev[option] }));
  };

  const queuePrint = () => {
    alert(`${activeRecord.name} has been added to the ID card print queue.`);
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <IdCardIcon className="w-5 h-5" /> ID Card Studio
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Generate student and staff ID cards with live data preview and batch print controls.
          </p>
        </div>

        <div className="flex bg-[#EAEAEA] p-1 rounded-2xl border border-[#C8C8C8]">
          {templateOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleTemplateChange(option.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black ${
                template === option.id
                  ? 'bg-[#E1FA6C] text-[#1A1A1A] shadow-sm'
                  : 'text-[#555555] hover:text-black'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold">
              <Search className="w-4 h-4 text-[#555555]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${template} records...`}
                className="bg-transparent outline-none w-full"
              />
            </div>

            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {filteredRecords.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all ${
                    activeRecord.id === record.id
                      ? 'bg-[#1A1A1A] text-white border-black'
                      : 'bg-[#F8F8F8] text-[#1A1A1A] border-[#EAEAEA] hover:border-black'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border ${
                      activeRecord.id === record.id
                        ? 'bg-[#E1FA6C] text-[#1A1A1A] border-[#E1FA6C]'
                        : 'bg-white text-[#555555] border-[#EAEAEA]'
                    }`}>
                      {getInitials(record.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black truncate">{record.name}</span>
                      <span className={`block text-[10px] font-mono mt-0.5 truncate ${activeRecord.id === record.id ? 'text-neutral-300' : 'text-[#555555]'}`}>
                        {record.admissionNumber || record.id}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-black">Card Options</h3>
            {[
              ['includeTransport', 'Transport route'],
              ['includeEmergency', 'Emergency contact'],
              ['includeQr', 'QR verification block'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleOption(id)}
                className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-center justify-between text-xs font-bold"
              >
                <span>{label}</span>
                <span className={`w-10 h-5 rounded-full border flex items-center p-0.5 transition-colors ${
                  cardOptions[id] ? 'bg-emerald-500 border-emerald-500 justify-end' : 'bg-[#EAEAEA] border-[#C8C8C8] justify-start'
                }`}>
                  <span className="w-4 h-4 bg-white rounded-full" />
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
              <h3 className="text-sm font-black">Live Preview</h3>
              <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md">
                DATA SYNCED
              </span>
            </div>

            <div className="mx-auto w-full max-w-sm rounded-[28px] border-2 border-[#1A1A1A] overflow-hidden bg-white shadow-xl">
              <div className="bg-[#1A1A1A] text-white p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-[#E1FA6C]">MGPS ERP</p>
                  <p className="text-sm font-black">Marigold Secondary School</p>
                </div>
                <IdCardIcon className="w-6 h-6 text-[#E1FA6C]" />
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-3xl bg-[#EAEAEA] border border-[#C8C8C8] flex items-center justify-center text-2xl font-black">
                    {getInitials(activeRecord.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black leading-tight">{activeRecord.name}</h3>
                    <p className="text-[11px] font-mono font-black text-[#555555] mt-1">
                      {activeRecord.admissionNumber || activeRecord.id}
                    </p>
                    <span className="inline-flex mt-2 bg-[#E1FA6C] border border-[#1A1A1A]/10 px-2 py-1 rounded-md text-[9px] font-black uppercase">
                      {template === 'student' ? `${activeRecord.className}-${activeRecord.section}` : activeRecord.department}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <PreviewCell label={template === 'student' ? 'Roll No' : 'Role'} value={template === 'student' ? activeRecord.rollNo : activeRecord.role} />
                  <PreviewCell label="Blood Group" value={activeRecord.bloodGroup || 'NA'} />
                  <PreviewCell label={template === 'student' ? 'Guardian' : 'Phone'} value={template === 'student' ? activeRecord.guardian : activeRecord.phone} />
                  <PreviewCell label="House / Dept" value={activeRecord.house || activeRecord.department} />
                </div>

                {cardOptions.includeTransport && template === 'student' && (
                  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 text-xs font-bold">
                    Transport: {activeRecord.transport}
                  </div>
                )}

                {cardOptions.includeEmergency && (
                  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 text-xs font-bold">
                    Emergency: {activeRecord.phone}
                  </div>
                )}

                {cardOptions.includeQr && (
                  <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-[#555555]">Verification</p>
                      <p className="text-xs font-mono font-black">{activeRecord.id}</p>
                    </div>
                    <div className="w-14 h-14 bg-[#F8F8F8] border border-[#C8C8C8] rounded-xl flex items-center justify-center">
                      <QrCode className="w-8 h-8" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={queuePrint}
                className="flex-1 min-w-40 bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl py-3 text-xs font-black flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Add To Print Queue
              </button>
              <button
                type="button"
                onClick={() => alert('ID card PDF export prepared for download.')}
                className="flex-1 min-w-40 bg-[#1A1A1A] text-[#E1FA6C] rounded-2xl py-3 text-xs font-black flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Print Batches
                </h3>
                <RefreshCw className="w-4 h-4 text-[#555555]" />
              </div>

              <div className="space-y-3">
                {batchRows.map((batch) => (
                  <div key={batch.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black">{batch.label}</p>
                        <p className="text-[10px] font-mono font-bold text-[#555555] mt-0.5">{batch.id}</p>
                      </div>
                      <span className="text-lg font-black">{batch.count}</span>
                    </div>
                    <span className={`inline-flex mt-3 text-[9px] font-black px-2 py-0.5 rounded-md border ${
                      batch.status === 'Ready'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {batch.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-black flex items-center gap-2">
                <BadgeCheck className="w-4 h-4" /> Print Readiness
              </h3>
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs font-semibold text-emerald-800">
                Cards marked Ready can be printed immediately. Photo Review batches need image verification before export.
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs font-semibold text-blue-800 flex items-start gap-2">
                <UserRound className="w-4 h-4 shrink-0" />
                Student data is pulled from office records and should be corrected in Student Management before printing.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const PreviewCell = ({ label, value }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 min-h-16">
    <p className="text-[9px] font-black uppercase text-[#555555]">{label}</p>
    <p className="mt-1 text-xs font-black truncate">{value}</p>
  </div>
);

export default IdCard;
