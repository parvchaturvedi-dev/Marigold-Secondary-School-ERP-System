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
import Logo from '../../assets/logo.png';
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

  const searchInputRef = useRef(null);
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

  const openNotification = async (notification) => {
    if (notification?.unread && notification.id) {
      try {
        await markRead([notification.id]);
      } catch (error) {
        console.error('Unable to mark notification as read:', error);
      }
    }
    setShowUnreadBox(false);
    setShowFullPanel(false);
    if (notification?.linkPage && typeof onPageChange === 'function') {
      onPageChange(notification.linkPage);
    }
  };

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

  const closeSearch = () => {
    setShowSearchInput(false);
    setShowSearchDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
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
    <header className="flex shrink-0 flex-col gap-4 bg-[#fdfdfd] px-4 pb-4 pt-16 font-sans sm:gap-5 sm:px-[30px] sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 pl-14 sm:pl-0">
          <img src={Logo} alt="" className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12" />
          <h1 className="truncate text-base font-extrabold leading-tight tracking-tight text-[#15181c] sm:text-xl">
            Marigold Secondary School
          </h1>
        </div>

        <div className="relative ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
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
                className={`flex h-[42px] items-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition-all ${
                  showStudentMenu
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-[#edeff2] bg-[#fafbfc] text-slate-700 hover:border-slate-300'
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

          </>
        )}

        <div
          className="relative flex items-center"
          onMouseEnter={() => setShowSearchInput(true)}
          onMouseLeave={() => {
            if (!searchQuery.trim() && document.activeElement !== searchInputRef.current) {
              setShowSearchInput(false);
              setShowSearchDropdown(false);
            }
          }}
        >
          <form
            onSubmit={handleSearchSubmit}
            className={`relative h-[46px] overflow-visible transition-[width] duration-300 sm:h-[54px] ${
              showSearchInput ? 'w-[min(360px,calc(100vw-180px))]' : 'w-[46px] sm:w-[52px]'
            }`}
          >
            <div className={`relative flex h-full items-center overflow-hidden transition-all duration-300 ${
              showSearchInput
                ? 'rounded-xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.10)] focus-within:border-slate-300'
                : 'rounded-xl border border-transparent bg-[#15181c] shadow-[0_4px_14px_rgba(15,23,42,0.08)]'
            }`}>
              <button
                type={showSearchInput ? 'submit' : 'button'}
                onClick={() => {
                  if (!showSearchInput) setShowSearchInput(true);
                }}
                aria-label="Search"
                className={`absolute left-0 top-0 z-10 flex h-full w-[46px] shrink-0 items-center justify-center bg-transparent sm:w-[52px] ${
                  showSearchInput ? 'text-slate-900' : 'text-white'
                }`}
              >
                <Search className="h-[19px] w-[19px]" strokeWidth={2.2} />
              </button>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pages, students..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  setShowSearchInput(true);
                  if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
                }}
                autoFocus={showSearchInput}
                tabIndex={showSearchInput ? 0 : -1}
                aria-label="Search pages, students..."
                className={`h-full min-w-0 flex-1 bg-transparent pl-[48px] pr-11 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 transition-opacity sm:pl-[54px] ${
                  showSearchInput ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              />
              {showSearchInput && (
                <button
                  type="button"
                  onClick={closeSearch}
                  aria-label="Close search"
                  className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              )}
            </div>

            {showSearchInput && showSearchDropdown && (
              <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs font-bold shadow-xl animate-scaleUp">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <span className="text-slate-900">Search Results</span>
                  <button
                    type="button"
                    onClick={() => setShowSearchDropdown(false)}
                    aria-label="Close search results"
                    className="rounded-md p-0.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {searchLoading ? (
                    <p className="p-4 text-center text-[11px] font-semibold italic text-slate-500">Searching…</p>
                  ) : searchError ? (
                    <p className="p-4 text-center text-[11px] font-semibold text-rose-600">{searchError}</p>
                  ) : searchResults.length === 0 ? (
                    <p className="p-4 text-center text-[11px] font-semibold italic text-slate-500">No results found.</p>
                  ) : (
                    searchResults.map((result, idx) => (
                      <button
                        key={`${result.type}-${result.label}-${idx}`}
                        type="button"
                        onClick={() => handleSearchResultClick(result)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-black text-slate-900">{result.label}</span>
                          {result.sublabel && (
                            <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500">
                              {result.sublabel}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[9px] uppercase tracking-wide text-indigo-600">
                          {SEARCH_TYPE_LABELS[result.type] || result.type}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowUnreadBox(!showUnreadBox); setShowProfileMenu(false); setShowStudentMenu(false); }}
            className={`relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border transition-all sm:h-[54px] sm:w-[52px] ${
              showUnreadBox
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            }`}
            title="Notifications Hub"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white animate-pulse"></span>
            )}
          </button>

          {/* FLOATING UNREAD BOX APPEND TRIGGER */}
          {showUnreadBox && (
            <div className="absolute right-0 mt-3 w-72 glass-strong rounded-2xl z-50 text-xs font-bold overflow-hidden animate-scaleUp">
              <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-4 py-2.5 border-b border-white/60 flex justify-between items-center">
                <span className="text-slate-900">Recent Notifications</span>
                <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-md font-black shadow-sm">{unreadCount} NEW</span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100/80">
                {notificationError ? (
                  <p className="p-4 text-center text-rose-600 text-[11px] font-semibold">{notificationError}</p>
                ) : notifications.length === 0 ? (
                  <p className="p-4 text-center text-slate-500 text-[11px] italic font-semibold">No recent notifications.</p>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      disabled={!notif.linkPage}
                      onClick={() => openNotification(notif)}
                      className="block w-full p-3 text-left hover:bg-white/70 transition-colors disabled:cursor-default"
                    >
                      <p className="text-slate-900 text-[11px] leading-tight font-black">{notif.title}</p>
                      <p className="text-slate-500 text-[10px] leading-tight font-semibold mt-1">{notif.text}</p>
                      <span className="text-[9px] text-slate-400 font-mono block mt-1">{formatNotificationTime(notif.time)}</span>
                      {!notif.unread && <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Read</span>}
                    </button>
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

        <div
          className="relative"
          onMouseEnter={() => { setShowProfileMenu(true); setShowStudentMenu(false); }}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <button
            type="button"
            onClick={() => setShowProfileMenu(true)}
            aria-expanded={showProfileMenu}
            aria-label="Open profile menu"
            className="flex h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 sm:h-[46px] sm:w-[46px]"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              : <User className="h-4 w-4 text-indigo-500" />
            }
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
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Recent Notifications</h4>
                <p className="text-[9px] text-slate-500 font-semibold">Read notifications are kept for 24 hours.</p>
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
                <p className="p-4 text-center text-slate-500 text-[11px] italic font-semibold">No recent notifications.</p>
              ) : notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  disabled={!notif.linkPage}
                  onClick={() => openNotification(notif)}
                  className={`block w-full p-3.5 rounded-xl glass-soft text-left text-[11px] font-bold text-slate-900 space-y-1.5 transition-all disabled:cursor-default ${notif.unread ? 'border-amber-300/80 ring-1 ring-amber-200/60' : ''}`}
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
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

    </header>
  );
};

export default Header;
