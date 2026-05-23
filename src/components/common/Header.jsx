import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  Clock,
  GraduationCap,
  LogOut,
  Search,
  Settings,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

const Header = ({ session, onLogout, onPageChange, onStudentChange }) => {
  // UI Interactive Toggle States
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadBox, setShowUnreadBox] = useState(false);
  const [showFullPanel, setShowFullPanel] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showStudentMenu, setShowStudentMenu] = useState(false);

  const [notifications] = useState([]);

  // Derived unread computations
  const unreadCount = notifications.filter(n => n.unread).length;
  const studentProfiles = session?.studentProfiles || [];
  const activeStudent = session?.activeStudent || studentProfiles[0] || null;
  const isStudentPortal = session?.role === 'student';
  const displayName = activeStudent?.displayName || session?.displayName || session?.username || 'MGPS User';
  const activeStudentMeta = activeStudent
    ? `${activeStudent.className}-${activeStudent.section} | Roll ${activeStudent.rollNo}`
    : '';
  const avatarUrl = activeStudent?.photoDataUrl || session?.photoDataUrl || '';

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      alert(`Executing core search vector pipeline for: "${searchQuery}"`);
    }
  };

  const handleStudentSelection = (studentId) => {
    const nextStudent = studentProfiles.find((student) => student.id === studentId);
    if (!nextStudent || nextStudent.id === session?.selectedStudentId) {
      setShowStudentMenu(false);
      return;
    }

    const confirmed = window.confirm(
      `Switch portal to ${nextStudent.displayName} (${nextStudent.className}-${nextStudent.section})?`
    );

    if (!confirmed) return;

    if (typeof onStudentChange === 'function') {
      onStudentChange(nextStudent.id);
    }

    setShowStudentMenu(false);
  };

  return (
    // shrink-0 lagaya hai taaki page content ise compress na kare
    <header className="bg-[#D9D9D9] px-8 py-4 flex items-center justify-between font-sans select-none border-b border-[#C8C8C8] shrink-0 relative z-40">
      
      {/* Left Side: Welcome Message */}
      <div className="flex flex-col">
        <h1 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-1.5">
          Welcome, {displayName}
        </h1>
        <p className="text-xs text-[#555555] mt-0.5">
          {isStudentPortal && activeStudent
            ? `${activeStudentMeta} | ${session?.isSiblingAccount ? session?.accountDisplayName : 'Solo student account'}`
            : "Here's what happening in your institutional domain."}
        </p>
      </div>

      {/* Right Side: Action Control Panel (Capsule Style) */}
      <div className="flex items-center gap-2 bg-[#EAEAEA] px-4 py-2 rounded-full shadow-xs relative">
        {isStudentPortal && activeStudent && (
          <>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowStudentMenu((prev) => !prev);
                  setShowUnreadBox(false);
                  setShowProfileMenu(false);
                }}
                className={`h-8 flex items-center gap-2 pl-2.5 pr-2 rounded-full border text-[11px] font-black transition-colors ${
                  showStudentMenu
                    ? 'bg-black text-[#E1FA6C] border-black'
                    : 'bg-white text-[#1A1A1A] border-[#C8C8C8] hover:border-black'
                }`}
                title="Select student user"
              >
                {session?.isSiblingAccount ? (
                  <Users className="w-4 h-4 shrink-0" />
                ) : (
                  <GraduationCap className="w-4 h-4 shrink-0" />
                )}
                <span className="hidden md:inline max-w-32 truncate">
                  Select User
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${showStudentMenu ? 'rotate-180' : ''}`} />
              </button>

              {showStudentMenu && (
                <div className="absolute right-0 mt-3 w-72 bg-white border border-[#C8C8C8] rounded-2xl shadow-xl z-50 text-xs font-bold overflow-hidden animate-scaleUp">
                  <div className="bg-[#EAEAEA]/70 px-4 py-3 border-b border-[#C8C8C8]">
                    <p className="text-[#1A1A1A] font-black">
                      {session?.isSiblingAccount ? 'Sibling Account Users' : 'Solo Student Account'}
                    </p>
                    <p className="text-[10px] text-[#555555] font-semibold mt-0.5">
                      Selection controls the whole student portal.
                    </p>
                  </div>

                  <div className="max-h-64 overflow-y-auto p-1.5">
                    {studentProfiles.map((student) => {
                      const isActive = student.id === activeStudent.id;

                      return (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => handleStudentSelection(student.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between gap-3 ${
                            isActive
                              ? 'bg-[#E1FA6C] text-[#1A1A1A]'
                              : 'hover:bg-[#EAEAEA] text-neutral-700'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-black">{student.displayName}</span>
                            <span className="block text-[10px] font-mono text-[#555555] truncate">
                              {student.admissionNumber} | {student.className}-{student.section}
                            </span>
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-md shrink-0 ${
                            isActive ? 'bg-black text-[#E1FA6C]' : 'bg-[#EAEAEA] text-[#555555]'
                          }`}>
                            {isActive ? 'ACTIVE' : 'SWITCH'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <span className="w-[1px] h-4 bg-[#C8C8C8] mx-1"></span>
          </>
        )}
        
        {/* 1. FUNCTIONAL SEARCH ENGINE BAR */}
        <div className="flex items-center transition-all duration-300">
          {showSearchInput && (
            <form onSubmit={handleSearchSubmit} className="mr-2 animate-fadeIn">
              <input 
                type="text"
                placeholder="Search database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#D9D9D9] text-xs font-bold text-[#1A1A1A] px-3 py-1 rounded-full border border-[#C8C8C8] outline-none w-36 md:w-48 focus:border-black transition-all"
              />
            </form>
          )}
          <button 
            type="button"
            onClick={() => setShowSearchInput(!showSearchInput)}
            className={`p-1.5 rounded-full transition-colors ${showSearchInput ? 'bg-black text-[#E1FA6C]' : 'hover:bg-[#D9D9D9] text-[#555555] hover:text-[#1A1A1A]'}`} 
            title="Search Engine Toggle"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        <span className="w-[1px] h-4 bg-[#C8C8C8] mx-1"></span>

        {/* 2. NOTIFICATIONS CONTROLLER COMPONENT */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => { setShowUnreadBox(!showUnreadBox); setShowProfileMenu(false); setShowStudentMenu(false); }}
            className={`p-1.5 rounded-full transition-colors relative ${showUnreadBox ? 'bg-black text-[#E1FA6C]' : 'hover:bg-[#D9D9D9] text-[#555555] hover:text-[#1A1A1A]'}`} 
            title="Notifications Hub"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#EAEAEA]"></span>
            )}
          </button>

          {/* FLOATING UNREAD BOX APPEND TRIGGER */}
          {showUnreadBox && (
            <div className="absolute right-0 mt-3 w-72 bg-white border border-[#C8C8C8] rounded-2xl shadow-xl z-50 text-xs font-bold overflow-hidden animate-scaleUp">
              <div className="bg-[#EAEAEA]/60 px-4 py-2.5 border-b border-[#C8C8C8] flex justify-between items-center">
                <span className="text-[#1A1A1A]">Unread Alerts</span>
                <span className="bg-red-500 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-md font-black">{unreadCount} NEW</span>
              </div>
              
              <div className="max-h-48 overflow-y-auto divide-y divide-[#EAEAEA]">
                {notifications.filter(n => n.unread).length === 0 ? (
                  <p className="p-4 text-center text-[#555555] text-[11px] italic font-semibold">No unread alerts in workspace buffer.</p>
                ) : (
                  notifications.filter(n => n.unread).map((notif) => (
                    <div key={notif.id} className="p-3 hover:bg-[#EAEAEA]/30 transition-colors">
                      <p className="text-[#1A1A1A] text-[11px] leading-tight font-semibold">{notif.text}</p>
                      <span className="text-[9px] text-[#555555] font-mono block mt-1">{notif.time}</span>
                    </div>
                  ))
                )}
              </div>

              {/* VIEW ALL REDIRECT ACTION BLOCK */}
              <button 
                type="button"
                onClick={() => { setShowFullPanel(true); setShowUnreadBox(false); }}
                className="w-full bg-[#1A1A1A] text-[#E1FA6C] py-2 text-center text-[10px] font-black uppercase tracking-wider block hover:opacity-90 transition-all border-t border-[#C8C8C8]"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>

        <span className="w-[1px] h-4 bg-[#C8C8C8] mx-1"></span>

        {/* 3. HOVERABLE PROFILE CONTEXT BOX */}
        <div 
          className="relative"
          onMouseEnter={() => { setShowProfileMenu(true); setShowStudentMenu(false); }}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <button type="button" className="flex items-center justify-center w-7 h-7 rounded-full bg-[#D9D9D9] hover:bg-[#CCCCCC] transition-colors border border-[#C8C8C8] overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-[#555555]" />
            )}
          </button>

          {/* DYNAMIC HOVER DROPDOWN PANEL MODULE */}
          {showProfileMenu && (
            <div className="absolute right-0 top-6 pt-3 w-44 z-50 animate-scaleUp">
              <div className="bg-white border border-[#C8C8C8] rounded-xl shadow-lg py-1.5 text-xs font-black text-[#1A1A1A] overflow-hidden">
                <button 
                  type="button"
                  onClick={() => {
                    if (typeof onPageChange === 'function') onPageChange('Profile');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#EAEAEA] flex items-center gap-2 text-neutral-700"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Go to Profile
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (typeof onPageChange === 'function') onPageChange('Settings');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#EAEAEA] flex items-center gap-2 text-neutral-700 border-t border-[#EAEAEA]/60"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (window.confirm('Terminate active security token session?')) {
                      if (typeof onLogout === 'function') onLogout();
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-[#EAEAEA]/60"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 4. LEFT TO RIGHT SLIDE-OUT PANEL DRAWER (UPDATED TO Exact 40vw WIDTH) */}
      {showFullPanel && (
        <div className="fixed inset-y-0 right-0 z-50 flex animate-slideInRight">
          {/* Backdrop Blur Mesh overlay */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowFullPanel(false)} />
          
          {/* Main 40vw Dimensional Drawer Frame */}
          <div className="relative bg-white border-l border-[#C8C8C8] h-screen shadow-2xl flex flex-col z-10 w-[40vw]">
            
            {/* Drawer Header Block */}
            <div className="p-4 bg-[#EAEAEA]/80 border-b border-[#C8C8C8] flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#1A1A1A]">Master Alert History</h4>
                <p className="text-[9px] text-[#555555] font-semibold">Chronological Timeline Buffer</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowFullPanel(false)}
                className="p-1 hover:bg-[#D9D9D9] rounded-lg transition-colors text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Timewise Notification Rows Data Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#D9D9D9]/20">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-3.5 rounded-xl border text-[11px] font-bold text-[#1A1A1A] space-y-1.5 bg-white transition-all ${notif.unread ? 'border-amber-400 shadow-2xs' : 'border-[#C8C8C8]/60'}`}
                >
                  <p className="leading-relaxed">{notif.text}</p>
                  <div className="flex items-center gap-1 text-[9px] text-[#555555] font-mono">
                    <Clock className="w-3 h-3 text-[#555555]" />
                    <span>{notif.time}</span>
                    {notif.unread && (
                      <span className="ml-auto text-[8px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">New</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

    </header>
  );
};

export default Header;
