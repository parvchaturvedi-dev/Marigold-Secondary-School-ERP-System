import React, { useRef, useState } from 'react';
import { Camera, UserRound } from 'lucide-react';
import { uploadProfilePhoto } from './profileStore';

const ProfilePhotoUploader = ({ session, label = 'EDIT PIC', className = '' }) => {
  const fileInputRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const photoUrl = session?.photoDataUrl || '';
  const displayName = session?.displayName || session?.username || 'MGPS User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'MG';

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    try {
      setIsSaving(true);
      await uploadProfilePhoto(file);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
      event.target.value = '';
    }
  };

  return (
    <div className={`relative group w-28 h-28 mx-auto ${className}`}>
      <div className="w-full h-full bg-white/50 border-2 border-white/80 rounded-3xl flex items-center justify-center text-3xl font-black text-slate-900 overflow-hidden shadow-inner">
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="w-full h-full object-cover select-none" />
        ) : initials ? (
          <span>{initials}</span>
        ) : (
          <UserRound className="w-14 h-14 text-slate-500" />
        )}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isSaving}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-[10px] font-black disabled:opacity-60"
        title="Upload profile picture"
      >
        <Camera className="w-5 h-5 text-indigo-300 mb-0.5" />
        <span>{isSaving ? 'SAVING' : label}</span>
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

export default ProfilePhotoUploader;
