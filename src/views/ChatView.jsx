import { Phone, Video, Search, Image as ImageIcon, ChevronLeft, ChevronRight, Heart, Download, X, Reply, Smile, Edit2, Trash2, Ban, MoreVertical, Paperclip, Mic, Send, Play, Pause, Check, Pin, MicOff, Volume2, VolumeX, Bell, PhoneOff, History, Gamepad2 } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useBroadcast, useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════ */
const compressImage = (base64Str, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      } else {
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
};

const globalAudioRef = { current: null };
function VoiceMessagePlayer({ duration, audioUrl }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(audioUrl ? new Audio(audioUrl) : null);
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.onended = () => setIsPlaying(false);
    const stopHandler = () => { if (globalAudioRef.current !== audioRef.current) setIsPlaying(false); };
    window.addEventListener('stopAudio', stopHandler);
    return () => { if (audio) { audio.pause(); audio.src = ''; } window.removeEventListener('stopAudio', stopHandler); };
  }, [audioUrl]);
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else {
      if (globalAudioRef.current && globalAudioRef.current !== audioRef.current) { globalAudioRef.current.pause(); window.dispatchEvent(new Event('stopAudio')); }
      audioRef.current.play().catch(e => console.log(e));
      globalAudioRef.current = audioRef.current;
      setIsPlaying(true);
    }
  };
  return (
    <div className="flex items-center gap-3 bg-white/50 p-2 rounded-lg retro-border">
      <button onClick={togglePlay} className="w-8 h-8 rounded-full retro-bg-accent retro-border flex items-center justify-center">{isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
      <div className="flex-1 h-2 bg-black/10 rounded-full w-20 sm:w-24 relative overflow-hidden"><div className={`absolute top-0 left-0 h-full bg-[var(--text-main)] w-1/3 rounded-full ${isPlaying ? 'animate-pulse bg-[var(--primary)] w-full transition-all duration-1000' : ''}`}></div></div>
      <span className="text-xs font-bold">{duration}</span>
    </div>
  );
}

