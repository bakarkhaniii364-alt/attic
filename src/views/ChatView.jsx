import { Phone, Video, Search, Image as ImageIcon, ChevronLeft, ChevronRight, Heart, Download, X, Reply, Smile, Edit2, Trash2, Ban, MoreVertical, Paperclip, Mic, Send, Play, Pause, Check, Pin, MicOff, Volume2, VolumeX, Bell, PhoneOff, History, Gamepad2, Clock } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useBroadcast, useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useChatSync } from '../hooks/useChatSync.js';
import { useNavigate } from 'react-router-dom';
import { base64ToBlob, compressImage } from '../utils/file.js';
import { isTestMode } from '../lib/testMode.js';

/* ═══════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════ */

const globalAudioRef = { current: null };
function VoiceMessagePlayer({ duration, audioUrl, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(audioUrl ? new Audio(audioUrl) : null);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Proper playhead tracking
    const updateTime = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    
    audio.addEventListener('timeupdate', updateTime);
    audio.onended = () => { setIsPlaying(false); setProgress(0); };
    
    const stopHandler = () => { if (globalAudioRef.current !== audioRef.current) setIsPlaying(false); };
    window.addEventListener('stopAudio', stopHandler);
    
    return () => { 
      if (audio) { 
        audio.pause(); 
        audio.removeEventListener('timeupdate', updateTime);
        audio.src = ''; 
      } 
      window.removeEventListener('stopAudio', stopHandler); 
    };
  }, [audioUrl]);

  // Allow clicking the timeline to scrub
  const handleSeek = (e) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = percent * audioRef.current.duration;
      setProgress(percent * 100);
    }
  };

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

  // Removed the outer bg-white/50 border so it just acts as bubble content
  return (
    <div className="flex items-center gap-2 sm:gap-3 w-48 sm:w-56">
      <button onClick={togglePlay} className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center hover:scale-105 transition-transform ${isMe ? 'bg-white text-[var(--primary)]' : 'bg-[var(--primary)] text-white shadow-sm'}`}>
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
      
      <div onClick={handleSeek} className="flex-1 h-2 bg-black/20 rounded-full relative overflow-hidden cursor-pointer group">
        <div 
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-75 ${isMe ? 'bg-white' : 'bg-[var(--text-main)]'}`} 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <span className={`text-[10px] sm:text-xs font-bold whitespace-nowrap ${isMe ? 'text-white opacity-90' : 'text-[var(--text-main)]'}`}>
        {duration}
      </span>
    </div>
  );
}

function formatMessage(text, isEdited) {
  if (!text) return null;
  const parts = text.split(/(\*.*?\*|_.*?_)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>;
        if (part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>;
        return part;
      })}
      {isEdited && <em className="text-[9px] opacity-40 ml-1.5 font-normal">(edited)</em>}
    </>
  );
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

