import React, { useState, useEffect, useRef } from 'react';
import { Phone, Video, Search, Image as ImageIcon, ChevronLeft, ChevronRight, Heart, Download, X, Reply, Smile, Edit2, Trash2, Ban, MoreVertical, Paperclip, Mic, Send, Play, Pause, Check, Pin, MicOff, Volume2, VolumeX, Bell, PhoneOff, History } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';

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
      <button onClick={togglePlay} className="w-8 h-8 rounded-full retro-bg-accent retro-border flex items-center justify-center hover:scale-105">{isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
      <div className="flex-1 h-2 bg-black/10 rounded-full w-20 sm:w-24 relative overflow-hidden"><div className={`absolute top-0 left-0 h-full bg-[var(--text-main)] w-1/3 rounded-full ${isPlaying ? 'animate-pulse bg-[var(--primary)] w-full transition-all duration-1000' : ''}`}></div></div>
      <span className="text-xs font-bold">{duration}</span>
    </div>
  );
}

function formatMessage(text) {
  if (!text) return null; const parts = text.split(/(\*.*?\*|_.*?_)/g);
  return parts.map((part, i) => { if (part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>; if (part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>; return part; });
}

function ImageViewerOverlay({ images, currentIndex, onClose, onNext, onPrev, profileName }) {
  if (currentIndex === null || !images[currentIndex]) return null; const currentImage = images[currentIndex];
  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-main)]/90 backdrop-blur-sm flex items-center justify-center p-4">
      <RetroWindow title={`viewing: ${currentImage.text || 'attachment.jpg'}`} onClose={onClose} className="w-full max-w-3xl h-full max-h-[90vh] flex flex-col" noPadding>
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative bg-[var(--bg-window)] overflow-hidden">
          <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full retro-border text-sm font-bold shadow-sm z-10">{currentImage.senderName ? currentImage.senderName : (currentImage.sender === 'me' ? profileName : 'Partner')}</div>
          <img src={currentImage.url} alt="full resolution" className="max-w-full max-h-full object-contain retro-border retro-shadow-dark" />
          {images.length > 1 && (<><button onClick={onPrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark rounded-full hover:scale-110 active:translate-y-1"><ChevronLeft size={24} /></button><button onClick={onNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark rounded-full hover:scale-110 active:translate-y-1"><ChevronRight size={24} /></button></>)}
          <div className="absolute bottom-4 flex gap-4 z-10"><RetroButton variant="primary" className="px-4 py-2 flex items-center gap-2"><Heart size={16} /> React</RetroButton><RetroButton variant="secondary" className="px-4 py-2 flex items-center gap-2"><Download size={16} /> Save</RetroButton></div>
        </div>
      </RetroWindow>
    </div>
  );
}

