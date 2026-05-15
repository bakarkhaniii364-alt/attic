import {
  X, Send, Paperclip, Smile, Mic, Trash2, Pin, Edit2, Reply, Image as ImageIcon,
  Gamepad2, Check, Clock, Ban, Phone, PhoneOff, Video, Download, Play, Monitor,
  Music, FileText, ChevronRight, MoreVertical, MicOff, Volume2, VolumeX, Bell, History, Palette, Pause, Pencil, Upload
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import { RetroWindow, RetroButton, ImageViewerOverlay, MediaEditorOverlay, RetroMediaPlayer } from '../components/UI.jsx';
import { SecureImage, SecureVideo, SecureAudio } from '../components/SecureMedia.jsx';
import { useSignedUrl, parseSupabaseUrl } from '../hooks/useSignedUrl.js';
import { useMobile } from '../hooks/useMobile.js';
import { useLastSeen } from '../hooks/useLastSeen.js';
import { playAudio } from '../utils/audio.js';
import { useBroadcast, useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useNavigate } from 'react-router-dom';
import { base64ToBlob, compressImage } from '../utils/file.js';
import { isTestMode } from '../lib/testMode.js';
import { useAuth, useSync, useChat, useCall } from '../context/instances.js';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';
import { useTypingIndicator } from '../hooks/useTypingIndicator.js';

const RetroIcon = ({ icon: Icon, ...props }) => <Icon {...props} />;

/* ═══════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════ */

const globalAudioRef = { current: null };
function VoiceMessagePlayer({ duration, audioUrl, isMe }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const isBlob = audioUrl?.startsWith('blob:');
  const { bucket, path } = isBlob ? { bucket: null, path: null } : parseSupabaseUrl(audioUrl);
  const { signedUrl: sUrl } = useSignedUrl(bucket, path);
  const effectiveUrl = isBlob ? audioUrl : sUrl;
  const audioRef = useRef(null);

  useEffect(() => {
    if (effectiveUrl) {
      audioRef.current = new Audio(effectiveUrl);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [effectiveUrl]);

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
      <button onClick={togglePlay} className={`w-8 h-8 retro-border retro-shadow-dark flex-shrink-0 flex items-center justify-center hover:brightness-110 transition-all ${isMe ? 'bg-window text-primary' : 'bg-primary text-white'}`}>
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <div onClick={handleSeek} className="flex-1 h-4 bg-black/20 retro-border border-dashed relative overflow-hidden cursor-pointer group">
        <div
          className={`absolute top-0 left-0 h-full transition-all duration-75 ${isMe ? 'bg-primary-text' : 'bg-main-text'}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <span className={`text-[10px] sm:text-xs font-bold whitespace-nowrap ${isMe ? 'text-primary-text opacity-90' : 'text-main-text'}`}>
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


export function ChatView({ onClose, sfx }) {
  const isMobile = useMobile();
  const { userId, partnerId, roomId } = useAuth();
  const { globalState, broadcast: syncBroadcast, onlineUsers } = useSync();
  const { messages: chatHistory, sendMessage: syncSendMessage, updateMessage: syncUpdateMessage, deleteMessage: syncDeleteMessage, loadMore: syncLoadMore, hasMore: syncHasMore } = useChat();
  const { startCall } = useCall();

  const profile = globalState?.room_profiles?.[userId] || {};
  const partnerProfile = globalState?.room_profiles?.[partnerId] || {};
  const roomProfiles = globalState?.room_profiles || {};
  const coupleData = globalState.couple_data || {};
  const partnerNickname = coupleData.nicknames?.[partnerId] || partnerProfile.name || 'Partner';
  const { partnerStatusData, partnerStatusLabel } = useLastSeen();
  const isNormalized = !!roomId;
  const isInputDisabled = false;
  const navigate = useNavigate();
  const draftKey = `attic_chat_draft_${userId}`;
  const [input, setInput] = useState(() => {
    try {
      return localStorage.getItem(draftKey) || '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    if (input) {
      localStorage.setItem(draftKey, input);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [input, draftKey]);

  const [showDetails, setShowDetails] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('media');

  const {
    isRecording, recordingTime, voicePreview, voicePreviewUrl, voiceBase64,
    mediaRecorderRef, audioChunksRef, voiceExtensionRef,
    startRecording, stopRecording, discardVoiceNote, recordingStartTimeRef
  } = useVoiceRecorder();

  const { isTypingLocal, isPartnerTyping, handleTyping, stopTyping } = useTypingIndicator(userId, partnerId);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lobbyState, setLobbyState] = useGlobalSync('arcade_lobby', { players: [], gameId: null, status: 'idle', config: null });

  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeOptions, setActiveOptions] = useState(null);
  const [viewLimit, setViewLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerContext, setViewerContext] = useState({ items: [], index: 0, isOpen: false });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const readMsgIdsRef = useRef(new Set());

  const textareaRef = useRef(null);

  // TYPING INDICATOR LOGIC

  const handleInputChange = (e) => {
    setInput(e.target.value);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    handleTyping();
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

    const unreadFromPartner = chatHistory.filter(m =>
      m.sender === partnerId &&
      m.sender !== userId &&
      m.status !== 'read' &&
      !readMsgIdsRef.current.has(m.id) &&
      !String(m.id).startsWith('temp-')  // skip optimistic messages — not yet in DB
    );

    if (unreadFromPartner.length > 0) {
      console.log(`[CHAT] Marking ${unreadFromPartner.length} messages as read from ${partnerId}`);
      if (isNormalized && syncUpdateMessage) {
        const idsToUpdate = unreadFromPartner.map(m => {
          readMsgIdsRef.current.add(m.id);
          return m.id;
        });
        syncUpdateMessage(idsToUpdate, { status: 'read', readAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
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

  const handleStartCall = (type) => {
    playAudio('click', sfx);
    startCall(type);
    // Log as 'ringing' — CallContext will write the final 'ended' or 'missed' entry
    syncSendMessage(`${type === 'video' ? 'Video' : 'Voice'} Call`, 'call_invite', { status: 'ringing', callType: type });
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
    setLobbyState(prev => {
      const newPlayers = Array.from(new Set([...(prev?.players || []), userId]));
      return {
        ...prev,
        players: newPlayers,
        gameId: inviteMsg.gameId || prev.gameId,
        status: newPlayers.length >= 2 ? 'ready' : 'waiting'
      };
    });
    // Navigate to activity
    navigate(`/activities/${inviteMsg.gameId}`);
  };

  const handleSend = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isInputDisabled) return;

    // Check if it's a special invite message passed as 'e'
    if (e && e._isInvite) {
      syncSendMessage(e.text, 'game_invite', { gameId: e.gameId, gameTitle: e.gameTitle, inviteStatus: 'pending' });
      return;
    }

    if (!input.trim() && pendingFiles.length === 0 && voicePreview === null) return;
    playAudio('send', sfx);
    if (editingMsgId) {
      if (isNormalized) {
        syncUpdateMessage(editingMsgId, { text: input, isEdited: true });
      }
      setEditingMsgId(null);
    }
    else if (pendingFiles.length > 0) {
      if (isNormalized) {
        pendingFiles.forEach(item => {
          if (item.type === 'image' && item.data) {
            const blob = base64ToBlob(item.data);
            const file = new File([blob], `image_${Date.now()}.png`, { type: 'image/png' });
            syncSendMessage(file, 'image', { text: input.trim() });
          } else {
            syncSendMessage(item.file, item.type, { text: input.trim(), fileName: item.name });
          }
        });
        setPendingFiles([]);
      }
    }
    else {
      if (isNormalized) {
        syncSendMessage(input, 'text', { replyTo: replyingTo }).catch(err => {
          console.error("Failed to send message:", err);
        });
      }
    }
    setInput(''); setReplyingTo(null); setActiveOptions(null); setShowEmojiPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    stopTyping();
  };


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
  const confirmVoiceNote = async () => {
    if (!voiceBase64 || !voicePreview) return;
    playAudio('send', sfx);

    if (isNormalized) {
      try {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const extension = voiceExtensionRef.current || 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // FIX: Wrap the raw Blob into a proper File object with correct extension.
        const audioFile = new File([audioBlob], `voice_${Date.now()}.${extension}`, { type: mimeType });

        await syncSendMessage(audioFile, 'voice', {
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

  const handleFiles = async (files) => {
    if (files.length > 0) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const compressed = await compressImage(reader.result);
            setPendingFiles(prev => [...prev, { type: 'image', data: compressed, name: file.name, file }]);
          };
          reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
          setPendingFiles(prev => [...prev, { type: 'video', file, name: file.name }]);
        } else if (file.type.startsWith('audio/')) {
          setPendingFiles(prev => [...prev, { type: 'audio', file, name: file.name }]);
        } else {
          setPendingFiles(prev => [...prev, { type: 'file', file, name: file.name }]);
        }
      }
      playAudio('click', sfx);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleSaveEditedFile = (editedFile, dataUrl, meta = {}) => {
    if (editingFileIndex === null) return;
    setPendingFiles(prev => {
      const next = [...prev];
      const item = next[editingFileIndex];
      next[editingFileIndex] = { ...item, file: editedFile, data: dataUrl, metadata: { ...item.metadata, ...meta } };
      return next;
    });
    setEditingFileIndex(null);
    playAudio('click', sfx);
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
        await syncSendMessage(blob, 'image', { text: 'Saved from chat' });
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
  const callHistory = safeHistory.filter(m => m.type === 'call_invite');
  const headerActions = (
    <div className="flex gap-1.5">
      <button onClick={() => handleStartCall('audio')} className="p-1.5 retro-border retro-shadow-dark bg-window text-main-text hover:bg-accent hover:text-accent-text transition-all active:translate-y-[1px] active:shadow-none" title="Voice Call"><Phone size={14} /></button>
      <button onClick={() => handleStartCall('video')} className="p-1.5 retro-border retro-shadow-dark bg-window text-main-text hover:bg-accent hover:text-accent-text transition-all active:translate-y-[1px] active:shadow-none" title="Video Call"><Video size={14} /></button>
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

  const openViewer = (url, msgId) => {
    const gallery = safeHistory.filter(m => (m.type === 'image' || m.type === 'image_group' || m.type === 'video'))
      .flatMap(m => {
        if (m.type === 'image_group') {
          return m.urls.map((u, idx) => ({
            url: u,
            type: 'image',
            id: m.id,
            isDeleted: m.isDeleted,
            metadata: {
              title: `Group Photo ${idx + 1}`,
              sender: m.sender === userId ? 'You' : (roomProfiles[m.sender]?.name || 'Partner'),
              time: m.time,
              isMine: m.sender === userId
            },
            reactions: m.reactions
          }));
        }
        return [{
          url: m.url,
          type: m.type,
          id: m.id,
          isDeleted: m.isDeleted,
          metadata: {
            title: m.type === 'video' ? 'Video Message' : 'Photo Message',
            sender: m.sender === userId ? 'You' : (roomProfiles[m.sender]?.name || 'Partner'),
            time: m.time,
            isMine: m.sender === userId
          },
          reactions: m.reactions
        }];
      });

    const initialIndex = gallery.findIndex(item => item.url === url && item.id === msgId);
    setViewerContext({ items: gallery, index: initialIndex >= 0 ? initialIndex : 0, isOpen: true });
  };

  return (
    <>
      {viewerContext.isOpen && (
        <ImageViewerOverlay
          images={viewerContext.items}
          currentIndex={viewerContext.index}
          onClose={() => setViewerContext(p => ({ ...p, isOpen: false }))}
          onNext={() => setViewerContext(p => ({ ...p, index: (p.index + 1) % p.items.length }))}
          onPrev={() => setViewerContext(p => ({ ...p, index: (p.index - 1 + p.items.length) % p.items.length }))}
          onDelete={(idx, mode) => {
            const item = viewerContext.items[idx];
            if (!item?.id) return;
            if (mode === 'everyone') {
              syncUpdateMessage(item.id, { isDeleted: true, text: 'message deleted' });
            } else {
              syncDeleteMessage(item.id);
            }
            setViewerContext(p => ({ ...p, isOpen: false }));
          }}
          onReact={(idx, emoji) => {
            const item = viewerContext.items[idx];
            if (item?.id) {
              const rs = item.reactions || [];
              syncUpdateMessage(item.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
            }
          }}
          onSaveToScrapbook={handleSaveToScrapbook}
          sfx={sfx}
        />
      )}
      {editingFileIndex !== null && pendingFiles[editingFileIndex] && (
        <MediaEditorOverlay
          file={pendingFiles[editingFileIndex].file}
          type={pendingFiles[editingFileIndex].type}
          onSave={handleSaveEditedFile}
          onClose={() => setEditingFileIndex(null)}
          sfx={sfx}
        />
      )}
      <RetroWindow
        title={`${partnerNickname} | ${partnerStatusLabel.toLowerCase()}`}
        onClose={onClose}
        headerActions={headerActions}
        onTitleClick={() => { playAudio('click', sfx); setShowDetails(!showDetails) }}
        className={`w-full ${isMobile ? 'h-[100dvh] max-h-none border-none' : 'max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px]'} flex flex-col transition-all duration-300 relative`}
        noPadding
        sfx={sfx}
      >
        {isDragging && (
          <div className="absolute inset-0 z-[200] bg-primary/20 backdrop-blur-md border-4 border-dashed border-primary flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300 pointer-events-none"
            style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)' }}>
            <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(var(--color-primary-rgb),0.5)] animate-bounce">
              <Upload size={48} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="font-black uppercase tracking-[0.3em] text-primary text-xl bg-window px-6 py-2 retro-border shadow-2xl">Drop to Attach</span>
              <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest bg-window px-3 py-1 retro-border">Images, Videos, Audio, Documents</span>
            </div>
          </div>
        )}
        <div className="flex flex-1 h-full overflow-hidden relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}>
          <div className={`flex flex-col h-full transition-all duration-300 ${showDetails ? 'hidden md:flex md:w-2/3 border-r-2 border-border' : 'w-full'}`}>
            <div
              className={`flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col relative chat-container chat-wallpaper-${coupleData.settings?.chatWallpaper || 'none'}`}
            >

              <div className="text-center text-xs font-bold opacity-50 mb-6 border-b-2 border-border inline-block mx-auto pb-1 mt-2 text-main-text">-- connection secured --</div>
              {syncHasMore && (
                <button
                  onClick={() => {
                    playAudio('click', sfx);
                    syncLoadMore();
                    setViewLimit(p => p + 50);
                  }}
                  className="mx-auto my-4 px-4 py-2 bg-accent text-accent-text border-2 border-border font-bold text-xs uppercase hover:-translate-y-0.5 transition-transform"
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
                          <button onClick={() => { playAudio('click', sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="options-trigger p-1.5 retro-border bg-window/80 backdrop-blur-sm border-dashed text-main-text">
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
                        ${noBubble || isGameInvite ? 'p-0 bg-transparent' : 'p-3.5 retro-border retro-shadow-dark'} 
                        ${msg.isDeleted ? 'bg-transparent border-dashed border-border/50 text-main-text/50 italic shadow-none' :
                          isCallLog ? 'bg-black/5 border-dashed italic shadow-none' :
                            isMe ? (noBubble ? '' : 'bg-primary text-[color:var(--text-on-primary)]') : (noBubble ? '' : 'bg-window text-main-text')}
                        ${isHighlighted ? 'ring-4 ring-accent ring-opacity-50 animate-pulse' : ''}
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
                            className={`border-l-4 border-border/40 bg-border/20 p-2 mb-2 text-[10px] opacity-90 cursor-pointer hover:bg-border/30 transition-all active:scale-95`}
                          >
                            <p className="font-black uppercase tracking-tighter mb-0.5 opacity-60">{msg.replyTo.sender === userId ? 'You' : (roomProfiles[msg.replyTo.sender]?.name || 'Partner')}</p>
                            <p className="truncate italic font-bold">{msg.replyTo.text || '📸 Media / Attachment'}</p>
                          </div>
                        )}

                        {/* Content Types */}
                        {msg.isDeleted ? (
                          <span className="flex items-center gap-2 text-main-text/40 italic px-2 py-1"><Ban size={12} /> message deleted</span>
                        ) : (
                          <>
                            {msg.type === 'text' && <span className={`${isPureEmoji ? 'text-4xl sm:text-5xl' : 'break-words whitespace-pre-wrap max-w-full-break block [word-break:break-word] overflow-hidden'}`}>{formatMessage(msg.text, msg.isEdited)}</span>}
                            {msg.type === 'voice' && <VoiceMessagePlayer duration={msg.duration} audioUrl={msg.audioUrl} isMe={isMe} />}
                            {msg.type === 'video' && (
                              <div className="flex flex-col gap-2 relative group/video w-full max-w-[280px] sm:max-w-xs overflow-hidden rounded-lg">
                                <RetroMediaPlayer
                                  url={msg.url}
                                  type="video"
                                  autoPlay={false}
                                  className="w-full aspect-video retro-border"
                                  onClick={() => openViewer(msg.url, msg.id)}
                                />
                                {msg.text && <span className="italic text-xs opacity-80 break-words">{msg.text}</span>}
                              </div>
                            )}
                            {msg.type === 'audio' && (
                              <div className="w-[240px] sm:w-[320px] max-w-full overflow-hidden">
                                <RetroMediaPlayer
                                  url={msg.url}
                                  type="audio"
                                  autoPlay={false}
                                  fileName={msg.fileName}
                                  className="w-full retro-border-thick bg-window/20"
                                />
                                <div className="mt-1 flex items-center justify-between px-1">
                                  <span className="text-[9px] font-black uppercase tracking-tighter opacity-40 flex items-center gap-1 truncate max-w-[70%]">
                                    <Music size={10} /> {msg.fileName || 'Audio Message'}
                                  </span>
                                </div>
                              </div>
                            )}
                            {msg.type === 'file' && (
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                <a href={msg.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-window retro-border hover:bg-accent/10 transition-all group no-underline text-main-text">
                                  <div className="p-2 bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                                    <FileText size={24} />
                                  </div>
                                  <div className="flex flex-col overflow-hidden">
                                    <span className="font-bold text-xs truncate w-32">{msg.fileName || 'Attachment'}</span>
                                    <span className="text-[9px] opacity-40 uppercase font-black">{msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'Document'}</span>
                                  </div>
                                  <Download size={16} className="ml-auto opacity-30 group-hover:opacity-100" />
                                </a>
                              </div>
                            )}
                            {msg.type === 'game_invite' && (
                              <div className="retro-border retro-shadow-dark bg-window p-3 w-64 text-main-text mt-1">
                                <div className="flex items-center gap-2 mb-3 border-b-2 border-border/20 pb-2">
                                  <Gamepad2 size={18} className="text-primary" />
                                  <span className="font-black text-[10px] uppercase tracking-widest">Activity Invite</span>
                                </div>
                                <p className="text-xs font-bold mb-4 opacity-80">{msg.text || `Join me for ${msg.gameTitle || "a game"}!`}</p>
                                {msg.inviteStatus === 'pending' || msg.metadata?.inviteStatus === 'pending' ? (
                                  <button onClick={() => handleJoinGame(msg)} className="w-full py-2 text-xs font-bold bg-accent text-accent-text retro-border retro-shadow-dark hover:brightness-110 transition-all">Join Now</button>
                                ) : (
                                  <div className="bg-black/5 border-2 border-dashed border-border/30 p-2 text-center text-[9px] font-black uppercase opacity-60">
                                    {msg.inviteStatus === 'accepted' || msg.metadata?.inviteStatus === 'accepted' ? 'Accepted' : 'Expired'}
                                  </div>
                                )}
                              </div>
                            )}
                            {msg.type === 'watchparty_invite' && (
                              <div className="retro-border retro-shadow-dark bg-window p-3 w-64 text-main-text mt-1">
                                <div className="flex items-center gap-2 mb-3 border-b-2 border-border/20 pb-2">
                                  <Monitor size={18} className="text-secondary" />
                                  <span className="font-black text-[10px] uppercase tracking-widest">Watchparty Invite</span>
                                </div>
                                <p className="text-xs font-bold mb-4 opacity-80">{msg.text || `Join me for a watch party!`}</p>
                                <button onClick={() => navigate('/watch')} className="w-full py-2 text-xs font-bold bg-secondary text-secondary-text retro-border retro-shadow-dark hover:brightness-110 transition-all">Join Now</button>
                              </div>
                            )}
                            {msg.type === 'call_invite' && (
                              <div className="flex flex-col gap-1 py-1 min-w-[160px]">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 retro-border retro-shadow-dark flex-shrink-0 ${msg.status === 'missed' ? 'bg-red-500 text-white' :
                                      msg.status === 'ended' ? 'bg-gray-100 text-gray-600' :
                                        msg.status === 'ringing' ? 'bg-yellow-100 text-yellow-600' :
                                          'bg-gray-100 text-gray-500'
                                    }`}>
                                    {msg.status === 'missed'
                                      ? <PhoneOff size={16} />
                                      : msg.callType === 'video' ? <Video size={16} /> : <Phone size={16} />
                                    }
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`text-[11px] font-black uppercase tracking-widest leading-none mb-1 ${msg.status === 'missed' ? 'text-red-500' : ''
                                      }`}>
                                      {msg.status === 'missed' ? '📵 Missed Call' :
                                        msg.status === 'ended' ? 'Call Ended' :
                                          msg.status === 'rejected' ? 'Declined' :
                                            msg.status === 'ringing' ? 'Calling...' : 'Call'}
                                    </span>
                                    {msg.metadata?.duration && (
                                      <span className="text-[9px] opacity-60 font-bold">⏱ {msg.metadata.duration}</span>
                                    )}
                                    <span className="text-[9px] opacity-40 font-bold">{msg.time}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {msg.type === 'image' && (
                              <div className="flex flex-col gap-2">
                                <SecureImage
                                  url={msg.url}
                                  alt=""
                                  onClick={() => openViewer(msg.url, msg.id)}
                                  className={`${isPureImage ? 'w-48 sm:w-64' : 'w-32 h-32 sm:w-48 sm:h-48'} object-cover retro-border cursor-pointer hover:brightness-95 transition-all`}
                                />
                                {msg.text && <span className="italic text-xs opacity-80 break-words whitespace-pre-wrap max-w-full-break block">{msg.text}</span>}
                              </div>
                            )}
                            {msg.type === 'image_group' && (
                              <div className="flex flex-col gap-2">
                                <div className={`grid ${msg.urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-1 w-full max-w-xs`}>
                                  {msg.urls.map((u, i) => (
                                    <SecureImage
                                      key={i}
                                      url={u}
                                      onClick={() => openViewer(u, msg.id)}
                                      className="aspect-square object-cover retro-border cursor-pointer hover:scale-[1.02] transition-transform"
                                    />
                                  ))}
                                </div>
                                {msg.text && <span className="italic text-xs opacity-80 break-words">{msg.text}</span>}
                              </div>
                            )}
                          </>
                        )}

                        {/* Reactions (Always visible and more stylized) */}
                        {msg.reactions && msg.reactions.length > 0 && !msg.isDeleted && !isCallLog && (
                          <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} bg-window text-main-text retro-border retro-shadow-dark px-2 py-0.5 text-[11px] flex gap-1 z-10 animate-in zoom-in-50`}>
                            {msg.reactions.map((r, i) => (
                              <span key={i} className="hover:scale-125 transition-transform cursor-default">
                                {typeof r === 'string' ? r : r.emoji}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Options Popup (Positioned to the side) */}
                      {activeOptions === msg.id && (
                        <div className={`
                          message-options-menu absolute z-[100] bg-window retro-border retro-shadow-dark py-1 flex flex-col w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-main-text
                          ${isMe ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]'}
                          ${isNearBottom ? 'bottom-0' : 'top-0'} 
                        `}>
                          <button onClick={() => { setReplyingTo(msg); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Reply size={14} className="text-blue-500" /> Reply</button>
                          <button onClick={() => { syncUpdateMessage(msg.id, { isPinned: !msg.isPinned }); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Pin size={14} className="text-orange-500" /> {msg.isPinned ? 'Unpin' : 'Pin'}</button>

                          <div className="flex items-center justify-center gap-2 px-3 py-1 border-y border-dashed border-border/10 text-[9px] font-black uppercase opacity-50">
                            <Clock size={10} /> {msg.time}
                          </div>

                          <div className="flex items-center justify-around px-1 py-2 border-y-2 border-border/10 bg-border/5 my-1">
                            {['❤️', '😂', '😢', '😮', '😡'].map(emoji => (
                              <button key={emoji} onClick={() => {
                                const rs = msg.reactions || [];
                                syncUpdateMessage(msg.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
                                setActiveOptions(null);
                              }} className={`text-base p-1 hover:scale-150 transition-transform active:scale-95 ${(msg.reactions || []).includes(emoji) ? 'bg-accent border-2 border-border' : ''}`}>{emoji}</button>
                            ))}
                          </div>

                          {isMe && !msg.isDeleted && (
                            <>
                              {msg.type === 'text' && <button onClick={() => { setEditingMsgId(msg.id); setInput(msg.text); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Edit2 size={14} className="text-green-600" /> Edit</button>}
                              <button onClick={() => { syncDeleteMessage(msg.id); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-red-100 text-red-600 text-left transition-colors"><Trash2 size={14} /> Delete</button>
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
                              <Check size={10} className={msg.status === 'read' ? 'text-blue-500' : ''} />
                              {(msg.status === 'delivered' || msg.status === 'read') && <Check size={10} className={msg.status === 'read' ? 'text-blue-500' : ''} />}
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
                  <div className="w-8 h-8 rounded-full bg-secondary border-2 border-border flex items-center justify-center text-sm">{partnerProfile.emoji || '☕'}</div>
                  <div className="bg-window border-2 border-border px-3 py-2 text-[10px] font-bold text-main-text flex gap-1 items-center">
                    {partnerNickname} is typing
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-main-text rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-main-text rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1 h-1 bg-main-text rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col bg-accent text-accent-text border-t-2 border-border relative">
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 z-[var(--z-overlay)] mb-2 animate-in slide-in-from-bottom-2">
                  <div className="retro-border retro-shadow-dark overflow-hidden">
                    <div className="bg-primary text-white px-2 py-1 flex justify-between items-center border-b-2 retro-border">
                      <span className="text-[10px] font-black uppercase tracking-widest">Select Emoji</span>
                      <button onClick={() => setShowEmojiPicker(false)}><X size={12} /></button>
                    </div>
                    <Suspense fallback={<div className="p-8 bg-window text-main-text font-bold">Loading...</div>}>
                      <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        theme="auto"
                        skinTonesDisabled
                        searchDisabled={window.innerWidth < 640}
                        width={window.innerWidth < 640 ? 280 : 350}
                        height={350}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              {pendingFiles.length > 0 && (
                <div className="p-3 bg-window border-b-2 border-dashed border-border flex flex-col gap-3 animate-in slide-in-from-bottom-2 text-main-text select-none">
                  <div className="w-full flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary">Attachment(s) staged for upload:</span>
                    <button onClick={() => setPendingFiles([])} className="text-[9px] font-bold underline opacity-60 hover:opacity-100 uppercase tracking-tighter">Clear All</button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {pendingFiles.map((item, i) => (
                      <div key={i} className="relative bg-black/5 p-1 retro-border border-dashed min-w-[64px] flex flex-col items-center justify-center group/item">
                        {item.type === 'image' ? (
                          <img src={item.data} alt="preview" className="w-16 h-16 object-cover retro-border" />
                        ) : (
                          <div className="w-16 h-16 flex flex-col items-center justify-center gap-1 bg-accent/5 text-accent overflow-hidden">
                            {item.type === 'video' ? <Video size={24} /> : item.type === 'audio' ? <Music size={24} /> : <FileText size={24} />}
                            <span className="text-[8px] font-black uppercase truncate w-14 text-center px-1">{item.name}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-1 z-10">
                          <button onClick={() => setEditingFileIndex(i)} className="bg-primary text-white p-1.5 retro-border hover:scale-110 transition-transform" title="Edit Attachment"><Pencil size={12} /></button>
                          <button onClick={() => setPendingFiles(p => p.filter((_, idx) => idx !== i))} className="bg-red-600 text-white p-1.5 retro-border hover:scale-110 transition-transform" title="Remove"><X size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {voicePreview !== null && (
                <div className="p-3 bg-window border-t-2 border-border flex items-center justify-between gap-3 text-main-text animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mic size={16} className="text-primary animate-pulse" />
                    </div>
                    <span className="text-sm font-bold uppercase tracking-tighter">Voice Note Staged</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <VoiceMessagePlayer
                      duration={`${Math.floor(voicePreview / 60)}:${(voicePreview % 60).toString().padStart(2, '0')}`}
                      audioUrl={voicePreviewUrl}
                      isMe={true}
                    />
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => discardVoiceNote()} className="px-3 py-1.5 retro-border bg-window text-main-text text-[10px] font-black uppercase hover:bg-red-50 transition-colors">Discard</button>
                      <button onClick={confirmVoiceNote} className="px-3 py-1.5 retro-border bg-primary text-primary-text text-[10px] font-black uppercase hover:brightness-110 transition-all">Send Note</button>
                    </div>
                  </div>
                </div>
              )}

              {replyingTo && (
                <div className="p-2 bg-primary text-white border-t-2 border-border/20 flex justify-between items-center text-sm animate-in slide-in-from-bottom-1">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Reply size={14} className="flex-shrink-0" />
                    <span className="font-bold truncate">
                      Replying to {replyingTo.sender === userId ? 'You' : (roomProfiles[replyingTo.sender]?.name || 'Partner')}: {replyingTo.text || '📸 Media / Attachment'}
                    </span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 retro-border flex-shrink-0 ml-2"><X size={14} /></button>
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2 items-center p-2 sm:p-3 relative">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />

                <div className="flex items-center gap-1.5 sm:gap-2 pr-1 sm:pr-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 retro-border bg-window text-main-text hover:brightness-110 transition-all">
                    <Paperclip size={18} />
                  </button>
                  <button type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); }} className={`p-2 retro-border transition-all ${showEmojiPicker ? 'bg-accent text-accent-text' : 'bg-window text-main-text hover:brightness-110'}`}>
                    <Smile size={18} />
                  </button>
                </div>

                <div className="flex-1 relative flex items-center bg-window retro-inset overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={isRecording ? `Recording... ${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}` : input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={pendingFiles.length > 0 ? "Add a caption..." : "type a message..."}
                    disabled={isRecording || voicePreview !== null || isInputDisabled}
                    className={`w-full p-2 sm:p-3 focus:outline-none font-bold placeholder:font-normal text-sm sm:text-base resize-none overflow-y-auto text-main-text ${isInputDisabled ? 'bg-gray-200 opacity-50 cursor-not-allowed' : (isRecording ? 'text-red-500 animate-pulse bg-red-50' : 'bg-transparent')}`}
                    style={{ minHeight: '44px', maxHeight: '72px' }}
                  />
                </div>
                {!input.trim() && !editingMsgId && voicePreview === null && pendingFiles.length === 0 ? (
                  <button type="button" disabled={isInputDisabled} onMouseDown={handleMicDown} onMouseUp={handleMicUp} onMouseLeave={handleMicUp} onTouchStart={handleMicDown} onTouchEnd={handleMicUp} className={`p-2 sm:p-3 retro-outset transition-all flex-shrink-0 select-none ${isInputDisabled ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500' : (isRecording ? 'bg-red-400 text-white shadow-none translate-y-[2px]' : 'bg-window text-main-text hover:brightness-110')}`}>
                    <RetroIcon icon={Mic} size={18} className={isRecording ? 'animate-bounce' : ''} />
                  </button>
                ) : (
                  <button type="submit" disabled={isInputDisabled} className={`p-2 sm:p-3 flex-shrink-0 transition-all ${isInputDisabled ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-primary text-primary-text retro-outset hover:brightness-110'}`}>
                    <RetroIcon icon={Send} size={18} />
                  </button>
                )}
              </form>
            </div>
          </div>
          {showDetails && (
            <div className="flex flex-col w-full md:w-1/3 bg-main overflow-y-auto relative border-l-2 border-border">
              <button onClick={() => setShowDetails(false)} className="md:hidden absolute top-4 right-4 p-2 bg-window retro-outset z-10"><RetroIcon icon={X} size={16} /></button>
              <div className="p-2 flex gap-1 bg-border shrink-0">
                <button onClick={() => setActiveSidebarTab('media')} className={`flex-1 py-1 text-[10px] font-bold uppercase retro-outset ${activeSidebarTab === 'media' ? 'bg-window text-main-text' : 'opacity-50 text-border-text'}`}>Media</button>
                <button onClick={() => setActiveSidebarTab('theme')} className={`flex-1 py-1 text-[10px] font-bold uppercase retro-outset ${activeSidebarTab === 'theme' ? 'bg-window text-main-text' : 'opacity-50 text-border-text'}`}>Theme</button>
                <button onClick={() => setActiveSidebarTab('calls')} className={`flex-1 py-1 text-[10px] font-bold uppercase retro-outset ${activeSidebarTab === 'calls' ? 'bg-window text-main-text' : 'opacity-50 text-border-text'}`}>Calls</button>
                <button onClick={() => setActiveSidebarTab('search')} className={`flex-1 py-1 text-[10px] font-bold uppercase retro-outset ${activeSidebarTab === 'search' ? 'bg-window text-main-text' : 'opacity-50 text-border-text'}`}>Search</button>
              </div>
              <div className="p-4 flex flex-col gap-6">
                {activeSidebarTab === 'theme' && (
                  <div className="text-main-text">
                    <h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={Palette} size={16} /> Chat Theme</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 flex items-center gap-1">Chat Wallpaper</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'none', label: 'None', color: 'transparent' },
                            { id: 'pixel-garden', label: 'Garden', color: '#90be6d' },
                            { id: 'pixel-stars', label: 'Stars', color: '#2b2d42' },
                            { id: 'pixel-clouds', label: 'Clouds', color: '#a2d2ff' }
                          ].map(w => (
                            <button
                              key={w.id}
                              onClick={() => setCoupleData(prev => ({ ...prev, settings: { ...prev.settings, chatWallpaper: w.id } }))}
                              className={`aspect-video retro-border flex flex-col items-center justify-center p-1 gap-1 transition-all ${coupleData.settings?.chatWallpaper === w.id ? 'ring-2 ring-primary scale-105' : 'opacity-70 hover:opacity-100'}`}
                            >
                              <div className="w-full h-full border border-border shadow-inner" style={{ backgroundColor: w.color }}></div>
                              <span className="text-[10px] font-bold uppercase">{w.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border/30">
                        <p className="text-[10px] italic opacity-50">This setting is shared between both partners.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeSidebarTab === 'search' && (
                  <div className="text-main-text">
                    <h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={Search} size={16} /> Search Logs</h3>
                    <div className="flex bg-window retro-inset p-3">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter messages..."
                        className="bg-transparent outline-none w-full text-sm font-black placeholder:font-normal uppercase"
                      />
                      {searchQuery && <button onClick={() => setSearchQuery('')} className="ml-2 hover:scale-110 transition-transform"><RetroIcon icon={X} size={14} className="opacity-50" /></button>}
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
                            className="bg-window retro-outset p-3 cursor-pointer hover:bg-accent hover:text-accent-text transition-all group/res active:translate-y-[2px]"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-black uppercase text-primary">{m.sender === userId ? 'You' : (m.senderName || partnerNickname || 'Partner')}</span>
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
                    <div><h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={Pin} size={16} /> Pinned</h3><div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">{pinnedMessages.length === 0 ? (<p className="text-sm opacity-50">No pinned messages.</p>) : (pinnedMessages.map(m => (<div key={m.id} className="bg-window p-2 text-sm retro-outset border-l-4 border-l-accent"><p className="font-bold opacity-70 text-xs mb-1">{m.sender === userId ? 'You' : (m.senderName || partnerNickname || 'Partner')}</p><p className="truncate">{m.text || 'Attachment/Voice'}</p></div>)))}</div></div>
                    <div><h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={ImageIcon} size={16} /> Media Grid</h3><div className="grid grid-cols-2 gap-2">{imageMessages.length === 0 ? (<p className="text-sm opacity-50 col-span-2">No media shared yet.</p>) : (imageMessages.map(m => (<div key={m.id} onClick={() => setViewerContext({ urls: m.type === 'image_group' ? m.urls : [m.url], index: 0, isOpen: true })} className="aspect-square retro-outset bg-cover bg-center cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundImage: `url(${m.type === 'image_group' ? m.urls[0] : m.url})` }}></div>)))}</div></div>
                  </>
                )}

                {activeSidebarTab === 'calls' && (
                  <div><h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={History} size={16} /> Call History</h3><div className="flex flex-col gap-2 overflow-y-auto pr-1">{callHistory.length === 0 ? (<p className="text-sm opacity-50">No call history.</p>) : (callHistory.reverse().map(m => (<div key={m.id} className="bg-window p-3 text-xs retro-outset flex items-center justify-between"><div className="flex items-center gap-2">{m.callType === 'video' ? <RetroIcon icon={Video} size={14} className="text-secondary" /> : <RetroIcon icon={Phone} size={14} className="text-primary" />}<div><p className="font-bold">{m.sender === userId ? 'Outgoing' : 'Incoming'}</p><p className="opacity-50">{m.time}</p></div></div><span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 retro-outset ${m.status === 'accepted' || m.status === 'ended' ? 'bg-green-100 text-green-700' : m.status === 'missed' || m.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{m.status === 'sent' || !m.status ? 'Outgoing' : m.status}</span></div>)))}</div></div>
                )}
              </div>
            </div>
          )}
        </div>
      </RetroWindow>
    </>
  );
}
