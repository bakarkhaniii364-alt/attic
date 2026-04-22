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

import { DoodleApp, TimeCapsuleApp, ListsApp, CalendarApp, ScrapbookApp, DoodleViewer } from './apps/UtilityApps.jsx';
import { PixelArtApp } from './apps/PixelArtApp.jsx';
import { DreamJournal } from './apps/DreamJournal.jsx';
import { DailyQuestion, getMilestoneToday, MilestoneCelebration, RelationshipResume } from './components/Features.jsx';
import { ActivitiesHub } from './games/index.jsx';
import { ResetPasswordView } from './views/ResetPasswordView.jsx';
import { ProtectedRoute, PublicRoute } from './components/AuthGuards.jsx';

/* ═══════════════════════════════════════════════════════
   PREMIUM FLOATING CALL HUB (Discord-Robust)
   ═══════════════════════════════════════════════════════ */
function PremiumCallHub({ calling, callDuration, isMuted, isDeafened, isCameraOff, onMicToggle, onDeafenToggle, onCameraToggle, onEndCall, partnerName, sfx, remoteVideoRef, isRinging }) {
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
      className={`fixed z-[5000] retro-bg-window retro-border retro-shadow-dark transition-all duration-300 ${isMinimized ? 'w-48' : 'w-[90vw] sm:w-[400px]'}`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseDown={(e) => { if (!e.target.closest('button')) handleStart(e.clientX, e.clientY); }}
      onTouchStart={(e) => { if (!e.target.closest('button')) handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
    >
      <div className="bg-[var(--border)] text-white px-4 py-2 flex justify-between items-center font-bold text-xs select-none">
        <span className="flex items-center gap-2 truncate">
          {calling === 'video' ? <Video size={14} className="text-pink-400"/> : <Phone size={14} className="text-cyan-400"/>}
          {partnerName} • {isRinging ? 'Ringing...' : `${mins}:${secs.toString().padStart(2, '0')}`}
        </span>
        <div className="flex gap-3">
          <button onClick={() => setIsMinimized(!isMinimized)} className="hover:scale-110 transition-transform">
            {isMinimized ? <Maximize2 size={16}/> : <Minimize2 size={16}/>}
          </button>
          <button onClick={onEndCall} className="text-red-400 hover:text-red-600 transition-colors"><PhoneOff size={16}/></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col bg-black/5">
          <div className={`w-full aspect-video bg-black/90 relative overflow-hidden flex items-center justify-center`}>
            {isRinging ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full retro-bg-secondary retro-border flex items-center justify-center animate-pulse shadow-[0_0_30px_var(--secondary)]">
                   {calling === 'video' ? <Video size={40} /> : <Phone size={40} />}
                </div>
                <div className="text-white font-bold text-xs uppercase tracking-widest animate-bounce">Calling {partnerName}...</div>
              </div>
            ) : (
              <>
                {calling === 'video' && !isDeafened && !isCameraOff ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full retro-bg-secondary retro-border flex items-center justify-center">
                       {calling === 'video' ? <VideoOff size={32} /> : <Phone size={32} />}
                    </div>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{calling === 'video' ? (isCameraOff ? 'Camera Off' : 'Connecting...') : 'Audio Only'}</p>
                  </div>
                )}
              </>
            )}
            {!isRinging && <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[8px] text-white font-bold uppercase border border-white/20 backdrop-blur-sm">Remote</div>}
          </div>

          <div className="p-4 grid grid-cols-4 gap-2 bg-[var(--bg-window)]">
            <button onClick={onMicToggle} className={`flex flex-col items-center justify-center p-3 retro-border transition-all ${isMuted ? 'bg-red-400 text-white' : 'retro-bg-accent hover:-translate-y-1'}`}>
              {isMuted ? <MicOff size={20}/> : <Mic size={20}/>}
              <span className="text-[8px] font-bold mt-1 uppercase">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button onClick={onDeafenToggle} className={`flex flex-col items-center justify-center p-3 retro-border transition-all ${isDeafened ? 'bg-red-400 text-white' : 'retro-bg-secondary hover:-translate-y-1'}`}>
              {isDeafened ? <VolumeX size={20}/> : <Volume2 size={20}/>}
              <span className="text-[8px] font-bold mt-1 uppercase">{isDeafened ? 'Undeafen' : 'Deafen'}</span>
            </button>
            <button onClick={onCameraToggle} className={`flex flex-col items-center justify-center p-3 retro-border transition-all ${isCameraOff ? 'bg-red-400 text-white' : 'retro-bg-primary hover:-translate-y-1'}`}>
              {isCameraOff ? <VideoOff size={20}/> : <Camera size={20}/>}
              <span className="text-[8px] font-bold mt-1 uppercase">Cam</span>
            </button>
            <button onClick={onEndCall} className="flex flex-col items-center justify-center p-3 retro-border bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-105">
              <PhoneOff size={20} className="rotate-[135deg]"/>
              <span className="text-[8px] font-bold mt-1 uppercase">End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   APP — THE MAIN ENTRY POINT
   ═══════════════════════════════════════════════════════ */
export default function App() {
  const navigate = useNavigate();
  const { userId, partnerId } = useUserContext();

  // 1. Auth & Session State
  const [session, setSession] = useState(null);
  const [hasRoom, setHasRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncedRoomId, setSyncedRoomId] = useState(null);

  // 2. Global Sync States
  const [profile, setProfile] = useLocalStorage('user_profile', { name: '', emoji: '😊' }); 
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
  const [coupleData, setCoupleData] = useGlobalSync('couple_data', { anniversary: '', petName: 'pet', petSkin: '/assets/Cat Sprite Sheet.png', petHappy: 60, partnerNickname: '' });

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

  const handleEndCall = () => {
    setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, type: 'call_invite', status: 'ended', time: new Date().toLocaleTimeString() }]);
    setCalling(null); setIsRinging(false);
  };

  // Peer initialization with Global STUN Servers
  useEffect(() => {
    if (!userId) return;
    const initPeer = () => {
      const peer = new Peer(userId, { 
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      });
      peerRef.current = peer;
      peer.on('call', (call) => { 
        currentCallRef.current = call; 
        if (calling) {
           navigator.mediaDevices.getUserMedia({ audio: true, video: calling === 'video' }).then(stream => {
              call.answer(stream);
              call.on('stream', (rs) => { 
                if(remoteAudioRef.current) { remoteAudioRef.current.srcObject = rs; remoteAudioRef.current.play().catch(e => console.log("Audio block", e)); } 
                if(remoteVideoRef.current) { remoteVideoRef.current.srcObject = rs; }
              });
           }).catch(err => { console.error("Media failed", err); handleEndCall(); });
        }
      });
      peer.on('error', (err) => {
        if (err.type === 'disconnected' || err.type === 'network') setTimeout(initPeer, 3000);
      });
    };
    initPeer();
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, [userId, calling]);

  // Handle incoming call signal from Chat History
  useEffect(() => {
    if (!userId) return;
    const last = chatHistory[chatHistory.length - 1];
    if (!last) return;
    if (last.type === 'call_invite' && last.status === 'ringing' && last.sender !== userId) {
      setIncomingCall({ messageId: last.id, callType: last.callType, fromName: last.senderName || 'Partner' });
      if (!ringingIntervalRef.current) ringingIntervalRef.current = setInterval(() => playAudio('receive', sfxEnabled), 900);
    }
    if (last.type === 'call_invite' && last.status === 'accepted') {
      if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
      setIncomingCall(null); setIsRinging(false);
      if (last.sender === userId && !calling) { setCalling(last.callType); initiatePeerCall(last.callType); }
    }
    if (last.type === 'call_invite' && (last.status === 'rejected' || last.status === 'ended' || last.status === 'missed')) {
      if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
      setIncomingCall(null); setCalling(null); setIsRinging(false);
      if (currentCallRef.current) { try { currentCallRef.current.close(); } catch(e){} currentCallRef.current = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    }
  }, [chatHistory, userId, sfxEnabled]);

  useEffect(() => {
    if (calling && !isRinging) callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    else { setCallDuration(0); if (callTimerRef.current) clearInterval(callTimerRef.current); }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [calling, isRinging]);

  const initiatePeerCall = async (type) => {
    try {
      setIsRinging(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      if (!peerRef.current || peerRef.current.destroyed) throw new Error("Peer disconnected");
      const call = peerRef.current.call(partnerId, stream);
      currentCallRef.current = call;
      call.on('stream', (remoteStream) => {
        setIsRinging(false);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = remoteStream; remoteAudioRef.current.play().catch(e => console.error("Audio block", e)); }
      });
      call.on('error', (e) => { console.error("Call error", e); handleEndCall(); });
    } catch (err) { console.error('Failed call', err); handleEndCall(); }
  };

  const acceptCall = async (messageId) => {
    const msg = chatHistory.find(m => m.id === messageId);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: msg?.callType === 'video' });
      localStreamRef.current = stream;
      if (currentCallRef.current) {
        currentCallRef.current.answer(stream);
        currentCallRef.current.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = remoteStream; remoteAudioRef.current.play().catch(e => console.error("Audio block", e)); }
        });
      }
      setChatHistory(prev => prev.map(m => m.id === messageId ? { ...m, status: 'accepted' } : m));
      setCalling(msg?.callType || 'audio');
      setIsRinging(false);
    } catch (err) { console.error('Failed accept', err); handleEndCall(); }
    setIncomingCall(null);
  };

  const rejectCall = (messageId) => { setChatHistory(prev => prev.map(m => m.id === messageId ? { ...m, status: 'rejected' } : m)); setIncomingCall(null); };

  // 4. Room Pairing & Sync logic
  const checkRoomAndSync = async (uid) => {
    try {
      const { data: room } = await supabase.rpc('get_my_room');
      const isPaired = !!(room && room.is_paired);
      setHasRoom(isPaired);
      if (isPaired && syncedRoomId !== room.id) { setSyncedRoomId(room.id); await initializeRoomSync(room.id); }
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
  const handlePaired = async (roomId) => { setHasRoom(true); setSyncedRoomId(roomId); await initializeRoomSync(roomId); navigate('/'); };
  const handleShareToChat = (text, imgData) => { setChatHistory(p => [...p, { id: Date.now(), sender: userId, type: imgData ? 'image' : 'text', url: imgData, text: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent' }]); };
  const navigateTo = (v) => { playAudio('click', sfxEnabled); if (v === 'dashboard') navigate('/'); else navigate(`/${v}`); };

  if (loading) return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#fffdf9]"><div className="w-8 h-8 border-4 border-[#ff6b9d] border-t-transparent rounded-full animate-spin mb-4" /><p className="font-bold text-xs opacity-40 tracking-widest uppercase">Initializing Attic...</p></div>;

  return (
    <ToastProvider>
      <div className={`min-h-screen w-full bg-pattern-grid flex flex-col items-center p-2 sm:p-4 md:p-8 relative ${triggerShake ? 'animate-shake' : ''}`}>
        <WeatherOverlay weather={weather} />
        <Confetti active={confetti} />
        {confirmDialog && <ConfirmDialog {...confirmDialog} sfx={sfxEnabled} />}
        {session && hasRoom && <StrayTray radioState={radioState} setRadioState={setRadioState} />}

        {/* Global Call UI */}
        {incomingCall && (
          <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="retro-bg-window retro-border retro-shadow-dark max-w-sm w-full p-10 text-center animate-bounce-subtle">
              <div className="w-24 h-24 rounded-full retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-6 animate-pulse">
                {incomingCall.callType === 'video' ? <Video size={48} className="text-white"/> : <Phone size={48} className="text-white"/>}
              </div>
              <h2 className="text-3xl font-bold mb-2">{incomingCall.fromName}</h2>
              <p className="text-sm opacity-70 font-bold mb-8 uppercase tracking-widest animate-pulse">incoming call...</p>
              <div className="flex gap-6 justify-center">
                <button onClick={() => { playAudio('click', sfxEnabled); rejectCall(incomingCall.messageId); }} className="p-6 bg-red-500 text-white retro-border rounded-full hover:bg-red-600 transition-all hover:scale-110 shadow-lg"><PhoneOff size={32} className="rotate-[135deg]"/></button>
                <button onClick={() => { playAudio('click', sfxEnabled); acceptCall(incomingCall.messageId); }} className="p-6 bg-green-500 text-white retro-border rounded-full hover:bg-green-600 transition-all hover:scale-110 shadow-lg"><Phone size={32}/></button>
              </div>
            </div>
          </div>
        )}

        {calling && (
          <PremiumCallHub
            calling={calling}
            callDuration={callDuration}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isCameraOff={isCameraOff}
            onMicToggle={() => { setIsMuted(!isMuted); if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isMuted); }}
            onDeafenToggle={() => setIsDeafened(!isDeafened)}
            onCameraToggle={() => { setIsCameraOff(!isCameraOff); if (localStreamRef.current) localStreamRef.current.getVideoTracks().forEach(t => t.enabled = isCameraOff); }}
            onEndCall={handleEndCall}
            partnerName={coupleData?.partnerNickname || 'Partner'}
            sfx={sfxEnabled}
            remoteVideoRef={remoteVideoRef}
            isRinging={isRinging}
          />
        )}
        
        <audio ref={remoteAudioRef} autoPlay style={{display: 'none'}} />

        <Routes>
          <Route path="/login" element={<PublicRoute session={session} hasRoom={hasRoom}><LandingView onTryAttic={() => navigate('/signup')} onSignIn={() => navigate('/signin')} /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signup" onAuthSuccess={() => navigate('/')} onBack={() => navigate('/login')} /></PublicRoute>} />
          <Route path="/signin" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signin" onAuthSuccess={() => navigate('/')} onBack={() => navigate('/login')} /></PublicRoute>} />
          <Route path="/password-reset" element={<ResetPasswordView sfx={true} />} />
          <Route path="/handshake" element={<ProtectedRoute session={session} hasRoom={hasRoom}><HandshakeView session={session} onPaired={handlePaired} onLogout={handleLogout} /></ProtectedRoute>} />

          <Route path="/" element={<ProtectedRoute session={session} hasRoom={hasRoom}><Dashboard setView={navigateTo} profile={profile} coupleData={coupleData} setCoupleData={setCoupleData} scores={scores} doodles={doodles} onOpenDoodle={setViewingDoodle} sfx={sfxEnabled} setTriggerShake={setTriggerShake} radioState={radioState} setRadioState={setRadioState} userId={userId} partnerId={partnerId} streaks={streaks} theme={theme} setTheme={setTheme} setProfile={setProfile} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} onLogout={handleLogout} onDelete={()=>{}} weather={weather} setWeather={setWeather} /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute session={session} hasRoom={hasRoom}><SettingsView theme={theme} setTheme={setTheme} weather={weather} setWeather={setWeather} profile={profile} setProfile={setProfile} coupleData={coupleData} setCoupleData={setCoupleData} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} scores={scores} userId={userId} onLogout={handleLogout} onDelete={()=>{}} onClose={()=>navigateTo('dashboard')} /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ChatView profile={profile} partnerNickname={coupleData?.partnerNickname} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} chatHistory={chatHistory} setChatHistory={setChatHistory} userId={userId} partnerId={partnerId} /></ProtectedRoute>} />
          <Route path="/doodle" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DoodleApp initialDoodle={replyDoodle} onClose={()=>{navigateTo('dashboard'); setReplyDoodle(null);}} onSendDoodle={(d) => { const de = {id: Date.now(), sender: userId, senderName: profile?.name, userId: userId, ...d}; setDoodles(p=>[...p, de]); setSharedImages(p => [...new Set([...p, d.img])]); }} onSaveToScrapbook={(url) => setSharedImages(p=>[...new Set([...p, url])])} sfx={sfxEnabled} /></ProtectedRoute>} />
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
