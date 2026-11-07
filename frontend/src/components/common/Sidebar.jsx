import React, { useState, useEffect } from 'react';
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
  ClipboardCheck,
  Menu,
  X,
  GitCommit,
  PenTool,
  Plus,
  Minus,
  Search,
  UserPlus,
  Award,
  Info,
  BriefcaseBusiness,
  FileCheck2,
  History,
  Package,
  Send,
} from 'lucide-react';
import Logo from '../../assets/logo.png';

// --- Main Sidebar Component ---
const Sidebar = ({ currentActive, onPageChange, role = 'admin', session }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Sub-menus dynamic expansion state trackers
  const [openSubMenus, setOpenSubMenus] = useState({
    'Class Desk': false,
    'Clerk Desk': false,
    'Faculty Desk': false,
    'Student Desk': false,
    'Examination Desk': false,
    'Timetable Desk': false,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
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
    { name: 'AI Assistant', icon: Sparkles },
    { name: 'Academic Calender', icon: Calendar },
    {
      name: 'Notification Desk',
      icon: Bell,
      hasSub: true,
      subItems: [
        { name: 'Notifications', icon: Bell },
        { name: 'Notification History', icon: ClipboardList },
      ],
    },
    { name: 'Application', icon: FileText },
    { name: 'Assignment', icon: ClipboardList },
    { name: 'Attendance', icon: CheckSquare },
    { name: 'Admin Management', icon: UserCheck },
    {
      name: 'WhatsApp Desk',
      icon: MessageSquare,
      hasSub: true,
      subItems: [
        { name: 'WhatsApp Integration', icon: MessageSquare },
        { name: 'WhatsApp Recipients', icon: Contact },
        { name: 'WhatsApp Message', icon: Send },
      ],
    },
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
    { name: 'Finance', icon: Wallet },
    { name: 'Stock & Inventory', icon: Package },
    { name: 'Payroll', icon: Wallet },
    {
      name: 'Timetable Desk',
      icon: CalendarClock,
      hasSub: true,
      subItems: [
        { name: 'Timetable', icon: CalendarClock },
        { name: 'Timetable Management', icon: Settings },
      ],
    },
    {
      name: 'Faculty Desk',
      icon: GraduationCap,
      hasSub: true,
      subItems: [
        { name: 'Teacher Management', icon: UserPlus },
        { name: 'Teacher Assignment', icon: UserCheck }
      ]
    },
    {
      name: 'Employee Desk',
      icon: BriefcaseBusiness,
      hasSub: true,
      subItems: [
        { name: 'Employee Management', icon: UserCheck },
        { name: 'Employee Assignment Management', icon: UserPlus }
      ]
    },
    { name: 'Id Card', icon: IdCard },
    { name: 'Transfer Certificate', icon: FileCheck2 },
    { name: 'Study Certificate', icon: GraduationCap },
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
    { name: 'Certification', icon: Award },
    { name: 'About Us', icon: Info },
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
      name: 'Employee Desk',
      icon: BriefcaseBusiness,
      hasSub: true,
      subItems: [
        { name: 'Employee Management', icon: UserCheck },
        { name: 'Employee Assignment Management', icon: UserPlus },
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
    { name: 'Paathshala History', icon: History },
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
    { name: 'Transfer Certificate', icon: FileCheck2 },
    { name: 'Study Certificate', icon: GraduationCap },
    { name: 'Leave Requests', icon: LogOut },
    { name: 'Meetings', icon: Video },
    {
      name: 'Timetable Desk',
      icon: CalendarClock,
      hasSub: true,
      subItems: [
        { name: 'Timetable', icon: CalendarClock },
        { name: 'Timetable Management', icon: Settings },
      ],
    },
    { name: 'Notices', icon: Bell },
    { name: 'Profile', icon: User },
    { name: 'My Salary', icon: Wallet },
    { name: 'Vault', icon: Lock },
    { name: 'Subject Management', icon: BookOpen },
    { name: 'Certification', icon: Award },
    { name: 'About Us', icon: Info },
    { name: 'Settings', icon: Settings },
  ];

  const academicMenuItems = [
    { name: 'Dashboard', icon: LayoutGrid },
    { name: 'Academic Calender', icon: Calendar },
    { name: 'My Class', icon: Layers },
    {
      name: 'Timetable Desk',
      icon: CalendarClock,
      hasSub: true,
      subItems: [{ name: 'Timetable', icon: CalendarClock }],
    },
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
    { name: 'Certification', icon: Award },
    { name: 'About Us', icon: Info },
    { name: 'Settings', icon: Settings },
  ];

  const teacherMenuItems = [
    { name: 'Dashboard', icon: LayoutGrid },
    { name: 'Academic Calender', icon: Calendar },
    { name: 'My Class', icon: Layers },
    {
      name: 'Timetable Desk',
      icon: CalendarClock,
      hasSub: true,
      subItems: [{ name: 'Timetable', icon: CalendarClock }],
    },
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
    { name: 'Certification', icon: Award },
    { name: 'About Us', icon: Info },
    { name: 'Settings', icon: Settings },
  ];

  const employeeMenuItems = [
    { name: 'Dashboard', icon: LayoutGrid },
    { name: 'Attendance', icon: CheckSquare },
    { name: 'Notices', icon: Bell },
    { name: 'Payroll', icon: Wallet },
    { name: 'Id Card', icon: IdCard },
    { name: 'Academic Calender', icon: Calendar },
  ];

  const roleMenuItems = {
    admin: adminMenuItems,
    clerk: clerkMenuItems,
    student: academicMenuItems,
    teacher: teacherMenuItems,
    employee: employeeMenuItems,
  };

  const menuItems = (roleMenuItems[role] || adminMenuItems).filter(
    (item) => item.name !== 'Paathshala History' || window.mgpsDesktop?.isDesktop
  );
  const utilityMenuItems = ['Settings', 'Profile']
    .map((name) => menuItems.find((item) => item.name === name))
    .filter(Boolean);
  const navigationItems = menuItems.filter((item) => !['Settings', 'Profile'].includes(item.name));
  const quickLinks = navigationItems.slice(0, 4);
  const profilePhoto = session?.activeStudent?.photoDataUrl || session?.photoDataUrl || '';

  const isGroupActive = (item) => {
    if (!item.hasSub) return currentActive === item.name;
    return item.subItems.some(sub => sub.name === currentActive);
  };

  const handleItemClick = (item) => {
    if (item.hasSub) {
      toggleSubMenu(item.name);
      return;
    }
    if (onPageChange) onPageChange(item.name);
    if (windowWidth <= 500) setIsMobileOpen(false);
  };

  const renderNavButton = (item, isSubChild = false) => {
    const IconComponent = item.icon;
    const isActive = isSubChild ? currentActive === item.name : isGroupActive(item);
    const isDropdownOpen = openSubMenus[item.name] || isActive;

    return (
      <div key={item.name} className="relative w-full">
        <button
          type="button"
          onClick={() => handleItemClick(item)}
          aria-expanded={item.hasSub ? isDropdownOpen : undefined}
          className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left text-[14px] font-medium transition-colors duration-200
            ${isActive
              ? 'bg-[#17191b] font-semibold text-white'
              : isSubChild
                ? 'text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
            }`}
        >
          <span className="flex min-w-0 items-center gap-3 truncate">
            <IconComponent
              className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}
              strokeWidth={2.2}
            />
            <span className="truncate">{item.name}</span>
            {item.badge && (
              <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-700">
                {item.badge}
              </span>
            )}
          </span>
          {item.hasSub && (
            isDropdownOpen
              ? <Minus className={`h-4 w-4 shrink-0 ${isActive ? 'text-white/80' : 'text-slate-400'}`} />
              : <Plus className={`h-4 w-4 shrink-0 ${isActive ? 'text-white/80' : 'text-slate-400'}`} />
          )}
        </button>
        {item.hasSub && (
          <div
            className={`ml-4 mt-1 flex flex-col gap-1 overflow-hidden border-l border-slate-200 pl-3 transition-all duration-300 ease-in-out
              ${isDropdownOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            {item.subItems.map(subItem => renderNavButton(subItem, true))}
          </div>
        )}
      </div>
    );
  };

  const renderRailButton = (item) => {
    const IconComponent = item.icon;
    const isActive = isGroupActive(item);

    return (
      <button
        key={item.name}
        type="button"
        onClick={() => handleItemClick(item)}
        aria-label={item.name}
        title={item.name}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200
          ${isActive
            ? 'border border-slate-200 bg-white text-slate-950 shadow-[0_5px_15px_rgba(15,23,42,0.08)]'
            : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
          }`}
      >
        <IconComponent className="h-[21px] w-[21px]" strokeWidth={2.2} />
      </button>
    );
  };

  const renderUtilityButton = (item, compact = false) => {
    const IconComponent = item.icon;
    const isActive = currentActive === item.name;

    return (
      <button
        key={item.name}
        type="button"
        onClick={() => handleItemClick(item)}
        aria-label={item.name}
        title={compact ? item.name : undefined}
        className={compact
          ? `flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors
              ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:bg-blue-50'}`
          : `flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-[14px] font-medium transition-colors
              ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`
        }
      >
        {item.name === 'Profile' && profilePhoto
          ? <img src={profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
          : <IconComponent className={`${compact ? 'h-[21px] w-[21px]' : 'h-[18px] w-[18px]'} shrink-0`} strokeWidth={2.2} />
        }
        {!compact && <span className="truncate">{item.name}</span>}
      </button>
    );
  };

  const isMobile = windowWidth <= 500;
  const mobilePanelVisibility = isMobileOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <>
      {isMobile && (
        <div className="fixed left-4 top-4 z-50">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label={isMobileOpen ? 'Close navigation' : 'Open navigation'}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 shadow-lg transition-transform active:scale-95"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      )}

      {isMobile && isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm"
        />
      )}

      {!isMobile && (
        <div className="group/sidebar relative z-50 h-full w-[100px] shrink-0 py-3 pl-3">
          <aside className="flex h-full w-[76px] flex-col items-center rounded-[36px] border border-slate-200 bg-white px-2 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
              <img src={Logo} alt="Marigold logo" className="h-8 w-8 object-contain" />
            </div>
            <nav aria-label="Quick navigation" className="flex w-full flex-col items-center gap-2">
              {quickLinks.map(renderRailButton)}
            </nav>
            <div className="flex flex-1 justify-center py-5" aria-hidden="true">
              <span className="relative h-16 w-px bg-slate-200 after:absolute after:left-1/2 after:top-1/2 after:h-2 after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-slate-400" />
            </div>
            <div className="flex w-full flex-col items-center gap-2">
              {utilityMenuItems.map(item => renderUtilityButton(item, true))}
            </div>
          </aside>
          <aside
            aria-label="Main navigation"
            className="invisible pointer-events-none absolute left-[100px] top-3 flex h-[calc(100%-24px)] w-[300px] translate-x-[-6px] flex-col rounded-[32px] border border-slate-200 bg-white p-5 opacity-0 shadow-[0_12px_36px_rgba(15,23,42,0.10)] transition-all duration-200 group-hover/sidebar:pointer-events-auto group-hover/sidebar:visible group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100"
          >
            <div className="mb-3 flex shrink-0 items-center gap-3 border-b border-slate-200 px-1 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 p-1">
                <img src={Logo} alt="" className="h-full w-full object-contain" />
              </div>
              <span className="whitespace-nowrap text-[19px] font-semibold tracking-tight text-slate-950">
                MGHUB-ERP
              </span>
            </div>
            <nav aria-label="Main menu" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-3">
              {navigationItems.map(item => renderNavButton(item, false))}
            </nav>
            {utilityMenuItems.length > 0 && (
              <div className="flex shrink-0 flex-col gap-1 border-t border-slate-200 pt-3">
                {utilityMenuItems.map(item => renderUtilityButton(item))}
              </div>
            )}
          </aside>
        </div>
      )}

      {isMobile && (
        <aside
          aria-label="Main navigation"
          className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-300 ${mobilePanelVisibility}`}
        >
          <div className="mb-3 flex shrink-0 items-center gap-3 border-b border-slate-200 px-1 pb-4 pt-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 p-1">
              <img src={Logo} alt="" className="h-full w-full object-contain" />
            </div>
            <span className="whitespace-nowrap text-[19px] font-semibold tracking-tight text-slate-950">
              Marigold
            </span>
          </div>
          <nav aria-label="Main menu" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-3">
            {navigationItems.map(item => renderNavButton(item, false))}
          </nav>
          {utilityMenuItems.length > 0 && (
            <div className="flex shrink-0 flex-col gap-1 border-t border-slate-200 pt-3">
              {utilityMenuItems.map(item => renderUtilityButton(item))}
            </div>
          )}
        </aside>
      )}
    </>
  );
};

export default Sidebar;
