import React, { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Loader, Phone, Video, PhoneOff, MicOff, Mic, Volume2, VolumeX, Maximize2, Minimize2, VideoOff, Camera, Bell, X, Mail, Heart, Download, MessageSquare, PenTool, Gamepad2 } from 'lucide-react';
import { WeatherOverlay, Confetti, ToastProvider, ConfirmDialog, useToast, RetroWindow, RetroButton } from './components/UI.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { playAudio } from './utils/audio.js';
import { INITIAL_CHAT } from './constants/data.js';
import { StrayTray } from './components/LofiPlayer.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useSync } from './context/SyncContext.jsx';
import { useCall } from './context/CallContext.jsx';
import { useChat } from './context/ChatContext.jsx';

import { LandingView, AuthView, HandshakeView } from './views/Onboarding.jsx';
import { LegalView } from './views/LegalView.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { supabase } from './lib/supabase.js';
import { isTestMode } from './lib/testMode.js';

const ChatView = lazy(() => import('./views/ChatView.jsx').then(m => ({ default: m.ChatView })));
const SettingsView = lazy(() => import('./views/SettingsView.jsx').then(m => ({ default: m.SettingsView })));
const DoodleApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.DoodleApp })));
const PersistentDoodleApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.PersistentDoodleApp })));
const TimeCapsuleApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.TimeCapsuleApp })));
const ListsApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.ListsApp })));
const CalendarApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.CalendarApp })));
const ScrapbookApp = lazy(() => import('./apps/UtilityApps.jsx').then(m => ({ default: m.ScrapbookApp })));
const PixelArtApp = lazy(() => import('./apps/PixelArtApp.jsx').then(m => ({ default: m.PixelArtApp })));
const SharedNotes = lazy(() => import('./apps/SharedNotes.jsx').then(m => ({ default: m.SharedNotes })));
const DreamJournal = lazy(() => import('./apps/DreamJournal.jsx').then(m => ({ default: m.DreamJournal })));
const DailyQuestion = lazy(() => import('./components/Features.jsx').then(m => ({ default: m.DailyQuestion })));
const MilestoneCelebration = lazy(() => import('./components/Features.jsx').then(m => ({ default: m.MilestoneCelebration })));
const RelationshipResume = lazy(() => import('./components/Features.jsx').then(m => ({ default: m.RelationshipResume })));
const ActivitiesHub = lazy(() => import('./games/index.jsx').then(m => ({ default: m.ActivitiesHub })));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView.jsx').then(m => ({ default: m.ResetPasswordView })));

const ProtectedRoute = lazy(() => import('./components/AuthGuards.jsx').then(m => ({ default: m.ProtectedRoute })));
const PublicRoute = lazy(() => import('./components/AuthGuards.jsx').then(m => ({ default: m.PublicRoute })));

const AppLoader = () => (
  <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
    <div className="font-black text-xl text-[var(--primary)] uppercase tracking-[0.3em] animate-pulse bg-[var(--bg-window)] retro-border-thick px-4 py-2 retro-shadow-dark mb-4">LOADING...</div>
    <p className="font-bold text-[10px] opacity-40 tracking-widest uppercase">Please Wait</p>
  </div>
);

