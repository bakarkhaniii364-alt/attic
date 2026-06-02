import {
  X, Send, Paperclip, Smile, Mic, Trash2, Pin, Edit2, Reply, Image as ImageIcon,
  Gamepad2, Check, Clock, Ban, Phone, PhoneOff, Video, Download, Play, Monitor,
  Music, FileText, ChevronRight, MoreVertical, MicOff, Volume2, VolumeX, Bell, History, Palette, Pause, Pencil, Upload, Search, Film, Settings, Lock, AlertTriangle, Unlock, Key, Loader
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import { RetroWindow, RetroButton, ImageViewerOverlay, MediaEditorOverlay, RetroMediaPlayer, RetroInput, ConfirmDialog, useToast } from '../components/UI.jsx';
import { PocketWatchWinder } from '../components/PocketWatchWinder.jsx';
import { SecureImage, SecureVideo, SecureAudio } from '../components/SecureMedia.jsx';
import { useSignedUrl, parseSupabaseUrl } from '../hooks/useSignedUrl.js';
import { useAssetSync } from '../hooks/useAssetSync.js';
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

export function toTrollCase(text) {
  if (!text) return '';
  return text.split(' ').map(word => {
    const hasLorI = /[li]/i.test(word);
    
    let optALost = 0; // starts with lowercase
    let optBLost = 0; // starts with uppercase
    
    const chars = word.split('');
    let letterIndex = 0;
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      if (/[a-zA-Z]/.test(char)) {
        const isLorI = /[li]/i.test(char);
        if (isLorI) {
          if (letterIndex % 2 === 1) {
            optALost++; // Option A would capitalize this
          } else {
            optBLost++; // Option B would capitalize this
          }
        }
        letterIndex++;
      }
    }
    
    const startWithUpper = optBLost <= optALost;
    
    let currentLetterIdx = 0;
    return chars.map(char => {
      if (/[a-zA-Z]/.test(char)) {
        const isUpper = startWithUpper ? (currentLetterIdx % 2 === 0) : (currentLetterIdx % 2 === 1);
        currentLetterIdx++;
        
        if (/[li]/i.test(char)) {
          return char.toLowerCase();
        }
        
        return isUpper ? char.toUpperCase() : char.toLowerCase();
      }
      return char;
    }).join('');
  }).join(' ');
}

export function htmlToMarkdown(html) {
  if (!html) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  function serializeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      let childrenContent = '';
      node.childNodes.forEach(child => {
        childrenContent += serializeNode(child);
      });
      
      switch (tagName) {
        case 'strong':
        case 'b':
          return `**${childrenContent}**`;
        case 'em':
        case 'i':
          return `*${childrenContent}*`;
        case 'del':
        case 'strike':
        case 's':
          return `~~${childrenContent}~~`;
        case 'sub':
          return `$x_{${childrenContent}}$`;
        case 'sup':
          return `$x^{${childrenContent}}$`;
        case 'pre':
          if (node.classList.contains('latex-eq')) {
            return `$$\n${childrenContent}\n$$`;
          }
          return childrenContent;
        case 'br':
          return '\n';
        case 'div':
        case 'p':
          return `\n${childrenContent}`;
        default:
          return childrenContent;
      }
    }
    return '';
  }
  
  let markdown = '';
  doc.body.childNodes.forEach(node => {
    markdown += serializeNode(node);
  });
  
  return markdown.replace(/^\n+/, '').replace(/\n+$/, '');
}

export function markdownToHtml(md) {
  if (!md) return '';
  let html = md;
  // Escape HTML entities to prevent raw HTML execution while editing
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Strikethrough: ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Subscript: $x_{text}$
  html = html.replace(/\$x_\{([^}]+)\}\$/g, '<sub>$1</sub>');
  
  // Superscript: $x^{text}$
  html = html.replace(/\$x\^\{([^}]+)\}\$/g, '<sup>$1</sup>');
  
  // LaTeX Equation: $$equation$$
  html = html.replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, '<pre class="latex-eq">$1</pre>');

  // Newlines
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

function formatMessage(text, isEdited) {
  if (!text) return null;
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({node, ...props}) => <span {...props} />, 
          a: ({node, ...props}) => <a {...props} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
      {isEdited && <em className="text-[9px] opacity-40 ml-1.5 font-normal">(edited)</em>}
    </div>
  );
}


