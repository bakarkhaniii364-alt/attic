import React, { useState, useEffect, useRef } from 'react';
import { Phone, Video, Search, Image as ImageIcon, ChevronLeft, ChevronRight, Heart, Download, X, Reply, Smile, Edit2, Trash2, Ban, MoreVertical, Paperclip, Mic, Send, Play, Pause, Check, Pin, MicOff, Volume2, VolumeX } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';

const globalAudioRef = { current: null };
function VoiceMessagePlayer({ duration, audioUrl }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(audioUrl ? new Audio(audioUrl) : null);

  useEffect(() => { const audio = audioRef.current; if (audio) audio.onended = () => setIsPlaying(false); const stopHandler = () => { if (globalAudioRef.current !== audioRef.current) setIsPlaying(false); }; window.addEventListener('stopAudio', stopHandler); return () => { if (audio) { audio.pause(); audio.src = ''; } window.removeEventListener('stopAudio', stopHandler); }; }, [audioUrl]);
  const togglePlay = () => { if (!audioRef.current) return; if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } else { if (globalAudioRef.current && globalAudioRef.current !== audioRef.current) { globalAudioRef.current.pause(); window.dispatchEvent(new Event('stopAudio')); } audioRef.current.play().catch(e=>console.log(e)); globalAudioRef.current = audioRef.current; setIsPlaying(true); } };

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
          <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full retro-border text-sm font-bold shadow-sm z-10">{currentImage.sender === 'me' ? profileName : 'Partner'}</div>
          <img src={currentImage.url} alt="full resolution" className="max-w-full max-h-full object-contain retro-border retro-shadow-dark" />
          {images.length > 1 && ( <><button onClick={onPrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark rounded-full hover:scale-110 active:translate-y-1"><ChevronLeft size={24} /></button><button onClick={onNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark rounded-full hover:scale-110 active:translate-y-1"><ChevronRight size={24} /></button></> )}
          <div className="absolute bottom-4 flex gap-4 z-10"><RetroButton variant="primary" className="px-4 py-2 flex items-center gap-2"><Heart size={16}/> React</RetroButton><RetroButton variant="secondary" className="px-4 py-2 flex items-center gap-2"><Download size={16}/> Save</RetroButton></div>
        </div>
      </RetroWindow>
    </div>
  );
}

