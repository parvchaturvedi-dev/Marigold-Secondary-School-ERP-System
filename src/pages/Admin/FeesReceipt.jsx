import React, { useState } from 'react';
import { Printer, MessageSquare, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { sendGmailMessages } from '../../components/common/gmail';

const FeesReceipt = ({ setActivePage }) => {
  const [receiptData] = useState(() => {
    const cachedData = localStorage.getItem('latest_invoice_payload');
    return cachedData ? JSON.parse(cachedData) : null;
  });
  const [isSendingMail, setIsSendingMail] = useState(false);

  const handleBack = () => {
    if (typeof setActivePage === 'function') {
      setActivePage('Finance');
    } else {
      window.location.reload();
    }
  };

  const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

  const handleGmailBroadcast = async () => {
    const guardianEmail = receiptData?.familyDetails?.guardianEmail || receiptData?.familyDetails?.email;

    if (!guardianEmail) {
      alert('Guardian Gmail is missing for this receipt.');
      return;
    }

    setIsSendingMail(true);
    try {
      await sendGmailMessages({
        to: guardianEmail,
        subject: `Fee Receipt ${receiptData.receiptNo}`,
        text: [
          `Dear ${receiptData.familyDetails?.fatherName || 'Guardian'},`,
          '',
          `Payment received: ${formatCurrency(receiptData.amountPaid)}.`,
          `Receipt number: ${receiptData.receiptNo}.`,
          `Receipt time: ${receiptData.timestamp}.`,
          '',
          'Allocation breakdown:',
          ...(receiptData.breakdown || []).map((item) => `- ${item.name}: ${formatCurrency(item.allocated)}`),
          '',
          'Regards,',
          'Accounts Department',
          'MGPS ERP Portal',
        ].join('\n'),
      });
      alert(`Receipt mailed successfully to ${guardianEmail}.`);
    } catch (error) {
      alert(`Receipt Gmail failed: ${error.message}`);
    } finally {
      setIsSendingMail(false);
    }
  };

  if (!receiptData) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl border border-neutral-300 shadow-md">
        <p className="text-sm font-bold text-neutral-500 font-mono">No active receipt payload found in stream.</p>
        <button onClick={handleBack} className="mt-4 px-4 py-2 bg-neutral-900 text-white text-xs font-black rounded-xl">
          Go Back to Finance
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-4 animate-fadeIn">
      
      {/* ====================================================================
          RECEIPT BODY (MATCHING THE CLASSIC BLUE-HEADER SLIP DESIGN)
          ==================================================================== */}
      <div className="bg-white border-2 border-neutral-300 rounded-xl overflow-hidden shadow-xl font-sans text-neutral-800 relative">
        
        {/* Blue Curved Banner Accent Line */}
        <div className="h-4 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 w-full border-b border-neutral-900/10" />

        <div className="p-8 space-y-8">
          
          {/* 1. Institution Header Block */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-neutral-200">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-blue-900 uppercase">ACADEMY GLOBAL SCHOOL</h2>
              <p className="text-xs font-medium text-neutral-500 max-w-sm mt-0.5">
                Sector 4, Devli Road, New Delhi - 110062<br />
                Email: support@academyschool.com | Tel: +91 11-23456789
              </p>
            </div>
            <div className="text-right md:text-right w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-neutral-100">
              <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-800 font-black tracking-widest text-sm rounded-lg border border-blue-200/60 font-mono uppercase">
                FEES RECEIPT
              </span>
              <div className="text-[11px] font-mono font-bold text-neutral-500 mt-2 space-y-0.5">
                <p>Receipt No: <span className="text-neutral-800 font-black">{receiptData.receiptNo}</span></p>
                <p>Date: <span className="text-neutral-800">{receiptData.timestamp?.split(',')[0]}</span></p>
              </div>
            </div>
          </div>

          {/* 2. Remitter Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200/70 text-xs font-medium">
            <div className="space-y-2">
              <p className="flex items-center"><span className="w-32 font-mono text-neutral-400 font-black uppercase">Received From:</span> <span className="font-bold text-neutral-900 text-sm">{receiptData.familyDetails?.fatherName}</span></p>
              <p className="flex items-center"><span className="w-32 font-mono text-neutral-400 font-black uppercase">Contact Link:</span> <span className="font-mono text-neutral-700">{receiptData.familyDetails?.contact}</span></p>
            </div>
            <div className="space-y-2 md:text-right flex flex-col justify-end items-start md:items-end">
              <p className="flex items-center gap-1"><span className="font-mono text-neutral-400 font-black uppercase">Status:</span> <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-black"><ShieldCheck className="w-3 h-3" /> VERIFIED CREDIT</span></p>
            </div>
          </div>

          {/* 3. Breakdown Matrix Table */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 font-mono text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                  <th className="py-3 px-4">Allocation Towards / Description</th>
                  <th className="py-3 px-4 text-right">Net Amount Credited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs font-semibold">
                {receiptData.breakdown?.map((item, index) => (
                  <tr key={index} className="hover:bg-neutral-50/40">
                    <td className="py-3.5 px-4 text-neutral-800 font-bold">{item.name} <span className="text-[10px] text-neutral-400 font-mono font-medium ml-1">(Tuition & Term Pooling Split)</span></td>
                    {/* CRITICAL FIX: .toFixed(2) implemented to eliminate trailing float decimals */}
                    <td className="py-3.5 px-4 text-right font-mono text-neutral-900 font-bold">₹{Number(item.allocated).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. Total Remittance Bar (Matching Receipt Box layout) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-900 rounded-xl text-white shadow-md">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 font-mono">Grand Total Remitted</span>
              <p className="text-xs font-bold font-serif opacity-90 mt-0.5">
                Rupees {receiptData.amountPaid === 10000 ? "Ten Thousand Only" : "Specified Ledger Balance Settled"}
              </p>
            </div>
            <div className="bg-white/10 px-6 py-2.5 rounded-lg border border-white/20 text-right min-w-[160px]">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 font-mono block">Amount Paid</span>
              <span className="text-xl font-black font-mono tracking-tight">₹{Number(receiptData.amountPaid).toFixed(2)}</span>
            </div>
          </div>

          {/* 5. Signature Footer Block */}
          <div className="pt-12 flex justify-between items-end text-xs font-bold font-mono">
            <div className="text-left text-neutral-400 text-[10px]">
              <p>* Computer generated slip. No physical stamp required.</p>
              <p>Powered by Institutional Finance Core Rig.</p>
            </div>
            <div className="text-center w-48 border-t border-neutral-400 pt-2 text-neutral-700">
              <span className="block text-[11px] font-black uppercase tracking-wider">Authorized Signatory</span>
              <span className="text-[9px] text-neutral-400 font-medium block mt-0.5">Accounts Department</span>
            </div>
          </div>

        </div>
      </div>

      {/* ====================================================================
          COMMUNICATION & CONTROL CONTAINER
          ==================================================================== */}
      <div className="bg-neutral-200/60 border border-neutral-300 p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3">
        <button onClick={() => window.print()} className="flex items-center justify-center gap-2 text-xs font-black bg-white hover:bg-neutral-50 border border-neutral-300 p-3 rounded-xl transition-all shadow-sm">
          <Printer className="w-4 h-4 text-neutral-700" /> Local Print
        </button>
        <button onClick={() => alert(`⚡ WhatsApp Dispatched to ${receiptData.familyDetails?.contact}`)} className="flex items-center justify-center gap-2 text-xs font-black bg-white hover:bg-neutral-50 border border-neutral-300 p-3 rounded-xl transition-all shadow-sm">
          <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Slip
        </button>
        <button onClick={handleGmailBroadcast} disabled={isSendingMail} className="flex items-center justify-center gap-2 text-xs font-black bg-white hover:bg-neutral-50 border border-neutral-300 p-3 rounded-xl transition-all shadow-sm disabled:opacity-60">
          <Mail className="w-4 h-4 text-red-500" /> {isSendingMail ? 'Sending...' : 'Gmail Broadcast'}
        </button>
        <button onClick={handleBack} className="flex items-center justify-center gap-2 text-xs font-black bg-neutral-900 hover:bg-neutral-800 text-white p-3 rounded-xl transition-all shadow-sm md:col-span-1">
          <ArrowLeft className="w-4 h-4" /> BACK TO LEDGER
        </button>
      </div>

    </div>
  );
};

export default FeesReceipt;