export function ChatView({ onClose, profile, partnerNickname, sfx, chatHistory, setChatHistory, userId, partnerId }) {
  const [input, setInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('media');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const [voiceBase64, setVoiceBase64] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [activeOptions, setActiveOptions] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingImageId, setViewingImageId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { if (!activeOptions && searchQuery === '' && !viewingImageId) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, activeOptions, searchQuery, viewingImageId, showDetails]);

  const handleStartCall = (type) => { playAudio('click', sfx); setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, senderName: profile?.name, type: 'call_invite', callType: type, status: 'ringing', time: new Date().toLocaleTimeString(), target: partnerId }]); };

  const handleSend = (e) => {
    if (e) e.preventDefault(); if (!input.trim()) return; playAudio('send', sfx);
    if (editingMsgId) { setChatHistory(chatHistory.map(m => m.id === editingMsgId ? { ...m, text: input, isEdited: true } : m)); setEditingMsgId(null); }
    else { setChatHistory([...chatHistory, { id: Date.now(), sender: userId, senderName: profile?.name, type: 'text', text: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), replyTo: replyingTo, status: 'sent' }]); }
    setInput(''); setReplyingTo(null); setActiveOptions(null); setShowEmojiPicker(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mediaRecorder = new MediaRecorder(stream); mediaRecorderRef.current = mediaRecorder; audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); const audioUrl = URL.createObjectURL(audioBlob); const durationSecs = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        const reader = new FileReader(); reader.readAsDataURL(audioBlob); reader.onloadend = () => { setVoiceBase64(reader.result); if (durationSecs >= 1) { setVoicePreview(durationSecs); setVoicePreviewUrl(audioUrl); } };
        stream.getTracks().forEach(track => track.stop());
      }; mediaRecorder.start(); setIsRecording(true); recordingStartTimeRef.current = Date.now(); setRecordingTime(0); recordingTimerRef.current = setInterval(() => { setRecordingTime(prev => prev + 1); }, 1000);
    } catch (err) { alert("Microphone access denied."); }
  };
  const stopRecording = () => { if (!isRecording || !mediaRecorderRef.current) return; setIsRecording(false); clearInterval(recordingTimerRef.current); mediaRecorderRef.current.stop(); };
  const discardVoiceNote = () => { setVoicePreview(null); setVoicePreviewUrl(null); setVoiceBase64(null); };
  const confirmVoiceNote = () => {
    if (!voiceBase64 || !voicePreview) return; playAudio('send', sfx);
    setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, senderName: profile?.name, type: 'voice', duration: `${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`, audioUrl: voiceBase64, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), replyTo: replyingTo, status: 'sent' }]);
    setReplyingTo(null); discardVoiceNote();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        playAudio('send', sfx);
        const compressed = await compressImage(reader.result);
        setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, senderName: profile?.name, type: 'image', url: compressed, text: file.name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), replyTo: replyingTo, status: 'sent' }]);
        setReplyingTo(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const onEmojiClick = (emojiData) => { setInput(prev => prev + emojiData.emoji); };

  const imageMessages = chatHistory.filter(m => m.type === 'image' && !m.isDeleted);
  const pinnedMessages = chatHistory.filter(m => m.isPinned && !m.isDeleted);
  const callHistory = chatHistory.filter(m => m.type === 'call_invite' && (m.status === 'ended' || m.status === 'missed' || m.status === 'accepted' || m.status === 'rejected'));
  const currentImageIndex = imageMessages.findIndex(m => m.id === viewingImageId);
  const headerActions = (<div className="flex gap-2"><button onClick={() => handleStartCall('audio')} className="p-1 hover:bg-black/10 rounded-md transition-colors" title="Voice Call"><Phone size={18} /></button><button onClick={() => handleStartCall('video')} className="p-1 hover:bg-black/10 rounded-md transition-colors" title="Video Call"><Video size={18} /></button></div>);
  const filteredMessages = chatHistory.filter(m => searchQuery === '' || (m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())) || (m.type === 'image' && m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <>
      <ImageViewerOverlay images={imageMessages} currentIndex={currentImageIndex >= 0 ? currentImageIndex : null} onClose={() => setViewingImageId(null)} onNext={() => setViewingImageId(imageMessages[(currentImageIndex + 1) % imageMessages.length].id)} onPrev={() => setViewingImageId(imageMessages[(currentImageIndex - 1 + imageMessages.length) % imageMessages.length].id)} profileName={profile.name || 'You'} />
      <RetroWindow title="chat_room.exe" onClose={onClose} headerActions={headerActions} onTitleClick={() => { playAudio('click', sfx); setShowDetails(!showDetails) }} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col transition-all duration-300" noPadding>
        <div className="flex flex-1 h-full overflow-hidden relative">
          <div className={`flex flex-col h-full transition-all duration-300 ${showDetails ? 'hidden md:flex md:w-2/3 border-r-2 retro-border' : 'w-full'}`}>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col retro-bg-window relative">
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

                return (
                  <div key={msg.id} className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'} ${marginClass}`}>
                    <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%] relative">
                      {!isMe && <div className="w-8 flex-shrink-0">{isGroupEnd && <div className="w-8 h-8 rounded-full retro-bg-secondary retro-border flex items-center justify-center text-sm">☕</div>}</div>}
                      {isMe && !msg.isDeleted && !isCallLog && (<div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 flex items-center justify-center relative"><button onClick={() => { playAudio('click', sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="p-1 hover:bg-black/5 rounded-full"><MoreVertical size={16} className="opacity-50 hover:opacity-100" /></button></div>)}
                      <div className={`p-3 retro-border text-sm leading-relaxed relative ${msg.isDeleted ? 'bg-gray-100 border-gray-300 text-gray-500 italic' : isCallLog ? 'bg-black/5 border-dashed italic' : isMe ? 'retro-bg-primary retro-shadow-dark' : 'retro-bg-window retro-shadow-dark'} ${isMe ? `rounded-l-xl ${isGroupStart ? 'rounded-tr-xl' : 'rounded-tr-sm'} ${isGroupEnd ? 'rounded-br-xl' : 'rounded-br-sm'}` : `rounded-r-xl ${isGroupStart ? 'rounded-tl-xl' : 'rounded-tl-sm'} ${isGroupEnd ? 'rounded-bl-xl' : 'rounded-bl-sm'}`}`}>
                        {msg.replyTo && !msg.isDeleted && (<div className="bg-white/50 border-l-4 border-[var(--border)] p-2 mb-2 text-xs rounded-r-md"><p className="font-bold opacity-70 mb-1">{msg.replyTo.sender === userId ? profile.name || 'You' : (msg.replyTo.senderName || partnerNickname || 'Partner')}</p><p className="truncate opacity-80">{msg.replyTo.text || 'Attachment/Voice'}</p></div>)}
                        {msg.isDeleted ? (<span className="flex items-center gap-2"><Ban size={14} /> this message was deleted</span>) : (
                          <>
                            {msg.type === 'text' && <span>{formatMessage(msg.text)}</span>}
                            {msg.type === 'voice' && <VoiceMessagePlayer duration={msg.duration} audioUrl={msg.audioUrl} />}
                            {msg.type === 'call_invite' && (
                              <div className="flex items-center gap-2 font-bold py-1">
                                {msg.callType === 'video' ? <Video size={16} className="text-pink-500" /> : <Phone size={16} className="text-cyan-500" />}
                                <span className="text-[10px] uppercase tracking-widest">{msg.callType === 'video' ? 'Video' : 'Audio'} Call {msg.status}</span>
                              </div>
                            )}
                            {msg.type === 'image' && (<div className="flex flex-col gap-2"><img src={msg.url} alt="attachment" onClick={() => { playAudio('click', sfx); setViewingImageId(msg.id) }} className="w-32 h-32 sm:w-48 sm:h-48 object-cover retro-border cursor-pointer hover:opacity-90 transition-opacity" />{msg.text && <span className="italic">{msg.text}</span>}</div>)}
                          </>
                        )}
                        {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && !isCallLog && (<div className={`absolute -bottom-3 ${isMe ? '-left-2' : '-right-2'} bg-white retro-border rounded-full px-1 py-0.5 text-xs flex gap-1 retro-shadow-primary z-10`}>{msg.reactions.map((r, i) => <span key={i}>{r}</span>)}</div>)}
                      </div>
                      {!isMe && !msg.isDeleted && !isCallLog && (<div className="opacity-0 group-hover:opacity-100 transition-opacity pl-2 flex items-center justify-center relative"><button onClick={() => { playAudio('click', sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="p-1 hover:bg-black/5 rounded-full"><MoreVertical size={16} className="opacity-50 hover:opacity-100" /></button></div>)}
                      {activeOptions === msg.id && !isCallLog && (<div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} retro-bg-window retro-border retro-shadow-dark z-20 flex flex-col w-32 py-1`}><button onClick={() => { playAudio('click', sfx); setReplyingTo(msg); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Reply size={14} /> Reply</button><button onClick={() => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => m.id === msg.id ? { ...m, isPinned: !m.isPinned } : m)); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Pin size={14} /> {msg.isPinned ? 'Unpin' : 'Pin'}</button><div className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] border-b border-[var(--border)] border-dashed"><Smile size={14} /> <span onClick={() => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => { if (m.id === msg.id) { const rs = m.reactions || []; return { ...m, reactions: rs.includes('❤️') ? rs.filter(e => e !== '❤️') : [...rs, '❤️'] }; } return m; })); setActiveOptions(null); }} className="cursor-pointer hover:scale-125 transition-transform">❤️</span></div>{isMe && msg.type === 'text' && <button onClick={() => { playAudio('click', sfx); setEditingMsgId(msg.id); setInput(msg.text); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Edit2 size={14} /> Edit</button>}{isMe && <button onClick={() => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => m.id === msg.id ? { ...m, isDeleted: true, text: null, url: null } : m)); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-100 text-red-600 text-left"><Trash2 size={14} /> Delete</button>}</div>)}
                    </div>
                    {msg.isPinned && !msg.isDeleted && <div className={`absolute -top-3 ${isMe ? 'right-4' : 'left-4'} bg-[var(--accent)] rounded-full p-1 border-2 border-[var(--border)] z-10`}><Pin size={12} className="text-white" /></div>}
                    {isGroupEnd && (<div className="flex items-center gap-1 mt-1 justify-end px-2"><span className="text-[10px] opacity-70 font-bold">{msg.time}</span>{isMe && msg.status && !isCallLog && (<div className="flex -space-x-1.5 ml-1"><Check size={12} className={msg.status === 'read' ? 'text-blue-500' : 'text-[var(--border)] opacity-50'} strokeWidth={3} />{(msg.status === 'delivered' || msg.status === 'read') && <Check size={12} className={msg.status === 'read' ? 'text-blue-500' : 'text-[var(--border)] opacity-50'} strokeWidth={3} />}</div>)}</div>)}
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
            <div className="flex flex-col retro-bg-accent retro-border-t relative">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 z-[100] shadow-2xl animate-in slide-in-from-bottom-2">
                  <EmojiPicker onEmojiClick={onEmojiClick} theme="light" />
                </div>
              )}
              {voicePreview !== null && (<div className="p-3 bg-blue-50 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-3"><div className="flex items-center gap-3 flex-1"><Mic size={16} className="text-blue-500" /><span className="text-sm font-bold">Voice note: {Math.floor(voicePreview / 60)}:{(voicePreview % 60).toString().padStart(2, '0')}</span></div><div className="flex gap-2"><VoiceMessagePlayer duration={`${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`} audioUrl={voicePreviewUrl} /></div><div className="flex gap-2"><button onClick={() => discardVoiceNote()} className="px-3 py-1 retro-border bg-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-300 rounded">Discard</button><button onClick={confirmVoiceNote} className="px-3 py-1 retro-border bg-green-400 text-white text-xs font-bold hover:bg-green-500 rounded">Send</button></div></div>)}
              {replyingTo && (<div className="p-2 bg-white/50 border-b border-dashed border-[var(--border)] flex justify-between items-center text-sm"><div><span className="font-bold mr-2 text-[var(--primary)]"><Reply size={14} className="inline mr-1" />Replying to {replyingTo.sender === userId ? profile.name || 'You' : 'Partner'}:</span><span className="opacity-70 truncate max-w-[200px] inline-block align-bottom">{replyingTo.text || 'Attachment/Voice'}</span></div><button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-black/10 rounded-full"><X size={14} /></button></div>)}
              <form onSubmit={handleSend} className="flex gap-2 items-center p-2 sm:p-3 relative"><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" /><button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 retro-bg-window retro-border hover:bg-gray-100 disabled:opacity-50 transition-colors"><Paperclip size={18} /></button><button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 retro-bg-window retro-border transition-colors ${showEmojiPicker ? 'bg-[var(--accent)]' : 'hover:bg-gray-100'}`}><Smile size={18} /></button><div className="flex-1 relative flex items-center"><input type="text" value={isRecording ? `Recording... 0:${recordingTime.toString().padStart(2, '0')}` : input} onChange={(e) => setInput(e.target.value)} placeholder="type a message..." disabled={isRecording || voicePreview !== null} className={`w-full p-2 sm:p-3 retro-border retro-bg-window focus:outline-none font-bold placeholder:font-normal text-sm sm:text-base ${isRecording ? 'text-red-500 animate-pulse bg-red-50' : ''}`} /></div>{!input.trim() && !editingMsgId && voicePreview === null ? (<button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`p-2 sm:p-3 retro-border transition-all flex-shrink-0 select-none ${isRecording ? 'bg-red-400 text-white retro-shadow-none translate-y-[2px]' : 'retro-bg-window retro-shadow-dark hover:-translate-y-1'}`}><Mic size={18} className={isRecording ? 'animate-bounce' : ''} /></button>) : (<RetroButton type="submit" variant="primary" className="p-2 sm:p-3 flex-shrink-0"><Send size={18} /></RetroButton>)}</form>
            </div>
          </div>
          {showDetails && (
            <div className="flex flex-col w-full md:w-1/3 retro-bg-main overflow-y-auto relative border-l-2 retro-border">
              <button onClick={() => setShowDetails(false)} className="md:hidden absolute top-4 right-4 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark z-10 rounded-full"><X size={16} /></button>
              <div className="p-2 flex gap-1 bg-[var(--border)] shrink-0"><button onClick={() => setActiveSidebarTab('media')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'media' ? 'bg-white' : 'opacity-50 text-white'}`}>Media</button><button onClick={() => setActiveSidebarTab('calls')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'calls' ? 'bg-white' : 'opacity-50 text-white'}`}>Calls</button><button onClick={() => setActiveSidebarTab('search')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'search' ? 'bg-white' : 'opacity-50 text-white'}`}>Search</button></div>
              <div className="p-4 flex flex-col gap-6">
                {activeSidebarTab === 'search' && (<div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><Search size={16} /> Search Logs</h3><div className="flex bg-[var(--bg-window)] retro-border p-2"><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="filter messages..." className="bg-transparent outline-none w-full text-sm font-bold" />{searchQuery && <button onClick={() => setSearchQuery('')}><X size={14} className="opacity-50" /></button>}</div></div>)}
                {activeSidebarTab === 'media' && (<><div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><Pin size={16} /> Pinned</h3><div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">{pinnedMessages.length === 0 ? (<p className="text-sm opacity-50">No pinned messages.</p>) : (pinnedMessages.map(m => (<div key={m.id} className="bg-[var(--bg-window)] p-2 text-sm retro-border border-l-4 border-l-[var(--accent)]"><p className="font-bold opacity-70 text-xs mb-1">{m.sender === userId ? 'You' : (m.senderName || partnerNickname || 'Partner')}</p><p className="truncate">{m.text || 'Attachment/Voice'}</p></div>)))}</div></div><div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><ImageIcon size={16} /> Media Grid</h3><div className="grid grid-cols-2 gap-2">{imageMessages.length === 0 ? (<p className="text-sm opacity-50 col-span-2">No media shared yet.</p>) : (imageMessages.map(m => (<div key={m.id} onClick={() => setViewingImageId(m.id)} className="aspect-square retro-border retro-shadow-dark bg-cover bg-center cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundImage: `url(${m.url})` }}></div>)))}</div></div></>)}
                {activeSidebarTab === 'calls' && (<div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><History size={16} /> Call History</h3><div className="flex flex-col gap-2 overflow-y-auto pr-1">{callHistory.length === 0 ? (<p className="text-sm opacity-50">No call history.</p>) : (callHistory.reverse().map(m => (<div key={m.id} className="bg-[var(--bg-window)] p-3 text-xs retro-border flex items-center justify-between"><div className="flex items-center gap-2">{m.callType === 'video' ? <Video size={14} className="text-[var(--secondary)]" /> : <Phone size={14} className="text-[var(--primary)]" />}<div><p className="font-bold">{m.sender === userId ? 'Outgoing' : 'Incoming'}</p><p className="opacity-50">{m.time}</p></div></div><span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 retro-border ${m.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span></div>)))}</div></div>)}
              </div>
            </div>
          )}
        </div>
      </RetroWindow>
    </>
  );
}