function PremiumCallHub({ calling, callDuration, isMuted, isDeafened, isCameraOff, onMicToggle, onDeafenToggle, onCameraToggle, onEndCall, partnerName, partnerPfp, sfx, remoteStream, isRinging, type }) {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (remoteStream && localVideoRef.current && !isRinging && type === 'video') {
      localVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isRinging, type]);

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
      className={`fixed z-[var(--z-callhub)] bg-window retro-border-thick transition-all duration-500 ease-in-out ${isMinimized ? 'w-64 h-14 overflow-hidden' : 'w-[90vw] sm:w-[420px] retro-shadow-dark'} animate-in zoom-in-95 fade-in select-none`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseDown={(e) => { if (!e.target.closest('button')) handleStart(e.clientX, e.clientY); }}
      onTouchStart={(e) => { if (!e.target.closest('button')) handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
    >
      <div className={`px-3 py-2 flex justify-between items-center font-bold text-[11px] sm:text-sm select-none border-b-2 border-border ${isMinimized ? 'bg-primary text-primary-text' : 'bg-border text-window-text'}`} style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
        <span className="flex items-center gap-2 truncate">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          {type === 'video' ? <Video size={16} className="text-pink-300"/> : <Phone size={16} className="text-cyan-300"/>}
          <span className="opacity-90 uppercase tracking-widest">{type === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}</span>
          <span className="opacity-50">|</span>
          <span className="truncate">{partnerName}</span>
          {!isMinimized && <span className="opacity-70 ml-2">{isRinging ? '...' : `${mins}:${secs.toString().padStart(2, '0')}`}</span>}
        </span>
        <div className="flex gap-2">
          <button onClick={() => { playAudio('click', sfx); setIsMinimized(!isMinimized); }} className="p-1 retro-border bg-window/10 hover:bg-window/20 transition-all">
            {isMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
          </button>
          <button onClick={onEndCall} className="p-1 retro-border bg-red-500 text-white hover:bg-red-600 transition-colors"><PhoneOff size={12}/></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col bg-window">
          <div className={`w-full aspect-video bg-black relative overflow-hidden flex items-center justify-center border-b-2 border-border`}>
            {isRinging ? (
              <div className="flex flex-col items-center gap-4 animate-in fade-in">
                <div className="w-20 h-20 retro-border flex items-center justify-center animate-pulse shadow-[0_0_40px_var(--secondary)] overflow-hidden bg-border relative">
                   {type === 'video' ? <Video size={36} className="text-white absolute z-0"/> : <Phone size={36} className="text-white absolute z-0"/>}
                   {partnerPfp && partnerPfp.length > 5 && (
                     <img src={partnerPfp} alt="partner" className="w-full h-full object-cover relative z-10 bg-window" onError={(e) => { e.target.style.display = 'none'; }} />
                   )}
                </div>
                <div className="text-white font-black text-[11px] uppercase tracking-[0.2em] animate-bounce">Ringing {partnerName}...</div>
              </div>
            ) : (
              <>
                {type === 'video' && !isCameraOff ? (
                  <video ref={localVideoRef} autoPlay playsInline className="w-full h-full object-cover animate-in fade-in duration-1000" />
                ) : (
                  <div className="flex flex-col items-center gap-4 group animate-in fade-in">
                    <div className="w-20 h-20 retro-bg-accent retro-border flex items-center justify-center transition-transform group-hover:scale-105 duration-500">
                       {type === 'video' ? <VideoOff size={36} className="text-white/80" /> : <Phone size={36} className="text-white/80" />}
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">{partnerName}</p>
                        <p className="text-[10px] font-bold text-white/30 uppercase mt-1 italic tracking-wider">{type === 'video' ? (isCameraOff ? 'Camera Off' : 'Connecting...') : 'Voice Only'}</p>
                    </div>
                  </div>
                )}
              </>
            )}
            {!isRinging && <div className="absolute top-2.5 right-2.5 bg-black/70 px-2.5 py-1 retro-border text-[10px] text-white font-black tracking-widest uppercase backdrop-blur-md border-white/20 select-none">LIVE • HIGH RES</div>}
            
            <div className="absolute bottom-2.5 left-2.5 flex gap-2">
                 {isMuted && <div className="bg-red-500/90 backdrop-blur-sm p-2 rounded-full retro-border text-white shadow-lg animate-in zoom-in-50"><MicOff size={12}/></div>}
                 {isDeafened && <div className="bg-red-500/90 backdrop-blur-sm p-2 rounded-full retro-border text-white shadow-lg animate-in zoom-in-50"><VolumeX size={12}/></div>}
            </div>
          </div>

          <div className="p-3.5 grid grid-cols-4 gap-2.5 bg-window border-t-2 border-border">
            <button onClick={onMicToggle} className={`flex flex-col items-center justify-center p-2.5 retro-border transition-all shadow-md ${isMuted ? 'bg-red-500 text-white' : 'retro-bg-accent hover:-translate-y-0.5 hover:shadow-lg'}`}>
              {isMuted ? <MicOff size={18}/> : <Mic size={18}/>}
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button onClick={onDeafenToggle} className={`flex flex-col items-center justify-center p-2.5 retro-border transition-all shadow-md ${isDeafened ? 'bg-red-500 text-white' : 'retro-bg-secondary hover:-translate-y-0.5 hover:shadow-lg'}`}>
              {isDeafened ? <VolumeX size={18}/> : <Volume2 size={18}/>}
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{isDeafened ? 'Hear' : 'Deafen'}</span>
            </button>
            <button onClick={onCameraToggle} className={`flex flex-col items-center justify-center p-2.5 retro-border transition-all shadow-md ${isCameraOff ? 'bg-red-500 text-white' : 'retro-bg-primary hover:-translate-y-0.5 hover:shadow-lg'}`}>
              {isCameraOff ? <VideoOff size={18}/> : <Camera size={18}/>}
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">Cam</span>
            </button>
            <button onClick={onEndCall} className="flex flex-col items-center justify-center p-2.5 retro-border bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-105 shadow-md">
              <PhoneOff size={18} className="rotate-[135deg]"/>
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LivingBackground({ weather }) {
  const [elements, setElements] = useState([]);
  const generateLightningPath = () => {
    let path = `M 100 0`;
    let currentX = 100;
    for (let y = 20; y <= 300; y += 30) {
      currentX += (Math.random() - 0.5) * 80;
      path += ` L ${currentX} ${y}`;
    }
    return path;
  };
  useEffect(() => {
    setElements([]);
    const timer = setTimeout(() => {
      const newElements = [];
      const count = weather === 'rain' ? 30 : weather === 'storm' ? 45 : weather === 'snow' ? 20 : weather === 'clouds' ? 4 : weather === 'clear' ? 15 : 0;
      for (let i = 0; i < count; i++) {
        if (weather === 'rain') newElements.push({ id: i, type: 'rain', left: Math.random() * 100, delay: Math.random() * 2, duration: 0.5 + Math.random() * 0.5 });
        else if (weather === 'storm') newElements.push({ id: i, type: 'storm', left: Math.random() * 120, delay: Math.random() * 1.5, duration: 0.3 + Math.random() * 0.3 });
        else if (weather === 'snow') newElements.push({ id: i, type: 'snow', left: Math.random() * 100, delay: Math.random() * 5, duration: 3 + Math.random() * 3, size: 2 + Math.random() * 4 });
        else if (weather === 'clouds') newElements.push({ id: i, type: 'cloud', top: Math.random() * 100, delay: Math.random() * 20, duration: 30 + Math.random() * 20, size: 200 + Math.random() * 300 });
        else if (weather === 'clear') newElements.push({ id: i, type: 'star', left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 5, duration: 2 + Math.random() * 3, size: 2 + Math.random() * 3 });
      }
      if (weather === 'thunder' || weather === 'storm') {
         newElements.push({ id: 'bolt1', type: 'lightning', left: 10 + Math.random() * 80, delay: 0, duration: 4 + Math.random() * 3, path: generateLightningPath() });
         newElements.push({ id: 'bolt2', type: 'lightning', left: 10 + Math.random() * 80, delay: 2, duration: 5 + Math.random() * 2, path: generateLightningPath() });
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
        if (e.type === 'lightning') return <svg key={e.id} className="svg-lightning" viewBox="0 0 200 300" style={{ left: `${e.left}%`, width: '200px', height: '300px', animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }}><path d={e.path} /></svg>
        return null;
      })}
    </div>
  );
}

function FloatingEnvelope({ doodle, onClick }) {
  return (
    <div className="envelope-wrapper drop-shadow-xl" style={{ top: `${doodle.y}vh`, left: `${doodle.x}vw` }} onClick={() => onClick(doodle)}>
      <div className="relative">
        <Mail size={64} className="text-white fill-[var(--primary)]" />
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white animate-pulse">NEW!</span>
      </div>
    </div>
  );
}

function GameInviteModal({ invite, partnerName, onAccept, onDecline, sfx }) {
  const titles = {
    tictactoe: 'Tic-Tac-Toe',
    'tic-tac-toe': 'Tic-Tac-Toe',
    pictionary: 'Pictionary',
    memory: 'Memory Match',
    wordle: 'Retro Word',
    sudoku: 'Sudoku',
    chess: 'Chess',
    quiz: 'Couples Quiz',
    '2048': '2048',
    typing: 'Typing Race',
    wyr: 'Would You Rather',
    uno: 'Retro Uno',
    retrouno: 'Retro Uno',
    othello: 'Othello',
    pool: '8-Ball Pool',
    '8-ballpool': '8-Ball Pool',
    '8ballpool': '8-Ball Pool',
    bluff: 'Cheat (Bluff)'
  };
  const gameId = invite?.metadata?.gameId || invite?.gameId || '';
  let title = titles[gameId?.toLowerCase().replace(/[^a-z0-9]/g, '')] || gameId || 'Game';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('tic-tac-toe')) title = 'Tic-Tac-Toe';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('chess')) title = 'Chess';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('uno')) title = 'Retro Uno';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('pool')) title = '8-Ball Pool';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('typing')) title = 'Typing Race';

  console.log('[GameInviteModal] invite:', invite);
  console.log('[GameInviteModal] rendered text:', `They are waiting in the lobby for ${title} (${invite?.metadata?.mode || invite?.mode || 'remote'}).`);

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <RetroWindow title="incoming_invite.exe" onClose={onDecline} className="max-w-md w-full border-4 border-dashed border-[var(--primary)] shadow-[0_0_50px_var(--primary)] animate-pulse" data-testid="game-invite-modal">
        <div className="flex flex-col items-center p-6 text-center">
          <Gamepad2 size={64} className="text-[var(--primary)] mb-4 animate-bounce" />
          <h2 className="text-2xl font-black uppercase mb-2">{partnerName} invited you!</h2>
          <h3 className="font-bold opacity-80 mb-8">They are waiting in the lobby for {title} ({invite?.metadata?.mode || invite?.mode || 'remote'}).</h3>
          <div className="flex gap-4 w-full">
            <RetroButton variant="white" onClick={() => { playAudio('click', sfx); onDecline(); }} className="flex-1 py-4 text-black border-dashed">Decline</RetroButton>
            <RetroButton variant="primary" onClick={() => { playAudio('click', sfx); onAccept(); }} className="flex-1 py-4 text-white font-black" data-testid="accept-game-btn">Accept & Join</RetroButton>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

function DoodleReceiverModal({ doodleData, partnerName, onClose, onScrapbook, onRedoodle, onReply }) {
  const [hearted, setHearted] = useState(false);
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = doodleData;
    link.download = `doodle_from_partner_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleHeart = () => {
    if (hearted) return;
    setHearted(true);
    onScrapbook(doodleData);
  };
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <RetroWindow title={`doodle_from_${(partnerName || 'partner').toLowerCase()}.exe`} onClose={onClose} className="max-w-md w-full">
        <div className="flex flex-col items-center p-4 bg-white retro-border shadow-inner">
          <img src={doodleData} alt="Received Doodle" className="w-full aspect-square object-contain bg-gray-50 border-2 border-dashed border-gray-300 mb-6" style={{ imageRendering: 'pixelated' }} />
          <div className="grid grid-cols-2 gap-3 w-full">
            <RetroButton onClick={handleHeart} className={`flex items-center justify-center gap-2 py-3 ${hearted ? 'bg-pink-100 border-pink-400 text-pink-600' : 'bg-white'}`}><Heart size={18} className={hearted ? "fill-pink-500 text-pink-500 animate-bounce" : ""} />{hearted ? 'Saved!' : 'Heart'}</RetroButton>
            <RetroButton onClick={() => onRedoodle(doodleData)} variant="primary" className="flex items-center justify-center gap-2 py-3"><PenTool size={18} /> Redoodle</RetroButton>
            <RetroButton onClick={() => onReply(doodleData)} className="flex items-center justify-center gap-2 py-3 bg-blue-50 border-blue-300"><MessageSquare size={18} /> Reply</RetroButton>
            <RetroButton onClick={handleDownload} className="flex items-center justify-center gap-2 py-3 bg-gray-100"><Download size={18} /> Save Device</RetroButton>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();


  
  const { user, userId, roomId, partnerId, loading: authLoading, roomLoading } = useAuth();
  const { globalState, onlineUsers, updateSyncState, roomProfiles, broadcast } = useSync();
  const { messages: chatHistory, sendMessage: syncSendMessage, updateMessage: syncUpdateMessage } = useChat();
  const { 
    calling, isRinging, incomingCall, callDuration, 
    remoteStream, isMuted, isDeafened, isCameraOff,
    acceptCall, endCall, toggleMic, toggleCamera, toggleDeafen, isOnline
  } = useCall();

  const [theme, setTheme] = useLocalStorage('app_theme', 'matcha');
  const [weather, setWeather] = useState('clear'); 
  const [sfxEnabled, setSfxEnabled] = useLocalStorage('sfx_enabled', true); 
  const [triggerShake] = useState(false); 
  const [confetti, setConfetti] = useState(false);
  const [radioState, setRadioState] = useLocalStorage('radio_state', { isPlaying: false, channelIdx: 0, volume: 0.4 });
  const [showKiss, setShowKiss] = useState(false);
  
  const handleShareToChat = (text, image, metadata) => {
    if (!roomId) return;
    const msg = {
      id: Date.now().toString(),
      text,
      image,
      metadata,
      sender: userId,
      timestamp: new Date().toISOString(),
      type: metadata?.type || 'text'
    };
    
    // Broadcast for real-time modal if it's an invite
    if (metadata?.type === 'game_invite_modal') {
      broadcast('invite', { ...msg, action: 'invite', timestamp: Date.now() });
    } else if (syncSendMessage) {
      syncSendMessage(text, metadata?.type || 'text', { ...metadata, image });
    }
  };
  
  const [floatingDoodles, setFloatingDoodles] = useState([]);
  const [doodleQueue, setDoodleQueue] = useState([]);
  const activeDoodleView = doodleQueue[0] || null;
  const closeDoodle = () => setDoodleQueue(prev => prev.slice(1));
  const [gameInvite, setGameInvite] = useState(null);
  const processedInvites = useRef(new Set());

  const partnerProfile = globalState.room_profiles?.[partnerId] || {};
  const partnerName = partnerProfile.name || 'Partner';
  const coupleData = globalState.couple_data || { petName: 'pet', petSkin: '/assets/cat_1_9' };
  const isPartnerOnline = onlineUsers[partnerId]?.status === 'active';
  const navigateTo = (v) => { playAudio('click', sfxEnabled); navigate(v === 'dashboard' ? '/dashboard' : `/${v}`); };

  useEffect(() => {
    const onboardingPaths = ['/signin', '/signup', '/handshake', '/password-reset'];
    const isOnboarding = onboardingPaths.some(p => location.pathname.startsWith(p)) || location.pathname === '/';
    document.documentElement.setAttribute('data-theme', isOnboarding ? 'default' : theme); 
  }, [theme, location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    let resizeTimer;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', debouncedResize);
  }, []);

  useEffect(() => {
    if (!userId || !roomId) return;
    const syncProfile = async () => {
        const currentProfile = roomProfiles?.[userId];
        if (!currentProfile) return;
        updateSyncState('room_profiles', {
            ...roomProfiles,
            [userId]: {
                ...currentProfile,
                status: isOnline ? 'online' : 'offline',
                lastSeen: new Date().toISOString()
            }
        });
    };
    syncProfile();
  }, [userId, roomId, isOnline]);

  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('attic_notifications', true);
  const [partnerOnlineModal, setPartnerOnlineModal] = useState(false);
  const [textNotifications, setTextNotifications] = useState([]);
  const prevPartnerOnline = useRef(false);
  const prevChatLength = useRef(0);

  useEffect(() => {
    if (isPartnerOnline && prevPartnerOnline.current === false && notificationsEnabled) {
      setPartnerOnlineModal(true);
      playAudio('notif', sfxEnabled);
      setTimeout(() => setPartnerOnlineModal(false), 4000);
    }
    prevPartnerOnline.current = isPartnerOnline;
  }, [isPartnerOnline, notificationsEnabled, sfxEnabled]);

  useEffect(() => {
    if (!Array.isArray(chatHistory) || !partnerId) return;
    const pendingInvites = chatHistory.filter(m => 
      m.type === 'game_invite' && 
      m.sender === partnerId && 
      (m.metadata?.status === 'pending')
    );
    const latestInvite = pendingInvites[pendingInvites.length - 1];
    if (latestInvite && !processedInvites.current.has(latestInvite.id) && gameInvite?.id !== latestInvite.id) {
      setGameInvite(latestInvite);
      playAudio('notif', sfxEnabled);
    }
  }, [chatHistory, partnerId, sfxEnabled, gameInvite?.id]);

  const lobbyState = globalState?.arcade_lobby;

  useEffect(() => {
    if (lobbyState?.gameId && (lobbyState?.players || []).includes(partnerId) && lobbyState?.status === 'waiting') {
      if (!(lobbyState?.players || []).includes(userId) && gameInvite?.id !== lobbyState.gameId) {
        setGameInvite({
          id: lobbyState.gameId,
          gameId: lobbyState.gameId,
          mode: lobbyState.config?.mode || '1v1_remote',
          metadata: { gameId: lobbyState.gameId }
        });
      }
    }
  }, [lobbyState, partnerId, userId, gameInvite?.id]);

  useEffect(() => {
    if (!Array.isArray(chatHistory)) return;
    const newMsgs = chatHistory.slice(prevChatLength.current);
    newMsgs.forEach(msg => {
      if (prevChatLength.current > 0 && msg.sender === partnerId && location.pathname !== '/chat' && notificationsEnabled) {
        playAudio('notif', sfxEnabled);
        const id = Date.now() + Math.random();
        setTextNotifications(prev => [...prev, { ...msg, notifId: id }]);
        setTimeout(() => setTextNotifications(prev => prev.filter(n => n.notifId !== id)), 5000);
      }
    });
    prevChatLength.current = chatHistory.length;
  }, [chatHistory, location.pathname, partnerId, notificationsEnabled, sfxEnabled]);

  // Global Broadcast Listeners
  useEffect(() => {
    const handler = ({ detail: { event, payload } }) => {
      if (event === 'interaction' && payload.type === 'kiss' && payload.from === partnerId) {
        setShowKiss(true);
        playAudio('notif', sfxEnabled);
        setTimeout(() => setShowKiss(false), 4500);
      }
      if (payload.action === 'doodle' && payload.image) {
        setDoodleQueue(prev => [...prev, { image: payload.image, sender: payload.sender }]);
      }
      if (payload.action === 'invite' && payload.sender !== userId) {
        const isRecent = !payload.timestamp || (Date.now() - payload.timestamp < 30000);
        if (isRecent) {
           setGameInvite(payload);
        }
      }
    };

    window.addEventListener('sync_broadcast', handler);
    return () => { 
        window.removeEventListener('sync_broadcast', handler);
    };
  }, [partnerId, sfxEnabled]);

  const remoteAudioRef = useRef(null);
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = isDeafened;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, isDeafened]);

  if (authLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-window"><AppLoader /></div>;

  const isOnboarding = ['/login', '/signup', '/signin', '/handshake'].includes(location.pathname);

  return (
    <div className={`retro-everywhere min-h-[100dvh] w-full mesh-bg flex flex-col relative ${isOnboarding ? '' : 'items-center p-2 sm:p-4 md:p-8'} ${triggerShake ? 'animate-shake' : ''}`}>
        <div className={`absolute inset-0 bg-pattern-${coupleData.settings?.bgPattern || 'grid'} opacity-10 pointer-events-none`} />
        <LivingBackground weather={weather} />
        <WeatherOverlay weather={weather} />
        <Confetti active={confetti} />
        {user && roomId && <StrayTray radioState={radioState} setRadioState={setRadioState} />}

        {showKiss && (
          <div className="kiss-container">
            {[...Array(30)].map((_, i) => (
              <div key={i} className="floating-heart" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 1.5}s`, fontSize: `${1.5 + Math.random() * 2.5}rem`, opacity: 0.3 + Math.random() * 0.4 }}>{Math.random() > 0.5 ? '💖' : '💗'}</div>
            ))}
          </div>
        )}

        {incomingCall && isRinging && (
          <div className="fixed inset-0 z-[var(--z-modal)] bg-black/10 flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-window/95 text-main-text retro-border shadow-2xl max-w-sm w-full p-8 text-center animate-in slide-in-from-bottom-10 border-t-4 border-t-primary">
              <div className="w-24 h-24 rounded-lg bg-secondary text-secondary-text retro-border mx-auto flex items-center justify-center mb-6 animate-pulse shadow-[0_0_40px_var(--secondary)] relative overflow-hidden">
                  {incomingCall.type === 'video' ? <Video size={48} className="text-white absolute z-0"/> : <Phone size={48} className="text-white absolute z-0"/>}
                  {partnerProfile.pfp && <img src={partnerProfile.pfp} alt="partner" className="w-full h-full object-cover relative z-10 bg-window" onError={(e) => { e.target.style.display = 'none'; }} />}
              </div>
              <h2 className="text-2xl font-black mb-1">{incomingCall.fromName}</h2>
              <p className="text-[10px] font-black text-primary mb-8 uppercase tracking-[0.2em] animate-pulse">Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call</p>
              <div className="flex gap-6 justify-center">
                <button onClick={endCall} className="p-5 bg-red-500 text-white retro-border rounded-full hover:bg-red-600 transition-all hover:scale-110 shadow-lg group"><PhoneOff size={28} className="rotate-[135deg]"/></button>
                <button onClick={acceptCall} className="p-5 bg-green-500 text-white retro-border rounded-full hover:bg-green-600 transition-all hover:scale-110 shadow-lg"><Phone size={28}/></button>
              </div>
            </div>
          </div>
        )}

        {calling && (
          <PremiumCallHub calling={calling} callDuration={callDuration} isMuted={isMuted} isDeafened={isDeafened} isCameraOff={isCameraOff} onMicToggle={toggleMic} onDeafenToggle={toggleDeafen} onCameraToggle={toggleCamera} onEndCall={endCall} partnerName={partnerName} partnerPfp={partnerProfile.pfp} sfx={sfxEnabled} remoteStream={remoteStream} isRinging={isRinging} type={calling} />
        )}
        
        <audio ref={remoteAudioRef} autoPlay style={{display: 'none'}} />

        {partnerOnlineModal && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[var(--z-toast)] animate-in slide-in-from-top-10 fade-in duration-500 pointer-events-none">
            <div className="bg-primary text-primary-text px-6 py-3 retro-border retro-shadow-dark flex items-center gap-3 rounded-full">
              <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse shadow-[0_0_10px_#4ade80]"></div>
              <span className="font-black uppercase tracking-widest text-xs">{partnerName} is Online!</span>
            </div>
          </div>
        )}

        <div className="fixed top-24 right-4 z-[var(--z-notification)] flex flex-col gap-2 pointer-events-none">
          {textNotifications.map(notif => (
            <div key={notif.notifId} className="bg-window text-main-text retro-border retro-shadow-dark p-3 w-64 animate-in slide-in-from-right-10 fade-in duration-300 pointer-events-auto cursor-pointer" onClick={() => navigate('/chat')}>
              <div className="flex justify-between items-start mb-1">
                <span className="font-black text-[10px] uppercase text-primary flex items-center gap-1"><Bell size={10} /> Message from {partnerName}</span>
                <button onClick={(e) => { e.stopPropagation(); setTextNotifications(p => p.filter(n => n.notifId !== notif.notifId)) }} className="opacity-50 hover:opacity-100"><X size={12}/></button>
              </div>
              <p className="text-xs truncate font-bold opacity-90">{notif.type === 'text' ? notif.text : `Sent a ${notif.type}`}</p>
            </div>
          ))}
        </div>

        {gameInvite && (
          <GameInviteModal 
            invite={gameInvite} partnerName={partnerName}
            onAccept={() => {
              setGameInvite(null);
              const gId = gameInvite.metadata?.gameId || gameInvite.gameId;
              let currentLobby = lobbyState;
              if (isTestMode()) {
                const cached = localStorage.getItem('attic_test_arcade_lobby');
                if (cached) {
                  try {
                    currentLobby = JSON.parse(cached);
                  } catch (e) {}
                }
              }
              if (currentLobby?.gameId === gId) {
                const currentPlayers = Array.from(new Set([...(currentLobby.players || []), userId]));
                const updatedLobby = {
                  ...currentLobby,
                  players: currentPlayers,
                  status: currentPlayers.length >= 2 ? 'ready' : 'waiting'
                };
                if (isTestMode()) {
                  localStorage.setItem('attic_test_arcade_lobby', JSON.stringify(updatedLobby));
                }
                updateSyncState('arcade_lobby', updatedLobby);
              }
              navigate(`/activities/${gId}`);
            }}
            onDecline={() => setGameInvite(null)}
            sfx={sfxEnabled}
          />
        )}

        {floatingDoodles.map((doodle) => (
           <FloatingEnvelope key={doodle.id} doodle={doodle} onClick={(d) => { playAudio('click', sfxEnabled); setDoodleQueue(prev => [...prev, { image: d.data, sender: partnerId }]); setFloatingDoodles(prev => prev.filter((item) => item.id !== d.id)); }} />
        ))}

        {activeDoodleView && (
          <DoodleReceiverModal 
            doodleData={activeDoodleView.image}
            partnerName={roomProfiles[activeDoodleView.sender]?.name || 'Partner'}
            onClose={closeDoodle}
            onScrapbook={async () => { toast('Saved to Scrapbook!', 'success'); }}
            onRedoodle={() => { closeDoodle(); navigateTo('doodle'); }}
            onReply={() => { closeDoodle(); navigateTo('chat'); }}
          />
        )}

        <div className="app-glitch-wrapper flex-1 w-full flex flex-col items-center" data-hawkins={theme === 'hawkins'}>
          <Suspense fallback={<AppLoader />}>
            <Routes key={location.pathname}>
              <Route path="/" element={<PublicRoute><LandingView /></PublicRoute>} />
              <Route path="/dashboard" element={
                authLoading || (user && roomLoading && !roomId) ? <AppLoader /> :
                !user ? <Navigate to="/" replace /> :
                !roomId ? <Navigate to="/handshake" replace /> :
                <Dashboard setView={navigateTo} theme={theme} setTheme={setTheme} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} weather={weather} setWeather={setWeather} radioState={radioState} setRadioState={setRadioState} />
              } />
              <Route path="/signup" element={<AuthView mode="signup" />} />
              <Route path="/signin" element={<AuthView mode="signin" />} />
              <Route path="/password-reset" element={<ResetPasswordView sfx={sfxEnabled} />} />
              <Route path="/handshake" element={
                authLoading || (user && roomLoading && !roomId) ? <AppLoader /> :
                !user ? <Navigate to="/" replace /> :
                roomId ? <Navigate to="/dashboard" replace /> :
                <HandshakeView />
              } />
              <Route path="/settings" element={<ProtectedRoute><SettingsView theme={theme} setTheme={setTheme} weather={weather} setWeather={setWeather} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} profile={roomProfiles?.[userId] || { name: 'You', emoji: '👤' }} setProfile={(newProf) => updateSyncState('room_profiles', { ...globalState.room_profiles, [userId]: typeof newProf === 'function' ? newProf(roomProfiles?.[userId] || { name: 'You', emoji: '👤' }) : newProf })} coupleData={globalState.couple_data || { petName: 'pet', petSkin: '/assets/cat_1_9' }} setCoupleData={(newData) => updateSyncState('couple_data', typeof newData === 'function' ? newData(globalState.couple_data || {}) : newData)} onClose={()=>navigateTo('dashboard')} /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatView onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/doodle" element={<ProtectedRoute><DoodleApp onClose={()=>{navigateTo('dashboard');}} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/shared-canvas" element={<ProtectedRoute><PersistentDoodleApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/capsule" element={<ProtectedRoute><TimeCapsuleApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/lists" element={<ProtectedRoute><ListsApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><CalendarApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/scrapbook" element={<ProtectedRoute><ScrapbookApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/pixelart" element={<ProtectedRoute><PixelArtApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/notes" element={<ProtectedRoute><SharedNotes onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/dreams" element={<ProtectedRoute><DreamJournal onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/daily-q" element={<ProtectedRoute><DailyQuestion onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/resume" element={<ProtectedRoute><RelationshipResume onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/legal" element={<LegalView onClose={() => navigateTo('dashboard')} />} />
              <Route path="/activities/*" element={<ProtectedRoute><ActivitiesHub 
                onClose={()=>navigateTo('dashboard')} 
                sfx={sfxEnabled} 
                setConfetti={setConfetti} 
                onShareToChat={handleShareToChat}
                userId={userId}
                partnerId={partnerId}
                scores={globalState.game_scores}
                setScores={(val) => updateSyncState('game_scores', typeof val === 'function' ? val(globalState.game_scores || {}) : val)}
                profile={roomProfiles[userId]}
                roomProfiles={roomProfiles}
                myName={roomProfiles[userId]?.name}
                partnerName={partnerName}
                syncedRoomId={roomId}
                pictionaryState={globalState.pictionary_state}
                setPictionaryState={(val) => updateSyncState('pictionary_state', typeof val === 'function' ? val(globalState.pictionary_state || {}) : val)}
                onSaveToScrapbook={(img) => {}}
              /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
    </div>
  );
}
