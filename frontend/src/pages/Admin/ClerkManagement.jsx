import React, { useState } from 'react';
import { UserCog, Plus, Trash2, Mail, Phone, FileText, Search, X, CheckCircle2, ShieldCheck, MoreVertical, Edit2, Eye } from 'lucide-react';
import ClerkProfile from './ClerkProfile';
import { useMongoState } from '../../components/common/mongoState';
const ClerkManagement = () => {
  // Global Live State for Registered Clerks Pool
  const [clerksList, setClerksList] = useMongoState('admin-clerk-management-list', []);

  // UI Interactive Tracker States
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [editingClerk, setEditingClerk] = useState(null);
  const [viewingClerk, setViewingClerk] = useState(null); // Used for rendering profile page view

  // Form State for Adding/Editing
  const [clerkForm, setClerkForm] = useState({ name: '', email: '', mobile: '', aadharNumber: '' });
  const [attachedFiles, setAttachedFiles] = useState([]);

  const toggleDropdown = (id) => {
    setActiveDropdownId(activeDropdownId === id ? null : id);
  };

  const handleInputChange = (e, isEdit = false) => {
    const { name, value } = e.target;
    if (isEdit) {
      setEditingClerk(prev => ({ ...prev, [name]: value }));
    } else {
      setClerkForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).map(f => f.name);
      setAttachedFiles(filesArray);
    }
  };

  // ACTION 1: ADD NEW CLERK
  const handleRegisterClerk = (e) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(clerkForm.aadharNumber)) {
      alert("Aadhaar requires exactly 12 digits.");
      return;
    }

    const newEntity = {
      id: `CLK-2026-${Math.floor(100 + Math.random() * 900)}`,
      ...clerkForm,
      documentsAttached: attachedFiles.length > 0 ? attachedFiles : ['default_blank.pdf']
    };

    setClerksList(prev => [newEntity, ...prev]);
    setShowAddModal(false);
    setClerkForm({ name: '', email: '', mobile: '', aadharNumber: '' });
    setAttachedFiles([]);
    alert('Clerk registered successfully!');
  };

  // ACTION 2: OPEN EDIT MODAL WITH PRE-FILLED VALUES
  const handleOpenEdit = (clerk) => {
    setEditingClerk({ ...clerk });
    setActiveDropdownId(null);
  };

  // ACTION 3: UPDATE CLERK DATABASE
  const handleUpdateClerk = (e) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(editingClerk.aadharNumber)) {
      alert("Aadhaar requires exactly 12 digits.");
      return;
    }

    setClerksList(prev => prev.map(c => c.id === editingClerk.id ? editingClerk : c));
    setEditingClerk(null);
    alert('Clerk records updated successfully!');
  };

  // ACTION 4: REMOVE CLERK
  const handleRemoveClerk = (id, name) => {
    setActiveDropdownId(null);
    if (window.confirm(`⚠️ Are you sure you want to completely remove ${name}?`)) {
      setClerksList(prev => prev.filter(c => c.id !== id));
    }
  };

  // Navigation Trigger: Profile View state switcher
  const handleViewProfile = (clerk) => {
    setViewingClerk(clerk);
    setActiveDropdownId(null);
  };

  // Filter Lookup
  const filteredClerks = clerksList.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Conditional Router Render: If profile state is set, render profile file instead
  if (viewingClerk) {
    return <ClerkProfile clerk={viewingClerk} onBack={() => setViewingClerk(null)} />;
  }

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">
      
      {/* HEADER BANNER */}
      <div className="glass-card p-6 rounded-3xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <UserCog className="w-5 h-5 text-slate-900" /> Clerical Staff Dashboard
          </h3>
          <p className="text-xs text-slate-500 mt-1">Manage admin staff, view credentials payloads, or sync directory updates.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white/50 px-3.5 py-2 rounded-xl border border-slate-200/70 text-xs">
            <Search className="w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search Name or ID..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="bg-transparent border-none outline-none font-bold text-slate-900 w-36 md:w-48" 
            />
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 text-xs font-black btn-primary px-5 py-2.5 rounded-xl ">
            <Plus className="w-4 h-4" /> Add Clerk Staff
          </button>
        </div>
      </div>

      {/* CLERK CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClerks.map((clerk) => (
          <div key={clerk.id} className="glass-card glass-hover rounded-3xl p-5 flex flex-col justify-between relative transition-all">
            
            {/* THREE-DOTS ACTION CONTEXT HOOK */}
            <div className="absolute top-4 right-4 z-20">
              <button onClick={() => toggleDropdown(clerk.id)} className="p-1.5 hover:bg-white/70 rounded-full text-slate-500 hover:text-black transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
              {activeDropdownId === clerk.id && (
                <div className="absolute right-0 mt-1 bg-white border border-white/70 rounded-xl shadow-lg w-36 py-1 text-xs font-black text-slate-900 overflow-hidden">
                  <button type="button" onClick={() => handleViewProfile(clerk)} className="w-full text-left px-3 py-2 hover:bg-white/70 flex items-center gap-2 text-emerald-600">
                    <Eye className="w-3.5 h-3.5" /> View Profile
                  </button>
                  <button type="button" onClick={() => handleOpenEdit(clerk)} className="w-full text-left px-3 py-2 hover:bg-white/70 flex items-center gap-2 text-blue-600 border-t border-slate-100/80">
                    <Edit2 className="w-3.5 h-3.5" /> Edit Details
                  </button>
                  <button type="button" onClick={() => handleRemoveClerk(clerk.id, clerk.name)} className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-slate-100/80">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-white/50 border border-white/70 rounded-xl flex items-center justify-center text-xs font-black text-slate-500">{clerk.name.charAt(0)}</div>
                <div>
                  <span className="font-mono text-[9px] bg-white/50 border border-slate-200/70 text-slate-900 px-2 py-0.5 rounded font-bold uppercase">{clerk.id}</span>
                  <h4 className="text-sm font-black text-slate-900 mt-0.5">{clerk.name}</h4>
                </div>
              </div>

              <hr className="border-slate-100/80" />

              <div className="space-y-2 text-[11px] font-bold text-slate-500">
                <p className="text-slate-900 truncate"><Mail className="w-3.5 h-3.5 inline mr-1.5 text-slate-500" /> {clerk.email}</p>
                <p className="text-slate-900 font-mono"><Phone className="w-3.5 h-3.5 inline mr-1.5 text-slate-500" /> {clerk.mobile}</p>
              </div>

              <hr className="border-slate-100/80" />
              <div className="flex flex-wrap gap-1 font-mono text-[9px]">
                {clerk.documentsAttached.map((file, idx) => (
                  <span key={idx} className="bg-white/50 px-2 py-0.5 rounded text-slate-900 truncate max-w-[120px] border border-slate-200/70">{file}</span>
                ))}
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* MODAL 1: ADD CLERK PROFILE */}
      {showAddModal && (
        <ClerkFormModal 
          title="Initialize Clerk Onboarding" 
          btnText="Onboard Clerk Staff"
          formValues={clerkForm}
          onInputChange={(e) => handleInputChange(e, false)}
          onFileChange={handleFileChange}
          attachedFiles={attachedFiles}
          onSubmit={handleRegisterClerk}
          onClose={() => { setShowAddModal(false); setAttachedFiles([]); }}
        />
      )}

      {/* MODAL 2: EDIT CLERK PROFILE */}
      {editingClerk && (
        <ClerkFormModal 
          title="Amend Clerk Records Payload" 
          btnText="Update Database"
          formValues={editingClerk}
          onInputChange={(e) => handleInputChange(e, true)}
          onFileChange={(e) => {
            if (e.target.files.length > 0) {
              const files = Array.from(e.target.files).map(f => f.name);
              setEditingClerk(prev => ({ ...prev, documentsAttached: [...prev.documentsAttached, ...files] }));
            }
          }}
          attachedFiles={editingClerk.documentsAttached}
          onSubmit={handleUpdateClerk}
          onClose={() => setEditingClerk(null)}
          isEdit={true}
        />
      )}

    </div>
  );
};

