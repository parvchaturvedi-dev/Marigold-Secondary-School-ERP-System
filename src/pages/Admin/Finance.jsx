import React, { useState } from 'react';
import { 
  DollarSign, Users, TrendingUp, Clock, Mail, MessageSquare, 
  Sparkles, ArrowRight, Send, ArrowLeft, Search, ArrowUpDown, 
  Eye, GraduationCap, User, Layers, CreditCard, CheckCircle, AlertCircle, Printer
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { sendGmailMessages } from '../../components/common/gmail';

/* ==================================================================================
   BACKEND ARCHITECTURE & DATABASE SCHEMA REQUIREMENTS (MEMO FOR DEVELOPMENT)
   ==================================================================================
   1. FAMILIAL LINKAGE (SIBLINGS NODE): Students grouped by 'ParentID' / 'FamilyId'.
   2. LEDGER PERSISTENCE POLICY: If status is 'Passed Out' or 'TC Issued', do NOT 
      purge if 'pendingFees > 0'. Account remains un-deletable until balance is 0.
   3. FEE AUTO-DISTRIBUTION: Equal Split among siblings OR Individual Override.
   4. PURGE ENGINE: Drop from registry ONLY if (Status === Passout/TC) AND (Pending === 0).
   ================================================================================== */

// 1. App.jsx se setActivePage ko as a prop accept kiya
const Finance = ({ setActivePage }) => {
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSendingReceiptMail, setIsSendingReceiptMail] = useState(false);
  
  // NAVIGATION CONTROL SYSTEM STATES
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'list' | 'ledger' | 'receipt'
  const [selectedClass, setSelectedClass] = useState({ id: '', name: '' });
  const [selectedStudent, setSelectedStudent] = useState({ admNo: '', name: '' });

  // SEARCH, SORT & TRANSACTION STATES
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('none');
  const [paymentMode, setPaymentMode] = useState('family'); // 'family' | 'individual'
  const [selectedIndividualId, setSelectedIndividualId] = useState('s1');
  const [inputAmount, setInputAmount] = useState('');
  const [latestReceipt, setLatestReceipt] = useState(null);

  // NOTE: Router ka useNavigate poori tarah se hata diya h taaki useContext crash na ho.

  // MASTER DATA REPOSITORIES (MOCK)
  const statsOverview = [
    { id: 1, title: 'Total Collection', value: '₹18,45,000', icon: DollarSign, trend: '+12% from last month' },
    { id: 2, title: 'Total Collected', value: '₹14,20,000', icon: TrendingUp, trend: '76.9% recovery rate' },
    { id: 3, title: 'Total Pending', value: '₹4,25,000', icon: Clock, trend: 'Requires urgent action' },
    { id: 4, title: 'Total Students', value: '1,240', icon: Users, trend: 'Active directory count' },
  ];

  const graphLineData = [
    { month: 'Jan', Total: 1200000, Collected: 950000, Pending: 250000 },
    { month: 'Feb', Total: 1400000, Collected: 1100000, Pending: 300000 },
    { month: 'Mar', Total: 1600000, Collected: 1300000, Pending: 300000 },
    { month: 'Apr', Total: 1845000, Collected: 1420000, Pending: 425000 },
  ];

  const classFinanceData = [
    { id: 'c1', className: 'Class 1', collected: 80, pending: 20, collectedAmt: '₹1,60,000', pendingAmt: '₹40,000' },
    { id: 'c2', className: 'Class 2', collected: 75, pending: 25, collectedAmt: '₹1,50,000', pendingAmt: '₹50,000' },
    { id: 'c3', className: 'Class 3', collected: 90, pending: 10, collectedAmt: '₹1,80,000', pendingAmt: '₹20,000' },
    { id: 'c4', className: 'Class 4', collected: 60, pending: 40, collectedAmt: '₹1,20,000', pendingAmt: '₹80,000' },
    { id: 'c5', className: 'Class 5', collected: 85, pending: 15, rounded: '₹1,70,000', pendingAmt: '₹30,000' },
    { id: 'c6', className: 'Class 6', collected: 70, pending: 30, collectedAmt: '₹1,40,000', pendingAmt: '₹60,000' },
  ];

  const studentsData = [
    { admNo: '2026/0104', name: 'Aarav Sharma', fatherName: 'Rajesh Sharma', contact: '9876543210', guardianEmail: 'rajesh.sharma@example.com', paidFees: '₹40,000', pendingFees: 10000 },
    { admNo: '2026/0215', name: 'Isha Patel', fatherName: 'Amit Patel', contact: '8765432109', guardianEmail: 'amit.patel@example.com', paidFees: '₹35,000', pendingFees: 15000 },
    { admNo: '2026/0089', name: 'Kabir Verma', fatherName: 'Sanjay Verma', contact: '7654321098', guardianEmail: 'sanjay.verma@example.com', paidFees: '₹50,000', pendingFees: 0 },
    { admNo: '2026/0342', name: 'Riya Sen', fatherName: 'Pradeep Sen', contact: '6543210987', guardianEmail: 'pradeep.sen@example.com', paidFees: '₹20,000', pendingFees: 30000 },
    { admNo: '2026/0112', name: 'Vivaan Joshi', fatherName: 'Manoj Joshi', contact: '9988776655', guardianEmail: 'manoj.joshi@example.com', paidFees: '₹45,000', pendingFees: 5000 },
  ];

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
      { id: 's3', name: 'Rahul Sharma', class: 'Class 12', gender: 'Male', status: 'Passed Out', pendingFees: 15000, paidFees: 35000 }
    ],
    historicalLogs: [
      { session: '2025-2026', totalAssigned: '₹75,000', recovered: '₹65,000', balance: '₹10,000' },
      { session: '2024-2025', totalAssigned: '₹60,000', recovered: '₹60,000', balance: '₹0' }
    ]
  });

  // LOGIC CONTROLLERS
  const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

  const buildFeeReminderMessage = (student) => ({
    to: student.guardianEmail,
    subject: `Fee Reminder: ${student.name} (${student.admNo})`,
    text: [
      `Dear ${student.fatherName},`,
      '',
      `This is a fee reminder for ${student.name} (${student.admNo}).`,
      `Pending amount: ${formatCurrency(student.pendingFees)}.`,
      '',
      'Please clear the pending dues at the earliest or contact the accounts office for any clarification.',
      '',
      'Regards,',
      'Accounts Department',
      'MGPS ERP Portal',
    ].join('\n'),
  });

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

  const triggerBroadcastReminders = async (channel) => {
    if (channel !== 'gmail') {
      alert(`⚡ Core Broadcast: Alerts dispatched via [${channel.toUpperCase()}].`);
      return;
    }

    const reminderMessages = studentsData
      .filter((student) => student.pendingFees > 0 && student.guardianEmail)
      .map(buildFeeReminderMessage);

    if (reminderMessages.length === 0) {
      alert('No pending-fee Gmail recipients found.');
      return;
    }

    setIsSendingReminder(true);
    try {
      const result = await sendGmailMessages(reminderMessages);
      alert(`Gmail reminders sent successfully to ${result.sent} guardian account(s).`);
    } catch (error) {
      alert(`Gmail reminder failed: ${error.message}`);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const sendReceiptMail = async (receipt) => {
    const receiptMessage = buildReceiptMessage(receipt);

    if (!receiptMessage.to) {
      alert('Guardian Gmail is missing for this receipt.');
      return;
    }

    setIsSendingReceiptMail(true);
    try {
      await sendGmailMessages(receiptMessage);
      alert(`Receipt mailed successfully to ${receiptMessage.to}.`);
    } catch (error) {
      alert(`Receipt Gmail failed: ${error.message}`);
    } finally {
      setIsSendingReceiptMail(false);
    }
  };

  const processedStudents = studentsData
    .filter(student => {
      const match = searchTerm.toLowerCase();
      return student.name.toLowerCase().includes(match) || student.admNo.toLowerCase().includes(match) || student.fatherName.toLowerCase().includes(match);
    })
    .sort((a, b) => {
      if (sortOrder === 'high-to-low') return b.pendingFees - a.pendingFees;
      if (sortOrder === 'low-to-high') return a.pendingFees - b.pendingFees;
      return 0;
    });

  const totalFamilyPending = familyProfile.students.reduce((acc, curr) => acc + curr.pendingFees, 0);

  // EXECUTE PAYMENTS WITHOUT ROUTER INTERRUPTIONS
  const executeManualPayment = (e) => {
    e.preventDefault();
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return alert("❌ Enter valid amount.");

    let updatedStudents = [...familyProfile.students];
    let breakdown = [];

    if (paymentMode === 'family') {
      const duesList = updatedStudents.filter(s => s.pendingFees > 0);
      if (duesList.length === 0) return alert("All clear!");
      const split = amount / duesList.length;

      updatedStudents = updatedStudents.map(s => {
        if (s.pendingFees > 0) {
          const ded = Math.min(split, s.pendingFees);
          breakdown.push({ name: s.name, allocated: Number(ded.toFixed(2)) });
          return { ...s, pendingFees: s.pendingFees - ded, paidFees: s.paidFees + ded };
        }
        return s;
      });
    } else {
      updatedStudents = updatedStudents.map(s => {
        if (s.id === selectedIndividualId) {
          const ded = Math.min(amount, s.pendingFees);
          breakdown.push({ name: s.name, allocated: Number(ded.toFixed(2)) });
          return { ...s, pendingFees: s.pendingFees - ded, paidFees: s.paidFees + ded };
        }
        return s;
      });
    }

    // Fixed State syntax
    setFamilyProfile(prev => ({ ...prev, students: updatedStudents }));
    
    const payload = {
      receiptNo: `REC-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleString(),
      amountPaid: amount,
      breakdown,
      familyDetails: {
        fatherName: familyProfile.fatherName,
        contact: familyProfile.contact,
        guardianEmail: familyProfile.guardianEmail
      }
    };

    // Data safely persisted for standalone component access
    try {
      localStorage.setItem('latest_invoice_payload', JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to persist invoice payload', err);
    }

    setLatestReceipt(payload);
    setInputAmount('');

    // 2. STATE REDIRECTION: Agar App.jsx se activePage prop mila h toh direct switch maaro
    if (typeof setActivePage === 'function') {
      setActivePage('Fees Receipt');
    } else {
      // Fallback agar direct page state render chal raha ho bina layout sync ke
      setCurrentView('receipt');
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#D9D9D9] p-6 text-neutral-800 font-sans box-border select-none">
      
      {/* ====================================================================
          VIEW 1: DASHBOARD
          ==================================================================== */}
      {currentView === 'dashboard' && (
        <div className="animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2 text-neutral-900">
                Institutional Finance Ledger <Sparkles className="w-5 h-5 text-neutral-700" />
              </h2>
              <p className="text-xs text-neutral-600 font-medium font-mono mt-1">MODULE CORE: SECURED MANUAL LEDGER CONTROLS</p>
            </div>
            <div className="flex items-center gap-2 bg-[#ffffff] p-1.5 rounded-2xl border border-neutral-300 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 text-neutral-500 font-mono flex items-center gap-1">Reminders:</span>
              <button onClick={() => triggerBroadcastReminders('gmail')} disabled={isSendingReminder} className="flex items-center gap-1 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-xl transition-all"><Mail className="w-3.5 h-3.5 text-red-500" /> Via Gmail</button>
              <button onClick={() => triggerBroadcastReminders('whatsapp')} disabled={isSendingReminder} className="flex items-center gap-1 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-xl transition-all"><MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Via WhatsApp</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statsOverview.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.id} className="bg-[#ffffff] p-5 rounded-2xl flex flex-col justify-between shadow-md border border-neutral-300/40">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase text-neutral-500 font-mono">{card.title}</span>
                    <div className="w-7 h-7 bg-neutral-100 border border-neutral-200 rounded-xl flex items-center justify-center"><Icon className="w-4 h-4" /></div>
                  </div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{card.value}</h3>
                </div>
              );
            })}
          </div>

          <div className="w-full bg-[#ffffff] border border-neutral-300 shadow-md p-5 rounded-2xl mb-6">
            <div className="w-full h-64 font-mono text-[10px] font-bold">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphLineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="month" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Total" stroke="#4B5563" strokeWidth={3} />
                  <Line type="monotone" dataKey="Collected" stroke="#10B981" strokeWidth={3} />
                  <Line type="monotone" dataKey="Pending" stroke="#EF4444" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-600 mb-4 font-mono">Classwise Accounts Index</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classFinanceData.map((cls) => (
              <div key={cls.id} onClick={() => { setSelectedClass({ id: cls.id, name: cls.className }); setCurrentView('list'); }} className="bg-[#ffffff] hover:bg-neutral-50 border border-neutral-300 p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between group shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-black text-neutral-900">{cls.className}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-800" />
                </div>
                <div className="flex justify-between text-[10px] font-mono font-bold mb-2.5">
                  <span className="text-emerald-600">Coll: {cls.collectedAmt}</span>
                  <span className="text-red-600">Pend: {cls.pendingAmt}</span>
                </div>
                <div className="w-full h-2.5 bg-neutral-200 rounded-full flex overflow-hidden border border-neutral-300">
                  <div className="h-full bg-emerald-500" style={{ width: `${cls.collected}%` }} />
                  <div className="h-full bg-red-500" style={{ width: `${cls.pending}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ====================================================================
          VIEW 2: CLASS FINANCE LIST
          ==================================================================== */}
      {currentView === 'list' && (
        <div className="animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentView('dashboard')} className="p-2 bg-white border border-neutral-300 rounded-xl shadow-sm"><ArrowLeft className="w-4 h-4" /></button>
              <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900">{selectedClass.name} Financial Log</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative bg-white rounded-xl border border-neutral-300 shadow-sm flex items-center px-3 py-1.5 w-full sm:w-64">
                <Search className="w-4 h-4 text-neutral-400 mr-2" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="bg-transparent text-xs text-neutral-800 outline-none w-full font-medium" />
              </div>
              <button onClick={() => setSortOrder(sortOrder === 'high-to-low' ? 'low-to-high' : 'high-to-low')} className="flex items-center gap-1.5 text-[10px] font-black bg-white border border-neutral-300 px-3 py-2.5 rounded-xl shadow-sm">
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort Due: {sortOrder}
              </button>
            </div>
          </div>

          <div className="w-full bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-black uppercase text-neutral-500 font-mono">
                    <th className="py-3 px-4">Adm. Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Father's Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Paid Fees</th>
                    <th className="py-3 px-4 text-right">Pending Fees</th>
                    <th className="py-3 px-4 text-center">Action Matrix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {processedStudents.map((student) => (
                    <tr key={student.admNo} className="hover:bg-neutral-50/60">
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-600">{student.admNo}</td>
                      <td className="py-3.5 px-4 font-bold text-neutral-900">{student.name}</td>
                      <td className="py-3.5 px-4 text-neutral-600">{student.fatherName}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-500">{student.contact}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">{student.paidFees}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-red-500">₹{student.pendingFees}</td>
                      <td className="py-3.5 px-4 text-center">
                        <button onClick={() => { setSelectedStudent({ admNo: student.admNo, name: student.name }); setCurrentView('ledger'); }} className="inline-flex items-center gap-1 text-[10px] font-black bg-neutral-100 border border-neutral-300 px-3 py-1.5 rounded-xl hover:bg-neutral-800 hover:text-white transition-all">
                          <Eye className="w-3 h-3" /> View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          VIEW 3: STUDENT LEDGER BOOK 
          ==================================================================== */}
      {currentView === 'ledger' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-neutral-400/60 pb-4">
            <button onClick={() => setCurrentView('list')} className="p-2 bg-white border border-neutral-300 rounded-xl shadow-xs"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <h2 className="text-xl font-black uppercase text-neutral-900">Secure Family Ledger: {selectedStudent.name}</h2>
              <p className="text-xs text-neutral-600 font-mono">Family ID: {familyProfile.familyId}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">FATHER NAME</span><p className="text-sm font-bold">{familyProfile.fatherName}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">MOTHER NAME</span><p className="text-sm font-bold">{familyProfile.motherName}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">CONTACT LINK</span><p className="text-sm font-bold font-mono">{familyProfile.contact}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">CATEGORY</span><p className="text-sm font-bold uppercase">{familyProfile.category}</p></div>
          </div>

          <div className="bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase font-mono text-neutral-500">Connected Sibling Registers</h3>
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-black font-mono">TOTAL FAMILY DUES: ₹{totalFamilyPending}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[9px] font-black text-neutral-400 font-mono">
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Cumulative Paid</th>
                    <th className="p-3 text-right">Unpaid Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {familyProfile.students.map((student) => (
                    <tr key={student.id} className="hover:bg-neutral-50/50">
                      <td className="p-3 font-bold text-neutral-900">
                        {student.name} {student.status === 'Passed Out' && student.pendingFees === 0 && <span className="ml-2 text-[9px] bg-neutral-200 px-1.5 rounded text-neutral-500">PASSED OUT LABEL</span>}
                      </td>
                      <td className="p-3 font-mono">{student.class}</td>
                      <td className="p-3">{student.gender}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-black ${student.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{student.status}</span>
                      </td>
                      <td className="p-3 text-right text-emerald-600 font-bold font-mono">₹{student.paidFees}</td>
                      <td className={`p-3 text-right font-bold font-mono ${student.pendingFees > 0 ? 'text-red-500' : 'text-neutral-400'}`}>₹{student.pendingFees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md md:col-span-2 space-y-4">
              <h4 className="text-xs font-black uppercase text-neutral-900 flex items-center gap-1"><CreditCard className="w-4 h-4" /> Secure Fee Collection Rig</h4>
              <form onSubmit={executeManualPayment} className="space-y-4">
                <div className="flex gap-4 bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={paymentMode === 'family'} onChange={() => setPaymentMode('family')} /> Distributed Pooling (Equal Split)</label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={paymentMode === 'individual'} onChange={() => setPaymentMode('individual')} /> Targeted Override</label>
                </div>
                {paymentMode === 'individual' && (
                  <select value={selectedIndividualId} onChange={(e) => setSelectedIndividualId(e.target.value)} className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none">
                    {familyProfile.students.map(s => (<option key={s.id} value={s.id}>{s.name} - Due: ₹{s.pendingFees}</option>))}
                  </select>
                )}
                <div className="relative flex items-center bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1">
                  <span className="text-sm font-mono font-black mr-2">₹</span>
                  <input type="number" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} placeholder="Amount to collect..." className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold" />
                </div>
                <button type="submit" className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-md">COMMIT MANUAL RECEIPT</button>
              </form>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-neutral-900 flex items-center gap-1.5 mb-3"><Layers className="w-4 h-4" /> Historic Ledger Stream</h4>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                  {familyProfile.historicalLogs.map((log, i) => (
                    <div key={i} className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 text-[11px] font-mono font-bold">
                      <div className="flex justify-between text-neutral-900 font-black"><span>SESSION: {log.session}</span><span className="text-emerald-600">BAL: {log.balance}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[10px] text-amber-800 font-mono mt-3 flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>Account cannot be deleted while indices show outstanding dues.</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          VIEW 4: FEES RECEIPT INVOICE (`FeesReceipt.jsx` Integrated Screen Backup)
          ==================================================================== */}
      {currentView === 'receipt' && latestReceipt && (
        <div className="max-w-xl mx-auto bg-white border border-neutral-400 p-6 rounded-2xl shadow-2xl space-y-6 text-left">
          <div className="text-center space-y-1 border-b border-dashed border-neutral-300 pb-4">
            <h3 className="text-base font-black uppercase tracking-widest text-neutral-900">Institutional Remittance Invoice</h3>
            <p className="text-[10px] font-mono text-neutral-400">{latestReceipt.timestamp} | Ref: {latestReceipt.receiptNo}</p>
          </div>
          <div className="text-xs space-y-1 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <p><strong>Primary Guardian:</strong> {latestReceipt.familyDetails?.fatherName}</p>
            <p><strong>Registered Mobile:</strong> {latestReceipt.familyDetails?.contact}</p>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {latestReceipt.breakdown?.map((item, index) => (
              <div key={index} className="p-2 flex justify-between border-b border-neutral-100"><span>{item.name}</span><span className="font-bold">₹{item.allocated}</span></div>
            ))}
            <div className="p-3 bg-neutral-900 text-white flex justify-between rounded-xl font-black"><span>Total Collected</span><span>₹{latestReceipt.amountPaid}</span></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={() => window.print()} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"><Printer className="w-3.5 h-3.5" /> Local Print</button>
            <button onClick={() => alert(`⚡ Sending WhatsApp Alert to ${latestReceipt.familyDetails?.contact}: Total ₹${latestReceipt.amountPaid} credited successfully.`)} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"><MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp</button>
            <button onClick={() => sendReceiptMail(latestReceipt)} disabled={isSendingReceiptMail} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl disabled:opacity-60"><Mail className="w-3.5 h-3.5 text-red-500" /> {isSendingReceiptMail ? 'Sending...' : 'Gmail Broadcast'}</button>
          </div>
          <button onClick={() => setCurrentView('dashboard')} className="w-full py-2.5 text-center text-xs font-black border border-neutral-800 rounded-xl hover:bg-neutral-900 hover:text-white transition-all">EXIT TO MAIN DASHBOARD</button>
        </div>
      )}

    </div>
  );
};

export default Finance;
