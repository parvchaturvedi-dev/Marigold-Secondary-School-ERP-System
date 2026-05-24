import React, { useMemo, useState } from 'react';
import { Contact2, GraduationCap, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useMasterData } from '../../components/common/masterData';

const IdCard = () => {
  const masterData = useMasterData();
  const [directoryType, setDirectoryType] = useState('students');
  const [selectedId, setSelectedId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const directory = useMemo(() => {
    if (directoryType === 'teachers') {
      return masterData.teachers.map((teacher) => ({
        id: teacher.id || teacher.empId || teacher.name,
        name: teacher.name || teacher.displayName || 'Teacher',
        subtitle: teacher.id || teacher.empId || 'Teacher',
        className: teacher.assignedClassTeacherFor || teacher.classAssignments?.[0]?.className || 'Faculty',
        contact: teacher.mobile || teacher.phone || teacher.email || '',
        role: teacher.isClassTeacher === 'Yes' ? 'Class Teacher' : 'Faculty',
        photoDataUrl: teacher.photoDataUrl || '',
      }));
    }

    return masterData.students.map((student) => ({
      id: student.id || student.admissionNumber,
      name: student.displayName || student.name,
      subtitle: student.admissionNumber || student.id,
      className: student.className,
      contact: student.guardianPhone || student.guardianEmail || '',
      role: 'Student',
      fatherName: student.fatherName,
      photoDataUrl: student.photoDataUrl || student.rawProfile?.photoDataUrl || '',
    }));
  }, [directoryType, masterData.students, masterData.teachers]);

  const visibleDirectory = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return directory.filter((item) => {
      const haystack = [item.name, item.subtitle, item.className, item.role].join(' ').toLowerCase();
      return !normalizedSearch || haystack.includes(normalizedSearch);
    });
  }, [directory, searchTerm]);

  const selectedProfile =
    directory.find((item) => item.id === selectedId) ||
    visibleDirectory[0] ||
    directory[0] ||
    null;

  return (
    <div className="space-y-6 p-6 font-sans select-none text-[#1A1A1A]">
      <div className="bg-white border border-[#C8C8C8] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
              <Contact2 className="w-5 h-5 text-blue-700" /> ID Card Generation
            </h2>
            <p className="text-xs text-[#555555] font-semibold mt-1">
              Live student and faculty identity cards from shared master records.
            </p>
          </div>
          <div className="flex bg-[#F8F8F8] border border-[#EAEAEA] rounded-xl p-1">
            {[
              ['students', 'Students'],
              ['teachers', 'Faculty'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setDirectoryType(id);
                  setSelectedId('');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-black transition ${
                  directoryType === id ? 'bg-[#1A1A1A] text-white' : 'text-[#555555]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 bg-white border border-[#C8C8C8] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#EAEAEA]">
            <div className="relative bg-[#F8F8F8] rounded-xl border border-[#D9D9D9] flex items-center px-3 py-2">
              <Search className="w-4 h-4 text-[#555555] mr-2" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search identity"
                className="bg-transparent outline-none text-xs font-semibold w-full"
              />
            </div>
          </div>

          <div className="max-h-[68vh] overflow-y-auto divide-y divide-[#EAEAEA]">
            {visibleDirectory.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-4 transition flex items-center gap-3 ${
                  selectedProfile?.id === item.id ? 'bg-[#F8F8F8]' : 'hover:bg-[#F8F8F8]'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                  {directoryType === 'students' ? <GraduationCap className="w-5 h-5" /> : <UserRound className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{item.name}</p>
                  <p className="text-[10px] text-[#555555] font-semibold truncate">
                    {item.subtitle} - {item.className}
                  </p>
                </div>
              </button>
            ))}
            {!visibleDirectory.length && (
              <div className="p-8 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                No synced identities found.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-[#C8C8C8] rounded-2xl shadow-sm p-6">
          {selectedProfile ? (
            <div className="max-w-sm mx-auto bg-[#F8F8F8] border border-[#D9D9D9] rounded-2xl overflow-hidden shadow-md">
              <div className="bg-[#1A1A1A] text-white p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black text-blue-200">Marigold Secondary School</p>
                  <h3 className="text-lg font-black">MGPS ERP ID</h3>
                </div>
                <ShieldCheck className="w-6 h-6 text-[#E1FA6C]" />
              </div>

              <div className="p-5 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-28 bg-white border border-[#D9D9D9] rounded-xl flex items-center justify-center overflow-hidden">
                    {selectedProfile.photoDataUrl ? (
                      <img src={selectedProfile.photoDataUrl} alt={selectedProfile.name} className="w-full h-full object-cover" />
                    ) : (
                      <Contact2 className="w-10 h-10 text-neutral-300" />
                    )}
                  </div>
                  <div className="min-w-0 pt-1">
                    <p className="text-[10px] uppercase tracking-wider font-black text-[#555555]">{selectedProfile.role}</p>
                    <h4 className="text-xl font-black leading-tight">{selectedProfile.name}</h4>
                    <p className="text-xs font-mono text-[#555555] mt-1">{selectedProfile.subtitle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="bg-white border border-[#EAEAEA] rounded-xl p-3">
                    <p className="text-[9px] uppercase tracking-wider font-black text-[#555555]">Class / Role</p>
                    <p className="font-black">{selectedProfile.className || '-'}</p>
                  </div>
                  {selectedProfile.fatherName && (
                    <div className="bg-white border border-[#EAEAEA] rounded-xl p-3">
                      <p className="text-[9px] uppercase tracking-wider font-black text-[#555555]">Father Name</p>
                      <p className="font-black">{selectedProfile.fatherName}</p>
                    </div>
                  )}
                  <div className="bg-white border border-[#EAEAEA] rounded-xl p-3">
                    <p className="text-[9px] uppercase tracking-wider font-black text-[#555555]">Contact</p>
                    <p className="font-black">{selectedProfile.contact || '-'}</p>
                  </div>
                </div>

                <div className="bg-white border border-dashed border-[#C8C8C8] rounded-xl p-4 text-center">
                  <p className="text-[9px] uppercase tracking-widest font-black text-[#555555]">QR Identifier</p>
                  <p className="text-lg font-mono font-black tracking-widest mt-1">{selectedProfile.id}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-xs font-black text-neutral-400 uppercase tracking-widest">
              Add students or teachers to generate ID cards.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdCard;
