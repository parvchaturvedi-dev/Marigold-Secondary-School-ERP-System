import React, { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  Clock,
  Eye,
  FilePlus,
  FileText,
  RefreshCw,
  Trash2,
  UploadCloud,
  UserCheck,
} from 'lucide-react';
import {
  ACADEMIC_CALENDAR_UPDATED_EVENT,
  formatCalendarDate,
  formatFileSize,
  fetchAcademicCalendar,
  readAcademicCalendar,
  removeAcademicCalendar,
  saveAcademicCalendar,
} from '../../components/common/academicCalendarStore';

const AcademicCalender = ({ session }) => {
  const [calendarPdf, setCalendarPdf] = useState(() => readAcademicCalendar());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef(null);
  const uploaderName = session?.displayName || session?.accountDisplayName || session?.username || '';
  const uploadedBy = uploaderName ? `Admin (${uploaderName})` : 'Admin';

  useEffect(() => {
    let isActive = true;

    const refreshCalendar = () => {
      fetchAcademicCalendar().then((latestCalendar) => {
        if (isActive) setCalendarPdf(latestCalendar);
      });
    };

    refreshCalendar();
    window.addEventListener(ACADEMIC_CALENDAR_UPDATED_EVENT, refreshCalendar);

    return () => {
      isActive = false;
      window.removeEventListener(ACADEMIC_CALENDAR_UPDATED_EVENT, refreshCalendar);
    };
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      alert('Please upload a valid PDF file only!');
      return;
    }

    try {
      const savedCalendar = await saveAcademicCalendar(file, uploadedBy);
      setCalendarPdf(savedCalendar);
      setIsPreviewOpen(true);
    } catch {
      alert('PDF could not be saved. Please try a smaller file or clear browser storage.');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = async () => {
    await removeAcademicCalendar();
    setCalendarPdf(null);
    setIsPreviewOpen(false);
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans">
      <div className="glass-card rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#8b5cf6]" /> Academic Calendar Management
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload the yearly schedule PDF. It will be instantly visible to Clerks, Teachers, and Students.
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,application/pdf"
            className="hidden"
          />

          <div className="flex flex-wrap gap-2.5">
            {!calendarPdf ? (
              <button
                type="button"
                onClick={triggerFileInput}
                className="flex items-center gap-2 px-5 py-2.5 btn-primary rounded-full text-xs font-bold shadow-sm "
              >
                <FilePlus className="w-4 h-4" /> Add Calendar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#FFF8EC] text-[#f59e0b] border border-[#F5E6CC] rounded-full text-xs font-bold hover:scale-[1.02] transition-transform duration-150"
                >
                  <RefreshCw className="w-4 h-4" /> Replace Calendar
                </button>

                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-bold hover:scale-[1.02] transition-transform duration-150"
                >
                  <Trash2 className="w-4 h-4" /> Remove Calendar
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              disabled={!calendarPdf}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all duration-150
                ${
                  calendarPdf
                    ? 'bg-[#E6FFFA] text-[#06b6d4] border border-[#CCFBF1] hover:scale-[1.02]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                }
              `}
            >
              <Eye className="w-4 h-4" /> {isPreviewOpen ? 'Hide Preview' : 'Preview Calendar'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-indigo-50/60 p-4 rounded-3xl flex flex-col gap-4 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 px-2">Document Status</h4>

          {calendarPdf ? (
            <div className="bg-white p-4 rounded-2xl border border-emerald-100 flex items-start gap-3.5">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-900 truncate">{calendarPdf.name}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                  {formatFileSize(calendarPdf.size)} - PDF Document
                </p>
                <div className="mt-3 space-y-1 text-[10px] font-semibold text-gray-500">
                  <p className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Updated: {formatCalendarDate(calendarPdf.uploadedAt)}
                  </p>
                  <p className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> By: {calendarPdf.uploadedBy}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={triggerFileInput}
              className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#8b5cf6] transition-colors h-44"
            >
              <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
              <p className="text-xs font-bold text-slate-900">No Active Calendar PDF</p>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">
                Click Add Calendar or drop a PDF here to publish.
              </p>
            </button>
          )}
        </div>

        <div className="lg:col-span-2 glass-card rounded-3xl p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">Portal Synchronization</h4>
            <p className="text-[10px] text-gray-400 font-medium">Whom this file is currently shared with</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 my-4">
            {['Clerk Terminal', 'Teacher App', 'Student Desk'].map((portalName) => (
              <div
                key={portalName}
                className="p-3 bg-[#F5F3FF] border border-[#E8E3FF] rounded-2xl flex items-center gap-3"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    calendarPdf ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">{portalName}</p>
                  <p className="text-[9px] text-gray-400 font-semibold">
                    {calendarPdf ? 'Live Sync Active' : 'Waiting for file'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isPreviewOpen && calendarPdf && (
        <div className="glass-card rounded-3xl p-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <h4 className="text-xs font-bold text-slate-900">Live Document Preview (PDF)</h4>
            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">
              Secure Connection
            </span>
          </div>

          <div className="w-full bg-indigo-50/60 rounded-2xl border border-gray-300 h-[500px] overflow-hidden">
            <iframe
              title="Academic Calendar PDF Preview"
              src={`${calendarPdf.dataUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full rounded-2xl bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalender;
