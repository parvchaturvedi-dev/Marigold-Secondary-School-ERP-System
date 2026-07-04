import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutGrid,
  Calendar,
  FileText,
  Lock,
  ClipboardList,
  CheckSquare,
  Layers,
  UserCheck,
  Contact,
  MessageSquare,
  PartyPopper,
  GraduationCap,
  Sparkles,
  Wallet,
  CalendarClock,
  IdCard,
  LogOut,
  Video,
  Bell,
  User,
  Settings,
  Computer,
  BookOpen,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  Menu,
  X,
  GitCommit,
  PenTool,
  Plus,
  Search,
  UserPlus
} from 'lucide-react';
import Logo from '../../assets/logo.png';

// --- Typing Animation Component ---
const TypingLogo = () => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);
  const words = useMemo(
    () => [
      "MARIGOLD",
      "M - Minds",
      "A - Achievers",
      "R - Radiant",
      "I - Inspire",
      "G - Guidance",
      "O - Opportunity",
      "L - Leadership",
      "D - Discipline"
    ],
    []
  );

  useEffect(() => {
    const handleTyping = () => {
      const fullWord = words[currentWordIndex];

      if (!isDeleting) {
        // Character type karna
        setCurrentText(fullWord.substring(0, currentText.length + 1));
        setTypingSpeed(100); // Typing ki speed

        // Agar poora word type ho gaya to rukna
        if (currentText === fullWord) {
          setTypingSpeed(1500); // Poora word type hone ke baad pause duration (1.5s)
          setIsDeleting(true);
        }
      } else {
        // Character mitana (Erase karna)
        setCurrentText(fullWord.substring(0, currentText.length - 1));
        setTypingSpeed(50); // Erase hone ki speed

        // Agar word poora mit gaya to agla word chalana
        if (currentText === '') {
          setIsDeleting(false);
          setCurrentWordIndex((prevIndex) => (prevIndex + 1) % words.length);
          setTypingSpeed(500); // Agla word shuru hone se pehle pause
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentWordIndex, typingSpeed, words]);

  return (
    <span className="inline-flex items-center text-md font-bold tracking-wider text-slate-800 whitespace-nowrap">
      {currentText}
      <span className="w-[2px] h-5 bg-indigo-500 ml-0.5 animate-pulse"></span>
    </span>
  );
};

// --- Main Sidebar Component ---
const Sidebar = ({ currentActive, onPageChange, role = 'admin' }) => {
  // Screen width track controllers
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sub-menus dynamic expansion state trackers
  const [openSubMenus, setOpenSubMenus] = useState({
    'Class Desk': false,
    'Clerk Desk': false,
    'Faculty Desk': false,
    'Student Desk': false,
    'Examination Desk': false
  });

  // Keep responsive window breaks synchronised
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth <= 920) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial safe component boot execution check
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSubMenu = (menuName) => {
    setOpenSubMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  // Master menu configuration
  const adminMenuItems = [
    { name: 'Dashboard', icon: LayoutGrid },
    { name: 'Academic Calender', icon: Calendar },
    { name: 'Application', icon: FileText },
    { name: 'Assignment', icon: ClipboardList },
    { name: 'Attendance', icon: CheckSquare },
    { name: 'Admin Management', icon: UserCheck },
    {
      name: 'Class Desk',
      icon: Layers,
      hasSub: true,
      subItems: [
        { name: 'Class Management', icon: Settings },
        { name: 'Class Preferences', icon: GitCommit },
      ]
    },
    {
      name: 'Clerk Desk',
      icon: Computer,
      hasSub: true,
      subItems: [
        { name: 'Clerk Management', icon: UserCheck },
      ]
    },
    { name: 'Documents Management', icon: FileText },
    { name: 'Events', icon: PartyPopper },
    {
      name: 'Examination Desk',
      icon: GraduationCap,
      hasSub: true,
      subItems: [
        { name: 'Exam Creation', icon: Plus },
        { name: 'Paper Creation', icon: PenTool },
        { name: 'Paper Analysis', icon: Search },
        { name: 'Paper Selected', icon: ClipboardCheck },
        { name: 'Report Card Management', icon: FileText },
        { name: 'Marks Management', icon: BarChart3 },
      ]
    },
    { name: 'Feature Page', icon: Sparkles },
    { name: 'Finance', icon: Wallet },
    { name: 'Payroll', icon: Wallet },
    { name: 'Timetable', icon: CalendarClock },
    {
      name: 'Faculty Desk',
      icon: GraduationCap,
      hasSub: true,
      subItems: [
        { name: 'Teacher Management', icon: UserPlus },
        { name: 'Teacher Assignment', icon: UserCheck }
      ]
    },
    { name: 'Id Card', icon: IdCard },
    { name: 'Leave Requests', icon: LogOut },
    { name: 'Meetings', icon: Video },
    { name: 'Notices', icon: Bell },
    { name: 'Profile', icon: User },
    {
      name: 'Student Desk',
      icon: User,
      hasSub: true,
      subItems: [
        { name: 'Student Management', icon: UserPlus },
        { name: 'Student Assigning', icon: Layers },
        { name: 'Sibling Assigning', icon: GitCommit }
      ]
    },
    { name: 'Users Management', icon: Lock },
    { name: 'Vault', icon: Lock },
    { name: 'Subject Management', icon: BookOpen },
    { name: 'Settings', icon: Settings }
  ];

  const clerkMenuItems = [
    { name: 'Dashboard', icon: LayoutGrid },
    { name: 'Academic Calender', icon: Calendar },
    { name: 'Application', icon: FileText },
    { name: 'Assignment', icon: ClipboardList },
    { name: 'Attendance', icon: CheckSquare },
    {
      name: 'Class Desk',
      icon: Layers,
      hasSub: true,
      subItems: [
        { name: 'Class Management', icon: Settings },
        { name: 'Class Preferences', icon: GitCommit },
      ],
    },
    {
      name: 'Faculty Desk',
      icon: GraduationCap,
      hasSub: true,
      subItems: [
        { name: 'Teacher Management', icon: UserPlus },
        { name: 'Teacher Assignment', icon: UserCheck },
      ],
    },
    {
      name: 'Student Desk',
      icon: User,
      hasSub: true,
      subItems: [
        { name: 'Student Management', icon: UserPlus },
        { name: 'Student Assigning', icon: Layers },
        { name: 'Sibling Assigning', icon: GitCommit },
      ],
    },
    { name: 'Documents Management', icon: FileText },
    { name: 'Events', icon: PartyPopper },
    {
      name: 'Examination Desk',
      icon: GraduationCap,
      hasSub: true,
      subItems: [
        { name: 'Exam Creation', icon: Plus },
        { name: 'Paper Creation', icon: PenTool },
        { name: 'Paper Analysis', icon: Search },
        { name: 'Paper Selected', icon: ClipboardCheck },
        { name: 'Marks Management', icon: BarChart3 },
      ],
    },
    { name: 'Id Card', icon: IdCard },
    { name: 'Leave Requests', icon: LogOut },
    { name: 'Meetings', icon: Video },
    { name: 'Timetable', icon: CalendarClock },
    { name: 'Notices', icon: Bell },
    { name: 'Profile', icon: User },
    { name: 'My Salary', icon: Wallet },
    { name: 'Vault', icon: Lock },
    { name: 'Subject Management', icon: BookOpen },
    { name: 'Settings', icon: Settings },
  ];

  const academicMenuItems = [
    { name: 'Dashboard', icon: LayoutGrid },
    { name: 'Academic Calender', icon: Calendar },
    { name: 'My Class', icon: Layers },
    { name: 'Timetable', icon: CalendarClock },
    { name: 'Application', icon: FileText },
    { name: 'Assignment', icon: ClipboardList },
    { name: 'Attendance', icon: CheckSquare },
    { name: 'Events', icon: PartyPopper },
    { name: 'Examinations', icon: GraduationCap },
    { name: 'Fees', icon: Wallet },
    { name: 'Id Card', icon: IdCard },
    { name: 'Leave Requests', icon: LogOut },
    { name: 'Meetings', icon: Video },
    { name: 'Notices', icon: Bell },
    { name: 'Profile', icon: User },
    { name: 'Vault', icon: Lock },
    { name: 'Settings', icon: Settings },
  ];

  const teacherMenuItems = [
    { name: 'Dashboard', icon: LayoutGrid },
    { name: 'Academic Calender', icon: Calendar },
    { name: 'My Class', icon: Layers },
    { name: 'Timetable', icon: CalendarClock },
    { name: 'Application', icon: FileText },
    { name: 'Assignment', icon: ClipboardList },
    { name: 'Attendance', icon: CheckSquare },
    { name: 'Events', icon: PartyPopper },
    {
      name: 'Examination Desk',
      icon: GraduationCap,
      hasSub: true,
      subItems: [
        { name: 'Paper Analysis', icon: Search },
        { name: 'Marks Management', icon: BarChart3 },
      ],
    },
    { name: 'Id Card', icon: IdCard },
    { name: 'Leave Requests', icon: LogOut },
    { name: 'Meetings', icon: Video },
    { name: 'Notices', icon: Bell },
    { name: 'Profile', icon: User },
    { name: 'My Salary', icon: Wallet },
    { name: 'Vault', icon: Lock },
    { name: 'Settings', icon: Settings },
  ];

  const roleMenuItems = {
    admin: adminMenuItems,
    clerk: clerkMenuItems,
    student: academicMenuItems,
    teacher: teacherMenuItems,
  };

  const menuItems = roleMenuItems[role] || adminMenuItems;

  const isGroupActive = (item) => {
    if (!item.hasSub) return currentActive === item.name;
    return item.subItems.some(sub => sub.name === currentActive);
  };

  const renderNavButton = (item, isSubChild = false) => {
    const IconComponent = item.icon;
    const isActive = isSubChild ? currentActive === item.name : isGroupActive(item);
    const isDropdownOpen = openSubMenus[item.name] || isActive;

    return (
      <div key={item.name} className="w-full relative group/item">
        <button
          onClick={() => {
            if (item.hasSub) {
              toggleSubMenu(item.name);
            } else {
              if (onPageChange) onPageChange(item.name);
              if (windowWidth <= 500) setIsMobileOpen(false);
            }
          }}
          className={`
            flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all duration-200 text-left w-full font-medium text-[13.5px]
            ${isActive
              ? 'btn-primary font-semibold'
              : isSubChild
                ? 'bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-900'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 hover:shadow-sm'
            }
          `}
        >
          <div className="flex items-center gap-3.5 truncate">
            <IconComponent
              className={`w-4.5 h-4.5 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover/item:text-indigo-500'}`}
              strokeWidth={2}
            />
            <span className={`truncate transition-opacity duration-200
              ${isCollapsed ? 'opacity-0 lg:group-hover/sidebar:opacity-100' : 'opacity-100'}
            `}>
              {item.name}
            </span>
          </div>

          {item.hasSub && (
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 shrink-0
              ${isActive ? 'text-white/80' : 'text-slate-400'}
              ${isDropdownOpen ? 'rotate-180' : ''}
              ${isCollapsed ? 'opacity-0 lg:group-hover/sidebar:opacity-100' : 'opacity-100'}
            `} />
          )}
        </button>

        {isCollapsed && windowWidth > 500 && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-[12px] font-bold rounded-lg opacity-0 invisible -translate-x-2 group-hover/item:opacity-100 group-hover/item:visible group-hover/item:translate-x-0 transition-all shadow-xl pointer-events-none z-50 whitespace-nowrap">
            {item.name}
          </div>
        )}

        {item.hasSub && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out pl-4 flex flex-col gap-1 mt-1
              ${isCollapsed
                ? 'max-h-0 lg:group-hover/sidebar:max-h-[360px]'
                : (isDropdownOpen ? 'max-h-[360px]' : 'max-h-0')
              }
            `}
          >
            {item.subItems.map(subItem => renderNavButton(subItem, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* FIXED FLOATING HAMBURGER TRIGGER SWITCH FOR SMALL SCREENS (< 500px) */}
      {windowWidth <= 500 && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2.5 glass-strong text-slate-800 rounded-xl focus:outline-none active:scale-95 transition-transform"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* SEMI-TRANSLUCENT SCREEN BACKDROP OVERLAY */}
      {windowWidth <= 500 && isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 transition-opacity animate-fadeIn"
        />
      )}

      {/* MASTER FLEX CONTROL SIDEBAR PANEL LAYER */}
      <div className={`h-screen bg-white/55 backdrop-blur-2xl flex flex-col px-4 font-sans select-none overflow-y-auto no-scrollbar shrink-0 border-r border-white/60 shadow-[4px_0_24px_rgba(79,70,229,0.05)] z-40 transition-all duration-300 ease-in-out
        ${windowWidth <= 500
          ? (isMobileOpen ? 'fixed top-0 left-0 w-72 translate-x-0' : 'fixed top-0 left-0 w-72 -translate-x-full')
          : (isCollapsed ? 'w-22 hover:w-72' : 'w-72')
        }
        ${isCollapsed ? 'group/sidebar' : ''}
      `}>

        {/* BRAND LOGO FRAME CONTAINER */}
        <div className="sticky top-0 bg-white/10 backdrop-blur-xl z-10 flex items-center gap-3 px-2 pt-6 pb-4 mb-2 shrink-0 min-h-[64px]">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-white/70 shadow-sm flex items-center justify-center p-1">
            <img src={Logo} alt="Logo" className="w-full h-full object-contain" />
          </div>

          <div className={`transition-opacity duration-200 overflow-hidden
            ${isCollapsed ? 'opacity-0 w-0 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:w-auto' : 'opacity-100 w-auto'}
          `}>
            <TypingLogo />
          </div>

          {/* Jab sidebar collapsed ho aur mouse hover na ho tab short text 'MGPS' dikhega */}
          {isCollapsed && (
            <span className="absolute left-14 text-xl font-bold tracking-wider text-gradient lg:group-hover/sidebar:opacity-0 transition-opacity duration-200">
              MGPS
            </span>
          )}
        </div>

        {/* COMPREHENSIVE NAVIGATION SCROLL LINK LIST */}
        <nav className="flex flex-col gap-1.5 pb-6">
          {menuItems.map(item => renderNavButton(item, false))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
