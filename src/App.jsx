import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Dashboard } from './views/Dashboard.jsx';
import { ChatView } from './views/ChatView.jsx';
import { SettingsView } from './views/SettingsView.jsx';
import { useGlobalSync, initializeRoomSync } from './hooks/useSupabaseSync.js';
import { supabase } from './lib/supabase.js';

import { DoodleApp, PersistentDoodleApp, TimeCapsuleApp, ListsApp, CalendarApp, ScrapbookApp, DoodleViewer } from './apps/UtilityApps.jsx';
import { PixelArtApp } from './apps/PixelArtApp.jsx';
import { DreamJournal } from './apps/DreamJournal.jsx';
import { DailyQuestion, getMilestoneToday, MilestoneCelebration, RelationshipResume } from './components/Features.jsx';
import { ActivitiesHub } from './games/index.jsx';
import { ResetPasswordView } from './views/ResetPasswordView.jsx';
import { ProtectedRoute, PublicRoute } from './components/AuthGuards.jsx';

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
    const newElements = [];
    if (weather === 'rain') {
      for (let i = 0; i < 60; i++) {
        newElements.push({ id: i, left: Math.random() * 100, delay: Math.random() * 2, duration: 0.5 + Math.random() * 0.5 });
      }
    } else if (weather === 'snow') {
      for (let i = 0; i < 40; i++) {
        newElements.push({ id: i, left: Math.random() * 100, delay: Math.random() * 5, duration: 3 + Math.random() * 3, size: 2 + Math.random() * 4 });
      }
    } else if (weather === 'clouds') {
      for (let i = 0; i < 6; i++) {
        newElements.push({ id: i, top: Math.random() * 100, delay: Math.random() * 20, duration: 30 + Math.random() * 20, size: 200 + Math.random() * 300 });
      }
    } else if (weather === 'clear') {
       for (let i = 0; i < 50; i++) {
        newElements.push({ id: i, left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 5, duration: 2 + Math.random() * 3, size: 1 + Math.random() * 2 });
      }
    }
    setElements(newElements);
  }, [weather]);

  return (
    <div className="weather-layer">
      {weather === 'rain' && elements.map(e => (
        <div key={e.id} className="rain-drop" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s` }} />
      ))}
      {weather === 'snow' && elements.map(e => (
        <div key={e.id} className="snow-flake" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size }} />
      ))}
      {weather === 'clouds' && elements.map(e => (
        <div key={e.id} className="cloud-vessel bg-white rounded-full" style={{ top: `${e.top}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size / 2 }} />
      ))}
      {weather === 'clear' && elements.map(e => (
        <div key={e.id} className="star-particle shadow-white" style={{ left: `${e.left}%`, top: `${e.top}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.duration}s`, width: e.size, height: e.size }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   APP — THE MAIN ENTRY POINT
   ═══════════════════════════════════════════════════════ */
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, partnerId } = useUserContext();

  // 1. Auth & Session State
  const [session, setSession] = useState(null);
  const [hasRoom, setHasRoom] = useLocalStorage('attic_has_room', false);
  const [loading, setLoading] = useState(true);
  const [syncedRoomId, setSyncedRoomId] = useState(null);

  // 2. Global Sync States
  const [profile, setProfile] = useLocalStorage('user_profile', { 
    name: '', 
    emoji: '😊',
    pfp: '' // Will be set on first load if empty
  }); 

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

  const [scores, setScores] = useGlobalSync('game_scores', {});
  const [streaks, setStreaks] = useGlobalSync('user_streaks', {});
  const [chatHistory, setChatHistory] = useGlobalSync('chat_history', INITIAL_CHAT);
  const [sharedImages, setSharedImages] = useGlobalSync('shared_images', []);
  const [doodles, setDoodles] = useGlobalSync('shared_doodles', []); 
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
  const [roomProfiles, setRoomProfiles] = useGlobalSync('room_profiles', {});

  // Update room profile whenever local profile changes
  useEffect(() => {
    if (userId && JSON.stringify(roomProfiles[userId]) !== JSON.stringify(profile)) {
      setRoomProfiles(prev => ({ ...prev, [userId]: profile }));
      console.log(`[SYNC] Local profile pushed for ${profile.name}`);
    }
    if (profile && profile.name) {
      localStorage.setItem('attic_profile', JSON.stringify(profile));
    }
  }, [profile]);

  const partnerProfile = useMemo(() => roomProfiles[partnerId] || {}, [roomProfiles, partnerId]);
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
    if (hasRoom && coupleData.nicknames && coupleData.nicknames[userId]) {
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
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== lastMsg.id));
            }, 5000);
        }
    }
  }, [chatHistory, partnerId, location.pathname, sfxEnabled]);

  const handleEndCall = () => {
    playAudio('click', sfxEnabled);
    if (callState.status !== 'idle') {
      setCallState({ status: 'ended', type: callState.type, endedBy: userId, timestamp: Date.now() });
      setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, type: 'call_invite', status: 'ended', callType: callState.type, time: new Date().toLocaleTimeString() }]);
    }
    setCalling(null); setIsRinging(false);
    if (currentCallRef.current) { try { currentCallRef.current.close(); } catch(e){} currentCallRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
  };

  useEffect(() => {
    if (!userId) return;
    const initPeer = () => {
      const peer = new Peer(userId, { 
        debug: 1,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }, 
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Add your TURN server here for 100% connection reliability
          // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'password' }
        ] }
      });
      peerRef.current = peer;
      peer.on('call', (call) => { 
        currentCallRef.current = call; 
        // Only auto-answer if we have already accepted in the state
        if (callState.status === 'connected' || callState.status === 'accepted') {
           navigator.mediaDevices.getUserMedia({ audio: true, video: callState.type === 'video' }).then(stream => {
              call.answer(stream);
              call.on('stream', (rs) => { 
                if(remoteAudioRef.current) { 
                    remoteAudioRef.current.srcObject = rs; 
                    remoteAudioRef.current.play().catch(e => console.log("Audio play blocked, waiting for interaction", e)); 
                } 
                if(remoteVideoRef.current) { remoteVideoRef.current.srcObject = rs; }
              });
           }).catch(err => { console.error("Media access failed", err); handleEndCall(); });
        }
      });
      peer.on('error', (err) => {
        if (err.type === 'disconnected' || err.type === 'network') setTimeout(initPeer, 3000);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      if (!peerRef.current || peerRef.current.destroyed) throw new Error("Peer disconnected");
      
      const call = peerRef.current.call(partnerId, stream);
      currentCallRef.current = call;
      
      call.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        if (remoteAudioRef.current) { 
            remoteAudioRef.current.srcObject = remoteStream; 
            remoteAudioRef.current.play().catch(e => console.error("Audio block", e)); 
        }
      });
      
      setCallState(prev => ({ ...prev, status: 'connected' }));
    } catch (err) { console.error('Failed call initiation', err); handleEndCall(); }
  };

  const startCall = (type) => {
    playAudio('click', sfxEnabled);
    if (callState.status !== 'idle') return;
    setIsRinging(true);
    setIsCameraOff(type === 'audio'); // Audio call defaults to camera off
    setCallState({ status: 'ringing', type, callerId: userId, calleeId: partnerId, timestamp: Date.now() });
    setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, type: 'call_invite', callType: type, status: 'ringing', time: new Date().toLocaleTimeString() }]);
  };

  const acceptCall = async () => {
    playAudio('click', sfxEnabled);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callState.type === 'video' });
      localStreamRef.current = stream;
      setCallState(prev => ({ ...prev, status: 'accepted' }));
      setChatHistory(prev => prev.map(m => (m.type === 'call_invite' && m.status === 'ringing') ? { ...m, status: 'accepted' } : m));
    } catch (err) { console.error('Failed accept', err); handleEndCall(); }
    setIncomingCall(null);
  };

  const rejectCall = () => { 
    playAudio('click', sfxEnabled);
    setCallState({ status: 'rejected', type: callState.type, timestamp: Date.now() });
    setChatHistory(prev => prev.map(m => (m.type === 'call_invite' && m.status === 'ringing') ? { ...m, status: 'rejected' } : m));
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
    } catch (err) { console.error("Room check failed", err); setHasRoom(false); } finally { setLoading(false); }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const s = data?.session || null; setSession(s);
      if (s) await checkRoomAndSync(s.user.id); else setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return; setSession(s);
      if (s) checkRoomAndSync(s.user.id); else { setHasRoom(false); setSyncedRoomId(null); setLoading(false); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); setSession(null); setHasRoom(false); navigate('/login'); };
  const handleAuthSuccess = (data) => {
    if (data.name) setProfile(prev => ({ ...prev, name: data.name }));
    setSession(data.session);
    navigate('/');
  };
  const handlePaired = async (roomId) => { 
    setHasRoom(true); 
    setSyncedRoomId(roomId); 
    await initializeRoomSync(roomId); 
    navigate('/'); 
  };
  const handleShareToChat = (text, imgData) => { setChatHistory(p => [...p, { id: Date.now(), sender: userId, type: imgData ? 'image' : 'text', url: imgData, text: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent' }]); };
  const navigateTo = (v) => { playAudio('click', sfxEnabled); if (v === 'dashboard') navigate('/'); else navigate(`/${v}`); };

  if (loading) return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#fffdf9]"><div className="w-8 h-8 border-4 border-[#ff6b9d] border-t-transparent rounded-full animate-spin mb-4" /><p className="font-bold text-xs opacity-40 tracking-widest uppercase">Initializing Attic...</p></div>;

  const isOnboarding = ['/login', '/signup', '/signin', '/handshake'].includes(location.pathname);

  return (
    <ToastProvider>
      <div className={`min-h-[100dvh] w-full mesh-bg flex flex-col relative ${isOnboarding ? '' : 'items-center p-2 sm:p-4 md:p-8'} ${triggerShake ? 'animate-shake' : ''}`}>
        <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />
        <LivingBackground weather={weather} />
        <WeatherOverlay weather={weather} />
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

        <Routes>
          <Route path="/login" element={<PublicRoute session={session} hasRoom={hasRoom}><LandingView onTryAttic={() => navigate('/signup')} onSignIn={() => navigate('/signin')} /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signup" onAuthSuccess={handleAuthSuccess} onBack={() => navigate('/login')} /></PublicRoute>} />
          <Route path="/signin" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signin" onAuthSuccess={handleAuthSuccess} onBack={() => navigate('/login')} /></PublicRoute>} />
          <Route path="/password-reset" element={<ResetPasswordView sfx={true} />} />
          <Route path="/handshake" element={<ProtectedRoute session={session} hasRoom={hasRoom}><HandshakeView session={session} onPaired={handlePaired} onLogout={handleLogout} /></ProtectedRoute>} />

          <Route path="/" element={<ProtectedRoute session={session} hasRoom={hasRoom}><Dashboard setView={navigateTo} profile={profile} myDisplayName={myDisplayName} partnerProfile={partnerProfile} coupleData={coupleData} setCoupleData={setCoupleData} scores={scores} doodles={doodles} chatHistory={chatHistory} onOpenDoodle={setViewingDoodle} sfx={sfxEnabled} setTriggerShake={setTriggerShake} radioState={radioState} setRadioState={setRadioState} userId={userId} partnerId={partnerId} streaks={streaks} theme={theme} setTheme={setTheme} setProfile={setProfile} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} onLogout={handleLogout} onDelete={()=>{}} weather={weather} setWeather={setWeather} /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute session={session} hasRoom={hasRoom}><SettingsView theme={theme} setTheme={setTheme} weather={weather} setWeather={setWeather} profile={profile} setProfile={setProfile} coupleData={coupleData} setCoupleData={setCoupleData} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} scores={scores} userId={userId} onLogout={handleLogout} onDelete={()=>{}} onClose={()=>navigateTo('dashboard')} /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ChatView profile={profile} partnerProfile={partnerProfile} roomProfiles={roomProfiles} partnerNickname={partnerName} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} chatHistory={chatHistory} setChatHistory={setChatHistory} userId={userId} partnerId={partnerId} onStartCall={startCall} sharedImages={sharedImages} setSharedImages={setSharedImages} /></ProtectedRoute>} />
          <Route path="/doodle" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DoodleApp initialDoodle={replyDoodle} onClose={()=>{navigateTo('dashboard'); setReplyDoodle(null);}} onSendDoodle={(d) => { const de = {id: Date.now(), sender: userId, senderName: profile?.name, userId: userId, ...d}; setDoodles(p=>[...p, de]); setSharedImages(p => [...new Set([...p, d.img])]); }} onSaveToScrapbook={(url) => setSharedImages(p=>[...new Set([...p, url])])} sfx={sfxEnabled} /></ProtectedRoute>} />
          <Route path="/shared-canvas" element={<ProtectedRoute session={session} hasRoom={hasRoom}><PersistentDoodleApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
          <Route path="/capsule" element={<ProtectedRoute session={session} hasRoom={hasRoom}><TimeCapsuleApp onClose={()=>navigateTo('dashboard')} letters={letters} setLetters={setLetters} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
          <Route path="/lists" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ListsApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute session={session} hasRoom={hasRoom}><CalendarApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
          <Route path="/scrapbook" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ScrapbookApp images={sharedImages} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
          <Route path="/pixelart" element={<ProtectedRoute session={session} hasRoom={hasRoom}><PixelArtApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} onSaveToScrapbook={(url) => setSharedImages(p=>[...new Set([...p, url])])} userId={userId} /></ProtectedRoute>} />
          <Route path="/dreams" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DreamJournal onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
          <Route path="/dailyq" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DailyQuestion onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} /></ProtectedRoute>} />
          <Route path="/resume" element={<ProtectedRoute session={session} hasRoom={hasRoom}><RelationshipResume onClose={()=>navigateTo('dashboard')} profile={profile} coupleData={coupleData} scores={scores} sfx={sfxEnabled} userId={userId} partnerId={partnerId} /></ProtectedRoute>} />
          <Route path="/activities/*" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ActivitiesHub onClose={()=>navigateTo('dashboard')} scores={scores} setScores={setScores} sfx={sfxEnabled} setConfetti={setConfetti} onShareToChat={handleShareToChat} profile={profile} userId={userId} partnerId={partnerId} /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {milestoneShown && getMilestoneToday(coupleData.anniversary) && <MilestoneCelebration milestone={getMilestoneToday(coupleData.anniversary)} onClose={() => setMilestoneShown(true)} />}
        {viewingDoodle && ( <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"><DoodleViewer doodle={viewingDoodle} onClose={() => setViewingDoodle(null)} profileName={profile?.name} sfx={sfxEnabled} onRedoodle={(d) => { setViewingDoodle(null); setReplyDoodle(d); navigateTo('doodle'); }} onReplyToChat={(t, i) => { handleShareToChat(t, i); setViewingDoodle(null); navigateTo('chat'); }} /></div>)}
      </div>
    </ToastProvider>
  );
}
