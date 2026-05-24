import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';

const TeacherLayout = ({ children, session, onLogout, onPageChange, onStudentChange, currentActive }) => {
  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-[#D9D9D9] font-sans">
      <Sidebar currentActive={currentActive} onPageChange={onPageChange} role="teacher" />

      <div className="min-w-0 flex-1 flex flex-col h-full overflow-hidden bg-[#D9D9D9]">
        <Header
          session={session}
          onLogout={onLogout}
          onPageChange={onPageChange}
          onStudentChange={onStudentChange}
        />

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-6 bg-[#D9D9D9]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default TeacherLayout;
