import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, Eye, FileText, ShieldCheck, UserCheck } from 'lucide-react';
import {
  ACADEMIC_CALENDAR_STORAGE_KEY,
  ACADEMIC_CALENDAR_UPDATED_EVENT,
  fetchAcademicCalendar,
  formatCalendarDate,
  formatFileSize,
  readAcademicCalendar,
} from './academicCalendarStore';

const AcademicCalendarViewer = ({ portalLabel = 'Portal' }) => {
  const [calendarPdf, setCalendarPdf] = useState(() => readAcademicCalendar());

  useEffect(() => {
    let isActive = true;
    const refreshCalendar = () => {
      fetchAcademicCalendar().then((latestCalendar) => {
        if (isActive) setCalendarPdf(latestCalendar);
      });
    };
    const handleStorageChange = (event) => {
      if (event.key === ACADEMIC_CALENDAR_STORAGE_KEY) refreshCalendar();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(ACADEMIC_CALENDAR_UPDATED_EVENT, refreshCalendar);

    return () => {
      isActive = false;
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(ACADEMIC_CALENDAR_UPDATED_EVENT, refreshCalendar);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    fetchAcademicCalendar().then((latestCalendar) => {
      if (isActive) setCalendarPdf(latestCalendar);
    });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="space-y-6 pb-8 select-none font-sans">
      <div className="bg-white p-6 rounded-3xl border border-[#EAEAEA] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#1A1A1A] flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#8b5cf6]" /> Academic Calendar
            </h3>
            <p className="text-xs text-[#666666] mt-0.5">
              {portalLabel} access is synchronized with the latest Admin upload.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-bold w-fit">
            <ShieldCheck className="w-4 h-4" /> View Only Access
          </div>
        </div>
      </div>

      {calendarPdf ? (
        <>
          <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
              <div className="md:col-span-2 bg-[#EAEAEA] p-4 rounded-2xl border border-[#DADADA] flex items-start gap-3.5">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#1A1A1A] truncate">{calendarPdf.name}</p>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                    {formatFileSize(calendarPdf.size)} - PDF Document
                  </p>
                </div>
              </div>

              <div className="bg-[#F5F3FF] p-4 rounded-2xl border border-[#E8E3FF] flex items-center gap-3">
                <Clock className="w-4 h-4 text-[#8b5cf6]" />
                <div>
                  <p className="text-[9px] uppercase font-black text-gray-400">Updated</p>
                  <p className="text-xs font-bold text-[#1A1A1A]">{formatCalendarDate(calendarPdf.uploadedAt)}</p>
                </div>
              </div>

              <div className="bg-[#FFF8EC] p-4 rounded-2xl border border-[#F5E6CC] flex items-center gap-3">
                <UserCheck className="w-4 h-4 text-[#f59e0b]" />
                <div>
                  <p className="text-[9px] uppercase font-black text-gray-400">Published By</p>
                  <p className="text-xs font-bold text-[#1A1A1A] truncate">{calendarPdf.uploadedBy}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm animate-fadeIn">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h4 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-2">
                <Eye className="w-4 h-4" /> Calendar PDF
              </h4>
              <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">
                Active
              </span>
            </div>

            <div className="w-full bg-[#EAEAEA] rounded-2xl border border-gray-300 h-[620px] overflow-hidden">
              <iframe
                title="Academic Calendar PDF"
                src={`${calendarPdf.dataUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-full rounded-2xl bg-white"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-10 rounded-3xl border border-[#EAEAEA] shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EAEAEA] text-gray-400 mx-auto flex items-center justify-center mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-black text-[#1A1A1A]">No Academic Calendar Published</h4>
          <p className="text-xs text-gray-500 mt-1">
            No PDF has been uploaded by Admin yet.
          </p>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendarViewer;
