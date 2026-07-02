import React, { useEffect, useRef, useState } from 'react';
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
import { apiFetch } from './api';
import { formatNotificationTime, useNotificationsDatabase } from './notificationStore';

const SEARCH_TYPE_LABELS = {
  student: 'Student',
  teacher: 'Teacher',
  class: 'Class',
  page: 'Page',
};

const Header = ({ session, onLogout, onPageChange, onStudentChange }) => {
  // UI Interactive Toggle States
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showUnreadBox, setShowUnreadBox] = useState(false);
  const [showFullPanel, setShowFullPanel] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showStudentMenu, setShowStudentMenu] = useState(false);

  const searchDebounceRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const runSearch = async (query) => {
    const requestId = ++searchRequestIdRef.current;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const payload = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
      if (!isMountedRef.current || requestId !== searchRequestIdRef.current) return;
      setSearchResults(Array.isArray(payload?.results) ? payload.results : []);
    } catch (err) {
      if (!isMountedRef.current || requestId !== searchRequestIdRef.current) return;
      setSearchError(err?.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      if (isMountedRef.current && requestId === searchRequestIdRef.current) {
        setSearchLoading(false);
      }
    }
  };

  const { notifications, error: notificationError, markRead } = useNotificationsDatabase(session);

  // Derived unread computations
  const unreadCount = notifications.filter(n => n.unread).length;
  const studentProfiles = session?.studentProfiles || [];
  const activeStudent = session?.activeStudent || studentProfiles[0] || null;
  const isStudentPortal = session?.role === 'student';
  const displayName =
    activeStudent?.displayName ||
    session?.displayName ||
    session?.accountDisplayName ||
    session?.username ||
    'MGPS User';
  const activeStudentMeta = activeStudent
    ? `${activeStudent.className}-${activeStudent.section} | Roll ${activeStudent.rollNo}`
    : '';
  const avatarUrl = activeStudent?.photoDataUrl || session?.photoDataUrl || '';

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setShowSearchDropdown(false);
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    setShowSearchDropdown(true);
    searchDebounceRef.current = setTimeout(() => {
      runSearch(trimmed);
    }, 350);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setShowSearchDropdown(true);
    runSearch(trimmed);
  };

  const handleSearchResultClick = (result) => {
    if (typeof onPageChange === 'function' && result?.page) {
      onPageChange(result.page);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
    setShowSearchInput(false);
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
    <header className="bg-white/40 backdrop-blur-xl px-4 sm:px-8 py-4 flex items-center justify-between font-sans select-none border-b border-white/60 shrink-0 relative z-40">

      {/* Left Side: Welcome Message */}
      <div className="flex flex-col min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-1.5 truncate">
          Welcome, <span className="text-gradient">{displayName}</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {isStudentPortal && activeStudent
            ? `${activeStudentMeta} | ${session?.isSiblingAccount ? session?.accountDisplayName : 'Solo student account'}`
            : "Here's what happening in your institutional domain."}
        </p>
      </div>

      {/* Right Side: Action Control Panel (Capsule Style) */}
      <div className="flex items-center gap-2 bg-white/55 backdrop-blur-md border border-white/70 px-3 sm:px-4 py-2 rounded-full shadow-sm relative shrink-0">
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
                className={`h-8 flex items-center gap-2 pl-2.5 pr-2 rounded-full border text-[11px] font-black transition-all ${
                  showStudentMenu
                    ? 'btn-primary border-transparent'
                    : 'bg-white/70 text-slate-800 border-white/80 hover:border-indigo-300 hover:shadow-sm'
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
                <div className="absolute right-0 mt-3 w-72 glass-strong rounded-2xl z-50 text-xs font-bold overflow-hidden animate-scaleUp">
                  <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-4 py-3 border-b border-white/60">
                    <p className="text-slate-900 font-black">
                      {session?.isSiblingAccount ? 'Sibling Account Users' : 'Solo Student Account'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
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
                          className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-3 ${
                            isActive
                              ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25'
                              : 'hover:bg-white/80 text-slate-700'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-black">{student.displayName}</span>
                            <span className={`block text-[10px] font-mono truncate ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                              {student.admissionNumber} | {student.className}-{student.section}
                            </span>
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-md shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
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

            <span className="w-[1px] h-4 bg-slate-300/60 mx-1"></span>
          </>
        )}

        {/* 1. FUNCTIONAL SEARCH ENGINE BAR */}
        <div className="relative flex items-center transition-all duration-300">
          {showSearchInput && (
            <form onSubmit={handleSearchSubmit} className="mr-2 animate-fadeIn relative">
              <input
                type="text"
                placeholder="Search database..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
                }}
                autoFocus
                className="bg-white/70 text-xs font-bold text-slate-800 px-3 py-1.5 rounded-full border border-white/80 outline-none w-36 md:w-48 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
              />

              {showSearchDropdown && (
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 glass-strong rounded-2xl z-50 text-xs font-bold overflow-hidden animate-scaleUp">
                  <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-4 py-2.5 border-b border-white/60 flex items-center justify-between">
                    <span className="text-slate-900">Search Results</span>
                    <button
                      type="button"
                      onClick={() => setShowSearchDropdown(false)}
                      className="p-0.5 rounded-md hover:bg-white/80 text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100/80">
                    {searchLoading ? (
                      <p className="p-4 text-center text-slate-500 text-[11px] italic font-semibold">Searching…</p>
                    ) : searchError ? (
                      <p className="p-4 text-center text-rose-600 text-[11px] font-semibold">{searchError}</p>
                    ) : searchResults.length === 0 ? (
                      <p className="p-4 text-center text-slate-500 text-[11px] italic font-semibold">No results found.</p>
                    ) : (
                      searchResults.map((result, idx) => (
                        <button
                          key={`${result.type}-${result.label}-${idx}`}
                          type="button"
                          onClick={() => handleSearchResultClick(result)}
                          className="w-full text-left px-4 py-2.5 hover:bg-white/80 transition-colors flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-black text-slate-900">{result.label}</span>
                            {result.sublabel && (
                              <span className="block text-[10px] font-semibold text-slate-500 truncate mt-0.5">
                                {result.sublabel}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wide">
                            {SEARCH_TYPE_LABELS[result.type] || result.type}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !showSearchInput;
              setShowSearchInput(next);
              if (!next) {
                setShowSearchDropdown(false);
                setSearchQuery('');
                setSearchResults([]);
              }
            }}
            className={`p-1.5 rounded-full transition-all ${showSearchInput ? 'btn-primary' : 'hover:bg-white/80 text-slate-500 hover:text-slate-900'}`}
            title="Search Engine Toggle"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        <span className="w-[1px] h-4 bg-slate-300/60 mx-1"></span>

        {/* 2. NOTIFICATIONS CONTROLLER COMPONENT */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowUnreadBox(!showUnreadBox); setShowProfileMenu(false); setShowStudentMenu(false); }}
            className={`p-1.5 rounded-full transition-all relative ${showUnreadBox ? 'btn-primary' : 'hover:bg-white/80 text-slate-500 hover:text-slate-900'}`}
            title="Notifications Hub"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white animate-pulse"></span>
            )}
          </button>

          {/* FLOATING UNREAD BOX APPEND TRIGGER */}
          {showUnreadBox && (
            <div className="absolute right-0 mt-3 w-72 glass-strong rounded-2xl z-50 text-xs font-bold overflow-hidden animate-scaleUp">
              <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-4 py-2.5 border-b border-white/60 flex justify-between items-center">
                <span className="text-slate-900">Unread Alerts</span>
                <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-md font-black shadow-sm">{unreadCount} NEW</span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100/80">
                {notificationError ? (
                  <p className="p-4 text-center text-rose-600 text-[11px] font-semibold">{notificationError}</p>
                ) : notifications.filter(n => n.unread).length === 0 ? (
                  <p className="p-4 text-center text-slate-500 text-[11px] italic font-semibold">No unread alerts in database.</p>
                ) : (
                  notifications.filter(n => n.unread).map((notif) => (
                    <div key={notif.id} className="p-3 hover:bg-white/70 transition-colors">
                      <p className="text-slate-900 text-[11px] leading-tight font-black">{notif.title}</p>
                      <p className="text-slate-500 text-[10px] leading-tight font-semibold mt-1">{notif.text}</p>
                      <span className="text-[9px] text-slate-400 font-mono block mt-1">{formatNotificationTime(notif.time)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* VIEW ALL REDIRECT ACTION BLOCK */}
              <button
                type="button"
                onClick={() => {
                  setShowFullPanel(true);
                  setShowUnreadBox(false);
                  markRead(notifications.filter((notif) => notif.unread).map((notif) => notif.id)).catch(() => {});
                }}
                className="w-full btn-primary py-2.5 text-center text-[10px] font-black uppercase tracking-wider block rounded-none"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>

        <span className="w-[1px] h-4 bg-slate-300/60 mx-1"></span>

        {/* 3. HOVERABLE PROFILE CONTEXT BOX */}
        <div
          className="relative"
          onMouseEnter={() => { setShowProfileMenu(true); setShowStudentMenu(false); }}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <button type="button" className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 hover:from-indigo-200 hover:to-violet-200 transition-all border border-white/80 shadow-sm overflow-hidden ring-2 ring-white/60">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          {/* DYNAMIC HOVER DROPDOWN PANEL MODULE */}
          {showProfileMenu && (
            <div className="absolute right-0 top-6 pt-3 w-44 z-50 animate-scaleUp">
              <div className="glass-strong rounded-xl py-1.5 text-xs font-black text-slate-900 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof onPageChange === 'function') onPageChange('Profile');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/80 flex items-center gap-2 text-slate-700 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Go to Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof onPageChange === 'function') onPageChange('Settings');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/80 flex items-center gap-2 text-slate-700 border-t border-slate-100/80 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-500" /> Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Terminate active security token session?')) {
                      if (typeof onLogout === 'function') onLogout();
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-600 border-t border-slate-100/80 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 4. LEFT TO RIGHT SLIDE-OUT PANEL DRAWER */}
      {showFullPanel && (
        <div className="fixed inset-y-0 right-0 z-50 flex animate-slideInRight">
          {/* Backdrop Blur Mesh overlay */}
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setShowFullPanel(false)} />

          {/* Main Dimensional Drawer Frame */}
          <div className="relative bg-white/85 backdrop-blur-2xl border-l border-white/70 h-screen shadow-2xl flex flex-col z-10 w-[92vw] sm:w-[420px] lg:w-[40vw]">

            {/* Drawer Header Block */}
            <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-b border-white/60 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Master Alert History</h4>
                <p className="text-[9px] text-slate-500 font-semibold">Chronological Timeline Buffer</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullPanel(false)}
                className="p-1.5 hover:bg-white/80 rounded-lg transition-colors text-slate-700 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Timewise Notification Rows Data Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 stagger">
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-slate-500 text-[11px] italic font-semibold">No notification history in database.</p>
              ) : notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-xl glass-soft text-[11px] font-bold text-slate-900 space-y-1.5 transition-all ${notif.unread ? 'border-amber-300/80 ring-1 ring-amber-200/60' : ''}`}
                >
                  <p className="leading-relaxed font-black">{notif.title}</p>
                  <p className="leading-relaxed text-slate-500">{notif.text}</p>
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatNotificationTime(notif.time)}</span>
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
