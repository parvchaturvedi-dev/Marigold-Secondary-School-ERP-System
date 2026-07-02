import React from 'react';
import { Download, IdCard as IdCardIcon } from 'lucide-react';
import { getClassLabel, getPortalStudent } from './studentPortalData';
import {
  IdCardStyles,
  ResponsiveIdCardPair,
  exportIdCardsPdf,
  normalizeStudentCard,
} from '../../components/common/idCardKit';

const IdCard = ({ session }) => {
  const student = getPortalStudent(session);
  const cardRecord = normalizeStudentCard(student);

  return (
    <div className="space-y-6 pb-8 font-sans text-slate-900 animate-fadeIn">
      <IdCardStyles />
      <section className="no-print glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <IdCardIcon className="w-5 h-5" /> Student ID Card
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Identity details for {student.displayName} | {getClassLabel(student)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportIdCardsPdf([cardRecord], `${cardRecord.id}-id-card.pdf`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full btn-primary text-xs font-black"
        >
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="glass-card rounded-3xl p-6 flex justify-center xl:col-span-2">
          <div className="id-print-area w-full pb-2 bg-white">
            <ResponsiveIdCardPair record={cardRecord} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default IdCard;
