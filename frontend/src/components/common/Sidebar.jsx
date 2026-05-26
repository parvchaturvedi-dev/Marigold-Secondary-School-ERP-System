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
    <span className="inline-flex items-center text-md font-bold tracking-wider text-[#1A1A1A] whitespace-nowrap">
      {currentText}
      <span className="w-[2px] h-5 bg-[#1A1A1A] ml-0.5 animate-pulse"></span>
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
    { name: 'Biometric Attendance', icon: Contact },
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
    { name: 'Communication', icon: MessageSquare },
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
    { name: 'Biometric Attendance', icon: Contact },
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
    { name: 'Communication', icon: MessageSquare },
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
    { name: 'Communication', icon: MessageSquare },
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
    { name: 'Communication', icon: MessageSquare },
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
            flex items-center justify-between px-5 py-2.5 rounded-full transition-all duration-200 text-left w-full font-medium text-[14px]
            ${isActive 
              ? 'bg-[#E1FA6C] text-[#1A1A1A] shadow-sm font-semibold' 
              : isSubChild 
                ? 'bg-transparent text-[#555555] hover:bg-[#E2E2E2]/60 hover:text-[#1A1A1A]'
                : 'bg-[#EAEAEA] text-[#555555] hover:bg-[#E2E2E2] hover:text-[#1A1A1A]'
            }
          `}
        >
          <div className="flex items-center gap-4 truncate">
            <IconComponent 
              className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-[#1A1A1A]' : 'text-[#666666]'}`} 
              strokeWidth={2}
            />
            <span className={`truncate transition-opacity duration-200 
              ${isCollapsed ? 'opacity-0 lg:group-hover/sidebar:opacity-100' : 'opacity-100'}
            `}>
              {item.name}
            </span>
          </div>

          {item.hasSub && (
            <ChevronDown className={`w-4 h-4 text-[#666666] transition-transform duration-200 shrink-0
              ${isDropdownOpen ? 'rotate-180' : ''}
              ${isCollapsed ? 'opacity-0 lg:group-hover/sidebar:opacity-100' : 'opacity-100'}
            `} />
          )}
        </button>

        {isCollapsed && windowWidth > 500 && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-[#1A1A1A] text-white text-[12px] font-bold rounded-lg opacity-0 invisible -translate-x-2 group-hover/item:opacity-100 group-hover/item:visible group-hover/item:translate-x-0 transition-all shadow-md pointer-events-none z-50 whitespace-nowrap">
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
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-pulse {
          animation: pulse 1s infinite;
        }
      `}</style>

      {/* FIXED FLOATING HAMBURGER TRIGGER SWITCH FOR SMALL SCREENS (< 500px) */}
      {windowWidth <= 500 && (
        <div className="fixed top-4 left-4 z-50">
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 bg-[#D9D9D9] border border-[#C8C8C8] text-[#1A1A1A] rounded-xl shadow-md focus:outline-none"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* SEMI-TRANSLUCENT SCREEN BACKDROP OVERLAY */}
      {windowWidth <= 500 && isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        />
      )}

      {/* MASTER FLEX CONTROL SIDEBAR PANEL LAYER */}
      <div className={`h-screen bg-[#D9D9D9] flex flex-col px-4 font-sans select-none overflow-y-auto no-scrollbar shrink-0 border-r border-[#C8C8C8] z-40 transition-all duration-300 ease-in-out
        ${windowWidth <= 500 
          ? (isMobileOpen ? 'fixed top-0 left-0 w-72 translate-x-0' : 'fixed top-0 left-0 w-72 -translate-x-full') 
          : (isCollapsed ? 'w-22 hover:w-72' : 'w-72')
        }
        ${isCollapsed ? 'group/sidebar' : ''}
      `}>
        
        {/* BRAND LOGO FRAME CONTAINER */}
        <div className="sticky top-0 bg-[#D9D9D9] z-10 flex items-center gap-3 px-3 pt-6 pb-4 mb-2 shrink-0 min-h-[64px]">
          <img src="/src/assets/logo.png" alt="Logo" className="w-8 h-8 shrink-0" />
          
          <div className={`transition-opacity duration-200 overflow-hidden
            ${isCollapsed ? 'opacity-0 w-0 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:w-auto' : 'opacity-100 w-auto'}
          `}>
            <TypingLogo />
          </div>

          {/* Jab sidebar collapsed ho aur mouse hover na ho tab short text 'MGPS' dikhega */}
          {isCollapsed && (
            <span className="absolute left-14 text-xl font-bold tracking-wider text-[#1A1A1A] lg:group-hover/sidebar:opacity-0 transition-opacity duration-200">
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
