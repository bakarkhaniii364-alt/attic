import React, { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Loader, Phone, Video, PhoneOff, MicOff, Mic, Volume2, VolumeX, Maximize2, Minimize2, VideoOff, Camera, Bell, X, Mail, Heart, Download, MessageSquare, PenTool, Gamepad2 } from 'lucide-react';
import { BootLoader } from './components/BootLoader.jsx';
import { ToastProvider, ConfirmDialog, useToast, RetroWindow, RetroButton } from './components/UI.jsx';
import { LivingBackground } from './components/Visuals/LivingBackground.jsx';
import { WeatherOverlay } from './components/Visuals/WeatherOverlay.jsx';
import { Confetti } from './components/Visuals/Confetti.jsx';
import { PremiumCallHub } from './components/Call/PremiumCallHub.jsx';
import { GameInviteModal } from './components/Modals/GameInviteModal.jsx';
import { DoodleReceiverModal } from './components/Modals/DoodleReceiverModal.jsx';
import { FloatingEnvelope } from './components/Modals/FloatingEnvelope.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { playAudio } from './utils/audio.js';
import { INITIAL_CHAT } from './constants/data.js';
import { StrayTray } from './components/LofiPlayer.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useSync } from './context/SyncContext.jsx';
import { useAssetSync } from './hooks/useAssetSync.js';
import { useCall } from './context/CallContext.jsx';
import { useChat } from './context/ChatContext.jsx';
import { useAppLogic } from './hooks/useAppLogic.js';

import { LandingView, AuthView, HandshakeView } from './views/Onboarding.jsx';
import { LegalView } from './views/LegalView.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { supabase } from './lib/supabase.js';
import { isTestMode } from './lib/testMode.js';

const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        return window.location.reload();
      }
      throw error;
    }
  });

const ChatView = lazyWithRetry(() => import('./views/ChatView.jsx').then(m => ({ default: m.ChatView })));
const SettingsView = lazyWithRetry(() => import('./views/SettingsView.jsx').then(m => ({ default: m.SettingsView })));
const DoodleApp = lazyWithRetry(() => import('./apps/DoodleApp.jsx').then(m => ({ default: m.DoodleApp })));
const PersistentDoodleApp = lazyWithRetry(() => import('./apps/PersistentDoodleApp.jsx').then(m => ({ default: m.PersistentDoodleApp })));
const TimeCapsuleApp = lazyWithRetry(() => import('./apps/TimeCapsuleApp.jsx').then(m => ({ default: m.TimeCapsuleApp })));
const ListsApp = lazyWithRetry(() => import('./apps/ListsApp.jsx').then(m => ({ default: m.ListsApp })));
const CalendarApp = lazyWithRetry(() => import('./apps/CalendarApp.jsx').then(m => ({ default: m.CalendarApp })));
const ScrapbookApp = lazyWithRetry(() => import('./apps/ScrapbookApp.jsx').then(m => ({ default: m.ScrapbookApp })));
const PixelArtApp = lazyWithRetry(() => import('./apps/PixelArtApp.jsx').then(m => ({ default: m.PixelArtApp })));
const SharedNotes = lazyWithRetry(() => import('./apps/SharedNotes.jsx').then(m => ({ default: m.SharedNotes })));
const DreamJournal = lazyWithRetry(() => import('./apps/DreamJournal.jsx').then(m => ({ default: m.DreamJournal })));
const DailyQuestion = lazyWithRetry(() => import('./components/Features.jsx').then(m => ({ default: m.DailyQuestion })));
const MilestoneCelebration = lazyWithRetry(() => import('./components/Features.jsx').then(m => ({ default: m.MilestoneCelebration })));
const RelationshipResume = lazyWithRetry(() => import('./components/Features.jsx').then(m => ({ default: m.RelationshipResume })));
const ActivitiesHub = lazyWithRetry(() => import('./games/index.jsx').then(m => ({ default: m.ActivitiesHub })));
import SyncWatcher from './games/SyncWatcher.jsx';
const ResetPasswordView = lazyWithRetry(() => import('./views/ResetPasswordView.jsx').then(m => ({ default: m.ResetPasswordView })));

import { ProtectedRoute, PublicRoute } from './components/AuthGuards.jsx';

const AppLoader = () => null;




