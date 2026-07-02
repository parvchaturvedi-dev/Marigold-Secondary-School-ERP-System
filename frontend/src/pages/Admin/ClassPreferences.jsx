import React, { useState } from 'react';
import { Settings, PlusCircle, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';

const ClassPreferences = () => {
  // Master Classes with explicit ordering sequence
  const [orderedClasses, setOrderedClasses] = useMongoState('admin-class-preferences', []);
  const [managedClasses, setManagedClasses] = useMongoState('admin-class-management-classes', []);

  const [newClassName, setNewClassName] = useState('');

  // Add Class to Preference Pool
  const handleAddClass = (e) => {
    e.preventDefault();
    const formattedName = newClassName.trim();
    if (!formattedName) return;

    const isDuplicate = orderedClasses.some(
      (c) => c.name.toLowerCase() === formattedName.toLowerCase()
    );
    if (isDuplicate) {
      alert('This class level already exists in preferences!');
      return;
    }

    const classRecord = { id: `CLS-${Date.now()}`, name: formattedName, teacher: '', studentCount: 0 };
    setOrderedClasses([...orderedClasses, { id: classRecord.id, name: formattedName }]);
    if (!managedClasses.some((c) => c.name.toLowerCase() === formattedName.toLowerCase())) {
      setManagedClasses([...managedClasses, classRecord]);
    }
    setNewClassName('');
  };

  // Move Class Up in Hierarchy
  const moveUp = (index) => {
    if (index === 0) return; // Already at the top (smallest class)
    const updated = [...orderedClasses];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setOrderedClasses(updated);
  };

  // Move Class Down in Hierarchy
  const moveDown = (index) => {
    if (index === orderedClasses.length - 1) return; // Already at the bottom (highest class)
    const updated = [...orderedClasses];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setOrderedClasses(updated);
  };

  // Remove Class from Preferences
  const handleRemoveClass = (id) => {
    if (window.confirm('Remove this class from preference sequence?')) {
      const removedClass = orderedClasses.find((c) => c.id === id);
      setOrderedClasses(orderedClasses.filter((c) => c.id !== id));
      if (removedClass) {
        setManagedClasses(managedClasses.filter((c) => c.name !== removedClass.name));
      }
    }
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">
      
      {/* HEADER BANNER */}
      <div className="glass-card p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-900" /> Class Preferences & Hierarchy
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Define the academic sequence from lowest to highest class. This order dictates the student promotion logic.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: ADD CLASS FORM */}
        <div className="glass-card p-6 rounded-3xl h-fit">
          <h4 className="text-sm font-bold mb-4 text-slate-900">Add Class to Sequence</h4>
          <form onSubmit={handleAddClass} className="space-y-4 text-xs font-semibold">
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-500">Class Title Name</label>
              <input 
                type="text" 
                placeholder="e.g. Nursery, Class 1, Class 2" 
                required 
                value={newClassName} 
                onChange={(e) => setNewClassName(e.target.value)} 
                className="w-full p-3 bg-white/50 border border-white/70 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 font-medium text-sm text-slate-900" 
              />
            </div>
            <button 
              type="submit" 
              className="w-full flex items-center justify-center gap-2 px-5 py-3 btn-primary rounded-full font-bold text-xs shadow-xs "
            >
              <PlusCircle className="w-4 h-4" /> Insert Into Sequence
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: HIERARCHY ORDER LIST */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl">
          <h4 className="text-sm font-bold mb-2 text-slate-900">Active Class Sequence Order</h4>
          <p className="text-[11px] text-slate-500 mb-4">Top represents the lowest grade. Bottom represents the highest grade.</p>

          <div className="space-y-2">
            {orderedClasses.map((cls, index) => (
              <div 
                key={cls.id} 
                className="flex items-center justify-between p-3 bg-white/50 border border-slate-200/70 rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500 w-5">#{index + 1}</span>
                  <span className="text-sm font-bold text-slate-900">{cls.name}</span>
                </div>

                {/* CONTROLS */}
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => moveUp(index)} 
                    disabled={index === 0}
                    className="p-1.5 text-slate-900 hover:bg-white/70 rounded-lg disabled:opacity-30 transition-all"
                    title="Move Up (Smaller Class)"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => moveDown(index)} 
                    disabled={index === orderedClasses.length - 1}
                    className="p-1.5 text-slate-900 hover:bg-white/70 rounded-lg disabled:opacity-30 transition-all"
                    title="Move Down (Higher Class)"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleRemoveClass(cls.id)} 
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white/70 rounded-lg ml-2 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default ClassPreferences;