export function ChatView({ onClose, sfx }) {
  const isMobile = useMobile();
  const { userId, partnerId, roomId } = useAuth();
  const { globalState, broadcast: syncBroadcast, onlineUsers } = useSync();
  const { 
    messages: chatHistory, sendMessage: syncSendMessage, retrySendMessage, updateMessage: syncUpdateMessage, deleteMessage: syncDeleteMessage, clearChatHistory, loadMore: syncLoadMore, hasMore: syncHasMore, searchMessages, jumpToMessage, loadNewer, resetToLatest, changePin,
    isE2EEReady, showRestorePrompt, setShowRestorePrompt, handleRestore, restoreKeyInput, setRestoreKeyInput, restoreError, isRestoring, isDeriving,
    showPinSetupPrompt, setShowPinSetupPrompt, pinSetupStep, setPinSetupStep, pinSetupInput, setPinSetupInput, pinSetupConfirm, setPinSetupConfirm, pinWarningConfirmed, setPinWarningConfirmed, handleCreatePin, showResetConfirm, setShowResetConfirm,
    resetE2EEKeys
  } = useChat();
  const { addToast } = useToast();
  const { startCall } = useCall();
  const { uploadAsset } = useAssetSync(roomId);
  const [openReactMsgId, setOpenReactMsgId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [showFormatting, setShowFormatting] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  
  const searchInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed && textareaRef.current?.contains(sel.anchorNode)) {
        setShowFormatting(true);
      } else {
        setShowFormatting(false);
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  useEffect(() => {
    const lastFocused = sessionStorage.getItem('attic_last_focus');
    if (lastFocused === 'search' && searchInputRef.current) {
      searchInputRef.current.focus();
    } else if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

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

  // Formatting Toolbar State
  const applyFormatting = (command) => {
    document.execCommand(command, false, null);
    if (textareaRef.current) {
      textareaRef.current.focus();
      setInput(textareaRef.current.innerHTML);
    }
  };
  const [input, setInput] = useState(() => {
    try {
      const draft = localStorage.getItem(draftKey);
      return draft ? markdownToHtml(draft) : '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.innerHTML === '' && input) {
      textareaRef.current.innerHTML = input;
    }
  }, [input]);

  useEffect(() => {
    if (input) {
      localStorage.setItem(draftKey, htmlToMarkdown(input));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [input, draftKey]);

  const [showDetails, setShowDetails] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('media');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

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
  const [searchFilters, setSearchFilters] = useState({ byMe: false, byPartner: false, hasMedia: false });
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [viewerContext, setViewerContext] = useState({ items: [], index: 0, isOpen: false });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isWatchWinderOpen, setIsWatchWinderOpen] = useState(false);
  const [watchWinderInitialDate, setWatchWinderInitialDate] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const readMsgIdsRef = useRef(new Set());
  const [deleteTargetMessage, setDeleteTargetMessage] = useState(null);
  const [deletedForMeIds, setDeletedForMeIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`deleted_for_me_${roomId}`) || '[]');
    } catch {
      return [];
    }
  });

  const handleDeleteForMe = (msgId) => {
    const nextList = [...deletedForMeIds, msgId];
    setDeletedForMeIds(nextList);
    localStorage.setItem(`deleted_for_me_${roomId}`, JSON.stringify(nextList));
  };

  const [isWindowFocused, setIsWindowFocused] = useState(document.hasFocus());
  const [isNearBottom, setIsNearBottom] = useState(true);

  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (replyingTo || editingMsgId) {
      const focusTextarea = () => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      };
      focusTextarea();
      const t1 = setTimeout(focusTextarea, 50);
      const t2 = setTimeout(focusTextarea, 150);
      const t3 = setTimeout(focusTextarea, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [replyingTo, editingMsgId, activeOptions]);
  const longPressTimers = useRef({});

  const handleTouchStart = (msgId) => {
    if (longPressTimers.current[msgId]) {
      clearTimeout(longPressTimers.current[msgId]);
    }
    longPressTimers.current[msgId] = setTimeout(() => {
      playAudio('click', sfx);
      setActiveOptions(msgId);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = (msgId) => {
    if (longPressTimers.current[msgId]) {
      clearTimeout(longPressTimers.current[msgId]);
      delete longPressTimers.current[msgId];
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimers.current) {
        Object.values(longPressTimers.current).forEach(clearTimeout);
      }
    };
  }, []);

  // TYPING INDICATOR LOGIC

  const handleInputChange = (e) => {
    setInput(e.currentTarget.innerHTML);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    handleTyping();
  };

  const rawHistory = Array.isArray(chatHistory) ? chatHistory : [];
  const safeHistory = rawHistory.filter(m => !deletedForMeIds.includes(m.id));

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
        const html = markdownToHtml(last.text);
        setInput(html);
        if (textareaRef.current) {
          textareaRef.current.innerHTML = html;
        }
        e.preventDefault();
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(textareaRef.current);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }, 50);
      }
    }
    if (e.key === 'Escape') {
      setEditingMsgId(null);
      setInput('');
      setReplyingTo(null);
      if (textareaRef.current) {
        textareaRef.current.innerHTML = '';
        textareaRef.current.style.height = 'auto'; // Reset height
      }
    }
  };

  // Safe Mark-as-Read Effect
  useEffect(() => {
    if (!Array.isArray(chatHistory) || !isWindowFocused) return;
    if (!isNearBottom) return;

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
  }, [chatHistory, partnerId, isNormalized, syncUpdateMessage, isWindowFocused, isNearBottom]);

  // Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        const { data, hasMore } = await searchMessages(searchQuery, searchPage, 10, searchFilters);
        setSearchResults(data);
        setSearchHasMore(hasMore);
        setIsSearching(false);
      } else {
        setSearchResults([]);
        setSearchHasMore(false);
        setSearchPage(0);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchPage, searchFilters, searchMessages]);

  const handleJumpToMessage = async (msgId, createdAt) => {
    const loadedMsgs = await jumpToMessage(createdAt);
    setIsHistoricalView(true);
    
    let targetMsgId = msgId;
    if (!targetMsgId && createdAt && loadedMsgs && loadedMsgs.length > 0) {
      const targetTime = new Date(createdAt).getTime();
      let closest = loadedMsgs[0];
      let minDiff = Math.abs(new Date(closest.created_at).getTime() - targetTime);
      for (const m of loadedMsgs) {
        const diff = Math.abs(new Date(m.created_at).getTime() - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = m;
        }
      }
      targetMsgId = closest.id;
    }

    if (targetMsgId) {
      setHighlightedMessageId(targetMsgId);
    }

    if (window.innerWidth < 768) {
       setShowDetails(false); // Close sidebar on mobile
    }
    setTimeout(() => {
      if (targetMsgId) {
        const el = document.getElementById(`msg-${targetMsgId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }
      setTimeout(() => setHighlightedMessageId(null), 3000);
    }, 200);
  };

  const handleJumpToPresent = async () => {
    await resetToLatest();
    setIsHistoricalView(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleChatScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Load newer messages if near bottom and in historical view
    if (scrollHeight - scrollTop - clientHeight < 100 && isHistoricalView) {
      loadNewer();
    }

    // Auto-load older messages when scrolled near the top
    if (scrollTop < 50 && syncHasMore) {
      syncLoadMore();
      setViewLimit(p => p + 50);
    }

    const nearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setIsNearBottom(nearBottom);

    // Dial update based on which date we are in:
    if (isWatchWinderOpen) {
      const container = e.target;
      const containerRect = container.getBoundingClientRect();
      const targetY = containerRect.top + containerRect.height / 2;

      let closestMsg = null;
      let closestDiff = Infinity;

      const msgElements = container.querySelectorAll('[id^="msg-"]');
      for (const el of msgElements) {
        const rect = el.getBoundingClientRect();
        const msgCenterY = rect.top + rect.height / 2;
        const diff = Math.abs(msgCenterY - targetY);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestMsg = el;
        }
      }

      if (closestMsg) {
        const msgId = closestMsg.id.replace('msg-', '');
        const msgObj = safeHistory.find(m => String(m.id) === msgId);
        if (msgObj && msgObj.created_at) {
          const newDateStr = msgObj.created_at;
          const newDate = new Date(newDateStr);
          setWatchWinderInitialDate(prev => {
            if (!prev) return newDateStr;
            const prevDate = new Date(prev);
            if (prevDate.toDateString() !== newDate.toDateString()) {
              return newDateStr;
            }
            return prev;
          });
        }
      }
    }
  };

  const lastMessageId = chatHistory[chatHistory.length - 1]?.id;

  // Scroll to bottom on initial mount (entering the chat)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  // Scroll to bottom when a new message is added or loaded
  useEffect(() => {
    if (lastMessageId && !isHistoricalView) {
      if (!initialScrollDone) {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        setInitialScrollDone(true);
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [lastMessageId, isHistoricalView, initialScrollDone]);

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

  const handlePinChange = async (e) => {
    if (e) e.preventDefault();
    setPinChangeError('');
    if (newPin.length < 6) {
      setPinChangeError('PIN must be at least 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinChangeError('PINs do not match.');
      return;
    }
    setIsChangingPin(true);
    playAudio('click', sfx);
    try {
      const success = await changePin(newPin);
      if (success) {
        setNewPin('');
        setConfirmPin('');
      }
    } catch (err) {
      setPinChangeError('Failed to change PIN.');
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleStartCall = (type) => {
    playAudio('click', sfx);
    startCall(type);
    // Log as 'ringing' — CallContext will write the final 'ended' or 'missed' entry
    syncSendMessage(`${type === 'video' ? 'Video' : 'Voice'} Call`, 'call_invite', { status: 'ringing', callType: type });
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
    navigate(`/activities/${inviteMsg.gameId}`, { state: { autoJoin: true } });
  };

  const handleSend = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isInputDisabled) return;

    // Check if it's a special invite message passed as 'e'
    if (e && e._isInvite) {
      syncSendMessage(e.text, 'game_invite', { gameId: e.gameId, gameTitle: e.gameTitle, inviteStatus: 'pending' });
      return;
    }

    const markdownInput = htmlToMarkdown(input);
    if (!markdownInput.trim() && pendingFiles.length === 0 && voicePreview === null) return;
    playAudio('send', sfx);
    if (editingMsgId) {
      if (isNormalized) {
        syncUpdateMessage(editingMsgId, { text: markdownInput, isEdited: true });
      }
      setEditingMsgId(null);
    }
    else if (pendingFiles.length > 0) {
      if (isNormalized) {
        pendingFiles.forEach(item => {
          if (item.type === 'image' && item.data) {
            const blob = base64ToBlob(item.data);
            const file = new File([blob], `image_${Date.now()}.png`, { type: 'image/png' });
            syncSendMessage(file, 'image', { text: markdownInput.trim() });
          } else {
            syncSendMessage(item.file, item.type, { text: markdownInput.trim(), fileName: item.name });
          }
        });
        setPendingFiles([]);
      }
    }
    else {
      if (isNormalized) {
        syncSendMessage(markdownInput, 'text', { replyTo: replyingTo }).catch(err => {
          console.error("Failed to send message:", err);
        });
      }
    }
    setInput(''); setReplyingTo(null); setActiveOptions(null); setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.innerHTML = '';
      textareaRef.current.style.height = 'auto';
    }
    if (isHistoricalView) {
      handleJumpToPresent();
    }
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

  const getFileType = (file) => {
    const name = file.name.toLowerCase();
    const type = file.type || '';
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(name)) {
      return 'image';
    }
    if (type.startsWith('video/') || /\.(mp4|mkv|avi|webm|mov|flv|3gp|wmv)$/.test(name)) {
      return 'video';
    }
    if (type.startsWith('audio/') || /\.(mp3|aac|flac|wav|m4a|ogg)$/.test(name)) {
      return 'audio';
    }
    return 'file';
  };

  const handleFiles = async (files) => {
    if (files.length > 0) {
      for (const file of files) {
        const fileType = getFileType(file);
        if (fileType === 'image') {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const compressed = await compressImage(reader.result);
            setPendingFiles(prev => [...prev, { type: 'image', data: compressed, name: file.name, file }]);
          };
          reader.readAsDataURL(file);
        } else if (fileType === 'video') {
          setPendingFiles(prev => [...prev, { type: 'video', file, name: file.name }]);
        } else if (fileType === 'audio') {
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
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await uploadAsset(blob, 'scrapbook', userId);
      playAudio('click', sfx);
      alert("Saved to Scrapbook successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to save to Scrapbook: " + e.message);
    }
  };

  const isPng = (msg) => {
    const name = (msg.fileName || '').toLowerCase();
    const url = (msg.url || '').toLowerCase();
    return name.endsWith('.png') || url.includes('.png') || url.startsWith('data:image/png');
  };

  const getFileStyle = (fileName) => {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf':
        return { icon: FileText, color: 'text-danger bg-danger/10', label: 'PDF Document' };
      case 'docx':
      case 'doc':
      case 'txt':
        return { icon: FileText, color: 'text-secondary bg-secondary/10', label: 'Word Document' };
      case 'blend':
        return { icon: Zap, color: 'text-warning bg-warning/10', label: 'Blender 3D Scene' };
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return { icon: Paperclip, color: 'text-primary bg-primary/10', label: 'Archive Zip' };
      default:
        return { icon: FileText, color: 'text-main-text opacity-70 bg-black/5', label: 'File Attachment' };
    }
  };

  const renderMediaToolbar = (msg, isMe) => {
    const effectiveUrl = msg.url || msg.audioUrl;
    if (!effectiveUrl) return null;

    return (
      <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-dashed border-border/15 shrink-0 text-main-text/60 select-none">
        {/* Reactions inline picker */}
        <div className="relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setOpenReactMsgId(openReactMsgId === msg.id ? null : msg.id); }} 
            className="hover:text-primary transition-colors p-1 hover:bg-black/5 rounded flex items-center justify-center"
            title="React"
          >
            <Smile size={13} />
          </button>
          {openReactMsgId === msg.id && (
            <div className="absolute bottom-6 left-0 bg-window border-2 border-border p-1 flex gap-1 shadow-md z-[110] rounded-md animate-in slide-in-from-bottom-2 duration-100">
              {['❤️', '😂', '😢', '😮', '😡'].map(emoji => (
                <button 
                  key={emoji} 
                  onClick={(e) => {
                    e.stopPropagation();
                    const rs = msg.reactions || [];
                    syncUpdateMessage(msg.id, { reactions: rs.includes(emoji) ? rs.filter(e => e !== emoji) : [...rs, emoji] });
                    setOpenReactMsgId(null);
                  }} 
                  className={`text-sm p-1 hover:scale-130 active:scale-95 transition-transform ${msg.reactions?.includes(emoji) ? 'bg-accent/40 rounded' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Download */}
        <button 
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const res = await fetch(effectiveUrl);
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = msg.fileName || 'download';
              a.click();
              URL.revokeObjectURL(blobUrl);
            } catch (err) {
              window.open(effectiveUrl, '_blank');
            }
          }} 
          className="hover:text-primary transition-colors p-1 hover:bg-black/5 rounded flex items-center justify-center"
          title="Download"
        >
          <Download size={13} />
        </button>

        {/* Save to Scrapbook (for images) */}
        {msg.type === 'image' && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleSaveToScrapbook(effectiveUrl);
            }} 
            className="hover:text-primary transition-colors p-1 hover:bg-black/5 rounded flex items-center gap-1 text-[10px] font-black uppercase"
            title="Save to Album"
          >
            <ImageIcon size={13} /> <span className="hidden sm:inline">Album</span>
          </button>
        )}

        {/* Delete */}
        {isMe && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Delete this media message?")) {
                syncDeleteMessage(msg.id);
              }
            }} 
            className="hover:text-danger transition-colors p-1 hover:bg-black/5 rounded ml-auto flex items-center justify-center text-red-600"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  };

  const onEmojiClick = (emojiData) => { setInput(prev => prev + emojiData.emoji); };

  const mediaMessages = safeHistory.filter(m => (m.type === 'image' || m.type === 'image_group' || m.type === 'video') && !m.isDeleted);
  // Sort pinned messages by time (newest first)
  const pinnedMessages = safeHistory.filter(m => m.isPinned && !m.isDeleted).reverse();
  const callHistory = safeHistory.filter(m => m.type === 'call_invite');
  const headerActions = (
    <div className="flex gap-1.5">
      <button 
        onClick={() => { playAudio('click', sfx); setShowClearChatConfirm(true); }} 
        className="flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none bg-window text-red-600 hover:text-red-700" 
        title="Clear Chat History"
      >
        <Trash2 size={14} />
      </button>
      <button 
        onClick={() => handleStartCall('audio')} 
        className="flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none bg-window text-main-text" 
        title="Voice Call"
      >
        <Phone size={14} />
      </button>
      <button 
        onClick={() => handleStartCall('video')} 
        className="flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none bg-window text-main-text" 
        title="Video Call"
      >
        <Video size={14} />
      </button>
    </div>
  );

  const chatTitle = isMobile ? (
    <div 
      className="flex items-center gap-3 py-1 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity"
      onClick={() => {
        playAudio('click', sfx);
        setActiveSidebarTab('media');
        setShowDetails(true);
      }}
    >
      <div className="flex flex-col leading-none items-start justify-center">
        <span className="font-black text-sm truncate tracking-tight">{partnerNickname}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`w-2 h-2 rounded-full ${
            partnerStatusData?.status === 'active' ? 'bg-success' : 
            partnerStatusData?.status === 'idle' ? 'bg-warning' : 
            'bg-disabled'
          }`} />
          <span className="text-[7.5px] font-black opacity-60 uppercase tracking-widest">{partnerStatusLabel.substring(0, 18)}</span>
        </div>
      </div>
    </div>
  ) : (
    <span 
      className="cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity"
      onClick={() => {
        playAudio('click', sfx);
        setActiveSidebarTab('media');
        setShowDetails(true);
      }}
    >
      {partnerNickname} | {partnerStatusLabel.toLowerCase()}
    </span>
  );

  // Main chat history feed uses safeHistory directly to prevent typing filter side-effects

  const openViewer = (url, msgId) => {
    const gallery = safeHistory.filter(m => (m.type === 'image' || m.type === 'image_group' || m.type === 'video'))
      .flatMap(m => {
        if (m.type === 'image_group') {
          return m.urls.map((u, idx) => ({
            url: u,
            type: 'image',
            id: m.id,
            createdAt: m.created_at,
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
          createdAt: m.created_at,
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
          onJumpToMessage={(idx) => {
            const item = viewerContext.items[idx];
            if (item?.id) {
              handleJumpToMessage(item.id, item.createdAt);
              setViewerContext(p => ({ ...p, isOpen: false }));
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
        title={chatTitle}
        onClose={onClose}
        headerActions={headerActions}
        onTitleClick={() => { playAudio('click', sfx); setShowDetails(!showDetails) }}
        className={`w-full ${isMobile ? 'h-[100dvh] pb-[env(safe-area-inset-bottom)] max-h-none border-none shadow-none' : 'max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px]'} flex flex-col transition-all duration-300 relative`}
        noPadding
        sfx={sfx}
      >
        {isDragging && (
          <div className="absolute inset-0 z-[200] bg-primary/20 border-4 border-dashed border-primary flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300 pointer-events-none"
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
          <div className={`flex flex-col h-full transition-all duration-300 flex-1 ${showDetails ? 'hidden md:flex border-r-2 border-border' : 'w-full'}`}>
              <div
                className={`flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col relative chat-container`}
                onScroll={handleChatScroll}
              >
                {showPinSetupPrompt ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md retro-border p-6 shadow-xl bg-window animate-in fade-in duration-300">
                      {pinSetupStep === 'warning' ? (
                        <div className="flex flex-col gap-5 py-2 text-center">
                          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                            <AlertTriangle size={32} className="text-yellow-600 animate-pulse" />
                          </div>
                          <h1 className="text-xl font-black lowercase text-primary">Warning: Important Notice ⚠️</h1>
                          <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded text-left text-xs font-bold text-amber-800 space-y-2">
                            <p>If you forget your PIN, your message history cannot be recovered.</p>
                            <p>This cannot be undone.</p>
                          </div>
                          <p className="text-xs text-muted-text font-bold">
                            Attic uses true End-to-End Encryption. We do not store your PIN on our servers, meaning we cannot reset it or recover your chats.
                          </p>
                          
                          <label className="flex items-start gap-2 cursor-pointer group mt-2 text-left">
                            <input 
                              type="checkbox" 
                              checked={pinWarningConfirmed}
                              onChange={e => setPinWarningConfirmed(e.target.checked)}
                              className="w-4 h-4 mt-0.5 border-2 border-border accent-primary cursor-pointer"
                            />
                            <span className="text-xs font-bold text-muted-text group-hover:text-main-text lowercase">
                              I understand that my message history will be permanently lost if I forget my PIN.
                            </span>
                          </label>
          
                          <RetroButton 
                            onClick={() => setPinSetupStep('input')} 
                            disabled={!pinWarningConfirmed} 
                            className="w-full py-3 text-base mt-2"
                          >
                            Continue
                          </RetroButton>
                        </div>
                      ) : (
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!pinSetupInput || pinSetupInput.length < 6) {
                              addToast("PIN must be at least 6 digits.", "error");
                              return;
                            }
                            if (pinSetupInput !== pinSetupConfirm) {
                              addToast("PINs do not match.", "error");
                              return;
                            }
                            handleCreatePin(pinSetupInput);
                          }}
                          className="flex flex-col gap-5 py-2 text-center"
                        >
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Lock size={32} className="text-primary" />
                          </div>
                          <h1 className="text-xl font-black lowercase text-primary">Create Chat PIN 🔐</h1>
                          <p className="font-bold text-muted-text text-sm">
                            Choose a numeric PIN (min 6 digits) to secure your chat history. You will need to enter this PIN when logging in on new devices.
                          </p>
          
                          <RetroInput 
                            label="Enter Chat PIN"
                            icon={Key}
                            type="password"
                            pattern="[0-9]*"
                            inputMode="numeric"
                            placeholder="e.g. 123456"
                            value={pinSetupInput}
                            onChange={e => setPinSetupInput(e.target.value.replace(/\D/g, ''))}
                            required
                            autoFocus
                            disabled={isDeriving}
                          />
          
                          <RetroInput 
                            label="Confirm Chat PIN"
                            icon={Check}
                            type="password"
                            pattern="[0-9]*"
                            inputMode="numeric"
                            placeholder="e.g. 123456"
                            value={pinSetupConfirm}
                            onChange={e => setPinSetupConfirm(e.target.value.replace(/\D/g, ''))}
                            required
                            disabled={isDeriving}
                          />
          
                          <RetroButton type="submit" disabled={isDeriving || pinSetupInput.length < 6 || pinSetupInput !== pinSetupConfirm} className="w-full py-3 text-base">
                            {isDeriving ? (
                              <span className="flex items-center justify-center gap-2">
                                <Loader className="animate-spin" size={16} /> securing your keys...
                              </span>
                            ) : 'Create PIN'}
                          </RetroButton>
                        </form>
                      )}
                    </div>
                  </div>
                ) : showRestorePrompt ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md retro-border p-6 shadow-xl bg-window animate-in fade-in duration-300">
                      <form onSubmit={handleRestore} className="flex flex-col gap-5 py-2 text-center">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                          <Unlock size={32} className="text-primary" />
                        </div>
                        <h1 className="text-xl font-black lowercase text-primary">unlock chat history 🔒</h1>
                        <p className="font-bold text-muted-text text-sm">
                          We detected existing encrypted chats, but your encryption keys are not on this device. Enter your Chat PIN to unlock them.
                        </p>
          
                        <RetroInput 
                          label="Enter Chat PIN"
                          icon={Key}
                          type="password"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder="Enter your 6-digit PIN"
                          value={restoreKeyInput}
                          onChange={e => setRestoreKeyInput(e.target.value.replace(/\D/g, ''))}
                          error={restoreError}
                          required
                          autoFocus
                          disabled={isRestoring || isDeriving}
                        />
          
                        <RetroButton type="submit" disabled={isRestoring || isDeriving || !restoreKeyInput.trim()} className="w-full py-3 text-base">
                          {isDeriving ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader className="animate-spin" size={16} /> securing your keys...
                            </span>
                          ) : 'Unlock History'}
                        </RetroButton>
          
                        <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-border opacity-20"></div>
                          <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-muted-text uppercase tracking-widest">or</span>
                          <div className="flex-grow border-t border-border opacity-20"></div>
                        </div>
          
                        <div className="space-y-2 text-left">
                          <p className="text-xs font-bold text-muted-text text-center">Forgot your Chat PIN?</p>
                          <RetroButton 
                            onClick={() => setShowResetConfirm(true)} 
                            type="button"
                            variant="secondary" 
                            disabled={isRestoring || isDeriving}
                            className="w-full py-2.5 text-xs font-bold"
                          >
                            Reset Chat History
                          </RetroButton>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  <>
              <div className="flex flex-col items-center gap-1 mt-2 mb-6 w-full text-center select-none shrink-0">
                <div className="text-[10px] sm:text-xs font-bold opacity-50 text-main-text max-w-sm lowercase leading-relaxed">
                  this is the beginning of your private, secure retro room history with {partnerNickname}. say hello!
                </div>
                <div className="text-[10px] sm:text-xs font-bold opacity-50 text-main-text lowercase">
                  -- connection secured --
                </div>
              </div>
              {isHistoricalView && (
                <div className="sticky top-4 z-[100] flex justify-center mb-4">
                  <button onClick={handleJumpToPresent} className="bg-primary text-white px-4 py-2 rounded-full retro-border shadow-xl font-bold text-xs uppercase hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                    <History size={14} /> Jump to Present
                  </button>
                </div>
              )}
              {safeHistory.slice(-viewLimit).map((msg, index) => {
                const visibleMsgs = safeHistory.slice(-viewLimit);
                const prevMsg = visibleMsgs[index - 1];
                const nextMsg = visibleMsgs[index + 1];

                // TIME DIVIDER
                let showTimeDivider = false;
                let dividerText = '';
                if (msg.created_at) {
                  const currTime = new Date(msg.created_at);
                  if (prevMsg && prevMsg.created_at) {
                    const prevTime = new Date(prevMsg.created_at);
                    if (currTime.getTime() - prevTime.getTime() > 3600000 || currTime.getDate() !== prevTime.getDate()) {
                      showTimeDivider = true;
                    }
                  } else {
                    showTimeDivider = true;
                  }
                  if (showTimeDivider) {
                    dividerText = currTime.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  }
                }

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
                if (msg.type === 'system' && (!msg.text || !msg.text.trim())) return null;
                const isCallLog = msg.type === 'call_invite';
                const isPureEmoji = msg.type === 'text' && msg.text && /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/.test(msg.text.trim());
                const isPureImage = (msg.type === 'image' || msg.type === 'image_group') && !msg.text;
                const isGameInvite = msg.type === 'game_invite' || msg.type === 'watchparty_invite' || msg.type === 'watchparty_summary';
                const noBubble = (isPureEmoji || isPureImage) && !msg.isDeleted;
                const isHighlighted = highlightedMessageId === msg.id;
                const hasReplies = safeHistory.some(m => m.replyTo && m.replyTo.id === msg.id && !m.isDeleted);

                return (
                  <React.Fragment key={msg.id}>
                    {showTimeDivider && (
                      <div className="flex justify-center my-6 animate-in fade-in">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudio('click', sfx);
                            setWatchWinderInitialDate(msg.created_at);
                            setIsWatchWinderOpen(true);
                          }}
                          className="retro-date-divider-btn bg-window/50 hover:bg-accent hover:text-accent-text transition-colors duration-150 px-4 py-1 retro-border rounded-full shadow-sm text-[10px] font-black uppercase text-main-text/60 tracking-widest cursor-pointer select-none"
                          title="Wind back in time"
                        >
                          {dividerText}
                        </button>
                      </div>
                    )}
                    {msg.type === 'system' ? (
                      <div className="flex justify-center my-3 animate-in fade-in">
                        <div className="bg-primary/10 px-4 py-1.5 retro-border border-dashed rounded text-xs italic font-bold text-primary/80 text-center max-w-sm">
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <div className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'} ${marginClass} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
                    <div id={`msg-${msg.id}`} className={`flex items-end gap-2 max-w-[70%] relative transition-all duration-500 ${isHighlighted ? 'scale-105 brightness-110 z-30' : ''} ${isMe ? 'flex-row justify-end self-end ml-auto' : 'flex-row self-start'}`}>
                      {!msg.isDeleted && !isCallLog && !isMobile && (
                        <div className={`
                          absolute top-1/2 -translate-y-1/2 transition-all duration-300 z-20
                          ${isMe ? '-left-10 md:group-hover:left-[-45px]' : '-right-10 md:group-hover:right-[-45px]'}
                          opacity-0 md:group-hover:opacity-100
                        `}>
                          <button onClick={() => { playAudio('click', sfx); setActiveOptions(activeOptions === msg.id ? null : msg.id) }} className="options-trigger p-1.5 retro-border bg-window border-dashed text-main-text shadow-sm">
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      )}

                      {/* PFP / Avatar (Only for partner) */}
                      {!isMe && (
                        <div className="w-8 h-8 flex-shrink-0 flex items-end order-first">
                          {isGroupEnd ? (
                            senderPfp ? (
                              <img src={senderPfp} alt={senderName} className="w-8 h-8 retro-border object-cover bg-white rounded-none" />
                            ) : (
                              <div className="w-8 h-8 retro-border flex items-center justify-center text-[10px] rounded-none retro-bg-secondary">
                                {senderEmoji}
                              </div>
                            )
                          ) : <div className="w-8" />}
                        </div>
                      )}

                      <div
                        onTouchStart={() => isMobile && handleTouchStart(msg.id)}
                        onTouchEnd={() => isMobile && handleTouchEnd(msg.id)}
                        onTouchMove={() => isMobile && handleTouchEnd(msg.id)}
                        className={`
                          relative flex flex-col group/bubble
                          ${noBubble || isGameInvite ? 'p-0 bg-transparent' : 'p-2 sm:p-3.5 retro-border retro-shadow-dark'} 
                          ${msg.isDeleted ? 'bg-transparent border-dashed border-border/50 text-main-text/50 italic shadow-none' :
                            isCallLog ? 'bg-black/5 border-dashed italic shadow-none' :
                              isMe ? (noBubble ? '' : 'bg-primary text-[color:var(--text-on-primary)]') : (noBubble ? '' : 'bg-window text-main-text')}
                          ${isHighlighted ? 'ring-4 ring-accent ring-opacity-50 animate-pulse' : ''}
                          ${isMobile ? 'active:scale-[0.98] select-none' : ''} transition-all duration-100
                        `}
                      >
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
                          <div 
                            className="flex flex-col gap-1 px-1 py-0.5 select-none"
                            title={`Sent on ${msg.time}, Deleted on ${msg.metadata?.deletedAt || 'unknown'}`}
                          >
                            <span className="flex items-center gap-2 text-main-text/40 italic"><Ban size={12} /> message deleted</span>
                            <div className="flex items-center justify-end gap-1 opacity-45 text-[8px] font-bold uppercase tracking-tighter mt-1">
                              <span>Deleted {msg.metadata?.deletedAt || msg.time}</span>
                              <span className="flex -space-x-1.5 ml-1" title={msg.metadata?.wasReadBeforeDelete ? "Seen before deletion" : "Deleted before seen"}>
                                {msg.metadata?.wasReadBeforeDelete ? (
                                  <>
                                    <Check size={10} className="text-green-300 drop-shadow-md" />
                                    <Check size={10} className="text-green-300 drop-shadow-md" />
                                  </>
                                ) : (
                                  <Check size={10} className="opacity-70" />
                                )}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.type === 'text' && <span className={`${isPureEmoji ? 'text-4xl sm:text-5xl' : 'break-words whitespace-pre-wrap max-w-full-break block [word-break:break-word] overflow-hidden'}`}>{formatMessage(msg.text, msg.isEdited)}</span>}
                            {msg.type === 'voice' && (
                               <div className="flex flex-col gap-1 w-[240px] sm:w-[300px]">
                                 <VoiceMessagePlayer duration={msg.duration} audioUrl={msg.audioUrl} isMe={isMe} />
                                 {renderMediaToolbar({ ...msg, url: msg.audioUrl, fileName: `voice_note_${msg.id}.wav` }, isMe)}
                               </div>
                             )}
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
                                 {renderMediaToolbar(msg, isMe)}
                               </div>
                             )}
                             {msg.type === 'audio' && (
                               <div className="w-[240px] sm:w-[320px] max-w-full overflow-hidden flex flex-col gap-1">
                                 <RetroMediaPlayer
                                   url={msg.url}
                                   type="audio"
                                   autoPlay={false}
                                   fileName={msg.fileName}
                                   className="w-full retro-border bg-window/20"
                                 />
                                 <div className="mt-1 flex items-center justify-between px-1">
                                   <span className="text-[9px] font-black uppercase tracking-tighter opacity-40 flex items-center gap-1 truncate max-w-[70%]">
                                     <Music size={10} /> {msg.fileName || 'Audio Message'}
                                   </span>
                                 </div>
                                 {renderMediaToolbar(msg, isMe)}
                               </div>
                             )}
                             {msg.type === 'file' && (
                               <div className="flex flex-col gap-2 min-w-[220px]">
                                 {(() => {
                                   const fileStyle = getFileStyle(msg.fileName);
                                   const FileIcon = fileStyle.icon;
                                   return (
                                     <a href={msg.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-window retro-border hover:bg-accent/10 transition-all group no-underline text-main-text rounded-md">
                                       <div className={`p-2 rounded ${fileStyle.color} group-hover:scale-110 transition-transform`}>
                                         <FileIcon size={24} />
                                       </div>
                                       <div className="flex flex-col overflow-hidden">
                                         <span className="font-bold text-xs truncate w-32">{msg.fileName || 'Attachment'}</span>
                                         <span className="text-[9px] opacity-45 uppercase font-black">{msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : fileStyle.label}</span>
                                       </div>
                                       <Download size={16} className="ml-auto opacity-30 group-hover:opacity-100" />
                                     </a>
                                   );
                                 })()}
                                 {renderMediaToolbar(msg, isMe)}
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
                                  <span className="font-black text-[10px] uppercase tracking-widest text-secondary">Watchparty Invite</span>
                                </div>
                                <p className="text-xs font-bold mb-4 opacity-80">{msg.text || `Join me for a watch party!`}</p>
                                <button onClick={() => navigate('/watch')} className="w-full py-2 text-xs font-bold bg-secondary text-secondary-text retro-border retro-shadow-dark hover:brightness-110 transition-all">Join Now</button>
                                <div className="flex justify-between items-center mt-3 border-t border-border/10 pt-2 text-[9px] opacity-60 font-bold uppercase tracking-tighter">
                                  <span>{msg.time}</span>
                                  {isMe && msg.status && (
                                    <span>{msg.status === 'read' ? 'Seen' : 'Sent'}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {msg.type === 'watchparty_summary' && (
                              <div className="retro-border retro-shadow-dark bg-window p-3.5 w-72 text-main-text mt-1">
                                <div className="flex items-center gap-2 mb-3 border-b-2 border-border/20 pb-2">
                                  <Film size={18} className="text-primary" />
                                  <span className="font-black text-[10px] uppercase tracking-widest text-primary">Watch Party Summary</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <h4 className="text-[10px] font-black text-main-text/75 uppercase tracking-wide leading-none">🍿 Finished watching:</h4>
                                  <p className="text-xs font-bold text-primary break-words">{msg.metadata?.title || 'Unknown Video'}</p>
                                  
                                  <div className="bg-black/5 p-2.5 rounded border border-black/10 text-[10px] font-bold text-main-text flex flex-col gap-1.5 mt-1 shadow-inner">
                                    <div className="flex justify-between">
                                      <span className="opacity-80">💬 Reactions:</span>
                                      <span className="font-black text-primary">{msg.metadata?.msgCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="opacity-80">🔄 Sync plays:</span>
                                      <span className="font-black">{msg.metadata?.playCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="opacity-80">⏸ Sync pauses:</span>
                                      <span className="font-black">{msg.metadata?.pauseCount || 0}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center mt-3 border-t border-border/10 pt-2 text-[9px] opacity-60 font-bold uppercase tracking-tighter">
                                  <span>{msg.time}</span>
                                  {isMe && msg.status && (
                                    <span>{msg.status === 'read' ? 'Seen' : 'Sent'}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {msg.type === 'call_invite' && (
                              <div className="flex flex-col gap-1 py-1 min-w-[160px]">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 retro-border retro-shadow-dark flex-shrink-0 ${msg.status === 'missed' ? 'bg-[var(--color-destructive)] text-white' :
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
                                    <span className={`text-[11px] font-black uppercase tracking-widest leading-none mb-1 ${msg.status === 'missed' ? 'text-[var(--color-destructive)]' : ''
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
                                 <div className={`relative ${isPng(msg) ? 'bg-transparent-checkerboard' : 'bg-black/5'} rounded-md overflow-hidden`}>
                                   <SecureImage
                                     url={msg.url}
                                     alt=""
                                     onClick={() => openViewer(msg.url, msg.id)}
                                     className={`${isPureImage ? 'w-48 sm:w-64' : 'w-32 h-32 sm:w-48 sm:h-48'} object-contain retro-border cursor-pointer hover:brightness-95 transition-all`}
                                   />
                                 </div>
                                 {msg.text && <span className="italic text-xs opacity-80 break-words whitespace-pre-wrap max-w-full-break block">{msg.text}</span>}
                                 {renderMediaToolbar(msg, isMe)}
                               </div>
                             )}
                             {msg.type === 'image_group' && (
                               <div className="flex flex-col gap-2">
                                 <div className={`grid ${msg.urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-1 w-full max-w-xs`}>
                                   {msg.urls.map((u, i) => (
                                     <div key={i} className={`relative ${u.toLowerCase().endsWith('.png') || u.toLowerCase().includes('.png') ? 'bg-transparent-checkerboard' : 'bg-black/5'} rounded-md overflow-hidden`}>
                                       <SecureImage
                                         url={u}
                                         onClick={() => openViewer(u, msg.id)}
                                         className="aspect-square object-contain retro-border cursor-pointer hover:scale-[1.02] transition-transform"
                                       />
                                     </div>
                                   ))}
                                 </div>
                                 {msg.text && <span className="italic text-xs opacity-80 break-words">{msg.text}</span>}
                                 {renderMediaToolbar(msg, isMe)}
                               </div>
                             )}
                          </>
                        )}

                        {/* Thread/Replies indicator */}
                        {hasReplies && !msg.isDeleted && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              playAudio('click', sfx);
                              const replies = safeHistory.filter(m => m.replyTo && m.replyTo.id === msg.id && !m.isDeleted);
                              if (replies.length > 0) {
                                const firstEl = document.getElementById(`msg-${replies[0].id}`);
                                if (firstEl) {
                                  firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                                replies.forEach(r => {
                                  const el = document.getElementById(`msg-${r.id}`);
                                  if (el) {
                                    el.classList.add('animate-shake');
                                    el.classList.add('ring-4', 'ring-accent', 'ring-opacity-50');
                                    setTimeout(() => {
                                      el.classList.remove('animate-shake', 'ring-4', 'ring-accent', 'ring-opacity-50');
                                    }, 1500);
                                  }
                                });
                              }
                            }}
                            className={`flex items-center gap-1.5 mt-1.5 mb-1 cursor-pointer select-none hover:text-accent font-black text-[9px] uppercase tracking-tighter transition-colors ${
                              isMe ? 'justify-end text-primary-text/80' : 'justify-start text-main-text/60'
                            }`}
                            title="Show replies"
                          >
                            <Reply size={11} className="transform scale-x-[-1]" />
                            <span>
                              {safeHistory.filter(m => m.replyTo && m.replyTo.id === msg.id && !m.isDeleted).length} reply
                              {safeHistory.filter(m => m.replyTo && m.replyTo.id === msg.id && !m.isDeleted).length > 1 ? 'ies' : ''}
                            </span>
                          </div>
                        )}

                        {/* Inline Timestamp and Read Receipts */}
                        {!msg.isDeleted && !isCallLog && !noBubble && !isGameInvite && (
                          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end text-current' : 'justify-end text-main-text'} opacity-60 text-[9px] font-bold uppercase tracking-tighter`}>
                            <span>{msg.time}</span>
                            {isMe && msg.status && msg.status !== 'failed' && (
                              <span className="flex -space-x-1.5 ml-1">
                                <Check size={10} className={msg.status === 'read' ? 'text-green-300 drop-shadow-md' : 'opacity-70'} />
                                {(msg.status === 'delivered' || msg.status === 'read') && <Check size={10} className={msg.status === 'read' ? 'text-green-300 drop-shadow-md' : 'opacity-70'} />}
                              </span>
                            )}
                            {isMe && msg.status === 'failed' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playAudio('click', sfx);
                                  retrySendMessage(msg);
                                }}
                                className="ml-1.5 text-[var(--color-destructive)] hover:text-red-700 underline font-black cursor-pointer flex items-center gap-0.5 normal-case animate-pulse"
                                title="Click to retry"
                              >
                                ⚠️ retry
                              </button>
                            )}
                          </div>
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
                        <>
                          {isMobile && (
                            <div 
                              className="fixed inset-0 bg-black/45 z-[999]"
                              onClick={(e) => { e.stopPropagation(); setActiveOptions(null); }}
                            />
                          )}
                          <div className={`
                            message-options-menu absolute z-[1000] bg-window retro-border retro-shadow py-1.5 flex flex-col w-44 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-main-text rounded-md shadow-2xl border-2
                            ${isMobile ? 'left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 fixed border-4' : (isMe ? 'right-[calc(100%+12px)]' : 'left-[calc(100%+12px)]')}
                            ${!isMobile && isNearBottom ? 'bottom-0' : 'top-0'} 
                          `}>
                            <button onClick={() => {
                               setReplyingTo(msg);
                               setActiveOptions(null);
                               setTimeout(() => {
                                 if (textareaRef.current) {
                                   textareaRef.current.focus();
                                   const len = textareaRef.current.value.length;
                                   textareaRef.current.setSelectionRange(len, len);
                                 }
                               }, 50);
                             }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Reply size={14} className="text-[var(--color-cta)]" /> Reply</button>
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

                            {isMe && !msg.isDeleted && msg.type === 'text' && (
                              <button onClick={() => {
                                 setEditingMsgId(msg.id);
                                 setInput(msg.text);
                                 setActiveOptions(null);
                                 setTimeout(() => {
                                   if (textareaRef.current) {
                                     textareaRef.current.focus();
                                     const len = msg.text.length;
                                     textareaRef.current.setSelectionRange(len, len);
                                   }
                                 }, 50);
                               }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-accent hover:text-accent-text text-left transition-colors"><Edit2 size={14} className="text-green-600" /> Edit</button>
                            )}
                            {!msg.isDeleted && (
                              <button onClick={() => { setDeleteTargetMessage(msg); setActiveOptions(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-red-100 text-red-600 text-left transition-colors"><Trash2 size={14} /> Delete</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
              {isPartnerTyping && (
                <div className="flex items-center gap-2 mb-4 animate-in fade-in duration-300">
                  <div className="w-8 h-8 rounded-none bg-secondary border-2 border-border flex items-center justify-center text-sm">{partnerProfile.emoji || '☕'}</div>
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
                  </>
                )}
            </div>
            <div className="flex flex-col bg-accent text-accent-text border-t-2 border-border relative">
              {showEmojiPicker && (
                <div className={isMobile ? "fixed bottom-[80px] left-0 right-0 z-[9999] animate-in slide-in-from-bottom-2 flex justify-center px-4" : "absolute bottom-full left-0 z-[var(--z-overlay)] mb-2 animate-in slide-in-from-bottom-2"}>
                  <div className="retro-border retro-shadow-dark overflow-hidden max-w-full">
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
                          <button onClick={() => setPendingFiles(p => p.filter((_, idx) => idx !== i))} className="bg-[var(--color-destructive)] text-white p-1.5 retro-border hover:scale-110 transition-transform" title="Remove"><X size={12} /></button>
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
              {!(showPinSetupPrompt || showRestorePrompt) && (
              <form onSubmit={handleSend} className="flex gap-1.5 sm:gap-2 items-center p-1.5 sm:p-3 relative bg-window z-50">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />

                <div className="flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center retro-border bg-window text-main-text hover:brightness-110 transition-all shrink-0">
                    <Paperclip size={isMobile ? 15 : 20} />
                  </button>
                  <button type="button" onClick={() => { setShowEmojiPicker(!showEmojiPicker); }} className={`w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center retro-border transition-all shrink-0 ${showEmojiPicker ? 'bg-accent text-accent-text' : 'bg-window text-main-text hover:brightness-110'}`}>
                    <Smile size={isMobile ? 15 : 20} />
                  </button>
                </div>

                  {showFormatting && (
                  <div className="absolute -top-12 left-0 right-0 mx-auto w-max bg-window retro-border shadow-lg z-50 flex gap-1 p-1 animate-in fade-in zoom-in-95 duration-200" onMouseDown={(e) => e.preventDefault()}>
                    <button type="button" onClick={() => applyFormatting('bold')} className="w-8 h-8 flex items-center justify-center font-serif font-bold hover:bg-accent hover:text-accent-text transition-colors" title="Bold">B</button>
                    <button type="button" onClick={() => applyFormatting('italic')} className="w-8 h-8 flex items-center justify-center font-serif italic hover:bg-accent hover:text-accent-text transition-colors" title="Italic">I</button>
                    <button type="button" onClick={() => applyFormatting('strikeThrough')} className="w-8 h-8 flex items-center justify-center font-serif line-through hover:bg-accent hover:text-accent-text transition-colors" title="Strikethrough">S</button>
                    <button type="button" onClick={() => applyFormatting('subscript')} className="w-8 h-8 flex items-center justify-center font-serif text-[10px] hover:bg-accent hover:text-accent-text transition-colors" title="Subscript">x₂</button>
                    <button type="button" onClick={() => applyFormatting('superscript')} className="w-8 h-8 flex items-center justify-center font-serif text-[10px] hover:bg-accent hover:text-accent-text transition-colors" title="Superscript">x²</button>
                    <div className="w-px bg-border mx-1 my-1"></div>
                    <button type="button" onClick={() => {
                      const sel = window.getSelection();
                      if (!sel.rangeCount) return;
                      const text = sel.toString();
                      if (!text) return;
                      document.execCommand('insertText', false, text.toUpperCase());
                    }} className="w-8 h-8 flex items-center justify-center font-bold text-[10px] hover:bg-accent hover:text-accent-text transition-colors" title="Uppercase">AA</button>
                    <button type="button" onClick={() => {
                      const sel = window.getSelection();
                      if (!sel.rangeCount) return;
                      const text = sel.toString();
                      if (!text) return;
                      document.execCommand('insertText', false, text.toLowerCase());
                    }} className="w-8 h-8 flex items-center justify-center font-bold text-[10px] hover:bg-accent hover:text-accent-text transition-colors" title="Lowercase">aa</button>
                    <button type="button" onClick={() => {
                      const sel = window.getSelection();
                      if (!sel.rangeCount) return;
                      const text = sel.toString();
                      if (!text) return;
                      document.execCommand('insertText', false, toTrollCase(text));
                    }} className="w-8 h-8 flex items-center justify-center font-bold text-[10px] hover:bg-accent hover:text-accent-text transition-colors" title="Trollcase">tRoLl</button>
                  </div>
                  )}

                <div className="flex-1 relative flex items-center bg-window retro-inset overflow-hidden min-h-[34px] sm:min-h-[44px]">
                  <div
                    contentEditable={!isRecording && voicePreview === null && !isInputDisabled}
                    ref={textareaRef}
                    onInput={handleInputChange}
                    onBlur={() => {
                       sessionStorage.setItem('attic_last_focus', 'chat');
                    }}
                    onKeyDown={handleKeyDown}
                    data-placeholder={pendingFiles.length > 0 ? "Add a caption..." : "type a message..."}
                    suppressContentEditableWarning={true}
                    className={`w-full p-1.5 sm:p-2.5 focus:outline-none font-bold placeholder:font-normal text-xs sm:text-base chat-input-textarea resize-none overflow-y-auto text-main-text self-center empty:before:content-[attr(data-placeholder)] empty:before:opacity-50 empty:before:pointer-events-none empty:before:font-normal ${isInputDisabled ? 'bg-[var(--bg-disabled)] text-[var(--text-disabled)] opacity-50 cursor-not-allowed' : (isRecording ? 'text-[var(--color-danger)] animate-pulse bg-[var(--color-danger)]/15' : 'bg-transparent')}`}
                    style={{ minHeight: isMobile ? '34px' : '44px', maxHeight: '120px' }}
                  />
                </div>
                <div className="flex shrink-0">
                  {!input.trim() && !editingMsgId && voicePreview === null && pendingFiles.length === 0 ? (
                    <button type="button" disabled={isInputDisabled} onMouseDown={handleMicDown} onMouseUp={handleMicUp} onMouseLeave={handleMicUp} onTouchStart={handleMicDown} onTouchEnd={handleMicUp} className={`w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center retro-outset transition-all flex-shrink-0 select-none ${isInputDisabled ? 'opacity-50 cursor-not-allowed bg-[var(--bg-disabled)] text-[var(--text-disabled)]' : (isRecording ? 'bg-[var(--color-danger)] text-[var(--text-on-danger)] shadow-none translate-y-[2px]' : 'bg-window text-main-text hover:brightness-110')}`}>
                      <RetroIcon icon={Mic} size={isMobile ? 15 : 20} className={isRecording ? 'animate-bounce' : ''} />
                    </button>
                  ) : (
                    <button type="submit" disabled={isInputDisabled} className={`w-[34px] h-[34px] sm:w-[44px] sm:h-[44px] flex items-center justify-center flex-shrink-0 transition-all ${isInputDisabled ? 'opacity-50 cursor-not-allowed bg-[var(--bg-disabled)] text-[var(--text-disabled)]' : 'bg-primary text-primary-text retro-outset hover:brightness-110'}`}>
                      <RetroIcon icon={Send} size={isMobile ? 15 : 20} />
                    </button>
                  )}
                </div>
              </form>
              )}
            </div>
          </div>
          {showDetails && (
            <div className="flex flex-col w-full md:w-80 shrink-0 bg-main overflow-hidden relative border-l-2 border-border h-full">
              <div className="p-2 flex gap-1 bg-border shrink-0 overflow-x-auto whitespace-nowrap">
                <button onClick={() => setActiveSidebarTab('media')} className={`flex-1 py-1.5 px-2.5 text-[9px] font-black uppercase retro-border transition-all flex items-center justify-center gap-1 ${activeSidebarTab === 'media' ? 'bg-window text-main-text shadow-inner' : 'bg-window/10 text-white/40 hover:bg-window/20 hover:text-white/70'}`}>
                  <ImageIcon size={10} /> Media
                </button>
                <button onClick={() => setActiveSidebarTab('calls')} className={`flex-1 py-1.5 px-2.5 text-[9px] font-black uppercase retro-border transition-all flex items-center justify-center gap-1 ${activeSidebarTab === 'calls' ? 'bg-window text-main-text shadow-inner' : 'bg-window/10 text-white/40 hover:bg-window/20 hover:text-white/70'}`}>
                  <History size={10} /> Calls
                </button>
                <button onClick={() => setActiveSidebarTab('search')} className={`flex-1 py-1.5 px-2.5 text-[9px] font-black uppercase retro-border transition-all flex items-center justify-center gap-1 ${activeSidebarTab === 'search' ? 'bg-window text-main-text shadow-inner' : 'bg-window/10 text-white/40 hover:bg-window/20 hover:text-white/70'}`}>
                  <Search size={10} /> Search
                </button>
                <button onClick={() => setActiveSidebarTab('settings')} className={`flex-1 py-1.5 px-2.5 text-[9px] font-black uppercase retro-border transition-all flex items-center justify-center gap-1 ${activeSidebarTab === 'settings' ? 'bg-window text-main-text shadow-inner' : 'bg-window/10 text-white/40 hover:bg-window/20 hover:text-white/70'}`}>
                  <Settings size={10} /> Settings
                </button>
              </div>
              <div className="p-4 flex-1 overflow-hidden flex flex-col min-h-0">

                {activeSidebarTab === 'search' && (
                  <div className="text-main-text flex flex-col h-full min-h-0">
                    <div className="shrink-0 mb-3">
                      <div className="flex bg-window retro-inset p-2">
                        <input
                          type="text"
                          ref={searchInputRef}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => sessionStorage.setItem('attic_last_focus', 'search')}
                          placeholder="Search..."
                          className="bg-transparent outline-none w-full text-xs font-black placeholder:font-normal uppercase"
                        />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="ml-2 hover:scale-110 transition-transform"><RetroIcon icon={X} size={14} className="opacity-50" /></button>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                         <button onClick={() => setSearchFilters(p => ({...p, byMe: !p.byMe}))} className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 retro-border transition-colors ${searchFilters.byMe ? 'bg-accent text-accent-text' : 'bg-window hover:bg-accent hover:text-accent-text'}`}>By Me</button>
                         <button onClick={() => setSearchFilters(p => ({...p, byPartner: !p.byPartner}))} className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 retro-border transition-colors ${searchFilters.byPartner ? 'bg-accent text-accent-text' : 'bg-window hover:bg-accent hover:text-accent-text'}`}>By Partner</button>
                         <button onClick={() => setSearchFilters(p => ({...p, hasMedia: !p.hasMedia}))} className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 retro-border transition-colors ${searchFilters.hasMedia ? 'bg-accent text-accent-text' : 'bg-window hover:bg-accent hover:text-accent-text'}`}>Has Media</button>
                      </div>
                    </div>
                    {searchQuery && (
                      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 min-h-0">
                        {isSearching ? (
                          <p className="text-xs font-bold opacity-50 animate-pulse text-center p-4">Searching archives...</p>
                        ) : searchResults.length === 0 ? (
                          <p className="text-xs font-bold opacity-50 text-center p-4">No results found.</p>
                        ) : (
                          <>
                            <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mb-1">
                              Page {searchPage + 1}
                            </p>
                            {searchResults.map(m => (
                              <div
                                key={m.id}
                                onClick={() => handleJumpToMessage(m.id, m.created_at)}
                                className="bg-window retro-outset p-3 cursor-pointer hover:bg-accent hover:text-accent-text transition-all group/res active:translate-y-[2px]"
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-black uppercase text-primary">{m.sender === userId ? 'You' : (m.senderName || partnerNickname || 'Partner')}</span>
                                  <span className="text-[9px] opacity-40 font-bold">{m.time}</span>
                                </div>
                                <p className="text-xs font-bold line-clamp-2 leading-relaxed">{m.text || '📸 Media / Attachment'}</p>
                              </div>
                            ))}
                            <div className="flex justify-between items-center mt-2 pt-2 border-t-2 border-border shrink-0 mb-2">
                              <button
                                disabled={searchPage === 0}
                                onClick={() => setSearchPage(p => p - 1)}
                                className={`px-3 py-1.5 retro-border text-[10px] font-black uppercase ${searchPage === 0 ? 'opacity-50 cursor-not-allowed bg-window/50' : 'bg-window hover:bg-accent hover:text-accent-text'}`}
                              >
                                Prev
                              </button>
                              <button
                                disabled={!searchHasMore}
                                onClick={() => setSearchPage(p => p + 1)}
                                className={`px-3 py-1.5 retro-border text-[10px] font-black uppercase ${!searchHasMore ? 'opacity-50 cursor-not-allowed bg-window/50' : 'bg-window hover:bg-accent hover:text-accent-text'}`}
                              >
                                Next
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeSidebarTab === 'media' && (
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 min-h-0">
                    <div>
                      <h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={Pin} size={16} /> Pinned</h3>
                      <div className="flex flex-col gap-2">
                        {pinnedMessages.length === 0 ? (
                          <p className="text-sm opacity-50">No pinned messages.</p>
                        ) : (
                          pinnedMessages.map(m => (
                            <div key={m.id} className="bg-window p-2 text-sm retro-outset border-l-4 border-l-accent">
                              <p className="font-bold opacity-70 text-xs mb-1">{m.sender === userId ? 'You' : (m.senderName || partnerNickname || 'Partner')}</p>
                              <p className="truncate">{m.text || 'Attachment/Voice'}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={ImageIcon} size={16} /> Media Grid</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {mediaMessages.length === 0 ? (
                          <p className="text-sm opacity-50 col-span-2">No media shared yet.</p>
                        ) : (
                          mediaMessages.map(m => {
                            if (m.type === 'video') {
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => openViewer(m.url, m.id)}
                                  className="aspect-square retro-outset bg-black cursor-pointer hover:opacity-80 transition-opacity relative overflow-hidden flex items-center justify-center"
                                >
                                  <video src={m.url} className="w-full h-full object-cover pointer-events-none" muted />
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <Video size={16} className="text-white drop-shadow-md" />
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={m.id}
                                onClick={() => openViewer(m.type === 'image_group' ? m.urls[0] : m.url, m.id)}
                                className="aspect-square retro-outset bg-cover bg-center cursor-pointer hover:opacity-80 transition-opacity"
                                style={{ backgroundImage: `url(${m.type === 'image_group' ? m.urls[0] : m.url})` }}
                              ></div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeSidebarTab === 'calls' && (
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 min-h-0">
                    <div>
                      <h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2"><RetroIcon icon={History} size={16} /> Call History</h3>
                      <div className="flex flex-col gap-2">
                        {callHistory.length === 0 ? (
                          <p className="text-sm opacity-50">No call history.</p>
                        ) : (
                          callHistory.reverse().map(m => (
                            <div key={m.id} className="bg-window p-3 text-xs retro-outset flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {m.callType === 'video' ? <RetroIcon icon={Video} size={14} className="text-secondary" /> : <RetroIcon icon={Phone} size={14} className="text-primary" />}
                                <div>
                                  <p className="font-bold">{m.sender === userId ? 'Outgoing' : 'Incoming'}</p>
                                  <p className="opacity-50">{m.time}</p>
                                </div>
                              </div>
                              <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 retro-outset ${m.status === 'accepted' || m.status === 'ended' ? 'bg-green-100 text-green-700' : m.status === 'missed' || m.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {m.status === 'sent' || !m.status ? 'Outgoing' : m.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeSidebarTab === 'settings' && (
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6 min-h-0 text-main-text">
                    <div>
                      <h3 className="font-bold border-b-2 border-border pb-2 mb-4 flex items-center gap-2">
                        <RetroIcon icon={Settings} size={16} /> Chat Settings
                      </h3>
                      <form onSubmit={handlePinChange} className="flex flex-col gap-4 bg-window p-3 retro-outset">
                        <div className="flex items-center gap-2 mb-1 border-b border-border border-dashed pb-2">
                          <Lock size={14} className="text-primary flex-shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Change Chat PIN</span>
                        </div>
                        <p className="text-[10px] font-bold opacity-60 leading-relaxed">
                          Update the 6-digit numeric PIN used to secure E2EE chat history on your devices.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider opacity-60">New PIN</label>
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={newPin}
                              onChange={(e) => {
                                setNewPin(e.target.value.replace(/\D/g, ''));
                                setPinChangeError('');
                              }}
                              placeholder="6-digit PIN"
                              className="w-full bg-window text-main-text font-black text-center tracking-[0.2em] border-2 border-border px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider opacity-60">Confirm New PIN</label>
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={confirmPin}
                              onChange={(e) => {
                                setConfirmPin(e.target.value.replace(/\D/g, ''));
                                setPinChangeError('');
                              }}
                              placeholder="Confirm PIN"
                              className="w-full bg-window text-main-text font-black text-center tracking-[0.2em] border-2 border-border px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
                              required
                            />
                          </div>
                        </div>

                        {pinChangeError && (
                          <p className="text-red-600 text-[10px] font-black text-center">{pinChangeError}</p>
                        )}

                        <RetroButton 
                          type="submit" 
                          disabled={isChangingPin || newPin.length < 6 || confirmPin.length < 6}
                          className="w-full py-2 text-xs font-black"
                        >
                          {isChangingPin ? 'Updating...' : 'Update PIN'}
                        </RetroButton>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {isWatchWinderOpen && (
          <PocketWatchWinder
            initialDate={watchWinderInitialDate}
            roomId={roomId}
            sfx={sfx}
            onClose={() => setIsWatchWinderOpen(false)}
            onJumpToDate={async (date) => {
              setIsWatchWinderOpen(false);
              if (date) {
                setWatchWinderInitialDate(date.toISOString());
                await handleJumpToMessage(null, date.toISOString());
              }
            }}
          />
        )}
      </RetroWindow>

      {deleteTargetMessage && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/35 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <RetroWindow 
            title="delete_message.exe" 
            onClose={() => setDeleteTargetMessage(null)} 
            className="w-full max-w-[280px]"
          >
            <div className="flex flex-col gap-4">
              <p className="font-bold text-xs">
                {deleteTargetMessage.sender === userId 
                  ? "Would you like to delete this message for everyone or just for you?" 
                  : "This will only delete the message from your end. Your partner will still be able to see it."}
              </p>
              {deleteTargetMessage.sender === userId && (
                <p className="text-[10px] opacity-75 font-medium leading-relaxed">
                  Deleting for everyone will replace this message with a "message deleted" placeholder. Deleting for you will remove it from your screen.
                </p>
              )}
              <div className="flex flex-col gap-2 mt-2">
                {deleteTargetMessage.sender === userId && (
                  <RetroButton 
                    variant="primary" 
                    onClick={() => {
                      playAudio('click', sfx);
                      syncUpdateMessage(deleteTargetMessage.id, { 
                        isDeleted: true, 
                        text: 'message deleted',
                        metadata: {
                          ...deleteTargetMessage.metadata,
                          deletedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          wasReadBeforeDelete: deleteTargetMessage.status === 'read'
                        }
                      });
                      setDeleteTargetMessage(null);
                    }}
                    className="w-full py-2 font-black uppercase text-xs text-white"
                  >
                    Delete for Everyone
                  </RetroButton>
                )}
                <RetroButton 
                  variant="white" 
                  onClick={() => {
                    playAudio('click', sfx);
                    handleDeleteForMe(deleteTargetMessage.id);
                    setDeleteTargetMessage(null);
                  }}
                  className="w-full py-2 font-black uppercase text-xs"
                >
                  Delete for Me
                </RetroButton>
              </div>
            </div>
          </RetroWindow>
        </div>
      )}
      {/* Confirm Reset Dialog */}
      {showResetConfirm && (
        <ConfirmDialog
          title="Reset encryption keys?"
          message="WARNING: Resetting your keys will prompt you to set a new Chat PIN, but all past encrypted messages will become permanently unreadable. This action cannot be undone."
          showCancel={true}
          onConfirm={resetE2EEKeys}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
      {/* Confirm Clear Chat Dialog */}
      {showClearChatConfirm && (
        <ConfirmDialog
          title="Delete Chat History?"
          message="Are you sure you want to delete all messages in this chat? This will permanently delete the chat history for both you and your partner. This action cannot be undone."
          showCancel={true}
          onConfirm={async () => {
            playAudio('click', sfx);
            await clearChatHistory();
            setShowClearChatConfirm(false);
          }}
          onCancel={() => {
            playAudio('click', sfx);
            setShowClearChatConfirm(false);
          }}
        />
      )}
    </>
  );
}