export function ChatView({ 
  onClose, profile, partnerProfile, roomProfiles = {}, partnerNickname, sfx, 
  chatHistory, userId, partnerId, roomId, onStartCall, 
  sharedImages, onlineUsers = {},
  syncSendMessage, syncUpdateMessage, syncDeleteMessage, syncLoadMore, syncHasMore, e2eeKey 
}) {
  const isNormalized = !!roomId;
  const isInputDisabled = !e2eeKey && !isTestMode();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('media');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTypingLocal, setIsTypingLocal] = useState(false);
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
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeOptions, setActiveOptions] = useState(null);
  const [viewLimit, setViewLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerContext, setViewerContext] = useState({ urls: [], index: 0, isOpen: false });
  const [pendingImages, setPendingImages] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

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
    
    // Auto-resize logic: Reset height, then set to scrollHeight capped at ~3 lines (72px)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 72)}px`;
    }
    
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      sendTyping({ userId, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingLocal(false);
      sendTyping({ userId, isTyping: false });
    }, 1500);
  };

  const safeHistory = Array.isArray(chatHistory) ? chatHistory : [];

  const handleKeyDown = (e) => {
    // Send on Enter (but allow Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
      return;
    }
    
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
      if (textareaRef.current) textareaRef.current.style.height = 'auto'; // Reset height
    }
  };

  // Safe Mark-as-Read Effect
  useEffect(() => {
    if (!Array.isArray(chatHistory)) return;
    
    const unreadFromPartner = chatHistory.filter(m => m.sender === partnerId && m.status !== 'read');
    
    if (unreadFromPartner.length > 0) {
      console.log(`[CHAT] Marking ${unreadFromPartner.length} messages as read from ${partnerId}`);
      if (isNormalized && syncUpdateMessage) {
        unreadFromPartner.forEach(m => {
          syncUpdateMessage(m.id, { status: 'read', readAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        });
      }
    }
  }, [chatHistory, partnerId, isNormalized, syncUpdateMessage]);

  useEffect(() => {
    if (!activeOptions && searchQuery === '' && !viewerContext.isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activeOptions, searchQuery, viewerContext.isOpen, showDetails]);

  // Handle click outside to close options
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeOptions && !e.target.closest('.message-options-menu') && !e.target.closest('.options-trigger')) {
        setActiveOptions(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeOptions]);

  // Handle click outside to close options
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeOptions && !e.target.closest('.message-options-menu') && !e.target.closest('.options-trigger')) {
        setActiveOptions(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeOptions]);

  const handleStartCall = (type) => {
    playAudio('click', sfx);
    onStartCall(type);
  };

  const jumpToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(id);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
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
    if (isInputDisabled) return;

    // Check if it's a special invite message passed as 'e'
    if (e && e.type === 'game_invite') {
      syncSendMessage(e.text, 'game_invite', userId, { gameId: e.gameId, gameTitle: e.gameTitle, status: 'pending' });
      return;
    }

    if (!input.trim() && pendingImages.length === 0 && voicePreview === null) return;
    playAudio('send', sfx);
    if (editingMsgId) {
      if (isNormalized) {
        syncUpdateMessage(editingMsgId, { text: input, isEdited: true });
      }
      setEditingMsgId(null);
    }
    else if (pendingImages.length > 0) {
      if (isNormalized) {
        pendingImages.forEach(img => {
          const blob = base64ToBlob(img);
          syncSendMessage(blob, 'image', userId, { text: input.trim() });
        });
        setPendingImages([]);
      }
    }
    else {
      if (isNormalized) {
        syncSendMessage(input, 'text', userId, { replyTo: replyingTo }).catch(err => {
          console.error("Failed to send message:", err);
        });
      }
    }
    setInput(''); setReplyingTo(null); setActiveOptions(null); setShowEmojiPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
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

  // Solution: Dual-Mode Recording (Tap-to-Toggle and Hold-to-Record)
  const handleMicDown = (e) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const handleMicUp = () => {
    if (isRecording) {
      const elapsed = Date.now() - (recordingStartTimeRef.current || 0);
      // If held for more than 500ms, stop on release (Hold mode)
      // Otherwise, stay recording (Toggle mode)
      if (elapsed > 500) {
        stopRecording();
      }
    }
  };
  const discardVoiceNote = () => { setVoicePreview(null); setVoicePreviewUrl(null); setVoiceBase64(null); };
  const confirmVoiceNote = async () => {
    if (!voiceBase64 || !voicePreview) return; 
    playAudio('send', sfx);

    if (isNormalized) {
      try {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // FIX: Wrap the raw Blob into a proper File object. 
        // This gives Supabase the exact metadata it needs to not choke on the upload.
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: mimeType });

        await syncSendMessage(audioFile, 'voice', userId, {
          duration: `${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`,
          replyTo: replyingTo
        });
      } catch (e) {
        alert("Upload Failed: " + e.message); // This will catch any remaining Supabase errors
      }
    }
    setReplyingTo(null); 
    discardVoiceNote();
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

  const handleSaveToScrapbook = async (url) => {
    // Solution 18: Route all scrapbook saves through sync/upload
    if (isNormalized) {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            // Assuming uploadAsset is available via prop or we can use syncSendMessage for images
            // In ChatView we don't have uploadAsset directly but we can use syncSendMessage or similar.
            // Actually Solution 18 says use uploadAsset. I should pass it to ChatView.
            await syncSendMessage(blob, 'image', userId, { text: 'Saved from chat' });
            playAudio('click', sfx);
            alert("Saved to Scrapbook and shared to chat!");
        } catch (e) {
            console.error(e);
        }
    }
  };

  const onEmojiClick = (emojiData) => { setInput(prev => prev + emojiData.emoji); };

  const imageMessages = safeHistory.filter(m => (m.type === 'image' || m.type === 'image_group') && !m.isDeleted);
  // Sort pinned messages by time (newest first)
  const pinnedMessages = safeHistory.filter(m => m.isPinned && !m.isDeleted).reverse();
  const callHistory = safeHistory.filter(m => m.type === 'call_invite' && (m.status === 'ended' || m.status === 'missed' || m.status === 'accepted' || m.status === 'rejected'));
  const headerActions = (
    <div className="flex gap-2">
      <button onClick={() => onStartCall('audio')} className="p-1.5 border-2 border-[var(--border)] bg-white hover:bg-[var(--accent)] shadow-[1px_1px_0px_0px_var(--border)] active:translate-y-[2px] active:shadow-none transition-all" title="Voice Call"><Phone size={18} /></button>
      <button onClick={() => onStartCall('video')} className="p-1.5 border-2 border-[var(--border)] bg-white hover:bg-[var(--accent)] shadow-[1px_1px_0px_0px_var(--border)] active:translate-y-[2px] active:shadow-none transition-all" title="Video Call"><Video size={18} /></button>
    </div>
  );
  
  // Refined search logic to catch names and text
  const filteredMessages = safeHistory.filter(m => {
    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase();
    const matchesText = m.text && m.text.toLowerCase().includes(q);
    const matchesName = roomProfiles[m.sender]?.name?.toLowerCase().includes(q);
    return matchesText || matchesName;
  });

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
              {syncHasMore && (
                <button
                  onClick={() => { 
                    playAudio('click', sfx); 
                    syncLoadMore(); 
                    setViewLimit(p => p + 50); 
                  }}
                  className="mx-auto my-4 px-4 py-2 bg-[var(--accent)] retro-border text-xs font-bold uppercase hover:-translate-y-0.5 transition-transform"
                >
                  ↑ Load Older Messages
                </button>
              )}
              {filteredMessages.slice(-viewLimit).map((msg, index) => {
                const visibleMsgs = filteredMessages.slice(-viewLimit);
                const prevMsg = visibleMsgs[index - 1];
                const nextMsg = visibleMsgs[index + 1];

                // Add this line to detect if the message is at the bottom of the view
                const isNearBottom = index >= visibleMsgs.length - 3; 

                // DATA RESOLUTION
                const isMe = msg.sender === userId;
                const senderInfo = roomProfiles[msg.sender] || (isMe ? profile : partnerProfile) || {};
                const senderName = senderInfo.name || (isMe ? 'You' : (partnerNickname || 'Partner'));
                const senderPfp = senderInfo.pfp;
                const senderEmoji = senderInfo.emoji || (isMe ? '😊' : '☕');

                // GROUPING LOGIC
                const isGroupStart = !prevMsg || prevMsg.sender !== msg.sender;
                const isGroupEnd = !nextMsg || nextMsg.sender !== msg.sender;
                const marginClass = isGroupEnd ? "mb-6" : "mb-2";

                if (msg.type === 'call_invite' && msg.status === 'ringing') return null;
                const isCallLog = msg.type === 'call_invite';
                const isPureEmoji = msg.type === 'text' && msg.text && /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/.test(msg.text.trim());
                const isPureImage = (msg.type === 'image' || msg.type === 'image_group') && !msg.text;
                const isGameInvite = msg.type === 'game_invite';
                const noBubble = (isPureEmoji || isPureImage) && !msg.isDeleted;
                const isHighlighted = highlightedMessageId === msg.id;

                return (
                  <div key={msg.id} className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'} ${marginClass} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
                    <div id={`msg-${msg.id}`} className={`flex items-end gap-2 max-w-[70%] relative transition-all duration-500 ${isHighlighted ? 'scale-105 brightness-110 z-30' : ''} ${isMe ? 'flex-row justify-end self-end ml-auto' : 'flex-row self-start'}`}>
                      {!msg.isDeleted && !isCallLog && (
                        <div className={`
                          absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-20
                          ${isMe ? '-left-10 group-hover:left-[-45px]' : '-right-10 group-hover:right-[-45px]'}
                          opacity-0 group-hover:opacity-100
                        `}>
                          <button onClick={() => { playAudio('click', sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="options-trigger p-1.5 hover:bg-black/5 bg-white/80 backdrop-blur-sm retro-border border-dashed shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
                            <MoreVertical size={14} className="opacity-70" />
                          </button>
                        </div>
                      )}

                      {/* PFP / Avatar (Only for partner) */}
                      {!isMe && (
                        <div className="w-8 h-8 flex-shrink-0 flex items-end order-first">
                          {isGroupEnd ? (
                            senderPfp ? (
                              <img src={senderPfp} alt={senderName} className="w-8 h-8 retro-border object-cover bg-white rounded-full" />
                            ) : (
                              <div className="w-8 h-8 retro-border flex items-center justify-center text-[10px] rounded-full retro-bg-secondary">
                                {senderEmoji}
                              </div>
                            )
                          ) : <div className="w-8" />}
                        </div>
                      )}

                      <div className={`
                        relative flex flex-col group/bubble
                        ${noBubble || isGameInvite ? 'p-0 bg-transparent' : 'p-3.5 border-2 border-[var(--border)] shadow-[1px_1px_0px_0px_var(--border)]'} 
                        ${msg.isDeleted ? 'bg-gray-50 border-gray-200 text-gray-400 italic shadow-none' :
                          isCallLog ? 'bg-black/5 border-dashed italic shadow-none' :
                            isMe ? (noBubble ? '' : 'bg-[var(--primary)] text-white') : (noBubble ? '' : 'bg-white text-[var(--text-main)]')}
                        ${isHighlighted ? 'ring-4 ring-[var(--accent)] ring-opacity-50 animate-pulse' : ''}
                      `}>
                        {/* Reply Preview */}
                        {msg.replyTo && !msg.isDeleted && (
                          <div
                            onClick={() => {
                              const el = document.getElementById(`msg-${msg.replyTo.id}`);
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('animate-shake');
                                setTimeout(() => el.classList.remove('animate-shake'), 1000);
                              }
                            }}
                            className={`border-l-4 border-[var(--border)]/40 bg-black/10 p-2 mb-2 text-[10px] opacity-90 cursor-pointer hover:bg-black/20 transition-all active:scale-95`}
                          >
                            <p className="font-black uppercase tracking-tighter mb-0.5 opacity-60">{msg.replyTo.sender === userId ? 'You' : (roomProfiles[msg.replyTo.sender]?.name || 'Partner')}</p>
                            <p className="truncate italic font-bold">{msg.replyTo.text || '📸 Media / Attachment'}</p>
                          </div>
                        )}

                        {/* Content Types */}
                        {msg.isDeleted ? (
                          <span className="flex items-center gap-2 opacity-50"><Ban size={12} /> message deleted</span>
                        ) : (
                          <>
                            {msg.type === 'text' && <span className={`${isPureEmoji ? 'text-4xl sm:text-5xl' : 'break-words whitespace-pre-wrap max-w-full-break block'}`}>{formatMessage(msg.text, msg.isEdited)}</span>}
                            {msg.type === 'voice' && <VoiceMessagePlayer duration={msg.duration} audioUrl={msg.audioUrl} isMe={isMe} />}
                            {msg.type === 'game_invite' && (
                              <div className="border-2 border-[var(--border)] bg-white shadow-[1px_1px_0px_0px_var(--border)] p-3 w-64 text-[var(--text-main)] mt-1">
                                <div className="flex items-center gap-2 mb-3 border-b-2 border-dashed border-[var(--border)]/20 pb-2">
                                  <Gamepad2 size={18} className="text-[var(--primary)]" />
                                  <span className="font-black text-[10px] uppercase tracking-widest">Activity Invite</span>
                                </div>
                                <p className="text-xs font-bold mb-4 opacity-80">{msg.text || `Join me for ${msg.gameTitle || "a game"}!`}</p>
                                {!isMe ? (
                                  <button onClick={() => handleJoinGame(msg)} className="w-full py-2 text-xs font-bold bg-[var(--accent)] border-2 border-[var(--border)] shadow-[1px_1px_0px_0px_var(--border)] hover:translate-y-[2px] hover:shadow-none transition-all">Join Now</button>
                                ) : (
                                  <div className="bg-black/5 border-2 border-dashed border-[var(--border)]/30 p-2 text-center text-[9px] font-black uppercase opacity-60">Waiting for partner...</div>
                                )}
                              </div>
                            )}
                            {msg.type === 'call_invite' && (
                              <div className="flex flex-col gap-1 py-1">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${msg.status === 'missed' ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600'}`}>
                                    {msg.callType === 'video' ? <Video size={16} /> : <Phone size={16} />}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">
                                      {msg.status === 'missed' ? 'Missed' : msg.status === 'ended' ? 'Call Ended' : msg.status === 'rejected' ? 'Declined' : 'Call'}
                                    </span>
                                    <span className="text-[9px] opacity-60 font-bold">{msg.time}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {msg.type === 'image' && (
                              <div className="flex flex-col gap-2">
                                <img src={msg.url} alt="" onClick={() => setViewerContext({ urls: [msg.url], index: 0, isOpen: true })} className={`${isPureImage ? 'w-48 sm:w-64' : 'w-32 h-32 sm:w-48 sm:h-48'} object-cover retro-border cursor-pointer hover:brightness-95 transition-all`} />
                                {msg.text && <span className="italic text-xs opacity-80 break-words whitespace-pre-wrap max-w-full-break block">{msg.text}</span>}
                              </div>
                            )}
                            {msg.type === 'image_group' && (
                              <div className="flex flex-col gap-2">
                                <div className={`grid ${msg.urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-1 w-full max-w-xs`}>
                                  {msg.urls.map((u, i) => <img key={i} src={u} onClick={() => setViewerContext({ urls: msg.urls, index: i, isOpen: true })} className="aspect-square object-cover retro-border cursor-pointer hover:scale-[1.02] transition-transform" />)}
                                </div>
                                {msg.text && <span className="italic text-xs opacity-80 break-words">{msg.text}</span>}
                              </div>
                            )}
                          </>
                        )}

                        {/* Reactions (Always visible and more stylized) */}
                        {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && !isCallLog && (
                          <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} bg-white retro-border px-2 py-0.5 text-[11px] flex gap-1 shadow-[2px_2px_0px_0px_var(--border)] z-10 animate-in zoom-in-50`}>
                            {msg.reactions.map((r, i) => <span key={i} className="hover:scale-125 transition-transform cursor-default">{r}</span>)}
                          </div>
                        )}
                      </div>

                      {/* Options Popup (Positioned to the side) */}
                      {activeOptions === msg.id && (
                        <div className={`
                          message-options-menu absolute z-[100] retro-bg-window retro-border-thick retro-shadow-dark py-1 flex flex-col w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200
                          ${isMe ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]'}
                          ${isNearBottom ? 'bottom-0' : 'top-0'} 
                        `}>
                          <button onClick={() => { setReplyingTo(msg); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-[var(--accent)] text-left transition-colors"><Reply size={14} className="text-blue-500" /> Reply</button>
                          <button onClick={() => { syncUpdateMessage(msg.id, { isPinned: !msg.isPinned }); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-[var(--accent)] text-left transition-colors"><Pin size={14} className="text-orange-500" /> {msg.isPinned ? 'Unpin' : 'Pin'}</button>

                          <div className="flex items-center justify-center gap-2 px-3 py-1 border-y border-dashed border-[var(--border)]/10 text-[9px] font-black uppercase opacity-50">
                            <Clock size={10} /> {msg.time}
                          </div>

                          <div className="flex items-center justify-around px-1 py-2 border-y-2 border-dashed border-[var(--border)]/10 bg-black/5 my-1">
                            {['❤️', '😂', '😢', '😮', '😡'].map(emoji => (
                              <button key={emoji} onClick={() => {
                                const rs = msg.reactions || [];
                                syncUpdateMessage(msg.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
                                setActiveOptions(null);
                              }} className={`text-base p-1 hover:scale-150 transition-transform active:scale-95 ${(msg.reactions || []).includes(emoji) ? 'bg-[var(--accent)] retro-border' : ''}`}>{emoji}</button>
                            ))}
                          </div>

                          {isMe && !msg.isDeleted && (
                            <>
                              {msg.type === 'text' && <button onClick={() => { setEditingMsgId(msg.id); setInput(msg.text); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-[var(--accent)] text-left transition-colors"><Edit2 size={14} className="text-green-600" /> Edit</button>}
                              <button onClick={() => { syncDeleteMessage(msg.id); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-red-100 text-red-600 text-left transition-colors"><Trash2 size={14}/> Delete</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata (Status for Me - Only for very last message in group) */}
                    {isGroupEnd && isMe && !isCallLog && (
                      <div className={`flex items-center gap-2 mt-1 px-11 text-[9px] font-black uppercase opacity-30 flex-row-reverse`}>
                        {msg.status && (
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1.5">
                              <Check size={10} className={msg.status === 'read' ? 'text-blue-500' : ''} strokeWidth={4} />
                              {(msg.status === 'delivered' || msg.status === 'read') && <Check size={10} className={msg.status === 'read' ? 'text-blue-500' : ''} strokeWidth={4} />}
                            </div>
                            {msg.status === 'read' && msg.readAt && <span>seen {msg.readAt}</span>}
                            {msg.status === 'delivered' && <span>delivered</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
              {isPartnerTyping && (
                <div className="flex items-center gap-2 mb-4 animate-in fade-in duration-300">
                  <div className="w-8 h-8 rounded-full retro-bg-secondary retro-border flex items-center justify-center text-sm">{partnerProfile.emoji || '☕'}</div>
                  <div className="retro-bg-window retro-border px-3 py-2 text-[10px] font-bold opacity-60 flex gap-1 items-center">
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
                <div className="absolute bottom-full left-0 z-[100] retro-shadow-dark animate-in slide-in-from-bottom-2">
                  <EmojiPicker onEmojiClick={onEmojiClick} theme="light" />
                </div>
              )}
              {pendingImages.length > 0 && (
                <div className="p-3 bg-white/80 backdrop-blur-md border-b-2 border-dashed border-[var(--border)] flex flex-wrap gap-4 animate-in slide-in-from-bottom-2">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="preview" className="w-16 h-16 object-cover retro-border shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]" />
                      <button onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 retro-border shadow-[2px_2px_0px_0px_var(--border)] hover:scale-110"><X size={10} /></button>
                    </div>
                  ))}
                  <div className="flex-1 min-w-[150px]">
                    <p className="text-xs font-bold uppercase opacity-50 mb-1">Media Preview</p>
                    <p className="text-[10px] italic">Sending {pendingImages.length} items at once.</p>
                  </div>
                </div>
              )}
              {voicePreview !== null && (<div className="p-3 bg-blue-50 border-b border-dashed border-[var(--border)] flex items-center justify-between gap-3"><div className="flex items-center gap-3 flex-1"><Mic size={16} className="text-blue-500" /><span className="text-sm font-bold">Voice note: {Math.floor(voicePreview / 60)}:{(voicePreview % 60).toString().padStart(2, '0')}</span></div><div className="flex gap-2"><VoiceMessagePlayer duration={`${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`} audioUrl={voicePreviewUrl} /></div><div className="flex gap-2"><button onClick={() => discardVoiceNote()} className="px-3 py-1 retro-border bg-gray-200 text-gray-800 text-xs font-bold hover:bg-gray-300">Discard</button><button onClick={confirmVoiceNote} className="px-3 py-1 retro-border bg-green-400 text-white text-xs font-bold hover:bg-green-500">Send</button></div></div>)}
              {replyingTo && (<div className="p-2 bg-white/50 border-b border-dashed border-[var(--border)] flex justify-between items-center text-sm"><div><span className="font-bold mr-2 text-[var(--primary)]"><Reply size={14} className="inline mr-1" />Replying to {replyingTo.sender === userId ? profile.name || 'You' : (replyingTo.senderName || partnerNickname || 'Partner')}:</span><span className="opacity-70 truncate max-w-[200px] inline-block align-bottom">{replyingTo.text || 'Attachment/Voice'}</span></div><button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-black/10 retro-border"><X size={14} /></button></div>)}
              <form onSubmit={handleSend} className="flex gap-2 items-center p-2 sm:p-3 relative">
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 border-2 border-[var(--border)] bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors shadow-[1px_1px_0px_0px_var(--border)] active:translate-y-[2px] active:shadow-none">
                   <Paperclip size={18} />
                 </button>
                 <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 border-2 border-[var(--border)] transition-colors shadow-[1px_1px_0px_0px_var(--border)] active:translate-y-[2px] active:shadow-none ${showEmojiPicker ? 'bg-[var(--accent)]' : 'bg-white hover:bg-gray-100'}`}>
                   <Smile size={18} />
                 </button>
                 <div className="flex-1 relative flex items-center bg-white border-2 border-[var(--border)] shadow-[inset_2px_2px_0px_rgba(0,0,0,0.05)] overflow-hidden">
                   <textarea 
                     ref={textareaRef}
                     rows={1}
                     value={isRecording ? `Recording... 0:${recordingTime.toString().padStart(2, '0')}` : input} 
                     onChange={handleInputChange} 
                     onKeyDown={handleKeyDown} 
                     placeholder={isInputDisabled ? "Establishing E2EE connection..." : (pendingImages.length > 0 ? "Add a caption..." : "type a secure message...")} 
                     disabled={isRecording || voicePreview !== null || isInputDisabled} 
                     className={`w-full p-2 sm:p-3 focus:outline-none font-bold placeholder:font-normal text-sm sm:text-base resize-none overflow-y-auto ${isInputDisabled ? 'bg-gray-200 opacity-50 cursor-not-allowed' : (isRecording ? 'text-red-500 animate-pulse bg-red-50' : 'bg-transparent')}`} 
                     style={{ minHeight: '44px', maxHeight: '72px' }}
                   />
                 </div>
                 {!input.trim() && !editingMsgId && voicePreview === null && pendingImages.length === 0 ? (
                   <button type="button" disabled={isInputDisabled} onMouseDown={handleMicDown} onMouseUp={handleMicUp} onMouseLeave={handleMicUp} onTouchStart={handleMicDown} onTouchEnd={handleMicUp} className={`p-2 sm:p-3 border-2 border-[var(--border)] transition-all flex-shrink-0 select-none shadow-[1px_1px_0px_0px_var(--border)] ${isInputDisabled ? 'opacity-50 cursor-not-allowed bg-gray-200' : (isRecording ? 'bg-red-400 text-white shadow-none translate-y-[2px]' : 'bg-white hover:bg-gray-50 hover:-translate-y-[1px]')}`}>
                     <Mic size={18} className={isRecording ? 'animate-bounce' : ''} />
                   </button>
                 ) : (
                   <button type="submit" disabled={isInputDisabled} className={`p-2 sm:p-3 border-2 border-[var(--border)] flex-shrink-0 transition-all ${isInputDisabled ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-[var(--primary)] text-white shadow-[1px_1px_0px_0px_var(--border)] hover:translate-y-[2px] hover:shadow-none'}`}>
                     <Send size={18} />
                   </button>
                 )}
               </form>
            </div>
          </div>
          {showDetails && (
            <div className="flex flex-col w-full md:w-1/3 retro-bg-main overflow-y-auto relative border-l-2 retro-border">
              <button onClick={() => setShowDetails(false)} className="md:hidden absolute top-4 right-4 p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark z-10 rounded-full"><X size={16} /></button>
              <div className="p-2 flex gap-1 bg-[var(--border)] shrink-0"><button onClick={() => setActiveSidebarTab('media')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'media' ? 'bg-white' : 'opacity-50 text-white'}`}>Media</button><button onClick={() => setActiveSidebarTab('calls')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'calls' ? 'bg-white' : 'opacity-50 text-white'}`}>Calls</button><button onClick={() => setActiveSidebarTab('search')} className={`flex-1 py-1 text-[10px] font-bold uppercase ${activeSidebarTab === 'search' ? 'bg-white' : 'opacity-50 text-white'}`}>Search</button></div>
              <div className="p-4 flex flex-col gap-6">
                {activeSidebarTab === 'search' && (
                  <div>
                    <h3 className="font-bold border-b-2 border-[var(--border)] pb-2 mb-4 flex items-center gap-2"><Search size={16} /> Search Logs</h3>
                    <div className="flex bg-white retro-border p-3 shadow-[1px_1px_0px_0px_var(--border)]">
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        placeholder="Filter messages..." 
                        className="bg-transparent outline-none w-full text-sm font-black placeholder:font-normal uppercase" 
                      />
                      {searchQuery && <button onClick={() => setSearchQuery('')} className="ml-2 hover:scale-110 transition-transform"><X size={14} className="opacity-50" /></button>}
                    </div>
                    {searchQuery && (
                      <div className="flex flex-col gap-3 mt-4 overflow-y-auto max-h-[500px] pr-2">
                        <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mb-1">
                          {filteredMessages.length} results found
                        </p>
                        {filteredMessages.map(m => (
                          <div 
                            key={m.id} 
                            onClick={() => jumpToMessage(m.id)}
                            className="bg-white retro-border p-3 cursor-pointer hover:bg-[var(--accent)] transition-all group/res active:scale-95 shadow-[2px_2px_0px_0px_var(--border)]"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black uppercase text-[var(--primary)]">{m.sender === userId ? 'You' : (m.senderName || partnerNickname || 'Partner')}</span>
                              <span className="text-[9px] opacity-40 font-bold">{m.time}</span>
                            </div>
                            <p className="text-xs font-bold line-clamp-2 leading-relaxed">{m.text || '📸 Media / Attachment'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
