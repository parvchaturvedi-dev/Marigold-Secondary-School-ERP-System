import React from 'react';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import AuroraBackground from '../components/common/AuroraBackground';

const StudentLayout = ({ children, session, onLogout, onPageChange, onStudentChange, currentActive }) => {
  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden font-sans relative">
      <AuroraBackground />
      <Sidebar currentActive={currentActive} onPageChange={onPageChange} role="student" />
      <div className="min-w-0 flex-1 flex flex-col h-full overflow-hidden">
        <Header
          session={session}
          onLogout={onLogout}
          onPageChange={onPageChange}
          onStudentChange={onStudentChange}
        />
        <main key={currentActive} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 animate-fadeInUp">
          {children}
        </main>
      </div>
    </div>
  );
};

export default StudentLayout;
