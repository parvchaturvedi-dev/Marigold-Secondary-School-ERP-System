import React from 'react';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';

const AdminLayout = ({ children, session, onLogout, onPageChange, onStudentChange, currentActive }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#D9D9D9] font-sans">
      <Sidebar currentActive={currentActive} onPageChange={onPageChange} role="admin" />
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#D9D9D9]">
        <Header
          session={session}
          onLogout={onLogout}
          onPageChange={onPageChange}
          onStudentChange={onStudentChange}
        />
        <main className="flex-1 overflow-y-auto p-6 bg-[#D9D9D9]">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
