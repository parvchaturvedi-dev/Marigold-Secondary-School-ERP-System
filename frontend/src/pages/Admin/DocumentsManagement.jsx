import React, { useState } from 'react';
import { FolderGit, PlusCircle, Trash2, FileText, ArrowLeft } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';

const DocumentsManagement = () => {
  // 4 Core Master Categories
  const roles = ['Admin', 'Clerk', 'Teacher', 'Student'];
  
  // Selected Context Active State
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Dynamic Master Document Mapping Matrix State
  const emptyRoleDocuments = { Admin: [], Clerk: [], Teacher: [], Student: [] };
  const [roleDocuments, setRoleDocuments] = useMongoState('admin-document-requirements', emptyRoleDocuments);

  const [newDocName, setNewDocName] = useState('');

  // 1. Add New Dynamic Field Element
  const handleAddDocument = (e) => {
    e.preventDefault();
    const formattedName = newDocName.trim();
    if (!formattedName) return;

    // Check for redundancy inside the active role bucket
    const currentDocs = roleDocuments[selectedRole] || [];
    if (currentDocs.some(doc => doc.toLowerCase() === formattedName.toLowerCase())) {
      alert(`This document label is already registered under the ${selectedRole} tier!`);
      return;
    }

    setRoleDocuments({
      ...roleDocuments,
      [selectedRole]: [...currentDocs, formattedName]
    });
    setNewDocName('');
  };

  // 2. Unlink / Delete Registered Document Entity
  const handleDeleteDocument = (docNameToRemove) => {
    if (window.confirm(`Are you sure you want to permanently delete the requirement for "${docNameToRemove}" from ${selectedRole} registrations?`)) {
      setRoleDocuments({
        ...roleDocuments,
        [selectedRole]: (roleDocuments[selectedRole] || []).filter(doc => doc !== docNameToRemove)
      });
    }
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">

      {/* TOP HEADER CONTROL BANNER */}
      <div className="glass-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FolderGit className="w-5 h-5 text-slate-900" /> Document Configuration Control
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure required documentation checklists across system layers. Registered fields enforce dynamic upload workflows during onboarding profiles.
          </p>
        </div>

        {selectedRole && (
          <button
            onClick={() => setSelectedRole(null)}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-black transition-colors px-4 py-2 bg-white/50 border border-slate-200/70 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Matrix
          </button>
        )}
      </div>

      {/* VIEW ENGINE PHASE 1: MASTER 4 CARD DISPLAY GRID */}
      {!selectedRole ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {roles.map((role) => {
            const count = roleDocuments[role]?.length || 0;
            return (
              <div
                key={role}
                onClick={() => setSelectedRole(role)}
                className="glass-card glass-hover p-6 rounded-3xl flex flex-col justify-between group transition-all cursor-pointer min-h-[140px]"
              >
                <div>
                  <div className="w-11 h-9 rounded-xl bg-white/50 text-slate-900 flex items-center justify-center font-bold text-sm border border-slate-200/70 shadow-xs mb-3">
                    {role.charAt(0)}
                  </div>
                  <h4 className="text-base font-black text-slate-900 group-hover:text-black transition-colors">{role} Checklists</h4>
                </div>
                <div className="text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-100/80 mt-4 flex justify-between items-center">
                  <span>Required Fields:</span>
                  <span className="bg-white/50 px-2 py-0.5 rounded text-slate-900 font-mono">{count} items</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (

        // VIEW ENGINE PHASE 2: INNER PROFILE PREFERENCE MAPPING CONFIGURATOR
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">

          {/* LEFT PANEL COLUMN: INLINE QUICK INSERT REGISTER FORM */}
          <div className="glass-card p-6 rounded-3xl h-fit space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Link Document for {selectedRole}</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Enforces verification parameters automatically.</p>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4 text-xs font-semibold">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-500">Document Label Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Caste Certificate, Passbook"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full p-3 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl text-sm text-slate-900"
                />
              </div>

              <div className="glass-soft p-3 rounded-2xl space-y-1 text-slate-500 text-[10px] leading-relaxed">
                <p className="font-bold text-slate-900">Allowed Standard Uplink Extensions:</p>
                <p className="font-mono">.JPG, .JPEG, .PNG, .WEBP, .PDF</p>
                <p>Maximum File allocation capacity limit capped at 2 megabytes (2 MB).</p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 btn-primary"
              >
                <PlusCircle className="w-4 h-4" /> Add Required Record Field
              </button>
            </form>
          </div>

          {/* RIGHT PANEL COLUMN: ACTIVE INTERACTIVE LIVE LIST ROSTER */}
          <div className="lg:col-span-2 glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100/80 pb-2">
              <h4 className="text-sm font-bold text-slate-900">{selectedRole} Validation Requirement Track</h4>
              <span className="text-[10px] bg-white/50 px-2 py-0.5 rounded font-black font-mono">COUNT: {(roleDocuments[selectedRole] || []).length}</span>
            </div>

            {(roleDocuments[selectedRole] || []).length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-medium">
                No compulsory verification forms initialized. Onboarding users for {selectedRole} currently skip documentation.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto no-scrollbar">
                {(roleDocuments[selectedRole] || []).map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-4 glass-soft rounded-2xl flex items-center justify-between group hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                        <FileText className="w-4 h-4 text-slate-900" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 break-all">{doc}</span>
                    </div>

                    <button
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-white rounded-full transition-all shrink-0 ml-2"
                      title="Remove Requirement Tag"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

export default DocumentsManagement;
