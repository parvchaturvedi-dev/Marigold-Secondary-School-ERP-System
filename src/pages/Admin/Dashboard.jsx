import React from 'react';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  UserPlus, 
  FilePlus, 
  BellRing, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  CalendarDays
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const attendanceData = [];

const feeStatusData = [];

const Dashboard = () => {

  // Quick Actions Helper Array (Sidebar links se connected)
  const quickActions = [
    { label: 'Add Student', icon: UserPlus, bg: 'bg-[#FFF8EC]', text: 'text-[#f59e0b]', border: 'border-[#F5E6CC]' },
    { label: 'Post Notice', icon: BellRing, bg: 'bg-[#F5F3FF]', text: 'text-[#8b5cf6]', border: 'border-[#E8E3FF]' },
    { label: 'Create Assignment', icon: FilePlus, bg: 'bg-[#E6FFFA]', text: 'text-[#06b6d4]', border: 'border-[#CCFBF1]' },
    { label: 'Approve Leaves', icon: CheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  ];

  return (
    <div className="space-y-6 pb-8 select-none">
      
      {/* SECTION 1: NEW QUICK ACTIONS PANEL */}
      <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-3.5">Admin Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button 
                key={index}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border ${action.bg} ${action.border} hover:scale-[1.02] transition-transform duration-200 text-left`}
              >
                <div className={`p-2 bg-white rounded-xl ${action.text} shadow-sm shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#1A1A1A] leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: METRICS & ATTENDANCE GRAPH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Academic Overview Card Container */}
        <div className="lg:col-span-1 bg-[#EAEAEA] p-4 rounded-3xl flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1A1A1A] px-2 mb-1">Academic Overview</h3>

          {/* Card 1: Total Students */}
          <div className="bg-[#FFF8EC] p-4 rounded-2xl border border-[#F5E6CC] flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-[#1A1A1A]">0</span>
                <p className="text-xs font-semibold text-[#666666] mt-1">Total Students</p>
              </div>
              <div className="p-2.5 bg-[#FCECD2] rounded-full text-[#f59e0b]">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" /> <span>Mongo data pending</span>
            </div>
          </div>

          {/* Card 2: Total Teachers */}
          <div className="bg-[#F5F3FF] p-4 rounded-2xl border border-[#E8E3FF] flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-[#1A1A1A]">0</span>
                <p className="text-xs font-semibold text-[#666666] mt-1">Total Teachers</p>
              </div>
              <div className="p-2.5 bg-[#EBE5FF] rounded-full text-[#8b5cf6]">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" /> <span>Mongo data pending</span>
            </div>
          </div>

          {/* Card 3: Total Classes */}
          <div className="bg-[#E6FFFA] p-4 rounded-2xl border border-[#CCFBF1] flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-[#1A1A1A]">0</span>
                <p className="text-xs font-semibold text-[#666666] mt-1">Active Classes</p>
              </div>
              <div className="p-2.5 bg-[#CCFBF1] rounded-full text-[#06b6d4]">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" /> <span>Stable Sections</span>
            </div>
          </div>
        </div>

        {/* Attendance Analytics Graphic */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-[#EAEAEA] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1A1A1A]">Attendance Analytics</h3>
              <p className="text-[11px] text-[#666666]">Monthly average overview of student consistency</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#f59e0b] rounded-full"></span> Present</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#8b5cf6] rounded-full"></span> Absent</span>
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" h="100%">
              <LineChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="Present" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Absent" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* SECTION 3: LOWER COLUMN (Finance, Performers & Live Notices) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Finance & Fees breakdown */}
        <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-[#EAEAEA] flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-[#1A1A1A]">Finance & Fee Analytics</h3>
            <p className="text-[11px] text-[#666666]">Current quarter status breakdown</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 mt-4">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={feeStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={4} dataKey="value">
                    {feeStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-lg font-black text-[#1A1A1A]">100%</span>
                <p className="text-[9px] text-gray-400 font-bold tracking-wider">ALLOCATED</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-xs font-semibold w-full">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                <span className="text-cyan-600">70% Collected</span>
                <span className="text-gray-400 font-normal">Regular</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                <span className="text-amber-500">20% Pending</span>
                <span className="text-gray-400 font-normal">Grace Period</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performing Classes Panel */}
        <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm">
          <h3 className="text-sm font-bold text-[#1A1A1A] mb-4">Top Performing Classes</h3>
          
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[#F5F3FF] text-[#8b5cf6] rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <p className="text-[#1A1A1A]">Class XII-A</p>
                  <p className="text-[10px] font-normal text-gray-400">Science Stream</p>
                </div>
              </div>
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">98.2% GPA</span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[#FFF8EC] text-[#f59e0b] rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <p className="text-[#1A1A1A]">Class X-B</p>
                  <p className="text-[10px] font-normal text-gray-400">General Academic</p>
                </div>
              </div>
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">95.4% GPA</span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[#E6FFFA] text-[#06b6d4] rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <p className="text-[#1A1A1A]">Class XI-C</p>
                  <p className="text-[10px] font-normal text-gray-400">Commerce Stream</p>
                </div>
              </div>
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">92.1% GPA</span>
            </div>
          </div>
        </div>

        {/* NEW FEATURE: LIVE NOTICE BOARD & MEETING UPDATES */}
        <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1A1A1A] mb-1">Live Updates & Notices</h3>
            <p className="text-[11px] text-[#666666] mb-3">Real-time alerts from Notice section</p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Notice 1 */}
            <div className="flex gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[#1A1A1A]">Final Exam Schedule Out</p>
                <p className="text-[10px] text-gray-400 font-medium">Uploaded 2 hours ago • Exam Dept</p>
              </div>
            </div>

            {/* Notice 2 */}
            <div className="flex gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[#1A1A1A]">Teacher-Parent Meeting</p>
                <p className="text-[10px] text-gray-400 font-medium">Scheduled for Saturday • XII-A</p>
              </div>
            </div>

            {/* Notice 3 */}
            <div className="flex gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-500 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[#1A1A1A]">5 Pending Leave Requests</p>
                <p className="text-[10px] text-gray-400 font-medium">Requires immediate clerk review</p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
