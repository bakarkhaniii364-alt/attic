import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Peer from 'peerjs';
import { Loader, Phone, Video, PhoneOff, MicOff, Mic, Volume2, VolumeX, Maximize2, Minimize2, Move } from 'lucide-react';
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
   GLOBAL DRAGGABLE CALL WINDOW
   ═══════════════════════════════════════════════════════ */
function GlobalCallWindow({ calling, callDuration, isMuted, isDeafened, onMicToggle, onDeafenToggle, onEndCall, partnerName, sfx, remoteVideoRef }) {
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;

  return (
    <div
      className={`fixed z-[2000] retro-bg-window retro-border retro-shadow-dark transition-all duration-300 ${isMinimized ? 'w-48' : (calling === 'video' ? 'w-80 sm:w-96' : 'w-72')}`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-[var(--border)] text-white px-3 py-2 flex justify-between items-center font-bold text-xs select-none">
        <span className="flex items-center gap-2 truncate pr-2">
          {calling === 'video' ? <Video size={14}/> : <Phone size={14}/>}
          {partnerName} - {mins}:{secs.toString().padStart(2, '0')}
        </span>
        <div className="flex gap-2">
          <button onClick={() => setIsMinimized(!isMinimized)}>{isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}</button>
          <button onClick={onEndCall} className="text-red-300 hover:text-red-500 transition-colors"><PhoneOff size={14}/></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col">
          {calling === 'video' ? (
            <div className="w-full aspect-video bg-black relative">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 bg-black/40 px-2 py-0.5 rounded text-[10px] text-white font-bold backdrop-blur-sm">Remote View</div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full retro-bg-secondary retro-border flex items-center justify-center animate-pulse">
                <Phone size={24} />
              </div>
              <p className="font-bold text-xs">Audio Connected</p>
            </div>
          )}

          <div className="p-3 bg-[var(--bg-main)] flex justify-center gap-4">
            <button onClick={onMicToggle} className={`p-2 rounded-full retro-border ${isMuted ? 'bg-red-400' : 'retro-bg-accent'}`}>
              {isMuted ? <MicOff size={18}/> : <Mic size={18}/>}
            </button>
            <button onClick={onDeafenToggle} className={`p-2 rounded-full retro-border ${isDeafened ? 'bg-red-400' : 'retro-bg-accent'}`}>
              {isDeafened ? <VolumeX size={18}/> : <Volume2 size={18}/>}
            </button>
            <button onClick={onEndCall} className="p-2 bg-red-500 text-white rounded-full retro-border hover:bg-red-600">
              <PhoneOff size={18} className="rotate-[135deg]"/>
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
  const location = useLocation();
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
  const [coupleData, setCoupleData] = useGlobalSync('couple_data', { 
    anniversary: '', 
    petName: 'pet', 
    petSkin: '/assets/Cat Sprite Sheet.png', 
    petHappy: 60,
    partnerNickname: '' 
  });

  const [viewingDoodle, setViewingDoodle] = useState(null);  
  const [replyDoodle, setReplyDoodle] = useState(null);

  // 3. Calling System (Global)
  const [calling, setCalling] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const peerRef = useRef(null);
  const currentCallRef = useRef(null);
  const ringingIntervalRef = useRef(null);
  const callTimerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // HIDDEN AUDIO TAG

  // Fetch Partner Data Automatically
  useEffect(() => {
    if (!partnerId) return;
    const fetchPartnerName = async () => {
      const { data } = await supabase.from('app_state').select('state').eq('room_id', syncedRoomId).limit(1).single();
      // Logic to find partner nickname in state if it's there, but for now we fallback to Nickname in coupleData
    };
    fetchPartnerName();
  }, [partnerId, syncedRoomId]);

  // Peer initialization
  useEffect(() => {
    if (!userId) return;
    const peer = new Peer(userId, { debug: 1 });
    peerRef.current = peer;
    peer.on('call', (call) => {
      currentCallRef.current = call;
    });
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, [userId]);

  // Handle incoming call signal from Chat History
  useEffect(() => {
    if (!userId) return;
    const last = chatHistory[chatHistory.length - 1];
    if (!last) return;
    
    if (last.type === 'call_invite' && last.status === 'ringing' && last.sender !== userId) {
      setIncomingCall({ messageId: last.id, callType: last.callType, fromName: last.senderName || 'Partner' });
      if (!ringingIntervalRef.current) {
        ringingIntervalRef.current = setInterval(() => playAudio('receive', sfxEnabled), 900);
      }
    }
    
    if (last.type === 'call_invite' && last.status === 'accepted') {
      if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
      setIncomingCall(null);
      if (last.sender === userId && !calling) {
        setCalling(last.callType);
        initiatePeerCall(last.callType);
      }
    }

    if (last.type === 'call_invite' && (last.status === 'rejected' || last.status === 'ended' || last.status === 'missed')) {
      if (ringingIntervalRef.current) { clearInterval(ringingIntervalRef.current); ringingIntervalRef.current = null; }
      setIncomingCall(null);
      setCalling(null);
      if (currentCallRef.current) { currentCallRef.current.close(); currentCallRef.current = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    }
  }, [chatHistory, userId, sfxEnabled]);

  useEffect(() => {
    if (calling) {
      callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    } else {
      setCallDuration(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [calling]);

  const initiatePeerCall = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      const call = peerRef.current.call(partnerId, stream);
      currentCallRef.current = call;
      call.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream; // CRITICAL: PLAY AUDIO
      });
    } catch (err) {
      console.error('Failed to get local stream', err);
      handleEndCall();
    }
  };

  const handleEndCall = () => {
    setChatHistory(prev => [...prev, { id: Date.now(), sender: userId, type: 'call_invite', status: 'ended', time: new Date().toLocaleTimeString() }]);
    setCalling(null);
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
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream; // CRITICAL: PLAY AUDIO
        });
      }
      setChatHistory(prev => prev.map(m => m.id === messageId ? { ...m, status: 'accepted' } : m));
      setCalling(msg?.callType || 'audio');
    } catch (err) { console.error('Failed to accept call', err); }
    setIncomingCall(null);
  };

  // 4. Room Pairing & Sync logic
  const checkRoomAndSync = async (uid) => {
    try {
      const { data: room } = await supabase.rpc('get_my_room');
      const isPaired = !!(room && room.is_paired);
      setHasRoom(isPaired);
      if (isPaired && syncedRoomId !== room.id) {
        setSyncedRoomId(room.id);
        await initializeRoomSync(room.id);
      }
    } catch (err) { console.error("Room sync check failed:", err); setHasRoom(false); } finally { setLoading(false); }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const s = data?.session || null;
      setSession(s);
      if (s) await checkRoomAndSync(s.user.id);
      else setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s) checkRoomAndSync(s.user.id);
      else { setHasRoom(false); setSyncedRoomId(null); setLoading(false); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const milestone = useMemo(() => {
    if (!milestoneShown && userId && coupleData?.anniversary) return getMilestoneToday(coupleData.anniversary);
    return null;
  }, [milestoneShown, userId, coupleData?.anniversary]);

  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); setSession(null); setHasRoom(false); navigate('/login'); };
  const handlePaired = async (roomId) => { setHasRoom(true); setSyncedRoomId(roomId); await initializeRoomSync(roomId); navigate('/'); };
  const handleShareToChat = (text, imgData) => { 
    setChatHistory(p => [...p, { id: Date.now(), sender: userId, type: imgData ? 'image' : 'text', url: imgData, text: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent' }]); 
  };
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
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="retro-bg-window retro-border retro-shadow-dark max-w-sm w-full p-8 text-center animate-bounce-subtle">
              <div className="w-20 h-20 rounded-full retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-4 animate-pulse">
                {incomingCall.callType === 'video' ? <Video size={40} /> : <Phone size={40} />}
              </div>
              <h2 className="text-2xl font-bold mb-2">{incomingCall.fromName}</h2>
              <p className="text-sm opacity-70 font-bold mb-6">is calling you...</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => rejectCall(incomingCall.messageId)} className="p-4 bg-red-500 text-white retro-border rounded-full hover:bg-red-600"><PhoneOff size={24} className="rotate-180"/></button>
                <button onClick={() => acceptCall(incomingCall.messageId)} className="p-4 bg-green-500 text-white retro-border rounded-full hover:bg-green-600"><Phone size={24}/></button>
              </div>
            </div>
          </div>
        )}

        {calling && (
          <GlobalCallWindow
            calling={calling}
            callDuration={callDuration}
            isMuted={isMuted}
            isDeafened={isDeafened}
            onMicToggle={() => { setIsMuted(!isMuted); localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isMuted); }}
            onDeafenToggle={() => setIsDeafened(!isDeafened)}
            onEndCall={handleEndCall}
            partnerName={coupleData?.partnerNickname || 'Partner'}
            sfx={sfxEnabled}
            remoteVideoRef={remoteVideoRef}
          />
        )}
        
        {/* HIDDEN AUDIO ELEMENT FOR CALLS */}
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

        {milestone && <MilestoneCelebration milestone={milestone} onClose={() => setMilestoneShown(true)} />}
        {viewingDoodle && ( <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"><DoodleViewer doodle={viewingDoodle} onClose={() => setViewingDoodle(null)} profileName={profile?.name} sfx={sfxEnabled} onRedoodle={(d) => { setViewingDoodle(null); setReplyDoodle(d); navigateTo('doodle'); }} onReplyToChat={(t, i) => { handleShareToChat(t, i); setViewingDoodle(null); navigateTo('chat'); }} /></div>)}
      </div>
    </ToastProvider>
  );
}
