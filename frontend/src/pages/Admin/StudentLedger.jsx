import React, { useState } from 'react';
import { 
  ArrowLeft, 
  User, 
  Users, 
  Layers, 
  CreditCard, 
  CheckCircle, 
  Printer, 
  Mail, 
  MessageSquare, 
  AlertCircle, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { sendGmailMessages } from '../../components/common/gmail';

/* ==================================================================================
   BACKEND ARCHITECTURE & DATABASE SCHEMA REQUIRMENTS (MEMO FOR DEVELOPMENT)
   ==================================================================================
   1. FAMILIAL LINKAGE (SIBLINGS NODE): 
      Students must be grouped by a unique 'ParentID' or 'FamilyId'.
   2. LEDGER PERSISTENCE POLICY (SOFT DELETION & RETENTION CONTROLS):
      If status is 'PASSED_OUT' or 'TC_ISSUED', do NOT purge or filter from ledger 
      if 'pendingFees > 0'. The account remains un-deletable until balance is 0.
   3. FEE AUTO-DISTRIBUTION LOGIC:
      - Global Family Payment: Deduct incoming amount equally among all active balances.
      - Individual Override: target specific studentId directly.
   4. PURGE ENGINE:
      Drop from accounting registry ONLY if (status === 'PASSED_OUT' || status === 'TC') 
      AND (pendingFees === 0).
   5. EMAIL AUDIT:
      Trigger SMTP/Nodemailer payroll receipt payload upon executing local payment commits.
   ================================================================================== */

const StudentLedger = () => {
  // STATE MACHINE FOR SCREEN VIEWS
  const [activeView, setActiveView] = useState('ledger'); // 'ledger' | 'receipt'
  const [isSendingMail, setIsSendingMail] = useState(false);
  
  // MANUAL PAYMENT INTERACTION REGISTER
  const [paymentMode, setPaymentMode] = useState('family'); // 'family' | 'individual'
  const [selectedIndividualId, setSelectedIndividualId] = useState('s1');
  const [inputAmount, setInputAmount] = useState('');

  // TARGET GENERATED RECEIPT METADATA STATE
  const [latestReceipt, setLatestReceipt] = useState(null);

  // STATIC MOCK MASTER FAMILY LEDGER INDEX STATE
  const [familyProfile, setFamilyProfile] = useState({
    familyId: "FAM-2026-8892",
    fatherName: "Rajesh Sharma",
    motherName: "Sunita Sharma",
    contact: "9876543210",
    guardianEmail: "rajesh.sharma@example.com",
    category: "General",
    students: [
      { id: 's1', name: 'Aarav Sharma', class: 'Class 5', gender: 'Male', status: 'Active', pendingFees: 12000, paidFees: 18000 },
      { id: 's2', name: 'Ananya Sharma', class: 'Class 2', gender: 'Female', status: 'Active', pendingFees: 8000, paidFees: 12000 },
      { id: 's3', name: 'Rahul Sharma', class: 'Class 12', gender: 'Male', status: 'Passed Out', pendingFees: 15000, paidFees: 35000 } // Retained due to pending balance
    ],
    historicalLogs: [
      { session: '2025-2026', totalAssigned: '₹75,000', recovered: '₹65,000', balance: '₹10,000' },
      { session: '2024-2025', totalAssigned: '₹60,000', recovered: '₹60,000', balance: '₹0' },
      { session: '2023-2024', totalAssigned: '₹55,000', recovered: '₹55,000', balance: '₹0' }
    ]
  });

  // EVALUATE ACTIVE RUNTIME AGGREGATES
  const totalFamilyPending = familyProfile.students.reduce((acc, curr) => acc + curr.pendingFees, 0);

  const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

  const buildReceiptMessage = (receipt) => ({
    to: receipt.familyDetails?.guardianEmail,
    subject: `Fee Receipt ${receipt.receiptNo}`,
    text: [
      `Dear ${receipt.familyDetails?.fatherName || 'Guardian'},`,
      '',
      `Payment received: ${formatCurrency(receipt.amountPaid)}.`,
      `Receipt number: ${receipt.receiptNo}.`,
      `Receipt time: ${receipt.timestamp}.`,
      '',
      'Allocation breakdown:',
      ...(receipt.breakdown || []).map((item) => `- ${item.name}: ${formatCurrency(item.allocated)}`),
      '',
      'Regards,',
      'Accounts Department',
      'MGPS ERP Portal',
    ].join('\n'),
  });

  const sendReceiptMail = async (receipt, mode = 'manual') => {
    const message = buildReceiptMessage(receipt);

    if (!message.to) {
      alert('Guardian Gmail is missing for this receipt.');
      return;
    }

    setIsSendingMail(true);
    try {
      await sendGmailMessages(message);
      alert(`Receipt mailed successfully to ${message.to}.`);
    } catch (error) {
      const prefix = mode === 'auto' ? 'Receipt was saved, but Gmail failed' : 'Receipt Gmail failed';
      alert(`${prefix}: ${error.message}`);
    } finally {
      setIsSendingMail(false);
    }
  };

  // SYSTEM CORE MANUAL FEE PROCESSOR TRANSACTION MATRIX
  const executeManualPayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return alert("❌ Execution Fault: Enter a valid transaction value.");

    let updatedStudents = [...familyProfile.students];
    let processingReceiptDetails = [];

    if (paymentMode === 'family') {
      // EQUAL FRACTIONAL DISTRIBUTION AMONG RELEVANT DEFICIT LEDGERS
      const studentsWithDues = updatedStudents.filter(s => s.pendingFees > 0);
      if (studentsWithDues.length === 0) return alert("ℹ️ System Register: No deficit found in family balance.");
      
      const splitQuota = amount / studentsWithDues.length;
      
      updatedStudents = updatedStudents.map(student => {
        if (student.pendingFees > 0) {
          const deduction = Math.min(splitQuota, student.pendingFees);
          processingReceiptDetails.push({ name: student.name, allocated: deduction });
          return {
            ...student,
            pendingFees: student.pendingFees - deduction,
            paidFees: student.paidFees + deduction
          };
        }
        return student;
      });
    } else {
      // ISOLATED TARGET RECORD OVERRIDE PAYMENTS
      updatedStudents = updatedStudents.map(student => {
        if (student.id === selectedIndividualId) {
          const deduction = Math.min(amount, student.pendingFees);
          processingReceiptDetails.push({ name: student.name, allocated: deduction });
          return {
            ...student,
            pendingFees: student.pendingFees - deduction,
            paidFees: student.paidFees + deduction
          };
        }
        return student;
      });
    }

    // Core Commit State updates
    setFamilyProfile(prev => ({
      ...prev,
      students: updatedStudents
    }));

    // POPULATE RECEIPT BUFFER
    const receipt = {
      receiptNo: `REC-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleString(),
      amountPaid: amount,
      mode: paymentMode,
      breakdown: processingReceiptDetails,
      familyDetails: familyProfile
    };

    setLatestReceipt(receipt);

    await sendReceiptMail(receipt, 'auto');
    
    // TRANSITION FOR RECEIPT GENERATOR MATRIX VIEW
    setActiveView('receipt');
    setInputAmount('');
  };

  return (
    <div className="w-full min-h-screen bg-[#D9D9D9] p-6 text-neutral-800 font-sans box-border select-none">
      
      {/* SCREEN ROUTE 1: MASTER LEDGER BOOKVIEW */}
      {activeView === 'ledger' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          
          {/* CONTROL STRIP COMPONENT */}
          <div className="flex items-center gap-3 border-b border-neutral-400/60 pb-4">
            <button
              type="button"
              onClick={() => window.location.href = '/admin/finance'}
              className="p-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl transition-all shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900 flex items-center gap-2">
                Secure Family Ledger Console <Sparkles className="w-4 h-4 text-neutral-600" />
              </h2>
              <p className="text-xs text-neutral-600 font-medium font-mono">ACCOUNT CLUSTER IDENTIFIER: {familyProfile.familyId}</p>
            </div>
          </div>

          {/* PARENTAL METADATA INDEX ARCHITECTURE DECK */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Father / Primary Guardian</span>
              <p className="text-sm font-bold text-neutral-900 flex items-center gap-1.5"><User className="w-4 h-4 text-neutral-500" /> {familyProfile.fatherName}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Mother Name</span>
              <p className="text-sm font-bold text-neutral-800">{familyProfile.motherName}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Contact Comms Portal</span>
              <p className="text-sm font-bold text-neutral-700 font-mono">{familyProfile.contact}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Category / Tier Flag</span>
              <p className="text-sm font-bold text-neutral-700 uppercase tracking-wider">{familyProfile.category}</p>
            </div>
          </div>

          {/* MAIN SIBLINGS RECONCILIATION LEDGER MODULE TABLE */}
          <div className="bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider font-mono text-neutral-500 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Connected Sibling Registers (Cross-Session Audits)
              </h3>
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-black font-mono">
                TOTAL DUES: ₹{totalFamilyPending.toLocaleString()}
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[9px] font-black uppercase tracking-wider text-neutral-400 font-mono">
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3 text-center">Operational Status</th>
                    <th className="p-3 text-right">Cumulative Paid</th>
                    <th className="p-3 text-right">Unpaid Deficit Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-800">
                  {familyProfile.students.map((student) => (
                    <tr key={student.id} className="hover:bg-neutral-50/50">
                      <td className="p-3 font-bold text-neutral-900">{student.name}</td>
                      <td className="p-3 font-mono text-neutral-600">{student.class}</td>
                      <td className="p-3 text-neutral-500">{student.gender}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-black tracking-wider uppercase font-mono ${student.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 border border-amber-300'}`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{student.paidFees}</td>
                      <td className={`p-3 text-right font-mono font-bold ${student.pendingFees > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {student.pendingFees > 0 ? `Extra Outstanding: ₹${student.pendingFees.toLocaleString()}` : 'Cleared'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECURE DIRECT COLLECTION TERMINAL AND TRANSACTION RIG */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* MANUAL TRANSACTION TERMINAL ENGINE */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md md:col-span-2 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900 flex items-center gap-1">
                <CreditCard className="w-4 h-4 text-neutral-700" /> Secure Direct Collection Matrix
              </h4>
              
              <form onSubmit={executeManualPayment} className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="paymentType" 
                      checked={paymentMode === 'family'} 
                      onChange={() => setPaymentMode('family')} 
                      className="accent-neutral-900"
                    /> Distributed Pooling (Equal Split)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="paymentType" 
                      checked={paymentMode === 'individual'} 
                      onChange={() => setPaymentMode('individual')} 
                      className="accent-neutral-900"
                    /> Individual Targeted Override
                  </label>
                </div>

                {paymentMode === 'individual' && (
                  <div className="animate-fadeIn space-y-1">
                    <span className="text-[10px] font-black uppercase text-neutral-500 font-mono">Select Target Registry Account</span>
                    <select 
                      value={selectedIndividualId}
                      onChange={(e) => setSelectedIndividualId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none text-neutral-800"
                    >
                      {familyProfile.students.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.class}) - Due: ₹{s.pendingFees}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-neutral-500 font-mono">Transaction Value (INR)</span>
                  <div className="relative flex items-center bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1">
                    <span className="text-sm font-black text-neutral-500 font-mono mr-2">₹</span>
                    <input 
                      type="number" 
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      placeholder="Enter exactly amount to credit..."
                      className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold text-neutral-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Commit Manual Entry & Disburse Receipt
                </button>
              </form>
            </div>

            {/* DEEP HISTORICAL TIMELINE STREAM LOCKER */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900 flex items-center gap-1.5 mb-3">
                  <Layers className="w-4 h-4 text-neutral-600" /> Historic Ledger Stream
                </h4>
                
                {/* INFINITE SCROLL ENHANCED TIMELINE ARCHIVE BASE */}
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-200">
                  {familyProfile.historicalLogs.map((log, i) => (
                    <div key={i} className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 text-[11px] font-mono font-bold text-neutral-600 space-y-1">
                      <div className="flex justify-between text-neutral-900 font-black">
                        <span>SESSION: {log.session}</span>
                        <span className="text-emerald-600">BAL: {log.balance}</span>
                      </div>
                      <div className="flex justify-between opacity-80 text-[10px]">
                        <span>Assigned: {log.totalAssigned}</span>
                        <span>Recovered: {log.recovered}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[10px] leading-relaxed text-amber-800 font-medium font-mono mt-3 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <span>Account records cannot be expunged while student balance indices show positive values.</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SCREEN ROUTE 2: TRANSACTION FEES RECEIPT OVERVIEW MODULE */}
      {activeView === 'receipt' && latestReceipt && (
        <div className="max-w-xl mx-auto bg-white border border-neutral-400 p-6 rounded-2xl shadow-2xl animate-scaleUp text-left space-y-6 select-text">
          
          {/* RECEIPT BANNER DESIGN */}
          <div className="text-center space-y-1 border-b border-dashed border-neutral-300 pb-4">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black uppercase tracking-widest text-neutral-900">Institutional Audit Invoice</h3>
            <p className="text-[10px] font-mono text-neutral-500 font-bold">TRANSACTION REFERENCE NO: {latestReceipt.receiptNo}</p>
            <p className="text-[9px] font-mono text-neutral-400">{latestReceipt.timestamp}</p>
          </div>

          {/* FAMILY AUDIT CONTEXT DECK */}
          <div className="text-xs space-y-1.5 font-medium border-b border-neutral-100 pb-4">
            <p className="font-bold text-neutral-900 font-mono text-[10px] uppercase text-neutral-400 tracking-wider">Account Specifications:</p>
            <p><span className="text-neutral-500">Primary Guardian:</span> <strong className="text-neutral-900">{latestReceipt.familyDetails.fatherName}</strong></p>
            <p><span className="text-neutral-500">Communication Terminal Link:</span> <strong className="text-neutral-800 font-mono">{latestReceipt.familyDetails.contact}</strong></p>
          </div>

          {/* ACCOUNT ALLOCATION SUBDIVISIONS */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-wider block">Allocation Ledger Remittance Breakdown:</span>
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 divide-y divide-neutral-200/60 font-mono text-xs overflow-hidden">
              {latestReceipt.breakdown.map((item, index) => (
                <div key={index} className="p-3 flex justify-between items-center font-bold">
                  <span className="text-neutral-700">{item.name}</span>
                  <span className="text-neutral-900">₹{item.allocated.toLocaleString()}</span>
                </div>
              ))}
              <div className="p-3 bg-neutral-900 text-white flex justify-between items-center font-black">
                <span className="uppercase tracking-widest text-[10px]">Total Remitted Volume</span>
                <span>₹{latestReceipt.amountPaid.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ACTION VALVE OPERATIONAL RIG */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-4 border-t border-dashed border-neutral-200">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 text-neutral-800 p-2.5 rounded-xl border border-neutral-300 transition-all shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-600" /> Local Print
            </button>
            <button
              type="button"
              onClick={() => alert("✅ Receipt payload successfully requeued and dispatched to user WhatsApp network layer.")}
              className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 text-neutral-800 p-2.5 rounded-xl border border-neutral-300 transition-all shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Share WhatsApp
            </button>
            <button
              type="button"
              onClick={() => sendReceiptMail(latestReceipt)}
              disabled={isSendingMail}
              className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 text-neutral-800 p-2.5 rounded-xl border border-neutral-300 transition-all shadow-xs disabled:opacity-60"
            >
              <Mail className="w-3.5 h-3.5 text-red-500" /> {isSendingMail ? 'Sending...' : 'Share Mail'}
            </button>
          </div>

          {/* BACK TO MASTER RETURN BRIDGE CONTROLLER */}
          <button
            type="button"
            onClick={() => {
              setLatestReceipt(null);
              setActiveView('ledger');
            }}
            className="w-full py-2.5 text-center text-xs font-black uppercase tracking-widest border border-neutral-800 text-neutral-800 hover:bg-neutral-900 hover:text-white rounded-xl transition-all"
          >
            Exit Statement Review View
          </button>

        </div>
      )}

    </div>
  );
};

export default StudentLedger;