function DraggableCallWindow({ calling, callDuration, isMuted, isDeafened, onMicToggle, onDeafenToggle, onEndCall, partnerNickname, sfx }) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  if (!calling) return null;

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;

  return (
    <div
      ref={windowRef}
      className="fixed z-50 w-80 retro-bg-window retro-border retro-shadow-dark cursor-move"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="bg-[var(--border)] text-[var(--bg-window)] px-3 py-2 flex justify-between items-center font-bold text-sm">
        <span className="flex items-center gap-2">
          {calling === 'video' ? <Video size={16} /> : <Phone size={16} />}
          {partnerNickname} - {mins}:{secs.toString().padStart(2, '0')}
        </span>
        <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse"></div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full retro-bg-accent retro-border flex items-center justify-center retro-shadow-dark">
          {calling === 'video' ? <Video size={32} /> : <Phone size={32} />}
        </div>
        <div className="text-center">
          <p className="font-bold text-sm">{callDuration === 0 ? 'Ringing...' : 'Connected'}</p>
          <p className="text-xs opacity-70 mt-1">{partnerNickname}</p>
        </div>

        {/* Controls */}
        <div className="flex gap-3 justify-center w-full">
          <button
            onClick={() => { playAudio('click', sfx); onMicToggle(); }}
            className={`p-3 retro-border rounded-full transition-all ${
              isMuted ? 'bg-red-400 text-white' : 'retro-bg-accent hover:scale-110'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            onClick={() => { playAudio('click', sfx); onDeafenToggle(); }}
            className={`p-3 retro-border rounded-full transition-all ${
              isDeafened ? 'bg-red-400 text-white' : 'retro-bg-accent hover:scale-110'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={() => { playAudio('click', sfx); onEndCall(); }}
            className="p-3 bg-red-500 text-white retro-border rounded-full hover:bg-red-600 transition-all"
            title="End Call"
          >
            <Phone size={16} className="rotate-180" />
          </button>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="px-4 pb-3 flex justify-center gap-4 text-xs font-bold opacity-70">
        {isMuted && <span className="px-2 py-1 retro-border bg-red-100">Muted</span>}
        {isDeafened && <span className="px-2 py-1 retro-border bg-red-100">Deafened</span>}
      </div>
    </div>
  );
}

export function ChatView({ onClose, profile, sfx, chatHistory, setChatHistory }) {
  const [input, setInput] = useState(''); const [showDetails, setShowDetails] = useState(false); const [calling, setCalling] = useState(null); 
  const [callDuration, setCallDuration] = useState(0); const callTimerRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false); const [isDeafened, setIsDeafened] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const mediaStreamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false); const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null); const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const mediaRecorderRef = useRef(null); const audioChunksRef = useRef([]); const recordingTimerRef = useRef(null); const recordingStartTimeRef = useRef(0);
  const [replyingTo, setReplyingTo] = useState(null); const [editingMsgId, setEditingMsgId] = useState(null); const [activeOptions, setActiveOptions] = useState(null); const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false); const [partnerTyping, setPartnerTyping] = useState(false);
  const [viewingImageId, setViewingImageId] = useState(null);
  const messagesEndRef = useRef(null); const fileInputRef = useRef(null);

  useEffect(() => { if (!calling && !activeOptions && searchQuery === '' && !viewingImageId) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, calling, showDetails, activeOptions, searchQuery, viewingImageId, partnerTyping]);

  useEffect(() => {
    if (calling) {
      // Request microphone access when call starts
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaStreamRef.current = stream;
          setCallStartTime(Date.now());
          playAudio('send', sfx);
          console.log('Microphone access granted');
        })
        .catch(err => {
          console.error('Microphone access denied:', err);
          alert('Microphone access denied. The call will be visual only.');
        });

      callTimerRef.current = setInterval(() => { setCallDuration(prev => prev + 1); }, 1000);
      return () => { 
        if (callTimerRef.current) clearInterval(callTimerRef.current);
      };
    }
  }, [calling, sfx]);

  useEffect(() => { 
    if (!calling) {
      setCallDuration(0);
      setIsMuted(false);
      setIsDeafened(false);
      // Stop and cleanup media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    }
  }, [calling]);

  useEffect(() => {
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (lastMsg && lastMsg.sender === 'me' && lastMsg.status !== 'read') {
      const deliverTimer = setTimeout(() => { setChatHistory(prev => prev.map(m => m.id === lastMsg.id ? { ...m, status: 'delivered' } : m)); }, 1000);
      const readTimer = setTimeout(() => { setChatHistory(prev => prev.map(m => m.id === lastMsg.id ? { ...m, status: 'read' } : m)); setPartnerTyping(true); }, 2500);
      const replyText = "Haha okay! 💖"; const typingDelay = replyText.length * 100;
      const replyTimer = setTimeout(() => { playAudio('receive', sfx); setPartnerTyping(false); setChatHistory(prev => [...prev, { id: Date.now(), sender: 'partner', type: 'text', text: replyText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'read' }]); }, 2500 + typingDelay);
      return () => { clearTimeout(deliverTimer); clearTimeout(readTimer); clearTimeout(replyTimer); };
    }
  }, [chatHistory, sfx, setChatHistory]);

  const handleInputChange = (e) => { setInput(e.target.value); if (!isTyping) setIsTyping(true); };
  useEffect(() => { const timer = setTimeout(() => setIsTyping(false), 1500); return () => clearTimeout(timer); }, [input]);

  const handleEndCall = () => {
    if (!calling) return;
    playAudio('click', sfx);
    const callDurationSecs = callDuration;
    const mins = Math.floor(callDurationSecs / 60);
    const secs = callDurationSecs % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    setChatHistory(prev => [...prev, {
      id: Date.now(),
      sender: 'me',
      type: 'call',
      callType: calling,
      duration: durationStr,
      durationSecs: callDurationSecs,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'ended'
    }]);
    
    setCalling(null);
  };

  const handleStartCall = (type) => {
    playAudio('click', sfx);
    setCalling(type);
  };

  const handleSend = (e) => {
    e.preventDefault(); if (!input.trim()) return; playAudio('send', sfx);
    if (editingMsgId) { setChatHistory(chatHistory.map(m => m.id === editingMsgId ? { ...m, text: input, isEdited: true } : m)); setEditingMsgId(null); } 
    else { setChatHistory([...chatHistory, { id: Date.now(), sender: 'me', type: 'text', text: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), replyTo: replyingTo, status: 'sent' }]); }
    setInput(''); setReplyingTo(null); setActiveOptions(null);
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mediaRecorder = new MediaRecorder(stream); mediaRecorderRef.current = mediaRecorder; audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); const audioUrl = URL.createObjectURL(audioBlob); const durationSecs = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        if (durationSecs >= 1) { 
          const mins = Math.floor(durationSecs / 60); const secs = durationSecs % 60; const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
          setVoicePreview(durationSecs);
          setVoicePreviewUrl(audioUrl);
        }
        stream.getTracks().forEach(track => track.stop()); 
      }; mediaRecorder.start(); setIsRecording(true); recordingStartTimeRef.current = Date.now(); setRecordingTime(0); recordingTimerRef.current = setInterval(() => { setRecordingTime(prev => prev + 1); }, 1000);
    } catch (err) { alert("Microphone access denied."); }
  };
  const stopRecording = () => { if (!isRecording || !mediaRecorderRef.current) return; setIsRecording(false); clearInterval(recordingTimerRef.current); mediaRecorderRef.current.stop(); };
  
  const discardVoiceNote = () => { setVoicePreview(null); setVoicePreviewUrl(null); };
  
  const confirmVoiceNote = () => {
    if (!voicePreviewUrl || !voicePreview) return;
    playAudio('send', sfx);
    const mins = Math.floor(voicePreview / 60); const secs = voicePreview % 60; const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    setChatHistory(prev => [...prev, { id: Date.now(), sender: 'me', type: 'voice', duration: durationStr, audioUrl: voicePreviewUrl, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), replyTo: replyingTo, status: 'sent' }]);
    setReplyingTo(null);
    discardVoiceNote();
  };

  const handleFileChange = (e) => { const file = e.target.files[0]; if (file) { playAudio('send', sfx); const mockUrl = URL.createObjectURL(file); setChatHistory([...chatHistory, { id: Date.now(), sender: 'me', type: 'image', url: mockUrl, text: file.name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), replyTo: replyingTo, status: 'sent' }]); setReplyingTo(null); } };
  const handleDelete = (id) => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => m.id === id ? { ...m, isDeleted: true, text: null, url: null, duration: null, audioUrl: null } : m)); setActiveOptions(null); };
  const handleReact = (id, emoji) => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => { if (m.id === id) { const reactions = m.reactions || []; return { ...m, reactions: reactions.includes(emoji) ? reactions.filter(e => e !== emoji) : [...reactions, emoji] }; } return m; })); setActiveOptions(null); };
  const handleEdit = (msg) => { playAudio('click', sfx); setEditingMsgId(msg.id); setInput(msg.text); setReplyingTo(null); setActiveOptions(null); };
  const handleReply = (msg) => { playAudio('click', sfx); setReplyingTo(msg); setEditingMsgId(null); setActiveOptions(null); };
  const handlePin = (id) => { playAudio('click', sfx); setChatHistory(chatHistory.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m)); setActiveOptions(null); };

  const imageMessages = chatHistory.filter(m => m.type === 'image' && !m.isDeleted);
  const pinnedMessages = chatHistory.filter(m => m.isPinned && !m.isDeleted);
  const currentImageIndex = imageMessages.findIndex(m => m.id === viewingImageId);
  const headerActions = (<div className="flex gap-2"><button onClick={() => handleStartCall('audio')} disabled={calling !== null} className="p-1 hover:bg-black/10 rounded-md transition-colors disabled:opacity-50" title="Voice Call"><Phone size={18}/></button><button onClick={() => handleStartCall('video')} disabled={calling !== null} className="p-1 hover:bg-black/10 rounded-md transition-colors disabled:opacity-50" title="Video Call"><Video size={18}/></button></div>);
  const filteredMessages = chatHistory.filter(m => searchQuery === '' || (m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())) || (m.type === 'image' && m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <>
      <ImageViewerOverlay images={imageMessages} currentIndex={currentImageIndex >= 0 ? currentImageIndex : null} onClose={() => setViewingImageId(null)} onNext={() => setViewingImageId(imageMessages[(currentImageIndex + 1) % imageMessages.length].id)} onPrev={() => setViewingImageId(imageMessages[(currentImageIndex - 1 + imageMessages.length) % imageMessages.length].id)} profileName={profile.name || 'You'} />
      <DraggableCallWindow calling={calling} callDuration={callDuration} isMuted={isMuted} isDeafened={isDeafened} onMicToggle={() => setIsMuted(!isMuted)} onDeafenToggle={() => setIsDeafened(!isDeafened)} onEndCall={handleEndCall} partnerNickname={profile?.partnerNickname || 'Partner'} sfx={sfx} />
      <RetroWindow title="chat_room.exe" onClose={onClose} headerActions={headerActions} onTitleClick={() => {playAudio('click', sfx); setShowDetails(!showDetails)}} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col transition-all duration-300" noPadding>
        <div className="flex flex-1 h-full overflow-hidden relative">

          <div className={`flex flex-col h-full transition-all duration-300 ${showDetails ? 'hidden md:flex md:w-2/3 border-r-2 retro-border' : 'w-full'}`}>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col retro-bg-window relative">
              <div className="text-center text-xs font-bold opacity-50 mb-6 retro-border-b inline-block mx-auto pb-1 mt-2">-- connection secured --</div>
              {filteredMessages.map((msg, index) => {
                const isMe = msg.sender === 'me'; const prevMsg = filteredMessages[index - 1]; const nextMsg = filteredMessages[index + 1]; const isGroupStart = !prevMsg || prevMsg.sender !== msg.sender; const isGroupEnd = !nextMsg || nextMsg.sender !== msg.sender; const marginClass = isGroupEnd ? "mb-6" : "mb-1";
                return (
                  <div key={msg.id} className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'} ${marginClass}`}>
                    <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%] relative">
                      {!isMe && <div className="w-8 flex-shrink-0">{isGroupEnd && <div className="w-8 h-8 rounded-full retro-bg-secondary retro-border flex items-center justify-center text-sm">☕</div>}</div>}
                      {isMe && !msg.isDeleted && (<div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 flex items-center justify-center relative"><button onClick={() => {playAudio('click',sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id)}} className="p-1 hover:bg-black/5 rounded-full"><MoreVertical size={16} className="opacity-50 hover:opacity-100"/></button></div>)}
                      <div className={`p-3 retro-border text-sm leading-relaxed relative ${msg.isDeleted ? 'bg-gray-100 border-gray-300 text-gray-500 italic' : isMe ? 'retro-bg-primary retro-shadow-dark' : 'retro-bg-window retro-shadow-dark'} ${isMe ? `rounded-l-xl ${isGroupStart ? 'rounded-tr-xl' : 'rounded-tr-sm'} ${isGroupEnd ? 'rounded-br-xl' : 'rounded-br-sm'}` : `rounded-r-xl ${isGroupStart ? 'rounded-tl-xl' : 'rounded-tl-sm'} ${isGroupEnd ? 'rounded-bl-xl' : 'rounded-bl-sm'}`}`}>
                        {msg.replyTo && !msg.isDeleted && (<div className="bg-white/50 border-l-4 border-[var(--border)] p-2 mb-2 text-xs rounded-r-md"><p className="font-bold opacity-70 mb-1">{msg.replyTo.sender === 'me' ? profile.name || 'You' : 'Partner'}</p><p className="truncate opacity-80">{msg.replyTo.text || 'Attachment/Voice'}</p></div>)}
                        {msg.isDeleted ? (<span className="flex items-center gap-2"><Ban size={14}/> this message was deleted</span>) : ( <>{msg.type === 'text' && <span>{formatMessage(msg.text)}</span>} {msg.type === 'voice' && <VoiceMessagePlayer duration={msg.duration} audioUrl={msg.audioUrl} />} {msg.type === 'call' && (<div className="flex items-center gap-2"><Phone size={16} className={msg.callType === 'video' ? 'hidden' : ''} /><Video size={16} className={msg.callType === 'video' ? '' : 'hidden'} /> <span className="font-bold text-sm">{msg.callType === 'video' ? 'Video' : 'Voice'} Call - {msg.duration}</span></div>)} {msg.type === 'image' && (<div className="flex flex-col gap-2"><img src={msg.url} alt="attachment" onClick={() => {playAudio('click',sfx); setViewingImageId(msg.id)}} className="w-32 h-32 sm:w-48 sm:h-48 object-cover retro-border cursor-pointer hover:opacity-90 transition-opacity" />{msg.text && <span className="italic">{msg.text}</span>}</div>)}</> )}
                        {msg.isEdited && !msg.isDeleted && <span className="text-[10px] opacity-50 ml-2 italic">(edited)</span>}
                        {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && (<div className={`absolute -bottom-3 ${isMe ? '-left-2' : '-right-2'} bg-white retro-border rounded-full px-1 py-0.5 text-xs flex gap-1 retro-shadow-primary z-10`}>{msg.reactions.map((r, i) => <span key={i}>{r}</span>)}</div>)}
                      </div>
                      {!isMe && !msg.isDeleted && (<div className="opacity-0 group-hover:opacity-100 transition-opacity pl-2 flex items-center justify-center relative"><button onClick={() => {playAudio('click',sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id)}} className="p-1 hover:bg-black/5 rounded-full"><MoreVertical size={16} className="opacity-50 hover:opacity-100"/></button></div>)}
                      {activeOptions === msg.id && (
                        <div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} retro-bg-window retro-border retro-shadow-dark z-20 flex flex-col w-32 py-1`}>
                          <button onClick={() => handleReply(msg)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Reply size={14}/> Reply</button>
                          <button onClick={() => handlePin(msg.id)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Pin size={14}/> {msg.isPinned ? 'Unpin' : 'Pin'}</button>
                          <div className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] border-b border-[var(--border)] border-dashed"><Smile size={14}/> <span onClick={() => handleReact(msg.id, '❤️')} className="cursor-pointer hover:scale-125 transition-transform">❤️</span><span onClick={() => handleReact(msg.id, '😂')} className="cursor-pointer hover:scale-125 transition-transform">😂</span></div>
                          {isMe && msg.type === 'text' && <button onClick={() => handleEdit(msg)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--accent)] text-left"><Edit2 size={14}/> Edit</button>}
                          {isMe && <button onClick={() => handleDelete(msg.id)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-100 text-red-600 text-left"><Trash2 size={14}/> Delete</button>}
                        </div>
                      )}
                    </div>
                    {msg.isPinned && !msg.isDeleted && <div className={`absolute -top-3 ${isMe ? 'right-4' : 'left-4'} bg-[var(--accent)] rounded-full p-1 border-2 border-[var(--border)] z-10`} title="Pinned Message"><Pin size={12} className="text-white"/></div>}
                    {isGroupEnd && ( <div className="flex items-center gap-1 mt-1 justify-end px-2"><span className="text-[10px] opacity-70 font-bold">{msg.time}</span>{isMe && msg.status && ( <div className="flex -space-x-1.5 ml-1"><Check size={12} className={msg.status==='read' ? 'text-blue-500' : 'text-[var(--border)] opacity-50'} strokeWidth={3} />{(msg.status === 'delivered' || msg.status === 'read') && <Check size={12} className={msg.status==='read' ? 'text-blue-500' : 'text-[var(--border)] opacity-50'} strokeWidth={3} />}</div> )}</div> )}
                  </div>
                );
              })}
              {partnerTyping && (
                 <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%] relative mb-2"><div className="w-8 flex-shrink-0"><div className="w-8 h-8 rounded-full retro-bg-secondary retro-border flex items-center justify-center text-sm">☕</div></div><div className="p-3 px-4 retro-border text-sm retro-bg-window retro-shadow-dark rounded-r-xl rounded-tl-xl rounded-bl-sm flex gap-1"><span className="w-2 h-2 bg-[var(--text-main)] rounded-full typing-dot"></span><span className="w-2 h-2 bg-[var(--text-main)] rounded-full typing-dot"></span><span className="w-2 h-2 bg-[var(--text-main)] rounded-full typing-dot"></span></div></div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
            <div className="flex flex-col retro-bg-accent retro-border-t">
              {voicePreview !== null && (
                <div className="p-3 bg-blue-50 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Mic size={16} className="text-blue-500"/>
                    <span className="text-sm font-bold">Voice note: {Math.floor(voicePreview / 60)}:{(voicePreview % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex gap-2">
                    <VoiceMessagePlayer duration={`${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`} audioUrl={voicePreviewUrl} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { playAudio('click', sfx); setIsRecording(false); startRecording(); }} className="px-3 py-1 retro-border bg-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-300 rounded">Re-record</button>
                    <button onClick={discardVoiceNote} className="px-3 py-1 retro-border bg-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-300 rounded">Discard</button>
                    <button onClick={confirmVoiceNote} className="px-3 py-1 retro-border bg-green-400 text-white text-xs font-bold hover:bg-green-500 rounded">Send</button>
                  </div>
                </div>
              )}
              {replyingTo && (<div className="p-2 bg-white/50 border-b border-dashed border-[var(--border)] flex justify-between items-center text-sm"><div><span className="font-bold mr-2 text-[var(--primary)]"><Reply size={14} className="inline mr-1"/>Replying to {replyingTo.sender === 'me' ? profile.name || 'You' : 'Partner'}:</span><span className="opacity-70 truncate max-w-[200px] inline-block align-bottom">{replyingTo.text || 'Attachment/Voice'}</span></div><button onClick={() => {playAudio('click', sfx); setReplyingTo(null)}} className="p-1 hover:bg-black/10 rounded-full"><X size={14}/></button></div>)}
              {editingMsgId && (<div className="p-2 bg-[#a3c4f3]/30 border-b border-dashed border-[var(--border)] flex justify-between items-center text-sm"><span className="font-bold"><Edit2 size={14} className="inline mr-1"/> Editing Message</span><button onClick={() => { playAudio('click', sfx); setEditingMsgId(null); setInput(''); }} className="p-1 hover:bg-black/10 rounded-full"><X size={14}/></button></div>)}
              <form onSubmit={handleSend} className="flex gap-2 items-center p-2 sm:p-3 relative">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*, audio/*, video/*" />
                <button type="button" onClick={() => {playAudio('click', sfx); fileInputRef.current?.click()}} disabled={isRecording || voicePreview !== null} className="p-2 retro-bg-window retro-border hover:bg-gray-100 disabled:opacity-50 transition-colors" title="Attach Media"><Paperclip size={18} /></button>
                <div className="flex-1 relative flex items-center">
                  <input type="text" value={isRecording ? `Recording... 0:${recordingTime.toString().padStart(2, '0')}` : input} onChange={handleInputChange} placeholder="type a message... (*bold* _italic_)" disabled={isRecording || voicePreview !== null} className={`w-full p-2 sm:p-3 retro-border retro-bg-window focus:outline-none font-bold placeholder:font-normal text-sm sm:text-base ${isRecording ? 'text-red-500 animate-pulse bg-red-50' : ''}`} />
                </div>
                {!input.trim() && !editingMsgId && voicePreview === null ? (
                  <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`p-2 sm:p-3 retro-border transition-all flex-shrink-0 select-none ${isRecording ? 'bg-red-400 text-white retro-shadow-none translate-y-[2px]' : 'retro-bg-window retro-shadow-dark hover:-translate-y-1'}`} title="Hold to Record Voice Memo"><Mic size={18} className={isRecording ? 'animate-bounce' : ''}/></button>
                ) : ( <RetroButton type="submit" variant="primary" disabled={voicePreview !== null} className="p-2 sm:p-3 flex-shrink-0 disabled:opacity-50"><Send size={18} /></RetroButton> )}
              </form>
            </div>
          </div>
          {showDetails && (
            <div className="flex flex-col w-full md:w-1/3 retro-bg-main overflow-y-auto relative border-l-2 retro-border">
              <button onClick={() => {playAudio('click', sfx); setShowDetails(false)}} className="md:hidden absolute top-4 right-4 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark z-10 rounded-full"><X size={16} /></button>
              <div className="p-4 flex flex-col gap-6 mt-12 md:mt-0">
                <div><h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><Search size={16}/> Search Logs</h3><div className="flex bg-[var(--bg-window)] retro-border p-2"><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="filter messages..." className="bg-transparent outline-none w-full text-sm font-bold" />{searchQuery && <button onClick={() => setSearchQuery('')}><X size={14} className="opacity-50"/></button>}</div></div>
                <div>
                  <h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><Pin size={16}/> Pinned Messages</h3>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                    {pinnedMessages.length === 0 ? (<p className="text-sm opacity-50">No pinned messages.</p>) : (pinnedMessages.map(m => (<div key={`pin-${m.id}`} className="bg-[var(--bg-window)] p-2 text-sm retro-border border-l-4 border-l-[var(--accent)]"><p className="font-bold opacity-70 text-xs mb-1">{m.sender === 'me' ? 'You' : 'Partner'}</p><p className="truncate">{m.text || 'Attachment/Voice'}</p></div>)))}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><ImageIcon size={16}/> Shared Media</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {imageMessages.length === 0 ? (<p className="text-sm opacity-50 col-span-2">No media shared yet.</p>) : (imageMessages.map(m => (<div key={m.id} onClick={() => {playAudio('click', sfx); setViewingImageId(m.id)}} className="aspect-square retro-border retro-shadow-dark bg-cover bg-center cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundImage: `url(${m.url})`}}></div>)))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </RetroWindow>
    </>
  );
}
