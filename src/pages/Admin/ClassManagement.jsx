import React, { useState } from 'react';
import { Layers, ArrowRightLeft, Users, UserCheck } from 'lucide-react';
import ClassDetail from './ClassDetail'; // Formatted view screen placeholder
import { useMongoState } from '../../components/common/mongoState';
import { useMasterData } from '../../components/common/masterData';

const ClassManagement = () => {
  // Navigation State for tracking inner sub views
  const [selectedClassContext, setSelectedClassContext] = useState(null);

  // Main Dashboard Workspace State
  const [classes, setClasses] = useMongoState('admin-class-management-classes', []);
  const { classes: derivedClasses } = useMasterData();
  const displayClasses = derivedClasses.length ? derivedClasses : classes;
  const classOrderSequence = displayClasses.map((classItem) => classItem.name);

  // MOVE TO NEXT JOURNEY (Session Promotion Core Business Logic)
  const handleNextJourneyPromotion = () => {
    const confirmation = window.confirm(
      "CRITICAL ACTION:\nAre you sure you want to trigger the 'Next Journey' promotion?\nAll students will be shifted to their immediate next hierarchal class level."
    );
    if (!confirmation) return;

    // We map back to front loop to prevent overriding clean arrays
    const promotedData = displayClasses.map((currentClass) => {
      const currentRankIndex = classOrderSequence.indexOf(currentClass.name);

      // If class is not found in preferences sequence or is already at the highest apex grade
      if (currentRankIndex === -1 || currentRankIndex === classOrderSequence.length - 1) {
        return { ...currentClass, studentCount: 0 }; // Graduated / Flushed out of the current matrix
      }

      // Find the targeted incoming class that is exactly 1 rank below current inside state
      const sourceClassName = classOrderSequence[currentRankIndex];
      // Find what was the count in the previous class to inherit it safely
      const inboundClassRecord = displayClasses.find((c) => c.name === sourceClassName);
      
      return {
        ...currentClass,
        studentCount: inboundClassRecord ? inboundClassRecord.studentCount : 0
      };
    });

    // Handle the lowest initial starting entry class (Set to 0 fresh admissions)
    const lowestClassName = classOrderSequence[0];
    const finalizedData = promotedData.map((c) => {
      if (c.name === lowestClassName) {
        return { ...c, studentCount: 0 }; 
      }
      return c;
    });

    setClasses(finalizedData);
    alert('Academic journey shifted successfully! Records updated.');
  };

  // If a card was triggered, swap engine to detail component view dynamically
  if (selectedClassContext) {
    return (
      <ClassDetail 
        classContext={selectedClassContext} 
        onBack={() => setSelectedClassContext(null)} 
      />
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* CONTROL ACTIONS BANNER */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1A1A1A]" /> Class Management
          </h3>
          <p className="text-xs text-[#555555] mt-1">
            Click on any operational card grid below to explore detailed rosters, metrics and records.
          </p>
        </div>

        {/* PROMOTION JOURNEY TRIGGER BUTTON */}
        <button 
          onClick={handleNextJourneyPromotion}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#E1FA6C] text-[#1A1A1A] rounded-full text-sm font-semibold shadow-xs hover:bg-[#d4ee59] transition-all shrink-0 border border-[#C8C8C8]/60"
        >
          <ArrowRightLeft className="w-4 h-4" /> Move to Next Journey
        </button>
      </div>

      {/* CLASSCARDS DYNAMIC WORKSPACE GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayClasses.map((cls) => (
          <div 
            key={cls.id}
            onClick={() => setSelectedClassContext(cls)}
            className="bg-[#ffffff] border border-[#C8C8C8] p-5 rounded-3xl flex flex-col justify-between group hover:border-[#1A1A1A] transition-all cursor-pointer min-h-[150px]"
          >
            {/* Top Identity Block */}
            <div className="flex items-center gap-4 border-b border-[#EAEAEA] pb-3">
              <div className="w-11 h-9 rounded-xl bg-[#EAEAEA] text-[#1A1A1A] flex items-center justify-center font-bold text-sm border border-[#C8C8C8]/40 shadow-xs">
                {cls.name.replace(/\D/g, "") || cls.name.charAt(0)}
              </div>
              <span className="text-sm font-bold text-[#1A1A1A] group-hover:text-black transition-colors">{cls.name}</span>
            </div>

            {/* Center Dynamic Metadata Blocks */}
            <div className="py-3 space-y-2">
              {/* Teacher Display Tracker */}
              <div className="flex items-center gap-2 text-xs text-[#555555]">
                <UserCheck className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span className="font-medium">Class Teacher:</span>
                <span className={`font-bold ${cls.teacher ? 'text-[#1A1A1A]' : 'text-red-600/80'}`}>
                  {cls.teacher || 'N/A'}
                </span>
              </div>

              {/* Live Student Count Metrics */}
              <div className="flex items-center gap-2 text-xs text-[#555555]">
                <Users className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span className="font-medium">Strength:</span>
                <span className="font-bold text-[#1A1A1A]">{cls.studentCount} Students</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default ClassManagement;
