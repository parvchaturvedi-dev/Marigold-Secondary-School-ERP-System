import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Hash, Users, Shield, Edit2, Trash2, Clock, CheckCircle, CheckSquare, Square } from 'lucide-react';
import { useMasterData } from '../../components/common/masterData';
import { useMongoState } from '../../components/common/mongoState';

const ROLE_LABELS = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  clerk: 'Clerk',
};

const getClassChannelId = (className = '') =>
  `ch-class-${String(className).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const Communication = ({ session }) => {
  const masterData = useMasterData();
  // Current logged-in simulated context
  const roleKey = String(session?.role || 'admin').toLowerCase();
  const currentUser = {
    id: session?.username || 'user',
    name: session?.displayName || session?.username || 'User',
    role: ROLE_LABELS[roleKey] || session?.role || 'Admin',
    roleKey,
  };
  const currentSession = "2026-2027"; 

  // Channels Pool
  const [storedChannels] = useMongoState('admin-communication-channels', []);
  const channels = useMemo(() => {
    const defaultChannels = [
      {
        id: 'ch-broadcast',
        name: 'School Broadcast',
        desc: 'Whole-school announcements and admin notices',
        type: 'Broadcast',
      },
      ...masterData.classNames.map((className) => ({
        id: getClassChannelId(className),
        name: `${className} - Class Stream`,
        desc: `${className} class communication channel`,
        type: 'Class',
        className,
      })),
    ];
    const defaultsById = new Map(defaultChannels.map((channel) => [channel.id, channel]));
    const customChannels = (Array.isArray(storedChannels) ? storedChannels : [])
      .filter((channel) => channel?.id && !defaultsById.has(channel.id));

    return [...defaultChannels, ...customChannels];
  }, [masterData.classNames, storedChannels]);

  const [activeChannelId, setActiveChannelId] = useState('ch-broadcast');
  const [typedMessage, setTypedMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editBufferText, setEditBufferText] = useState('');
  
  // Admin Multi-Class Selection State
  const [selectedTargetClasses, setSelectedTargetClasses] = useState([]);

  const chatBottomRef = useRef(null);

  // Messages Database with complete Date & Time strings
  const [messages, setMessages] = useMongoState('admin-communication-messages', []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannelId]);

  useEffect(() => {
    if (!channels.length) return;
    if (!channels.some((channel) => channel.id === activeChannelId)) {
      setActiveChannelId(channels[0].id);
    }

    const classChannelIds = new Set(channels.filter((channel) => channel.type === 'Class').map((channel) => channel.id));
    setSelectedTargetClasses((prev) => prev.filter((channelId) => classChannelIds.has(channelId)));
  }, [activeChannelId, channels]);

  // Helper function to generate standardized Date & Time stamp string
  const createTimestampString = () => {
    const now = new Date();
    const dateOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    const dateStr = now.toLocaleDateString('en-GB', dateOptions).replace(/ /g, '-');
    const timeStr = now.toLocaleTimeString('en-US', timeOptions);
    return `${dateStr} • ${timeStr}`;
  };

  // MULTI-CLASS CHECKBOX TOGGLE CONTROLLER
  const handleToggleClassSelection = (classId) => {
    setSelectedTargetClasses(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  // BROADCAST MESSAGE ENGINE
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    const timestampStr = createTimestampString();
    const isBroadcastMode = currentUser.roleKey === 'admin' && selectedTargetClasses.length > 0;

    if (isBroadcastMode) {
      // Admin is blasting the message across multiple selected classes + current active channel
      const targetChannels = Array.from(new Set([...selectedTargetClasses, activeChannelId]));
      
      const massMessages = targetChannels.map(chId => ({
        id: `msg-${Math.random().toString(36).substr(2, 9)}`,
        channelId: chId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text: typedMessage.trim(),
        timestamp: timestampStr,
        rawDate: new Date(),
        isEdited: false
      }));

      setMessages(prev => [...prev, ...massMessages]);
      setSelectedTargetClasses([]); // Reset multi-selection checkbox states
      alert(`Message successfully routed to ${targetChannels.length} active workspace nodes.`);
    } else {
      // Standard Single Channel Route message dispatch
      const singleMessage = {
        id: `msg-${Math.random().toString(36).substr(2, 9)}`,
        channelId: activeChannelId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text: typedMessage.trim(),
        timestamp: timestampStr,
        rawDate: new Date(),
        isEdited: false
      };
      setMessages(prev => [...prev, singleMessage]);
    }

    setTypedMessage('');
  };

  // RE-INDEXING / SUBSTANTIVE EDIT ROUTINE ENGINE
  const commitMessageEdit = (id) => {
    const targetMsg = messages.find(m => m.id === id);
    if (!targetMsg) return;

    if (currentUser.roleKey !== 'admin') {
      const timeElapsedInMinutes = (new Date() - new Date(targetMsg.rawDate)) / 60000;
      if (timeElapsedInMinutes > 10) {
        alert("Security Lock: Editing access has expired (10 minutes structural limit).");
        setEditingMessageId(null);
        return;
      }
    }

    setMessages(prev => prev.map(m => m.id === id ? { ...m, text: editBufferText.trim(), isEdited: true } : m));
    setEditingMessageId(null);
  };

  const triggerEditPhase = (message) => {
    setEditingMessageId(message.id);
    setEditBufferText(message.text || '');
  };

  const triggerGlobalPurge = (id) => {
    if (currentUser.roleKey !== 'admin') return;
    if (window.confirm("⚠️ Execute structural purge for everyone?")) {
      setMessages(prev => prev.filter(m => m.id !== id));
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const currentChannelMessages = messages.filter(m => m.channelId === activeChannelId);
  const classTypeChannels = channels.filter(c => c.type === 'Class');

  return (
    <div className="flex-1 h-[calc(100vh-73px)] bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A] flex gap-6">
      
      {/* LEFT CONTAINER LAYER: SUB-CHANNEL TREE SELECTOR ROSTERS (30vw) */}
      <div className="w-[30vw] bg-white border border-[#C8C8C8] rounded-3xl flex flex-col overflow-hidden shadow-2xs">
        <div className="p-4 bg-[#EAEAEA]/80 border-b border-[#C8C8C8]">
          <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Academic Streams
          </h3>
          <span className="text-[9px] font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1 block w-fit">
            CYCLE: {currentSession}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => { setActiveChannelId(ch.id); setEditingMessageId(null); }}
              className={`w-full text-left p-3 rounded-2xl border text-xs transition-all flex items-start gap-2.5 ${activeChannelId === ch.id ? 'bg-[#1A1A1A] border-black text-white shadow-md' : 'bg-[#EAEAEA]/30 border-[#C8C8C8]/60 hover:border-black text-[#1A1A1A]'}`}
            >
              <Hash className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeChannelId === ch.id ? 'text-[#E1FA6C]' : 'text-[#555555]'}`} />
              <div className="min-w-0">
                <p className="font-black truncate">{ch.name}</p>
                <p className={`text-[10px] font-medium mt-0.5 truncate ${activeChannelId === ch.id ? 'text-neutral-400' : 'text-[#555555]'}`}>{ch.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT CONTAINER LAYER: CORE LIVE INTERACTION CHAT TERMINAL GRID */}
      <div className="flex-1 bg-white border border-[#C8C8C8] rounded-3xl flex flex-col overflow-hidden shadow-2xs relative">
        
        {/* CHAT CONTAINER AREA HEADER MODULE */}
        <div className="p-4 bg-[#EAEAEA]/80 border-b border-[#C8C8C8] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-xl text-[#E1FA6C] flex items-center justify-center font-mono font-black text-sm">#</div>
            <div>
              <h4 className="text-sm font-black text-[#1A1A1A]">{activeChannel?.name}</h4>
              <p className="text-[10px] text-[#555555] font-semibold">{activeChannel?.desc}</p>
            </div>
          </div>
        </div>

        {/* MAIN CHAT MESSAGE RENDERING BUFFER MATRIX */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#D9D9D9]/10">
          {currentChannelMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#555555] font-semibold italic">
              No historical data logs captured inside this stream yet.
            </div>
          ) : (
            currentChannelMessages.map((msg) => {
              const isMyMessage = msg.senderId === currentUser.id;
              const isAdmin = currentUser.roleKey === 'admin';
              const timeDeltaInMin = (new Date() - new Date(msg.rawDate)) / 60000;
              const isEditableByMe = isMyMessage && (timeDeltaInMin <= 10 || isAdmin);

              return (
                <div key={msg.id} className={`flex flex-col max-w-[75%] ${isMyMessage ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                  
                  {/* LABEL NAME + EXACT DATE AND TIME METADATA STRIP */}
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#555555] mb-1 px-1">
                    <span className="text-[#1A1A1A] font-black">{msg.senderName}</span>
                    <span className={`text-[8px] px-1 rounded uppercase tracking-tighter font-black border ${msg.senderRole === 'Admin' ? 'bg-red-50 text-red-700 border-red-200' : msg.senderRole === 'Teacher' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                      [{msg.senderRole}]
                    </span>
                    <span className="font-mono text-[#555555] bg-[#EAEAEA] px-1.5 py-0.5 rounded-md font-bold ml-1 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-[#555555]" /> {msg.timestamp}
                    </span>
                  </div>

                  {/* DISPLAY SPEECH BUBBLE */}
                  <div className={`p-3 rounded-2xl border text-xs font-semibold relative group ${isMyMessage ? 'bg-[#1A1A1A] border-black text-white rounded-tr-none' : 'bg-[#EAEAEA] border-[#C8C8C8] text-[#1A1A1A] rounded-tl-none'}`}>
                    
                    {editingMessageId === msg.id ? (
                      <div className="space-y-2 min-w-[200px]">
                        <textarea
                          value={editBufferText}
                          onChange={(e) => setEditBufferText(e.target.value)}
                          className="w-full bg-white text-black p-2 rounded-xl text-xs font-medium border border-black outline-none resize-none"
                          rows={2}
                        />
                        <div className="flex justify-end gap-1 text-[9px] font-black uppercase">
                          <button type="button" onClick={() => setEditingMessageId(null)} className="px-2 py-1 bg-neutral-500 text-white rounded-md">Cancel</button>
                          <button type="button" onClick={() => commitMessageEdit(msg.id)} className="px-2 py-1 bg-[#E1FA6C] text-black rounded-md flex items-center gap-0.5">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="leading-relaxed break-all whitespace-pre-wrap">{msg.text}</p>
                        {msg.isEdited && <span className="text-[8px] block mt-1 font-mono italic opacity-60 text-right">(edited)</span>}
                      </div>
                    )}

                    {editingMessageId !== msg.id && (
                      <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white p-1 rounded-lg border border-[#C8C8C8] shadow-xs z-10 ${isMyMessage ? 'right-full mr-2' : 'left-full ml-2'}`}>
                        {(isMyMessage || isAdmin) && (
                          <button
                            type="button" onClick={() => triggerEditPhase(msg)}
                            disabled={!isEditableByMe && !isAdmin}
                            className={`p-1 rounded text-neutral-600 hover:text-black hover:bg-neutral-100 ${(!isEditableByMe && !isAdmin) ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {isAdmin && (
                          <button type="button" onClick={() => triggerGlobalPurge(msg.id)} className="p-1 rounded text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* ADMIN MULTI-CLASS BROADCAST SELECTION CAPSULE PANEL */}
        {currentUser.roleKey === 'admin' && (activeChannelId === 'ch-broadcast' || activeChannel?.type === 'Class') && (
          <div className="px-4 py-2.5 bg-[#EAEAEA]/80 border-t border-[#C8C8C8] flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#555555] flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-black" /> Blaster Cross-Routing Engine:
            </span>
            <div className="flex flex-wrap gap-2">
              {classTypeChannels.map((c) => {
                const isSelected = selectedTargetClasses.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleClassSelection(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1.5 transition-all ${isSelected ? 'bg-[#1A1A1A] text-[#E1FA6C] border-black shadow-xs' : 'bg-white border-[#C8C8C8] text-[#1A1A1A] hover:border-black'}`}
                  >
                    {isSelected ? <CheckSquare className="w-3 h-3 text-[#E1FA6C]" /> : <Square className="w-3 h-3 text-[#555555]" />}
                    {c.name.split(' - ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* INPUT INTERACTIVE CONTROL STRIP */}
        <div className="p-4 border-t border-[#C8C8C8] bg-white flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
            <input
              type="text"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder={selectedTargetClasses.length > 0 ? `⚠️ BROADCASTING payload simultaneously into current stream + ${selectedTargetClasses.length} selected classes...` : `Broadcast message into ${activeChannel?.name}...`}
              className="flex-1 p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl text-xs font-semibold outline-none focus:border-black placeholder-[#555555]"
            />
            <button
              type="submit"
              disabled={!typedMessage.trim()}
              className="p-3 bg-[#1A1A1A] text-[#E1FA6C] hover:opacity-90 transition-all rounded-xl disabled:opacity-40 flex-shrink-0"
            >
              <Send className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};

export default Communication;
