import React, { useState } from 'react';
import { Megaphone, Plus, Trash2, Calendar, Search, FileText, X, CheckSquare, Square } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { useMasterData } from '../../components/common/masterData';

const Notices = () => {
  const { classNames } = useMasterData();
  const availableClasses = classNames;

  // Global Live State for Notice Board Circulars Pool
  const [noticesList, setNoticesList] = useMongoState('admin-notices-list', []);

  // UI Interactive Tracker States
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Notice Form State Engine Vector
  const [newNotice, setNewNotice] = useState({
    title: '',
    description: '',
    category: 'General'
  });
  
  // Specific Selected target classes tracking state
  const [selectedClasses, setSelectedClasses] = useState([]);

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewNotice(prev => ({ ...prev, [name]: value }));
  };

  // MULTI-CHECKBOX SELECT INDIVIDUAL HANDLER
  const handleClassCheckboxChange = (cls) => {
    setSelectedClasses(prev => 
      prev.includes(cls) ? prev.filter(item => item !== cls) : [...prev, cls]
    );
  };

  // SELECT ALL GLOBAL INTERACTION MASTER TOGGLE
  const handleSelectAllToggle = () => {
    if (selectedClasses.length === availableClasses.length) {
      setSelectedClasses([]); // Flush selections
    } else {
      setSelectedClasses([...availableClasses]); // Inject all structural elements
    }
  };

  // ACTION ENGINE 1: PUBLISH NEW NOTICE CIRCULAR
  const handlePublishNotice = (e) => {
    e.preventDefault();

    if (selectedClasses.length === 0) {
      alert('Validation Failure: Please route this notice to at least one target class node.');
      return;
    }

    // Determine optimization string notation
    const finalTargetArray = selectedClasses.length === availableClasses.length ? ['ALL CLASSES'] : [...selectedClasses];

    const formattedNotice = {
      id: `NTC-2026-${Math.floor(100 + Math.random() * 900)}`,
      title: newNotice.title,
      description: newNotice.description,
      category: newNotice.category,
      date: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      targetClasses: finalTargetArray
    };

    setNoticesList(prev => [formattedNotice, ...prev]);
    setShowAddModal(false);
    
    // Reset Form Input Blocks & Array Pools
    setNewNotice({ title: '', description: '', category: 'General' });
    setSelectedClasses([]);
    alert('Notice broadcasted to specified target student feeds successfully!');
  };

  // ACTION ENGINE 2: PURGE/DELETE NOTICE RECORD
  const handleRemoveNotice = (id) => {
    const confirmDelete = window.confirm('⚠️ Are you sure you want to delete this notice circular from the public board?');
    if (confirmDelete) {
      setNoticesList(prev => prev.filter(n => n.id !== id));
    }
  };

  // Filter Pipeline Lookup Computation
  const filteredNotices = noticesList.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    n.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* HEADER META CONTROL BANNER */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#1A1A1A]" /> Official Campus Notice Board
          </h3>
          <p className="text-xs text-[#555555] mt-1">
            Publish or revoke institutional circulars, holiday announcements, and filter targeting directories.
          </p>
        </div>

        {/* Action Controls Side */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-[#EAEAEA] px-3.5 py-2 rounded-xl border border-[#C8C8C8]/60 text-xs">
            <Search className="w-4 h-4 text-[#555555]" />
            <input 
              type="text"
              placeholder="Search circulars..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-36 md:w-48 font-bold text-[#1A1A1A]"
            />
          </div>

          <button 
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1.5 text-xs font-black bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 px-5 py-2.5 rounded-xl hover:bg-[#d4ee59] transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Notice
          </button>
        </div>
      </div>

      {/* CORE BULLETIN MATRIX CARDS GRID */}
      {filteredNotices.length === 0 ? (
        <div className="bg-[#ffffff] rounded-3xl p-12 text-center text-xs text-[#555555] font-semibold border border-[#C8C8C8]">
          No notice data tracks matches your current search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {filteredNotices.map((notice) => (
            <div 
              key={notice.id} 
              className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 flex flex-col justify-between min-h-[210px] hover:border-black transition-all group relative"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] bg-[#EAEAEA] border border-[#C8C8C8]/60 text-[#1A1A1A] px-2 py-0.5 rounded-md font-black uppercase">
                      {notice.id}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tight ${notice.category === 'Accounts' ? 'bg-amber-50 text-amber-700 border border-amber-200' : notice.category === 'Examinations' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                      {notice.category}
                    </span>
                  </div>

                  <button 
                    type="button"
                    onClick={() => handleRemoveNotice(notice.id)}
                    className="text-[#555555] hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    title="Revoke Notice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="text-md font-black text-[#1A1A1A] leading-tight pt-1">
                  {notice.title}
                </h4>
                <p className="text-xs text-[#555555] font-medium leading-relaxed whitespace-pre-line">
                  {notice.description}
                </p>
              </div>

              {/* TARGET VISIBILITY MATRIX CHIPS */}
              <div className="mt-3.5 pt-2.5 border-t border-[#EAEAEA] space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider">Target Audience:</span>
                  <div className="flex flex-wrap gap-1">
                    {notice.targetClasses.map((tCls, idx) => (
                      <span 
                        key={idx} 
                        className={`text-[8px] px-1.5 py-0.5 font-bold rounded-sm ${tCls === 'ALL CLASSES' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-black' : 'bg-neutral-100 text-neutral-700 border border-neutral-300'}`}
                      >
                        {tCls}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Footer Timeline Marker */}
                <div className="flex items-center justify-between text-[10px] text-[#555555] font-bold font-mono pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#1A1A1A]" /> Published: {notice.date}
                  </span>
                  <span className="text-[#555555]/60 font-semibold">Status: BOUND</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* DYNAMIC COMPONENT: ADD NOTICE OVERLAY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] border-2 border-black w-full max-w-lg rounded-3xl p-6 relative animate-scaleUp text-xs font-bold text-[#1A1A1A] space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            
            {/* Modal Closer Header Bar */}
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
              <h3 className="text-md font-black text-[#1A1A1A] flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Draft Targeted Circular Broadcast
              </h3>
              <button 
                type="button" 
                onClick={() => { setShowAddModal(false); setSelectedClasses([]); }} 
                className="p-1 hover:bg-[#EAEAEA] rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input Form Fields Execution Trap */}
            <form onSubmit={handlePublishNotice} className="space-y-4">
              
              <div className="grid grid-cols-1 gap-1.5">
                <label className="text-[#555555]">Notice Title/Headline <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="title" 
                  required 
                  placeholder="e.g. School Timings Changed for Winters" 
                  value={newNotice.title} 
                  onChange={handleInputChange} 
                  className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-semibold text-[#1A1A1A]" 
                />
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <label className="text-[#555555]">Notice Department Stream Category</label>
                <select 
                  name="category" 
                  value={newNotice.category} 
                  onChange={handleInputChange} 
                  className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black"
                >
                  <option value="General">General/Academic Announcement</option>
                  <option value="Accounts">Accounts/Fee Reminders</option>
                  <option value="Examinations">Examinations & Evaluation Matrix</option>
                  <option value="Sports">Sports & Extracurricular Events</option>
                </select>
              </div>

              {/* TARGET CLASS ROUTING SELECTION TREE GRID */}
              <div className="grid grid-cols-1 gap-2 bg-[#EAEAEA]/40 p-4 rounded-2xl border border-[#C8C8C8]/60">
                <div className="flex items-center justify-between border-b border-[#C8C8C8]/60 pb-2 mb-1">
                  <label className="text-[#1A1A1A] font-black uppercase tracking-wider text-[10px]">Target Audience Scope Routing <span className="text-red-500">*</span></label>
                  
                  {/* MASTER CHANNELS ROUTER SWITCH */}
                  <button
                    type="button"
                    onClick={handleSelectAllToggle}
                    className="text-[10px] font-black bg-[#1A1A1A] text-[#E1FA6C] px-2.5 py-1 rounded-md hover:opacity-90 transition-all uppercase tracking-tight"
                  >
                    {selectedClasses.length === availableClasses.length ? 'Deselect All' : 'Select All Classes'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {availableClasses.map((cls, index) => {
                    const isChecked = selectedClasses.includes(cls);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleClassCheckboxChange(cls)}
                        className={`p-2 border rounded-xl flex items-center gap-2 text-left transition-all ${isChecked ? 'bg-[#1A1A1A] text-white border-black shadow-inner' : 'bg-white text-[#1A1A1A] border-[#C8C8C8] hover:border-black'}`}
                      >
                        {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-[#E1FA6C]" /> : <Square className="w-3.5 h-3.5 text-[#555555]" />}
                        <span className="text-[11px] font-bold">{cls}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <label className="text-[#555555]">Detailed Description Circular Content <span className="text-red-500">*</span></label>
                <textarea 
                  name="description" 
                  required 
                  rows="4" 
                  placeholder="Draft full declaration summary context here..." 
                  value={newNotice.description} 
                  onChange={handleInputChange} 
                  className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black resize-none font-semibold leading-relaxed text-[#1A1A1A]" 
                />
              </div>

              {/* Action Operations Buttons Trigger Strip */}
              <div className="flex items-center justify-end gap-2 border-t border-[#EAEAEA] pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowAddModal(false); setSelectedClasses([]); }} 
                  className="px-5 py-2.5 bg-[#EAEAEA] border border-[#C8C8C8] rounded-full text-[#555555] hover:text-black transition-colors"
                >
                  Discard Draft
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-full font-black hover:bg-[#d4ee59] shadow-xs transition-all uppercase tracking-wider"
                >
                  Publish Broadcast
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Notices;
