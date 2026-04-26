import React, { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Peer from 'peerjs';
import { Loader, Phone, Video, PhoneOff, MicOff, Mic, Volume2, VolumeX, Maximize2, Minimize2, VideoOff, Camera } from 'lucide-react';
import { WeatherOverlay, Confetti, ToastProvider, ConfirmDialog, useToast } from './components/UI.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useUserContext } from './hooks/useUserContext.js';
import { playAudio } from './utils/audio.js';
import { INITIAL_CHAT } from './constants/data.js';
import { StrayTray } from './components/LofiPlayer.jsx';

import { LandingView, AuthView, HandshakeView } from './views/Onboarding.jsx';
import { LegalView } from './views/LegalView.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { useGlobalSync, initializeRoomSync } from './hooks/useSupabaseSync.js';
import { useChatSync } from './hooks/useChatSync.js';
import { useAssetSync } from './hooks/useAssetSync.js';
import { supabase } from './lib/supabase.js';
import { isTestMode } from './lib/testMode.js';

// Lazy load heavy views
const ChatView = lazy(() => import('./views/ChatView.jsx').then(m => ({ default: m.ChatView })));
const SettingsView = lazy(() => import('./views/SettingsView.jsx').then(m => ({ default: m.SettingsView })));
const DoodleApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.DoodleApp })));
const PersistentDoodleApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.PersistentDoodleApp })));
const TimeCapsuleApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.TimeCapsuleApp })));
const ListsApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.ListsApp })));
const CalendarApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.CalendarApp })));
const ScrapbookApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.ScrapbookApp })));
const PixelArtApp = lazy(() => import('./apps/PixelArtApp.jsx').then(m => ({ default: m.PixelArtApp })));
const DreamJournal = lazy(() => import('./apps/DreamJournal.jsx').then(m => ({ default: m.DreamJournal })));
const DailyQuestion = lazy(() => import('./components/Features.jsx').then(m => ({ default: m.DailyQuestion })));
const MilestoneCelebration = lazy(() => import('./components/Features.jsx').then(m => ({ default: m.MilestoneCelebration })));
const RelationshipResume = lazy(() => import('./components/Features.jsx').then(m => ({ default: m.RelationshipResume })));
const ActivitiesHub = lazy(() => import('./games/index.jsx').then(m => ({ default: m.ActivitiesHub })));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView.jsx').then(m => ({ default: m.ResetPasswordView })));
const DoodleViewer = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.DoodleViewer })));

const ProtectedRoute = lazy(() => import('./components/AuthGuards.jsx').then(m => ({ default: m.ProtectedRoute })));
const PublicRoute = lazy(() => import('./components/AuthGuards.jsx').then(m => ({ default: m.PublicRoute })));

// Loading Fallback Component
const AppLoader = () => (
  <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
    <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-4" />
    <p className="font-bold text-[10px] opacity-40 tracking-widest uppercase animate-pulse">Loading View...</p>
  </div>
);

/* ═══════════════════════════════════════════════════════
   PREMIUM FLOATING CALL HUB (Discord-Robust)
   ═══════════════════════════════════════════════════════ */