export default function App() {
  const navigate = useNavigate();
  const location = useLocation();


  
  const { user, userId, roomId, partnerId, loading: authLoading, roomLoading, hasInitialized } = useAuth();
  const { globalState, onlineUsers, updateSyncState, updateSyncStateAtomic, mergeSyncState, roomProfiles, broadcast, isInitialized } = useSync();
  const coupleData = globalState?.couple_data || {};
  const partnerProfile = roomProfiles?.[partnerId] || {};
  const partnerName = coupleData.nicknames?.[partnerId] || (partnerProfile.name && partnerProfile.name !== 'You' ? partnerProfile.name : 'Partner');
  const { messages: chatHistory, sendMessage: syncSendMessage, updateMessage: syncUpdateMessage } = useChat();
  const { 
    calling, isRinging, incomingCall, callDuration, 
    remoteStream, localStream, isMuted, isDeafened, isCameraOff,
    acceptCall, endCall, toggleMic, toggleCamera, toggleDeafen, isOnline
  } = useCall();

  const [theme, setTheme] = useLocalStorage('app_theme', 'matcha');
  const [weather, setWeather] = useState('clear'); 
  const [sfxEnabled, setSfxEnabled] = useLocalStorage('sfx_enabled', true); 
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('notifications_enabled', true);
  const [triggerShake] = useState(false); 
  const [confetti, setConfetti] = useState(false);
  const [radioState, setRadioState] = useLocalStorage('radio_state', { isPlaying: false, channelIdx: 0, volume: 0.4 });
  const [bootFinished, setBootFinished] = useState(false);
  
  const streaks = globalState?.user_streaks?.[userId] || { count: 0 };
  
  const { uploadAsset } = useAssetSync(roomId);
  
  const handleSendDoodle = async (doodleData) => {
    if (!roomId || !userId) return;
    try {
      const dataUrl = typeof doodleData === 'string' ? doodleData : doodleData.img;
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `doodle_${Date.now()}.png`, { type: 'image/png' });
      
      const asset = await uploadAsset(file, 'doodle', userId);
      if (asset) {
        broadcast('doodle_alert', { 
          action: 'doodle', 
          image: asset.url, 
          sender: userId, 
          timestamp: Date.now() 
        });
      }
    } catch (e) {
      console.error("[APP] Doodle send failed:", e);
    }
  };

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
  
  const toast = useToast();

  const isPartnerOnline = partnerId && onlineUsers[partnerId]?.status === 'active';
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

  const {
    floatingDoodles, setFloatingDoodles,
    doodleQueue, setDoodleQueue, closeDoodle,
    gameInvite, setGameInvite,
    watchpartyInvite, setWatchpartyInvite,
    showKiss, setShowKiss,
    partnerOnlineModal,
    textNotifications, setTextNotifications
  } = useAppLogic({
    user, userId, roomId, partnerId, partnerName,
    isInitialized, sfxEnabled, toast, broadcast,
    updateSyncStateAtomic, navigate, location,
    chatHistory, onlineUsers, notificationsEnabled,
    lobbyState: globalState?.arcade_lobby
  });

  const activeDoodleView = doodleQueue[0] || null;

  const remoteAudioRef = useRef(null);
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = isDeafened;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, isDeafened]);

  if (!hasInitialized || !bootFinished) return <BootLoader onComplete={() => setBootFinished(true)} sfxEnabled={sfxEnabled} />;

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
            {[...Array(50)].map((_, i) => {
              const angle = Math.random() * Math.PI * 2;
              const dist = 200 + Math.random() * 600;
              const tx = Math.cos(angle) * dist;
              const ty = Math.sin(angle) * dist;
              const tr = (Math.random() - 0.5) * 500;
              return (
                <div key={i} className="floating-heart" style={{ 
                  '--tx': `${tx}px`, 
                  '--ty': `${ty}px`, 
                  '--tr': `${tr}deg`,
                  animationDelay: `${Math.random() * 0.5}s`, 
                  fontSize: `${1.5 + Math.random() * 3}rem` 
                }}>{['💖', '💗', '💓', '💕', '❤️', '💌'][Math.floor(Math.random() * 6)]}</div>
              );
            })}
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
                <button 
                  onClick={() => {
                    // Critical: Trigger audio play on user gesture to bypass autoplay blocks
                    if (remoteAudioRef.current) {
                      remoteAudioRef.current.play().catch(e => console.warn("[Call] Autoplay block bypass failed:", e));
                    }
                    acceptCall();
                  }} 
                  className="p-5 bg-green-500 text-white retro-border rounded-full hover:bg-green-600 transition-all hover:scale-110 shadow-lg"
                >
                  <Phone size={28}/>
                </button>
              </div>
            </div>
          </div>
        )}

        {calling && (
          <PremiumCallHub calling={calling} callDuration={callDuration} isMuted={isMuted} isDeafened={isDeafened} isCameraOff={isCameraOff} onMicToggle={toggleMic} onDeafenToggle={toggleDeafen} onCameraToggle={toggleCamera} onEndCall={endCall} partnerName={partnerName} partnerPfp={partnerProfile.pfp} sfx={sfxEnabled} remoteStream={remoteStream} localStream={localStream} isRinging={isRinging} type={calling} />
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
            onAccept={async () => {
              setGameInvite(null);
              const gId = gameInvite.metadata?.gameId || gameInvite.gameId;
              
              // 1. Attempt atomic join via RPC (safest)
              try {
                const { error } = await supabase.rpc('join_arcade_lobby', { 
                  p_room_id: roomId, 
                  p_user_id: userId 
                });
                if (error) throw error;
                console.log("[Lobby] Atomic join successful via RPC");
              } catch (err) {
                // 2. Fallback to client-side merge if RPC is not yet deployed
                console.warn("[Lobby] RPC join failed, falling back to client merge:", err);
                let currentLobby = lobbyState;
                if (currentLobby?.gameId === gId) {
                  const currentPlayers = Array.from(new Set([...(currentLobby.players || []), userId]));
                  const updatedLobby = {
                    ...currentLobby,
                    players: currentPlayers,
                    status: currentPlayers.length >= 2 ? 'ready' : 'waiting'
                  };
                  updateSyncState('arcade_lobby', updatedLobby);
                }
              }
              
              navigate(`/activities/${gId}`);
            }}
            onDecline={() => setGameInvite(null)}
            sfx={sfxEnabled}
          />
        )}

        {watchpartyInvite && (
          <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <RetroWindow title="watchparty_invite.exe" onClose={() => setWatchpartyInvite(null)} className="max-w-sm w-full">
              <div className="p-6 text-center">
                 <div className="w-16 h-16 bg-primary text-white rounded-lg retro-border flex items-center justify-center mx-auto mb-4">
                    <Monitor size={32} />
                 </div>
                 <h2 className="text-xl font-black mb-2 uppercase tracking-tighter">{watchpartyInvite.senderName} invited you!</h2>
                 <p className="text-sm font-bold opacity-70 mb-6 lowercase">join them for a watch party on syncwatcher?</p>
                 <div className="flex gap-3">
                    <RetroButton variant="white" className="flex-1 py-2 text-xs font-black uppercase" onClick={() => setWatchpartyInvite(null)}>Decline</RetroButton>
                    <RetroButton variant="primary" className="flex-1 py-2 text-xs font-black uppercase" onClick={() => {
                        setWatchpartyInvite(null);
                        navigateTo('watch');
                    }}>Join Now</RetroButton>
                 </div>
              </div>
            </RetroWindow>
          </div>
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
                !user ? <Navigate to="/" replace /> :
                !roomId ? <Navigate to="/handshake" replace /> :
                <Dashboard setView={navigateTo} theme={theme} setTheme={setTheme} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} weather={weather} setWeather={setWeather} radioState={radioState} setRadioState={setRadioState} setShowKiss={setShowKiss} />
              } />
              <Route path="/signup" element={<AuthView mode="signup" />} />
              <Route path="/signin" element={<AuthView mode="signin" />} />
              <Route path="/password-reset" element={<ResetPasswordView sfx={sfxEnabled} />} />
              <Route path="/handshake" element={
                !user ? <Navigate to="/" replace /> :
                roomId ? <Navigate to="/dashboard" replace /> :
                <HandshakeView />
              } />
              <Route path="/settings" element={<ProtectedRoute><SettingsView 
                theme={theme} setTheme={setTheme} 
                weather={weather} setWeather={setWeather} 
                sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} 
                notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} 
                profile={roomProfiles?.[userId] || { name: user?.user_metadata?.name || user?.user_metadata?.full_name || 'Partner', emoji: '👤' }} 
                setProfile={(newProf) => {
                  const currentProf = roomProfiles?.[userId] || { name: user?.user_metadata?.name || user?.user_metadata?.full_name || 'Partner', emoji: '👤' };
                  const updatedProf = typeof newProf === 'function' ? newProf(currentProf) : newProf;
                  updateSyncStateAtomic('room_profiles', userId, updatedProf);
                }}
                coupleData={globalState.couple_data || { petName: 'pet', petSkin: '/assets/cat_1_9' }} 
                setCoupleData={(newData) => {
                  const currentData = globalState.couple_data || {};
                  const updatedData = typeof newData === 'function' ? newData(currentData) : newData;
                  mergeSyncState('couple_data', updatedData);
                }}
                onClose={()=>navigateTo('dashboard')} 
                streaks={streaks}
                scores={globalState.game_scores}
                userId={userId}
                partnerId={partnerId}
              /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatView onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} /></ProtectedRoute>} />
              <Route path="/doodle" element={<ProtectedRoute><DoodleApp onClose={()=>{navigateTo('dashboard');}} sfx={sfxEnabled} onSendDoodle={handleSendDoodle} /></ProtectedRoute>} />
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
               <Route path="/watch" element={<ProtectedRoute><SyncWatcher onBack={() => navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} onShareToChat={handleShareToChat} /></ProtectedRoute>} />
              <Route path="/legal" element={<LegalView onClose={() => navigateTo('dashboard')} />} />
              <Route path="/activities/*" element={<ProtectedRoute><ActivitiesHub 
                onClose={()=>navigateTo('dashboard')} 
                sfx={sfxEnabled} 
                setConfetti={setConfetti} 
                onShareToChat={handleShareToChat}
                broadcast={broadcast}
                userId={userId}
                partnerId={partnerId}
                scores={globalState.game_scores}
                setScores={(val) => {
                  const newScores = typeof val === 'function' ? val(globalState.game_scores || {}) : val;
                  // Atomic score update
                  updateSyncStateAtomic('game_scores', userId, newScores[userId]);
                }}
                profile={roomProfiles[userId]}
                roomProfiles={roomProfiles}
                onlineUsers={onlineUsers}
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