function formatMessage(text) {
  if (!text) return null; const parts = text.split(/(\*.*?\*|_.*?_)/g);
  return parts.map((part, i) => { if (part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>; if (part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>; return part; });
}

function ImageViewerOverlay({ images, currentIndex, onClose, onNext, onPrev, profileName, onSaveToScrapbook }) {
  if (currentIndex === null || !images || !images[currentIndex]) return null; 
  const currentUrl = images[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images, onNext, onPrev, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl h-full flex flex-col items-center justify-center relative" onClick={e => e.stopPropagation()}>
        <img src={currentUrl} alt="full resolution" className="max-w-full max-h-full object-contain retro-border shadow-2xl bg-black" />
        
        {images.length > 1 && (
          <>
            <button onClick={onPrev} className="absolute left-0 sm:-left-16 top-1/2 -translate-y-1/2 p-3 text-white hover:scale-110 transition-transform"><ChevronLeft size={48} /></button>
            <button onClick={onNext} className="absolute right-0 sm:-right-16 top-1/2 -translate-y-1/2 p-3 text-white hover:scale-110 transition-transform"><ChevronRight size={48} /></button>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full font-bold text-sm">
                {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
        
        <button onClick={onClose} className="absolute top-0 right-0 sm:-right-16 p-3 text-white hover:rotate-90 transition-transform"><X size={32} /></button>
        
        <div className="absolute bottom-4 flex gap-4">
            <RetroButton variant="primary" onClick={() => onSaveToScrapbook(currentUrl)} className="px-6 py-2 flex items-center gap-2"><ImageIcon size={18} /> Save to Scrapbook</RetroButton>
        </div>
      </div>
    </div>
  );
}

export function ChatView({ onClose, profile, partnerProfile, partnerNickname, sfx, chatHistory, setChatHistory, userId, partnerId, onStartCall, sharedImages, setSharedImages }) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('media');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const [voiceBase64, setVoiceBase64] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lobbyState, setLobbyState] = useGlobalSync('game_lobby', { status: 'idle' });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [activeOptions, setActiveOptions] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerContext, setViewerContext] = useState({ urls: [], index: 0, isOpen: false });
  const [pendingImages, setPendingImages] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // TYPING INDICATOR LOGIC
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const sendTyping = useBroadcast('typing', (payload) => {
      if (payload.userId === partnerId) {
          setIsPartnerTyping(payload.isTyping);
      }
  });

  const typingTimeoutRef = useRef(null);
  const handleInputChange = (e) => {
      setInput(e.target.value);
      sendTyping({ userId, isTyping: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
          sendTyping({ userId, isTyping: false });
      }, 2000);
  };

  const safeHistory = Array.isArray(chatHistory) ? chatHistory : [];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp' && !input && !editingMsgId) {
      const myMsgs = safeHistory.filter(m => m.sender === userId && m.type === 'text' && !m.isDeleted);
      if (myMsgs.length > 0) {
        const last = myMsgs[myMsgs.length - 1];
        setEditingMsgId(last.id);
        setInput(last.text);
        e.preventDefault();
      }
    }
    if (e.key === 'Escape') {
      setEditingMsgId(null);
      setInput('');
      setReplyingTo(null);
    }
  };

  useEffect(() => {
    if (!Array.isArray(chatHistory)) return;
    const unreadFromPartner = chatHistory.some(m => m.sender === partnerId && m.status !== 'read');
    if (unreadFromPartner) {
        setChatHistory(prev => prev.map(m => (m.sender === partnerId && m.status !== 'read') ? { ...m, status: 'read', readAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : m));
    }
  }, [chatHistory, partnerId, setChatHistory]);

  useEffect(() => { 
    if (!activeOptions && searchQuery === '' && !viewerContext.isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
    }
  }, [chatHistory, activeOptions, searchQuery, viewerContext.isOpen, showDetails]);

  const handleStartCall = (type) => { 
    playAudio('click', sfx); 
    setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, senderName: profile?.name, type: 'call_invite', callType: type, status: 'ringing', time: new Date().toLocaleTimeString(), target: partnerId }]); 
  };

  const handleJoinGame = (inviteMsg) => {
    playAudio('click', sfx);
    // Update lobby state to 'joined'
    setLobbyState({ ...inviteMsg, status: 'joined', partnerId: userId });
    // Navigate to activity
    navigate(`/activities/${inviteMsg.gameId}`);
  };

  const handleSend = (e) => {
    if (e && e.preventDefault) e.preventDefault(); 
    
    // Check if it's a special invite message passed as 'e'
    if (e && e.type === 'game_invite') {
       const newMsg = {
         id: crypto.randomUUID(),
         sender: userId,
         senderName: profile?.name,
         type: 'game_invite',
         gameId: e.gameId,
         gameTitle: e.gameTitle,
         text: e.text,
         timestamp: Date.now(),
         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
         status: 'pending'
       };
       setChatHistory([...chatHistory, newMsg]);
       return;
    }

    if (!input.trim() && pendingImages.length === 0 && voicePreview === null) return; 
    playAudio('send', sfx);
    if (editingMsgId) { 
      setChatHistory(chatHistory.map(m => m.id === editingMsgId ? { ...m, text: input, isEdited: true } : m)); 
      setEditingMsgId(null); 
    }
    else if (pendingImages.length > 0) {
      const newMsg = {
        id: crypto.randomUUID(),
        sender: userId,
        senderName: profile?.name,
        type: pendingImages.length > 1 ? 'image_group' : 'image',
        url: pendingImages.length === 1 ? pendingImages[0] : null,
        urls: pendingImages.length > 1 ? pendingImages : null,
        text: input.trim() || null,
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        replyTo: replyingTo,
        status: 'sent'
      };
      setChatHistory([...chatHistory, newMsg]);
      setPendingImages([]);
    }
    else { 
      const newMsg = { 
        id: crypto.randomUUID(), 
        sender: userId, 
        senderName: profile?.name, 
        type: 'text', 
        text: input, 
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        replyTo: replyingTo, 
        status: 'sent' 
      };
      setChatHistory([...chatHistory, newMsg]); 
    }
    setInput(''); setReplyingTo(null); setActiveOptions(null); setShowEmojiPicker(false);
    sendTyping({ userId, isTyping: false });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
      const mediaRecorder = new MediaRecorder(stream); 
      mediaRecorderRef.current = mediaRecorder; 
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
        const audioUrl = URL.createObjectURL(audioBlob); 
        const durationSecs = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        const reader = new FileReader(); reader.readAsDataURL(audioBlob); 
        reader.onloadend = () => { 
            setVoiceBase64(reader.result); 
            if (durationSecs >= 1) { setVoicePreview(durationSecs); setVoicePreviewUrl(audioUrl); } 
        };
        stream.getTracks().forEach(track => track.stop());
      }; 
      mediaRecorder.start(); 
      setIsRecording(true); 
      recordingStartTimeRef.current = Date.now(); 
      setRecordingTime(0); 
      recordingTimerRef.current = setInterval(() => { setRecordingTime(prev => prev + 1); }, 1000);
    } catch (err) { alert("Microphone access denied."); }
  };
  const stopRecording = () => { if (!isRecording || !mediaRecorderRef.current) return; setIsRecording(false); clearInterval(recordingTimerRef.current); mediaRecorderRef.current.stop(); };
  const discardVoiceNote = () => { setVoicePreview(null); setVoicePreviewUrl(null); setVoiceBase64(null); };
  const confirmVoiceNote = () => {
    if (!voiceBase64 || !voicePreview) return; playAudio('send', sfx);
    setChatHistory(prev => [...prev, { 
        id: crypto.randomUUID(), 
        sender: userId, 
        senderName: profile?.name, 
        type: 'voice', 
        duration: `${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`, 
        audioUrl: voiceBase64, 
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        replyTo: replyingTo, 
        status: 'sent' 
    }]);
    setReplyingTo(null); discardVoiceNote();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newImgs = await Promise.all(files.map(file => {
          return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = async () => {
                  const compressed = await compressImage(reader.result);
                  resolve(compressed);
              };
              reader.readAsDataURL(file);
          });
      }));
      setPendingImages(prev => [...prev, ...newImgs]);
      playAudio('click', sfx);
    }
  };

  const handleSaveToScrapbook = (url) => {
    if (!setSharedImages) return;
    setSharedImages(prev => [...new Set([...(prev || []), url])]);
    playAudio('click', sfx);
    alert("Saved to Scrapbook!");
  };

  const onEmojiClick = (emojiData) => { setInput(prev => prev + emojiData.emoji); };

  const imageMessages = safeHistory.filter(m => (m.type === 'image' || m.type === 'image_group') && !m.isDeleted);
  const pinnedMessages = safeHistory.filter(m => m.isPinned && !m.isDeleted);
  const callHistory = safeHistory.filter(m => m.type === 'call_invite' && (m.status === 'ended' || m.status === 'missed' || m.status === 'accepted' || m.status === 'rejected'));
  const headerActions = (
    <div className="flex gap-2">
      <button onClick={() => onStartCall('audio')} className="p-1 hover:bg-black/10 rounded-md transition-colors" title="Voice Call"><Phone size={18} /></button>
      <button onClick={() => onStartCall('video')} className="p-1 hover:bg-black/10 rounded-md transition-colors" title="Video Call"><Video size={18} /></button>
    </div>
  );
  const filteredMessages = safeHistory.filter(m => searchQuery === '' || (m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())) || (m.type === 'image' && m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <>
      {viewerContext.isOpen && (
        <ImageViewerOverlay 
          images={viewerContext.urls} 
          currentIndex={viewerContext.index} 
          onClose={() => setViewerContext(p => ({ ...p, isOpen: false }))} 
          onNext={() => setViewerContext(p => ({ ...p, index: (p.index + 1) % p.urls.length }))} 
          onPrev={() => setViewerContext(p => ({ ...p, index: (p.index - 1 + p.urls.length) % p.urls.length }))} 
          profileName={profile?.name} 
          onSaveToScrapbook={handleSaveToScrapbook} 
        />
      )}
      <RetroWindow title="chat_room.exe" onClose={onClose} headerActions={headerActions} onTitleClick={() => { playAudio('click', sfx); setShowDetails(!showDetails) }} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col transition-all duration-300" noPadding>
        <div className="flex flex-1 h-full overflow-hidden relative">
          <div className={`flex flex-col h-full transition-all duration-300 ${showDetails ? 'hidden md:flex md:w-2/3 border-r-2 retro-border' : 'w-full'}`}>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col retro-bg-window relative">
              <div className="text-center text-xs font-bold opacity-50 mb-6 retro-border-b inline-block mx-auto pb-1 mt-2">-- connection secured --</div>
              {filteredMessages.map((msg, index) => {
                const isMe = msg.sender === userId;
                const prevMsg = filteredMessages[index - 1];
                const nextMsg = filteredMessages[index + 1];
                const isGroupStart = !prevMsg || prevMsg.sender !== msg.sender;
                const isGroupEnd = !nextMsg || nextMsg.sender !== msg.sender;
                const marginClass = isGroupEnd ? "mb-6" : "mb-1";
                if (msg.type === 'call_invite' && msg.status === 'ringing') return null;
                const isCallLog = msg.type === 'call_invite';
                const isPureEmoji = msg.type === 'text' && msg.text && /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/.test(msg.text.trim());
                const isPureImage = (msg.type === 'image' || msg.type === 'image_group') && !msg.text;
                const isGameInvite = msg.type === 'game_invite';
                const noBubble = (isPureEmoji || isPureImage) && !msg.isDeleted;

                return (
                  <div key={msg.id} className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'} ${marginClass}`}>
                    <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%] relative">
                      {!isMe && (
                        <div className="w-8 flex-shrink-0">
                          {isGroupEnd && (
                            partnerProfile.pfp ? (
                              <img src={partnerProfile.pfp} alt="partner" className="w-8 h-8 retro-border object-cover bg-white" />
                            ) : (
                              <div className="w-8 h-8 retro-bg-secondary retro-border flex items-center justify-center text-sm">{partnerProfile.emoji || '☕'}</div>
                            )
                          )}
                        </div>
                      )}
                      {isMe && !msg.isDeleted && !isCallLog && (<div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 flex items-center justify-center relative"><button onClick={() => { playAudio('click', sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="p-1 hover:bg-black/5 rounded-full"><MoreVertical size={16} className="opacity-50 hover:opacity-100" /></button></div>)}
                      <div className={`${noBubble || isGameInvite ? 'p-0' : 'p-3'} text-sm leading-relaxed relative ${noBubble || isGameInvite ? '' : 'retro-border'} ${msg.isDeleted ? 'bg-gray-100 border-gray-300 text-gray-500 italic' : isCallLog ? 'bg-black/5 border-dashed italic' : isMe ? (noBubble || isGameInvite ? '' : 'retro-bg-primary retro-shadow-dark') : (noBubble || isGameInvite ? '' : 'retro-bg-window retro-shadow-dark')} ${isMe ? `rounded-l-xl ${isGroupStart ? 'rounded-tr-xl' : 'rounded-tr-sm'} ${isGroupEnd ? 'rounded-br-xl' : 'rounded-br-sm'}` : `rounded-r-xl ${isGroupStart ? 'rounded-tl-xl' : 'rounded-tl-sm'} ${isGroupEnd ? 'rounded-bl-xl' : 'rounded-bl-sm'}`}`}>
                        {msg.replyTo && !msg.isDeleted && (<div className={`${noBubble ? 'bg-white/80 backdrop-blur-md shadow-sm mb-2 retro-border border-l-4 p-2' : 'bg-white/50 border-l-4 border-[var(--border)] p-2 mb-2'} text-xs rounded-r-md`}><p className="font-bold opacity-70 mb-1">{msg.replyTo.sender === userId ? profile.name || 'You' : (msg.replyTo.senderName || partnerNickname || 'Partner')}</p><p className="truncate opacity-80">{msg.replyTo.text || 'Attachment/Voice'}</p></div>)}
                        {msg.isDeleted ? (<span className="flex items-center gap-2"><Ban size={14} /> this message was deleted</span>) : (
                          <>
                            {msg.type === 'text' && <span className={isPureEmoji ? 'text-4xl sm:text-5xl drop-shadow-sm' : 'break-words'}>{formatMessage(msg.text)}</span>}
                            {msg.type === 'voice' && <VoiceMessagePlayer duration={msg.duration} audioUrl={msg.audioUrl} />}
                            {msg.type === 'game_invite' && (
                                <div className="retro-border retro-bg-window retro-shadow-dark p-3 w-64 animate-in slide-in-from-bottom-2">
                                   <div className="flex items-center gap-2 mb-3 border-b-2 border-dashed border-[var(--border)] pb-2">
                                      <Gamepad2 size={20} className="text-[var(--primary)]" />
                                      <span className="font-black text-xs uppercase tracking-widest">Activity Invite</span>
                                   </div>
                                   <p className="text-xs font-bold mb-4 opacity-80">{msg.text}</p>
                                   {!isMe ? (
                                      <RetroButton className="w-full py-2 text-xs" onClick={() => handleJoinGame(msg)}>
                                         Join Activity
                                      </RetroButton>
                                   ) : (
                                      <div className="bg-[var(--accent)]/10 retro-border border-dashed p-2 text-center">
                                         <p className="text-[10px] font-black uppercase opacity-60">Invite Sent</p>
                                      </div>
                                   )}
                                </div>
                            )}
                            {msg.type === 'call_invite' && (
                              <div className="flex items-center gap-2 font-bold py-1">
                                {msg.callType === 'video' ? <Video size={16} className="text-pink-500" /> : <Phone size={16} className="text-cyan-500" />}
                                <span className="text-[10px] uppercase tracking-widest">{msg.callType === 'video' ? 'Video' : 'Audio'} Call {msg.status}</span>
                              </div>
                            )}
                            {msg.type === 'image' && (<div className="flex flex-col gap-2"><img src={msg.url} alt="attachment" onClick={() => { playAudio('click', sfx); setViewerContext({ urls: [msg.url], index: 0, isOpen: true }); }} className={`${isPureImage ? 'w-48 h-auto sm:w-64' : 'w-32 h-32 sm:w-48 sm:h-48'} object-cover retro-border cursor-pointer hover:opacity-90 transition-opacity`} />{msg.text && <span className="italic break-words">{msg.text}</span>}</div>)}
                            {msg.type === 'image_group' && (
                               <div className="flex flex-col gap-2">
                                 <div className={`grid ${msg.urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-1 w-full max-w-sm`}>
                                   {msg.urls.map((u, i) => (
                                     <img key={i} src={u} onClick={() => { playAudio('click', sfx); setViewerContext({ urls: msg.urls, index: i, isOpen: true }); }} className="aspect-square object-cover retro-border cursor-pointer hover:opacity-80" />
                                   ))}
                                 </div>
                                 {msg.text && <span className="italic break-words">{msg.text}</span>}
                               </div>
                            )}
                          </>
                        )}
                        {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && !isCallLog && (<div className={`absolute ${noBubble ? '-bottom-1' : '-bottom-3'} ${isMe ? '-left-2' : '-right-2'} bg-white retro-border rounded-full px-1 py-0.5 text-xs flex gap-1 retro-shadow-primary z-10`}>{msg.reactions.map((r, i) => <span key={i}>{r}</span>)}</div>)}
                      </div>
                      {!isMe && !msg.isDeleted && !isCallLog && (<div className="opacity-0 group-hover:opacity-100 transition-opacity pl-2 flex items-center justify-center relative"><button onClick={() => { playAudio('click', sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="p-1 hover:bg-black/5 rounded-full"><MoreVertical size={16} className="opacity-50 hover:opacity-100" /></button></div>)}
                      {activeOptions === msg.id && !isCallLog && (<div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} retro-bg-window retro-border retro-shadow-dark z-20 flex flex-col w-40 py-1`}><button onClick={() => { playAudio('click', sfx); setReplyingTo(msg); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Reply size={14} /> Reply</button><button onClick={() => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => m.id === msg.id ? { ...m, isPinned: !m.isPinned } : m)); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Pin size={14} /> {msg.isPinned ? 'Unpin' : 'Pin'}</button>{(msg.type === 'image' || msg.type === 'image_group') && <button onClick={() => { handleSaveToScrapbook(msg.url || msg.urls[0]); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><ImageIcon size={14} /> Scrapbook</button>}<div className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] border-b border-[var(--border)] border-dashed"><Smile size={14} /> <span onClick={() => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => { if (m.id === msg.id) { const rs = m.reactions || []; return { ...m, reactions: rs.includes('❤️') ? rs.filter(e => e !== '❤️') : [...rs, '❤️'] }; } return m; })); setActiveOptions(null); }} className="cursor-pointer hover:scale-125 transition-transform">❤️</span></div>{isMe && msg.type === 'text' && <button onClick={() => { playAudio('click', sfx); setEditingMsgId(msg.id); setInput(msg.text); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Edit2 size={14} /> Edit</button>}{isMe && <button onClick={() => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => m.id === msg.id ? { ...m, isDeleted: true, text: null, url: null } : m)); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-100 text-red-600 text-left"><Trash2 size={14} /> Delete</button>}</div>)}
                    </div>
                    {msg.isPinned && !msg.isDeleted && <div className={`absolute -top-3 ${isMe ? 'right-4' : 'left-4'} bg-[var(--accent)] rounded-full p-1 border-2 border-[var(--border)] z-10`}><Pin size={12} className="text-white" /></div>}
                    {isGroupEnd && (<div className="flex flex-col items-end gap-1 mt-1 justify-end px-2"><span className="text-[10px] opacity-70 font-bold">{msg.time}</span>{isMe && msg.status && !isCallLog && (<div className="flex items-center gap-1"><div className="flex -space-x-1.5"><Check size={12} className={msg.status === 'read' ? 'text-blue-500' : 'text-[var(--border)] opacity-50'} strokeWidth={3} />{(msg.status === 'delivered' || msg.status === 'read') && <Check size={12} className={msg.status === 'read' ? 'text-blue-500' : 'text-[var(--border)] opacity-50'} strokeWidth={3} />}</div>{msg.status === 'read' && msg.readAt && <span className="text-[8px] font-black opacity-30 uppercase">seen {msg.readAt}</span>}</div>)}</div>)}
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
              {isPartnerTyping && (
                  <div className="flex items-center gap-2 mb-4 animate-in fade-in duration-300">
                      <div className="w-8 h-8 rounded-full retro-bg-secondary retro-border flex items-center justify-center text-sm">{partnerProfile.emoji || '☕'}</div>
                      <div className="retro-bg-window retro-border px-3 py-2 rounded-xl rounded-bl-sm text-[10px] font-bold opacity-60 flex gap-1 items-center">
                          {partnerNickname} is typing
                          <span className="flex gap-0.5">
                              <span className="w-1 h-1 bg-black rounded-full animate-bounce"></span>
                              <span className="w-1 h-1 bg-black rounded-full animate-bounce [animation-delay:0.2s]"></span>
                              <span className="w-1 h-1 bg-black rounded-full animate-bounce [animation-delay:0.4s]"></span>
                          </span>
                      </div>
                  </div>
              )}
            </div>
            <div className="flex flex-col retro-bg-accent retro-border-t relative">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 z-[100] shadow-2xl animate-in slide-in-from-bottom-2">
                  <EmojiPicker onEmojiClick={onEmojiClick} theme="light" />
                </div>
              )}
              {pendingImages.length > 0 && (
                <div className="p-3 bg-white/80 backdrop-blur-md border-b-2 border-dashed border-[var(--border)] flex flex-wrap gap-4 animate-in slide-in-from-bottom-2">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="preview" className="w-16 h-16 object-cover retro-border shadow-sm" />
                      <button onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full retro-border shadow-md hover:scale-110"><X size={10}/></button>
                    </div>
                  ))}
                  <div className="flex-1 min-w-[150px]">
                    <p className="text-xs font-bold uppercase opacity-50 mb-1">Media Preview</p>
                    <p className="text-[10px] italic">Sending {pendingImages.length} items at once.</p>
                  </div>
                </div>
              )}
              {voicePreview !== null && (<div className="p-3 bg-blue-50 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-3"><div className="flex items-center gap-3 flex-1"><Mic size={16} className="text-blue-500" /><span className="text-sm font-bold">Voice note: {Math.floor(voicePreview / 60)}:{(voicePreview % 60).toString().padStart(2, '0')}</span></div><div className="flex gap-2"><VoiceMessagePlayer duration={`${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`} audioUrl={voicePreviewUrl} /></div><div className="flex gap-2"><button onClick={() => discardVoiceNote()} className="px-3 py-1 retro-border bg-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-300 rounded">Discard</button><button onClick={confirmVoiceNote} className="px-3 py-1 retro-border bg-green-400 text-white text-xs font-bold hover:bg-green-500 rounded">Send</button></div></div>)}
              {replyingTo && (<div className="p-2 bg-white/50 border-b border-dashed border-[var(--border)] flex justify-between items-center text-sm"><div><span className="font-bold mr-2 text-[var(--primary)]"><Reply size={14} className="inline mr-1" />Replying to {replyingTo.sender === userId ? profile.name || 'You' : (replyingTo.senderName || partnerNickname || 'Partner')}:</span><span className="opacity-70 truncate max-w-[200px] inline-block align-bottom">{replyingTo.text || 'Attachment/Voice'}</span></div><button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-black/10 rounded-full"><X size={14} /></button></div>)}
              <form onSubmit={handleSend} className="flex gap-2 items-center p-2 sm:p-3 relative"><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple /><button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 retro-bg-window retro-border hover:bg-gray-100 disabled:opacity-50 transition-colors"><Paperclip size={18} /></button><button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 retro-bg-window retro-border transition-colors ${showEmojiPicker ? 'bg-[var(--accent)]' : 'hover:bg-gray-100'}`}><Smile size={18} /></button><div className="flex-1 relative flex items-center"><input type="text" value={isRecording ? `Recording... 0:${recordingTime.toString().padStart(2, '0')}` : input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={pendingImages.length > 0 ? "Add a caption..." : "type a message..."} disabled={isRecording || voicePreview !== null} className={`w-full p-2 sm:p-3 retro-border retro-bg-window focus:outline-none font-bold placeholder:font-normal text-sm sm:text-base ${isRecording ? 'text-red-500 animate-pulse bg-red-50' : ''}`} /></div>{!input.trim() && !editingMsgId && voicePreview === null && pendingImages.length === 0 ? (<button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`p-2 sm:p-3 retro-border transition-all flex-shrink-0 select-none ${isRecording ? 'bg-red-400 text-white retro-shadow-none translate-y-[2px]' : 'retro-bg-window retro-shadow-dark hover:-translate-y-1'}`}><Mic size={18} className={isRecording ? 'animate-bounce' : ''} /></button>) : (<RetroButton type="submit" variant="primary" className="p-2 sm:p-3 flex-shrink-0"><Send size={18} /></RetroButton>)}</form>
            </div>
          </div>
          {showDetails && (
            <div className="flex flex-col w-full md:w-1/3 retro-bg-main overflow-y-auto relative border-l-2 retro-border">
              <button onClick={() => setShowDetails(false)} className="md:hidden absolute top-4 right-4 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark z-10 rounded-full"><X size={16} /></button>
              <div className="p-2 flex gap-1 bg-[var(--border)] shrink-0"><button onClick={() => setActiveSidebarTab('media')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'media' ? 'bg-white' : 'opacity-50 text-white'}`}>Media</button><button onClick={() => setActiveSidebarTab('calls')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'calls' ? 'bg-white' : 'opacity-50 text-white'}`}>Calls</button><button onClick={() => setActiveSidebarTab('search')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'search' ? 'bg-white' : 'opacity-50 text-white'}`}>Search</button></div>
              <div className="p-4 flex flex-col gap-6">
                {activeSidebarTab === 'search' && (<div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><Search size={16} /> Search Logs</h3><div className="flex bg-[var(--bg-window)] retro-border p-2"><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="filter messages..." className="bg-transparent outline-none w-full text-sm font-bold" />{searchQuery && <button onClick={() => setSearchQuery('')}><X size={14} className="opacity-50" /></button>}</div></div>)}
                {activeSidebarTab === 'media' && (
                  <>
                    <div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><Pin size={16} /> Pinned</h3><div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">{pinnedMessages.length === 0 ? (<p className="text-sm opacity-50">No pinned messages.</p>) : (pinnedMessages.map(m => (<div key={m.id} className="bg-[var(--bg-window)] p-2 text-sm retro-border border-l-4 border-l-[var(--accent)]"><p className="font-bold opacity-70 text-xs mb-1">{m.sender === userId ? 'You' : (m.senderName || partnerNickname || 'Partner')}</p><p className="truncate">{m.text || 'Attachment/Voice'}</p></div>)))}</div></div>
                    <div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><ImageIcon size={16} /> Media Grid</h3><div className="grid grid-cols-2 gap-2">{imageMessages.length === 0 ? (<p className="text-sm opacity-50 col-span-2">No media shared yet.</p>) : (imageMessages.map(m => (<div key={m.id} onClick={() => setViewerContext({ urls: m.type === 'image_group' ? m.urls : [m.url], index: 0, isOpen: true })} className="aspect-square retro-border retro-shadow-dark bg-cover bg-center cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundImage: `url(${m.type === 'image_group' ? m.urls[0] : m.url})` }}></div>)))}</div></div>
                  </>
                )}
                {activeSidebarTab === 'calls' && (<div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><History size={16} /> Call History</h3><div className="flex flex-col gap-2 overflow-y-auto pr-1">{callHistory.length === 0 ? (<p className="text-sm opacity-50">No call history.</p>) : (callHistory.reverse().map(m => (<div key={m.id} className="bg-[var(--bg-window)] p-3 text-xs retro-border flex items-center justify-between"><div className="flex items-center gap-2">{m.callType === 'video' ? <Video size={14} className="text-[var(--secondary)]" /> : <Phone size={14} className="text-[var(--primary)]" />}<div><p className="font-bold">{m.sender === userId ? 'Outgoing' : 'Incoming'}</p><p className="opacity-50">{m.time}</p></div></div><span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 retro-border ${m.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span></div>)))}</div></div>)}
              </div>
            </div>
          )}
        </div>
      </RetroWindow>
    </>
  );
}