function PremiumCallHub({ calling, callDuration, isMuted, isDeafened, isCameraOff, onMicToggle, onDeafenToggle, onCameraToggle, onEndCall, partnerName, partnerPfp, sfx, remoteVideoRef, isRinging, type }) {
  const [position, setPosition] = useState({ x: window.innerWidth > 640 ? window.innerWidth - 420 : 10, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const handleStart = (clientX, clientY) => {
    setIsDragging(true);
    setDragOffset({ x: clientX - position.x, y: clientY - position.y });
  };
  const handleMove = (clientX, clientY) => {
    if (!isDragging) return;
    setPosition({ x: clientX - dragOffset.x, y: clientY - dragOffset.y });
  };
  const handleEnd = () => setIsDragging(false);

  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset]);

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;

  return (
    <div
      className={`fixed z-[5000] retro-bg-window retro-border transition-all duration-500 ease-in-out ${isMinimized ? 'w-56 h-12 overflow-hidden' : 'w-[90vw] sm:w-[400px] shadow-lg'} animate-in zoom-in-95 fade-in`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseDown={(e) => { if (!e.target.closest('button')) handleStart(e.clientX, e.clientY); }}
      onTouchStart={(e) => { if (!e.target.closest('button')) handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
    >
      <div className={`px-4 py-2 flex justify-between items-center font-bold text-[10px] sm:text-xs select-none ${isMinimized ? 'bg-[var(--primary)] text-white' : 'bg-[var(--border)] text-white'}`}>
        <span className="flex items-center gap-2 truncate">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          {type === 'video' ? <Video size={14} className="text-pink-300"/> : <Phone size={14} className="text-cyan-300"/>}
          <span className="opacity-90">{type === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}</span>
          <span className="opacity-50">|</span>
          <span className="truncate">{partnerName}</span>
          {!isMinimized && <span className="opacity-70 ml-2">{isRinging ? '...' : `${mins}:${secs.toString().padStart(2, '0')}`}</span>}
        </span>
        <div className="flex gap-3">
          <button onClick={() => { playAudio('click', sfx); setIsMinimized(!isMinimized); }} className="hover:scale-110 transition-transform">
            {isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
          </button>
          <button onClick={onEndCall} className="text-red-300 hover:text-red-500 transition-colors"><PhoneOff size={14}/></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col bg-black/5">
          <div className={`w-full aspect-video bg-black relative overflow-hidden flex items-center justify-center`}>
            {isRinging ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 retro-border flex items-center justify-center animate-pulse shadow-[0_0_40px_var(--secondary)] overflow-hidden">
                   {partnerPfp ? <img src={partnerPfp} alt="" className="w-full h-full object-cover" /> : (type === 'video' ? <Video size={40} className="text-white"/> : <Phone size={40} className="text-white"/>)}
                </div>
                <div className="text-white font-black text-[10px] uppercase tracking-[0.2em] animate-bounce">Ringing {partnerName}...</div>
              </div>
            ) : (
              <>
                {type === 'video' && !isDeafened && !isCameraOff ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover animate-in fade-in duration-1000" />
                ) : (
                  <div className="flex flex-col items-center gap-4 group">
                    <div className="w-24 h-24 retro-bg-accent retro-border flex items-center justify-center transition-transform group-hover:scale-105 duration-500">
                       {type === 'video' ? <VideoOff size={40} className="text-white/80" /> : <Phone size={40} className="text-white/80" />}
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">{partnerName}</p>
                        <p className="text-[9px] font-bold text-white/20 uppercase mt-1 italic">{type === 'video' ? (isCameraOff ? 'Camera Off' : 'Connecting...') : 'Voice Only'}</p>
                    </div>
                  </div>
                )}
              </>
            )}
            {!isRinging && <div className="absolute top-3 right-3 bg-black/60 px-2 py-1 rounded retro-border text-[8px] text-white font-bold uppercase backdrop-blur-sm border-white/20">LIVE • REMOTE</div>}
            
            <div className="absolute bottom-3 left-3 flex gap-2">
                 {isMuted && <div className="bg-red-500/80 backdrop-blur-sm p-1.5 rounded-full retro-border text-white shadow-lg"><MicOff size={10}/></div>}
                 {isDeafened && <div className="bg-red-500/80 backdrop-blur-sm p-1.5 rounded-full retro-border text-white shadow-lg"><VolumeX size={10}/></div>}
            </div>
          </div>

          <div className="p-4 grid grid-cols-4 gap-3 bg-[var(--bg-window)] border-t-2 retro-border">
            <button onClick={onMicToggle} className={`flex flex-col items-center justify-center p-3 retro-border transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] ${isMuted ? 'bg-red-500 text-white' : 'retro-bg-accent hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]'}`}>
              {isMuted ? <MicOff size={20}/> : <Mic size={20}/>}
              <span className="text-[8px] font-black mt-1.5 uppercase tracking-tighter">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button onClick={onDeafenToggle} className={`flex flex-col items-center justify-center p-3 retro-border transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] ${isDeafened ? 'bg-red-500 text-white' : 'retro-bg-secondary hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]'}`}>
              {isDeafened ? <VolumeX size={20}/> : <Volume2 size={20}/>}
              <span className="text-[8px] font-black mt-1.5 uppercase tracking-tighter">{isDeafened ? 'Hear' : 'Deafen'}</span>
            </button>
            <button onClick={onCameraToggle} className={`flex flex-col items-center justify-center p-3 retro-border transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] ${isCameraOff ? 'bg-red-500 text-white' : 'retro-bg-primary hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]'}`}>
              {isCameraOff ? <VideoOff size={20}/> : <Camera size={20}/>}
              <span className="text-[8px] font-black mt-1.5 uppercase tracking-tighter">Cam</span>
            </button>
            <button onClick={onEndCall} className="flex flex-col items-center justify-center p-3 retro-border bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]">
              <PhoneOff size={20} className="rotate-[135deg]"/>
              <span className="text-[8px] font-black mt-1.5 uppercase tracking-tighter">End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Living Background Component ── */
function LivingBackground({ weather }) {
  const [elements, setElements] = useState([]);

  useEffect(() => {
    setElements([]);
    const timer = setTimeout(() => {
      const newElements = [];
      const count = weather === 'rain' ? 30 : weather === 'storm' ? 45 : weather === 'snow' ? 20 : weather === 'clouds' ? 4 : weather === 'clear' ? 15 : 0;
      
      for (let i = 0; i < count; i++) {
        if (weather === 'rain') {
          newElements.push({ id: i, type: 'rain', left: Math.random() * 100, delay: Math.random() * 2, duration: 0.5 + Math.random() * 0.5 });
        } else if (weather === 'storm') {
          newElements.push({ id: i, type: 'storm', left: Math.random() * 120, delay: Math.random() * 1.5, duration: 0.3 + Math.random() * 0.3 });
        } else if (weather === 'snow') {
          newElements.push({ id: i, type: 'snow', left: Math.random() * 100, delay: Math.random() * 5, duration: 3 + Math.random() * 3, size: 2 + Math.random() * 4 });
        } else if (weather === 'clouds') {
          newElements.push({ id: i, type: 'cloud', top: Math.random() * 100, delay: Math.random() * 20, duration: 30 + Math.random() * 20, size: 200 + Math.random() * 300 });
        } else if (weather === 'clear') {
           newElements.push({ id: i, type: 'star', left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 5, duration: 2 + Math.random() * 3, size: 2 + Math.random() * 3 });
        }
      }

      // Add actual geometric jagged lightning bolts at the top of the screen
      if (weather === 'thunder' || weather === 'storm') {
         newElements.push({ id: 'bolt1', type: 'lightning', left: 20 + Math.random() * 20, delay: 0, duration: 4 + Math.random() * 3 });
         newElements.push({ id: 'bolt2', type: 'lightning', left: 60 + Math.random() * 20, delay: 2, duration: 5 + Math.random() * 2 });
      }

      setElements(newElements);
    }, 100);
    return () => clearTimeout(timer);
  }, [weather]);

  return (
    <div className="weather-layer">
      {elements.map(e => {
        if (e.type === 'rain') return <div key={e.id} className="rain-drop" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }} />
        if (e.type === 'storm') return <div key={e.id} className="storm-drop" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }} />
        if (e.type === 'snow') return <div key={e.id} className="snow-flake" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size }} />
        if (e.type === 'cloud') return <div key={e.id} className="cloud-vessel rounded-full" style={{ top: `${e.top}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size / 2 }} />
        if (e.type === 'star') return <div key={e.id} className="star-particle" style={{ left: `${e.left}%`, top: `${e.top}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size }} />
        
        {/* Render the jagged lightning bolt */}
        if (e.type === 'lightning') return <div key={e.id} className="retro-lightning" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }} />
        return null;
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   APP — THE MAIN ENTRY POINT
   ═══════════════════════════════════════════════════════ */
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { userId } = useUserContext();

  // 1. Auth & Session State
  const [session, setSession] = useState(null);
  const [hasRoom, setHasRoom] = useLocalStorage('attic_has_room', null);
  const [pendingRoomId, setPendingRoomId] = useState(null);
  const [coreReady, setCoreReady] = useState(false); // true after essential data loaded
  const [loading, setLoading] = useState(true);
  const [syncedRoomId, setSyncedRoomId] = useState(null);
  const [visualsReady, setVisualsReady] = useState(false); // Deferred for performance
  const [onlineUsers, setOnlineUsers] = useState({}); // Tracking presence
  const navigateTo = (v) => { 
    playAudio('click', sfxEnabled); 
    navigate(v === 'dashboard' ? '/dashboard' : `/${v}`); 
  };

  // 2. Global Sync States
  const [profile, setProfile] = useLocalStorage('user_profile', { 
    name: '', 
    emoji: '😊',
    pfp: '' // Will be set on first load if empty
  }); 
  const partnerId = profile?.partner_id;

  // Initialize default PFP if not set
  useEffect(() => {
    if (userId && !profile.pfp) {
      const isEven = parseInt(userId.charAt(0), 16) % 2 === 0;
      const defaultPfp = isEven 
        ? `https://api.dicebear.com/9.x/pixel-art/svg?seed=Felix&backgroundColor=ffdfbf` // Cat
        : `https://api.dicebear.com/9.x/pixel-art/svg?seed=Dino&backgroundColor=b6e3f4`;  // Dino
      setProfile(prev => ({ ...prev, pfp: defaultPfp }));
    }
  }, [userId]);
  const [theme, setTheme] = useLocalStorage('app_theme', 'default');
  const [weather, setWeather] = useState('clear'); 
  const [sfxEnabled, setSfxEnabled] = useLocalStorage('sfx_enabled', true); 
  const [triggerShake, setTriggerShake] = useState(false); 
  const [confetti, setConfetti] = useState(false);
  const [radioState, setRadioState] = useLocalStorage('radio_state', { isPlaying: false, channelIdx: 0, volume: 0.4 });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [milestoneShown, setMilestoneShown] = useState(false);

  const [scores, setScoresRaw] = useGlobalSync('game_scores', {});
  const setScores = useCallback((val) => {
    const valueToStore = val instanceof Function ? val(scores || {}) : val;
    // Solution 30: Sanitize input to prevent object expansion loop or synthetic events leaking in
    const sanitized = {};
    if (valueToStore && typeof valueToStore === 'object') {
        Object.keys(valueToStore).forEach(k => {
            if (typeof valueToStore[k] === 'number' || typeof valueToStore[k] === 'string') {
                sanitized[k] = valueToStore[k];
            }
        });
    }
    setScoresRaw({ ...(scores || {}), ...sanitized });
  }, [scores, setScoresRaw]);

  const [streaks, setStreaks] = useGlobalSync('user_streaks', {});
  const { messages: chatHistory, sendMessage: syncSendMessage, updateMessage: syncUpdateMessage, deleteMessage: syncDeleteMessage, loadMore: syncLoadMore, hasMore: syncHasMore } = useChatSync(syncedRoomId);
  const { assets: doodles, uploadAsset: uploadDoodle } = useAssetSync(syncedRoomId, 'doodle');
  const { assets: sharedImages, uploadAsset: uploadImage } = useAssetSync(syncedRoomId, 'scrapbook');
  
  // Legacy setters for compatibility during transition (can be removed once all components migrated)
  const setChatHistory = () => console.warn("Legacy setChatHistory called. Use specialized hooks instead.");
  const setDoodles = () => console.warn("Legacy setDoodles called. Use specialized hooks instead.");
  const setSharedImages = () => console.warn("Legacy setSharedImages called. Use specialized hooks instead.");

  const [letters, setLetters] = useGlobalSync('shared_letters', []);
  const [coupleData, setCoupleData] = useGlobalSync('couple_data', { 
    anniversary: '', 
    petName: 'pet', 
    petSkin: '/assets/Cat Sprite Sheet.png', 
    petHappy: 60, 
    partnerNickname: '',
    nicknames: {} 
  });
  
  const [callState, setCallState] = useGlobalSync('room_call_state', { status: 'idle' });
  const callStateRef = useRef(callState);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  const [roomProfiles, setRoomProfiles] = useGlobalSync('room_profiles', {});
  const [pictionaryState, setPictionaryState] = useGlobalSync('pictionary_state', { gameState: 'prep', drawerId: null, word: '', displayWord: [], timeLeft: 60, currentCanvas: null });

  // Update room profile whenever local profile changes
  useEffect(() => {
    // Solution 29: Prevent null/undefined key leaks in roomProfiles
    if (userId && userId !== 'null' && JSON.stringify(roomProfiles[userId]) !== JSON.stringify(profile)) {
      setRoomProfiles(prev => ({ ...prev, [userId]: profile }));
      console.log(`[SYNC] Local profile pushed for ${profile.name}`);
    }
    if (profile && profile.name) {
      localStorage.setItem('attic_profile', JSON.stringify(profile));
    }
  }, [profile]);

  const partnerProfile = useMemo(() => roomProfiles[partnerId] || {}, [roomProfiles, partnerId]);
  
  // Auto-sync partner name to coupleData for persistence
  useEffect(() => {
    if (partnerProfile.name && partnerProfile.name !== coupleData.partnerNickname) {
      setCoupleData(prev => ({ ...prev, partnerNickname: partnerProfile.name }));
      console.log(`[SYNC] Partner nickname updated to ${partnerProfile.name}`);
    }
  }, [partnerProfile.name, coupleData.partnerNickname]);

  const partnerName = partnerProfile.name || coupleData.partnerNickname || 'Partner';
  const partnerEmoji = partnerProfile.emoji || '😊';

  // Sync Diagnostic Log
  useEffect(() => {
    if (syncedRoomId) {
      console.log(`[SYNC] Health Status:
- Room ID: ${syncedRoomId}
- Profiles Synced: ${Object.keys(roomProfiles).length} (${Object.keys(roomProfiles).join(', ')})
- Partner Profile Found: ${!!roomProfiles[partnerId]}
- Partner Name: ${partnerName}
        `);
    }
  }, [syncedRoomId, roomProfiles, partnerId, partnerName]);

  // Nickname logic: If my partner set a nickname for ME in coupleData.nicknames[userId], use it.
  // Otherwise use my profile name.
  const myDisplayName = useMemo(() => {
    // Solution 12: Optional chaining for nicknames
    if (hasRoom && coupleData?.nicknames?.[userId]) {
        return coupleData.nicknames[userId];
    }
    return profile.name || 'you';
  }, [profile.name, coupleData.nicknames, userId, hasRoom]);

  const [viewingDoodle, setViewingDoodle] = useState(null);  
  const [replyDoodle, setReplyDoodle] = useState(null);

  // 3. Calling System
  const [calling, setCalling] = useState(null);
  const [isRinging, setIsRinging] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  
  const peerRef = useRef(null);
  const currentCallRef = useRef(null);
  const ringingIntervalRef = useRef(null);
  const callTimerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [audioBlocked, setAudioBlocked] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const lastMsgIdRef = useRef(null);

  useEffect(() => {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) return;
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (lastMsg.sender === partnerId && lastMsg.id !== lastMsgIdRef.current) {
        lastMsgIdRef.current = lastMsg.id;
        // Show notification if NOT in chat view
        if (location.pathname !== '/chat') {
            const newNotif = { id: lastMsg.id, text: lastMsg.text, type: lastMsg.type };
            setNotifications(prev => [...prev, newNotif]);
            playAudio('notif', sfxEnabled);
            
            // Solution 20: Robust auto-dismiss with explicit ID matching
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id === lastMsg.id ? false : true));
            }, 5000);
        }
    }
  }, [chatHistory, partnerId, location.pathname, sfxEnabled]);

  const handleEndCall = () => {
    playAudio('click', sfxEnabled);
    if (callState.status !== 'idle') {
      setCallState({ status: 'ended', type: callState.type, endedBy: userId, timestamp: Date.now() });
      // Solution 16: Use syncSendMessage instead of setChatHistory stub
      syncSendMessage('Call ended', 'call_invite', userId, { status: 'ended', callType: callState.type });
    }
    setCalling(null); setIsRinging(false);
    if (currentCallRef.current) { try { currentCallRef.current.close(); } catch(e){} currentCallRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
  };

  useEffect(() => {
    if (!userId) return;
    const initPeer = () => {
      // Solution 4: Destroy old instance before re-initializing
      if (peerRef.current && !peerRef.current.destroyed) {
          try { peerRef.current.destroy(); } catch(e) {}
      }

      const peer = new Peer(userId, { 
        debug: 1,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, 
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ] }
      });
      peerRef.current = peer;
      peer.on('call', (call) => { 
        currentCallRef.current = call; 
        // Solution 23: Clean up on remote disconnect
        call.on('close', () => handleEndCall());
        call.on('error', () => handleEndCall());

        const currentStatus = callStateRef.current.status;
        
        // If we somehow already accepted it, answer immediately
        if (currentStatus === 'connected' || currentStatus === 'accepted') {
           if (localStreamRef.current) {
               call.answer(localStreamRef.current);
               call.on('stream', (rs) => { 
                 // Solution 21 & 22: Null ref checks
                 if(remoteAudioRef.current) { 
                     remoteAudioRef.current.srcObject = rs; 
                     remoteAudioRef.current.play().catch(e => {
                         if (e.name === 'NotAllowedError') setAudioBlocked(true);
                         console.log('Audio autoplay blocked');
                     }); 
                 } 
                 if(remoteVideoRef.current) { remoteVideoRef.current.srcObject = rs; }
               });
           }
        }
      });
      peer.on('error', (err) => {
        if (err.type === 'disconnected' || err.type === 'network') {
            // Solution 4: Force destroy on retry
            if (peerRef.current) peerRef.current.destroy();
            setTimeout(initPeer, 3000);
        }
      });
    };
    initPeer();
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, [userId]); // Removed calling dependency to keep peer alive

  // NEW: Robust Call State Machine
  useEffect(() => {
    if (!userId || !callState) return;

    // Incoming call detection
    if (callState.status === 'ringing' && callState.calleeId === userId && !incomingCall) {
      setIncomingCall({ type: callState.type, fromName: partnerName });
      if (!ringingIntervalRef.current) {
        ringingIntervalRef.current = setInterval(() => playAudio('receive', sfxEnabled), 1200);
      }
    }

    // Call accepted by partner
    if (callState.status === 'accepted' && callState.callerId === userId && isRinging) {
      setIsRinging(false);
      setCalling(callState.type);
      initiatePeerCall(callState.type);
    }

    // Call connected (both sides)
    if (callState.status === 'connected') {
        if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
        setIncomingCall(null);
        setIsRinging(false);
        setCalling(callState.type);
    }

    // Call ended or rejected
    if (callState.status === 'ended' || callState.status === 'rejected' || callState.status === 'idle') {
      if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
      setIncomingCall(null);
      setCalling(null);
      setIsRinging(false);
      if (currentCallRef.current) { try { currentCallRef.current.close(); } catch(e){} currentCallRef.current = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
      
      // Clear idle state after a bit
      if (callState.status === 'ended' || callState.status === 'rejected') {
          setTimeout(() => setCallState({ status: 'idle' }), 2000);
      }
    }
  }, [callState, userId, partnerName, sfxEnabled]);

  useEffect(() => {
    if (calling && !isRinging) callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    else { setCallDuration(0); if (callTimerRef.current) clearInterval(callTimerRef.current); }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [calling, isRinging]);

  const initiatePeerCall = async (type) => {
    try {
      setIsRinging(false);
      if (isTestMode()) {
          setCallState({ ...callState, status: 'connected' });
          return;
      }
      // Solution 24: Peer initialization guard
      if (!peerRef.current || peerRef.current.destroyed) {
          toast('Connection not ready. Try again.', 'error');
          return handleEndCall();
      }

      // Solution 2: Camera/Mic rejection handling
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' })
        .catch(err => {
            if (err.name === 'NotAllowedError') toast('Camera/Mic permission denied', 'error');
            throw err;
        });

      localStreamRef.current = stream;
      
      const call = peerRef.current.call(partnerId, stream);
      currentCallRef.current = call;
      
      call.on('stream', (remoteStream) => {
        // Solution 22: Null ref checks
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        if (remoteAudioRef.current) { 
            remoteAudioRef.current.srcObject = remoteStream; 
            remoteAudioRef.current.play().catch(e => {
                if (e.name === 'NotAllowedError') setAudioBlocked(true);
                console.error("Audio block", e);
            }); 
        }
      });
      
      // Solution 23: Call close event
      call.on('close', () => handleEndCall());
      
      setCallState(prev => ({ ...prev, status: 'connected' }));
    } catch (err) { console.error('Failed call initiation', err); handleEndCall(); }
  };

  const startCall = (type) => {
    playAudio('click', sfxEnabled);
    if (callState.status !== 'idle') return;
    setIsRinging(true);
    setIsCameraOff(type === 'audio'); // Audio call defaults to camera off
    setCallState({ status: 'ringing', type, callerId: userId, calleeId: partnerId, timestamp: Date.now() });
    // Solution 16 & 19: Robust unique ID and syncSendMessage
    syncSendMessage('Incoming call...', 'call_invite', userId, { callType: type, status: 'ringing' });
  };

  const acceptCall = async () => {
    playAudio('click', sfxEnabled);
    try {
      // Solution 2: Permission handling
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callState.type === 'video' })
        .catch(err => {
            if (err.name === 'NotAllowedError') toast('Camera/Mic permission denied', 'error');
            throw err;
        });

      localStreamRef.current = stream;
      setCallState(prev => ({ ...prev, status: 'accepted' }));
      
      // NEW: Answer the waiting PeerJS call here!
      if (currentCallRef.current && currentCallRef.current.answer) {
         currentCallRef.current.answer(stream);
         currentCallRef.current.on('stream', (rs) => { 
           // Solution 21 & 22: Null ref checks
           if(remoteAudioRef.current) { 
             remoteAudioRef.current.srcObject = rs; 
             remoteAudioRef.current.play().catch(e=>{
               if (e.name === 'NotAllowedError') setAudioBlocked(true);
             }); 
           } 
           if(remoteVideoRef.current) { remoteVideoRef.current.srcObject = rs; }
         });
         currentCallRef.current.on('close', () => handleEndCall());
      }

      // Solution 16: Update synchronized message status
      const ringingInvite = chatHistory.find(m => m.type === 'call_invite' && m.status === 'ringing' && m.sender === partnerId);
      if (ringingInvite) {
          syncUpdateMessage(ringingInvite.id, { status: 'accepted' });
      }
    } catch (err) { console.error('Failed accept', err); handleEndCall(); }
    setIncomingCall(null);
  };

  const rejectCall = () => { 
    playAudio('click', sfxEnabled);
    setCallState({ status: 'rejected', type: callState.type, timestamp: Date.now() });
    
    // Find the active ringing invite and update it
    const ringingInvite = chatHistory.find(m => m.type === 'call_invite' && m.status === 'ringing');
    if (ringingInvite && syncedRoomId) {
        syncUpdateMessage(ringingInvite.id, { status: 'rejected' });
    }
    
    setIncomingCall(null); 
  };

  const checkRoomAndSync = async (uid) => {
    try {
      const { data: room } = await supabase.rpc('get_my_room');
      const isPaired = !!(room && room.is_paired);
      setHasRoom(isPaired);
      if (isPaired) localStorage.setItem('attic_has_room', 'true');
      else localStorage.setItem('attic_has_room', 'false');
      if (isPaired && syncedRoomId !== room.id) { 
        setSyncedRoomId(room.id); 
        await initializeRoomSync(room.id); 
      }
      return isPaired;
    } catch (err) { console.error("Room check failed", err); setHasRoom(false); } finally { setLoading(false); }
    return false;
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      // Step 1: Parallelize session fetch and initial room check
      const [sessionRes, roomRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc('get_my_room')
      ]);

      if (!mounted) return;
      const s = sessionRes.data?.session || null;
      setSession(s);
      
      if (s) {
        // populate local profile name
        try {
          const metaName = s.user?.user_metadata?.name;
          if (metaName && profile.name !== metaName) setProfile(prev => ({ ...prev, name: metaName }));
        } catch (e) {}

        const room = roomRes.data;
        if (room) {
          setHasRoom(!!room.is_paired);
          if (room.is_paired) setPendingRoomId(room.id);
        } else {
          setHasRoom(false);
        }
      } else {
        setHasRoom(false);
      }
      
      setLoading(false);
      setCoreReady(true);
      setVisualsReady(true); // Instant ready, elements are deferred internally
    };

    const checkTestMode = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('test_mode') === 'true') {
        const testUserParam = params.get('user');
        // Solution 27: Guard against literal "undefined" strings
        const testUser = (testUserParam === 'undefined' || !testUserParam) ? 'userA' : testUserParam;
        const [base, suffix] = testUser.split('_');
        const idSuffix = suffix ? `-${suffix}` : '';
        const id1 = `00000000-0000-0000-0000-000000000001${idSuffix}`;
        const id2 = `00000000-0000-0000-0000-000000000002${idSuffix}`;

        const mockSession = {
          user: { 
            id: base === 'userA' ? id1 : id2,
            user_metadata: { name: base === 'userA' ? 'Test User A' : 'Test User B' }
          },
          access_token: 'fake_token'
        };
        localStorage.setItem('attic_test_mode', 'true');
        localStorage.setItem('attic_test_user', testUser);
        
        // Mock profile with partner mapping
        const mockProfile = {
            id: base === 'userA' ? id1 : id2,
            name: base === 'userA' ? 'Test User A' : 'Test User B',
            partner_id: base === 'userA' ? id2 : id1,
            partner_name: base === 'userA' ? 'Test User B' : 'Test User A'
        };
        const roomSuffix = suffix ? `-${suffix}` : '';
        const mockRoomId = `00000000-0000-0000-0000-000000000000${roomSuffix}`;

        localStorage.setItem('user_profile', JSON.stringify(mockProfile));
        setProfile(mockProfile);
        setSession(mockSession);
        setHasRoom(true);
        setPendingRoomId(mockRoomId);
        setSyncedRoomId(mockRoomId);
        setLoading(false);
        setCoreReady(true);
        setVisualsReady(true);
        return true;
      }
      return false;
    };

    if (checkTestMode()) return;
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s && s.user) {
        // perform quick check on auth change
        (async () => {
          try {
            const { data: room } = await supabase.rpc('get_my_room');
            if (room) {
              setHasRoom(!!room.is_paired);
              if (room.is_paired) setPendingRoomId(room.id);
              else setPendingRoomId(null);
            } else {
              setHasRoom(false);
              setPendingRoomId(null);
            }
          } catch (err) { console.error('Auth state room check failed', err); setHasRoom(false); setPendingRoomId(null); }
        })();
      } else {
        setHasRoom(false); setPendingRoomId(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  
  // Solution 30: Mobile Viewport Jitter Fix
  useEffect(() => {
    const handleResize = () => {
      const vh = window.visualViewport ? window.visualViewport.height * 0.01 : window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Apply theme after core is ready to avoid blocking initial render
  useEffect(() => {
    if (!coreReady) return;
    document.documentElement.setAttribute('data-theme', theme);
  }, [coreReady, theme]);

  // When we have a pending room ID and core is ready, lazily initialize the full room sync
  useEffect(() => {
    if (!coreReady || !pendingRoomId) return;
    if (syncedRoomId === pendingRoomId && !isTestMode()) return;
    let cancelled = false;
    let presenceChannel = null;
    (async () => {
      try {
        // give the UI a tick before starting heavy sync
        await new Promise(r => setTimeout(r, 200));
        if (cancelled) return;
        setSyncedRoomId(pendingRoomId);
        await initializeRoomSync(pendingRoomId);
        
        // Presence tracking
        presenceChannel = supabase.channel(`presence_${pendingRoomId}`, {
          config: { presence: { key: userId } }
        });

        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const newState = presenceChannel.presenceState();
            const onlineMap = {};
            Object.keys(newState).forEach(id => {
               onlineMap[id] = newState[id][0]?.status || 'online';
            });
            setOnlineUsers(onlineMap);
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('join', key, newPresences);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('leave', key, leftPresences);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({ status: document.hasFocus() ? 'active' : 'idle', onlineAt: new Date().toISOString() });
            }
          });

        const handleVisibility = () => {
          if (presenceChannel) {
            presenceChannel.track({ status: document.hasFocus() ? 'active' : 'idle', onlineAt: new Date().toISOString() });
          }
        };
        window.addEventListener('focus', handleVisibility);
        window.addEventListener('blur', handleVisibility);
      } catch (err) {
        console.error('Lazy initializeRoomSync failed', err);
      }
    })();
    return () => { 
      cancelled = true; 
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      window.removeEventListener('focus', () => {});
      window.removeEventListener('blur', () => {});
    };
  }, [coreReady, pendingRoomId, userId]);

  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); setSession(null); setHasRoom(false); navigate('/dashboard'); };
  const handleAuthSuccess = async (data) => {
    if (data.name) setProfile(prev => ({ ...prev, name: data.name }));
    setSession(data.session);
    // If user just signed up, route them to handshake to start pairing.
    if (data.mode === 'signup') {
      navigate('/handshake');
      return;
    }
    // For signin, check pairing immediately and route accordingly.
    try {
      const paired = await checkRoomAndSync(data.session.user.id);
      if (paired) navigate('/dashboard'); else navigate('/handshake');
    } catch (err) {
      navigate('/handshake');
    }
  };
  const handlePaired = async (roomId) => { 
    setHasRoom(true);
    setPendingRoomId(roomId);
    // lazily initialize heavy sync after a short delay so UI becomes interactive quickly
    setTimeout(async () => {
      setSyncedRoomId(roomId);
      await initializeRoomSync(roomId);
    }, 500);
    // ensure our profile is pushed to room_profiles immediately so partner sees our display name
    try { setRoomProfiles(prev => ({ ...prev, [userId]: profile })); } catch(e) {}
    navigate('/dashboard');
  };
  const handleShareToChat = async (text, imgData, inviteData = null) => { 
      if (syncedRoomId) {
          if (inviteData) {
              await syncSendMessage(text, 'game_invite', userId, inviteData);
          } else if (imgData) {
              try {
                  const { base64ToBlob } = await import('./utils/file.js');
                  const blob = base64ToBlob(imgData);
                  const file = new File([blob], `image_${Date.now()}.png`, { type: 'image/png' });
                  await syncSendMessage(file, 'image', userId, { text });
              } catch (e) {
                  console.error("Failed to process image", e);
                  toast("Failed to share image", "error");
              }
          } else {
              await syncSendMessage(text, 'text', userId);
          }
      }
  };

  if (loading || hasRoom === null) return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#fffdf9]"><div className="w-8 h-8 border-4 border-[#ff6b9d] border-t-transparent rounded-full animate-spin mb-4" /><p className="font-bold text-xs opacity-40 tracking-widest uppercase">Initializing Attic...</p></div>;

  const isOnboarding = ['/login', '/signup', '/signin', '/handshake'].includes(location.pathname);

  return (
    <div className={`retro-everywhere min-h-[100dvh] w-full mesh-bg flex flex-col relative ${isOnboarding ? '' : 'items-center p-2 sm:p-4 md:p-8'} ${triggerShake ? 'animate-shake' : ''}`}>
        <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />
        {visualsReady && <LivingBackground weather={weather} />}
        {visualsReady && <WeatherOverlay weather={weather} />}
        <Confetti active={confetti} />
        {confirmDialog && <ConfirmDialog {...confirmDialog} sfx={sfxEnabled} />}
        {session && hasRoom && <StrayTray radioState={radioState} setRadioState={setRadioState} />}

        {incomingCall && (
          <div className="fixed inset-0 z-[6000] bg-black/10 flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-white/95 retro-border shadow-2xl max-w-sm w-full p-8 text-center animate-in slide-in-from-bottom-10 border-t-4 border-t-[var(--primary)]">
              <div className="w-24 h-24 rounded-lg retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-6 animate-pulse shadow-[0_0_40px_var(--secondary)]">
                {incomingCall.type === 'video' ? <Video size={48} className="text-white"/> : <Phone size={48} className="text-white"/>}
              </div>
              <h2 className="text-2xl font-black mb-1">{incomingCall.fromName}</h2>
              <p className="text-[10px] font-black text-[var(--primary)] mb-8 uppercase tracking-[0.2em] animate-pulse">
                  Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
              </p>
              <div className="flex gap-6 justify-center">
                <button onClick={rejectCall} className="p-5 bg-red-500 text-white retro-border rounded-full hover:bg-red-600 transition-all hover:scale-110 shadow-lg group"><PhoneOff size={28} className="rotate-[135deg] group-hover:rotate-0 transition-transform"/></button>
                <button onClick={acceptCall} className="p-5 bg-green-500 text-white retro-border rounded-full hover:bg-green-600 transition-all hover:scale-110 shadow-lg"><Phone size={28}/></button>
              </div>
            </div>
          </div>
        )}

        {callState.status !== 'idle' && callState.status !== 'rejected' && (callState.callerId === userId || callState.status === 'connected' || callState.status === 'accepted') && (
          <PremiumCallHub
            type={callState.type}
            callDuration={callDuration}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isCameraOff={isCameraOff}
            onMicToggle={() => { setIsMuted(!isMuted); if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isMuted); }}
            onDeafenToggle={() => setIsDeafened(!isDeafened)}
            onCameraToggle={() => { setIsCameraOff(!isCameraOff); if (localStreamRef.current) localStreamRef.current.getVideoTracks().forEach(t => t.enabled = isCameraOff); }}
            onEndCall={handleEndCall}
            partnerName={partnerName}
            partnerPfp={partnerProfile.pfp}
            sfx={sfxEnabled}
            remoteVideoRef={remoteVideoRef}
            isRinging={isRinging}
          />
        )}
        
        {audioBlocked && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[6000] animate-bounce">
                <button 
                  onClick={() => {
                      if (remoteAudioRef.current) remoteAudioRef.current.play().catch(e => {});
                      setAudioBlocked(false);
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded-full retro-border shadow-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                    <Volume2 size={14}/> Click to Enable Audio
                </button>
            </div>
        )}
        
        <audio ref={remoteAudioRef} autoPlay style={{display: 'none'}} />

        {/* Floating Notifications */}
        <div className="fixed bottom-4 left-4 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none">
            {notifications.map(n => (
                <div key={n.id} onClick={() => navigate('/chat')} className="bg-white/95 backdrop-blur-md p-3 retro-border shadow-xl animate-in slide-in-from-left-4 pointer-events-auto flex items-center gap-3 cursor-pointer transition-transform">
                    <div className="relative">
                            {partnerProfile.pfp ? (
                                <img src={partnerProfile.pfp} alt="partner" className="w-10 h-10 retro-border object-cover bg-white shadow-sm" />
                            ) : (
                                <div className="w-10 h-10 retro-bg-secondary retro-border flex items-center justify-center text-lg">{partnerProfile.emoji || '👤'}</div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border border-white animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase opacity-40 leading-none mb-1">{partnerName}</p>
                        <p className="text-xs font-bold line-clamp-1">{n.text || (n.type === 'image' ? '📸 Sent a photo' : n.type === 'voice' ? '🎤 Sent a voice note' : 'New message')}</p>
                    </div>
                </div>
            ))}
        </div>

        <Suspense fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-main)] z-50">
            <div className="border-2 border-[var(--border)] bg-[var(--bg-window)] shadow-[4px_4px_0px_0px_var(--border)] p-6 text-center animate-pulse">
              <h2 className="font-black uppercase tracking-widest text-lg mb-2 text-[var(--text-main)]">Loading Module...</h2>
              <div className="h-4 w-48 border-2 border-[var(--border)] p-0.5 mx-auto">
                 <div className="h-full bg-[var(--primary)] w-2/3"></div>
              </div>
            </div>
          </div>
        }>
          <Routes key={location.pathname}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              !session ? (
                <LandingView onTryAttic={() => navigate('/signin')} onSignIn={() => navigate('/signup')} />
              ) : !hasRoom ? (
                <Navigate to="/handshake" replace />
              ) : (
                <Dashboard setView={navigateTo} profile={profile} myDisplayName={myDisplayName} partnerProfile={partnerProfile} coupleData={coupleData} setCoupleData={setCoupleData} scores={scores} doodles={doodles} chatHistory={chatHistory} onOpenDoodle={setViewingDoodle} sfx={sfxEnabled} setTriggerShake={setTriggerShake} radioState={radioState} setRadioState={setRadioState} userId={userId} partnerId={partnerId} streaks={streaks} theme={theme} setTheme={setTheme} setProfile={setProfile} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} onLogout={handleLogout} onDelete={()=>{}} weather={weather} setWeather={setWeather} onlineUsers={onlineUsers} />
              )
            } />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signup" onAuthSuccess={handleAuthSuccess} onBack={() => navigate('/dashboard')} /></PublicRoute>} />
            <Route path="/signin" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signin" onAuthSuccess={handleAuthSuccess} onBack={() => navigate('/dashboard')} /></PublicRoute>} />
            <Route path="/password-reset" element={<ResetPasswordView sfx={true} />} />
            <Route path="/handshake" element={<ProtectedRoute session={session} hasRoom={hasRoom}><HandshakeView session={session} onPaired={handlePaired} onLogout={handleLogout} /></ProtectedRoute>} />

            <Route path="/settings" element={<ProtectedRoute session={session} hasRoom={hasRoom}><SettingsView theme={theme} setTheme={setTheme} weather={weather} setWeather={setWeather} profile={profile} setProfile={setProfile} coupleData={coupleData} setCoupleData={setCoupleData} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} scores={scores} userId={userId} onLogout={handleLogout} onDelete={()=>{}} onClose={()=>navigateTo('dashboard')} /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ChatView profile={profile} partnerProfile={partnerProfile} roomProfiles={roomProfiles} partnerNickname={partnerName} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} chatHistory={chatHistory} userId={userId} partnerId={partnerId} roomId={syncedRoomId} onStartCall={startCall} sharedImages={sharedImages} onlineUsers={onlineUsers} syncSendMessage={syncSendMessage} syncUpdateMessage={syncUpdateMessage} syncDeleteMessage={syncDeleteMessage} syncLoadMore={syncLoadMore} syncHasMore={syncHasMore} /></ProtectedRoute>} />
            <Route path="/doodle" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DoodleApp initialDoodle={replyDoodle} onClose={()=>{navigateTo('dashboard'); setReplyDoodle(null);}} onSendDoodle={async (imgData) => {
                if (syncedRoomId) {
                    const { base64ToBlob } = await import('./utils/file.js');
                    const blob = base64ToBlob(imgData);
                    await uploadDoodle(blob, 'doodle', userId);
                    toast('Doodle shared!', 'success');
                }
            }} onSaveToScrapbook={async (imgData) => {
                if (syncedRoomId) {
                    const { base64ToBlob } = await import('./utils/file.js');
                    const blob = base64ToBlob(imgData);
                    await uploadImage(blob, 'scrapbook', userId);
                    toast('Saved to Scrapbook!', 'success');
                }
            }} sfx={sfxEnabled} roomId={syncedRoomId} userId={userId} /></ProtectedRoute>} />
            <Route path="/shared-canvas" element={<ProtectedRoute session={session} hasRoom={hasRoom}><PersistentDoodleApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
            <Route path="/capsule" element={<ProtectedRoute session={session} hasRoom={hasRoom}><TimeCapsuleApp onClose={()=>navigateTo('dashboard')} letters={letters} setLetters={setLetters} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
            <Route path="/lists" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ListsApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute session={session} hasRoom={hasRoom}><CalendarApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
            <Route path="/scrapbook" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ScrapbookApp images={sharedImages} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} roomId={syncedRoomId} userId={userId} /></ProtectedRoute>} />
            <Route path="/pixelart" element={<ProtectedRoute session={session} hasRoom={hasRoom}><PixelArtApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} onSaveToScrapbook={async (imgData) => {
                if (syncedRoomId) {
                    const { base64ToBlob } = await import('./utils/file.js');
                    await uploadImage(base64ToBlob(imgData), 'scrapbook', userId);
                    toast('Pixel Art saved!', 'success');
                }
            }} userId={userId} /></ProtectedRoute>} />
            <Route path="/dreams" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DreamJournal onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
            <Route path="/dailyq" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DailyQuestion onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
            <Route path="/resume" element={<ProtectedRoute session={session} hasRoom={hasRoom}><RelationshipResume onClose={()=>navigateTo('dashboard')} profile={profile} coupleData={coupleData} scores={scores} sfx={sfxEnabled} userId={userId} partnerId={partnerId} /></ProtectedRoute>} />
            <Route path="/legal" element={<LegalView onClose={() => navigateTo('dashboard')} />} />
            <Route path="/activities/*" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ActivitiesHub onClose={()=>navigateTo('dashboard')} scores={scores} setScores={setScores} sfx={sfxEnabled} setConfetti={setConfetti} onShareToChat={handleShareToChat} onSaveToScrapbook={async (imgData) => {
                if (syncedRoomId) {
                    const { base64ToBlob } = await import('./utils/file.js');
                    const blob = base64ToBlob(imgData);
                    const file = new File([blob], `image_${Date.now()}.png`, { type: 'image/png' });
                    await uploadImage(file, 'scrapbook', userId);
                    toast('Saved to Scrapbook!', 'success');
                }
            }} profile={profile} userId={userId} partnerId={partnerId} pictionaryState={pictionaryState} setPictionaryState={setPictionaryState} /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        {milestoneShown && getMilestoneToday(coupleData.anniversary) && <MilestoneCelebration milestone={getMilestoneToday(coupleData.anniversary)} onClose={() => setMilestoneShown(true)} />}
        {viewingDoodle && ( <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"><DoodleViewer doodle={viewingDoodle} onClose={() => setViewingDoodle(null)} profileName={profile?.name} sfx={sfxEnabled} onRedoodle={(d) => { setViewingDoodle(null); setReplyDoodle(d); navigateTo('doodle'); }} onReplyToChat={(t, i) => { handleShareToChat(t, i); setViewingDoodle(null); navigateTo('chat'); }} /></div>)}
      </div>
  );
}