// REUSABLE SUB-COMPONENT: CLERK FORM MODAL (ADD/EDIT BOTH FIELDS)
const ClerkFormModal = ({ title, btnText, formValues, onInputChange, onFileChange, attachedFiles, onSubmit, onClose, isEdit=false }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div className="glass-strong w-full max-w-lg rounded-3xl p-6 text-xs font-bold text-slate-900 space-y-4 shadow-xl animate-scaleUp">
      <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
        <h3 className="text-md font-black text-slate-900 flex items-center gap-1.5"><FileText className="w-4 h-4" /> {title}</h3>
        <button type="button" onClick={onClose} className="p-1 hover:bg-white/70 rounded-full"><X className="w-4 h-4" /></button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-slate-500">Clerk Full Name <span className="text-red-500">*</span></label>
          <input type="text" name="name" required value={formValues.name} onChange={onInputChange} placeholder="e.g. Mukesh Kumar" className="w-full p-3 bg-white/60 border border-white/80 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-semibold" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-500">Official Email Address <span className="text-red-500">*</span></label>
            <input type="email" name="email" required value={formValues.email} onChange={onInputChange} placeholder="name@example.com" className="w-full p-3 bg-white/60 border border-white/80 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-medium" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-slate-500">Mobile Number <span className="text-red-500">*</span></label>
            <input type="text" name="mobile" required value={formValues.mobile} onChange={onInputChange} placeholder="10 digit phone" className="w-full p-3 bg-white/60 border border-white/80 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-mono" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-500">Aadhaar Number <span className="text-red-500">*</span></label>
          <input type="text" name="aadharNumber" required maxLength={12} value={formValues.aadharNumber} onChange={onInputChange} placeholder="12 digit card indices" className="w-full p-3 bg-white/60 border border-white/80 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-mono tracking-wider" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-500">{isEdit ? "Attached Credentials Dossiers Portfolio" : "Upload Verification Credentials Packet"}</label>
          <div className="relative">
            <input type="file" multiple onChange={onFileChange} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10" />
            <div className="w-full py-4 bg-white/50 border border-dashed border-white/70 rounded-xl text-center font-medium text-slate-500 hover:border-black transition-all">
              <span>Click to map scanned file targets</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 font-mono text-[9px] pt-1">
            {attachedFiles.map((f, i) => (
              <span key={i} className="bg-white border border-white/70 text-slate-900 px-2 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {f}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100/80 pt-4">
          <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white/50 border border-white/70 rounded-full text-slate-500">Cancel</button>
          <button type="submit" className="px-6 py-2.5 btn-primary rounded-full font-black ">{btnText}</button>
        </div>
      </form>
    </div>
  </div>
);

export default ClerkManagement;
