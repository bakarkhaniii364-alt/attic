import React, { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Loader, Phone, Video, PhoneOff, MicOff, Mic, Volume2, VolumeX, Maximize2, Minimize2, VideoOff, Camera, Bell, X, Mail, Heart, Download, MessageSquare, PenTool, Gamepad2 } from 'lucide-react';
import { BootLoader } from './components/BootLoader.jsx';
import { ToastProvider, ConfirmDialog, useToast, RetroWindow, RetroButton } from './components/UI.jsx';
import { LivingBackground } from './components/Visuals/LivingBackground.jsx';
import { WeatherOverlay } from './components/Visuals/WeatherOverlay.jsx';
import { Confetti } from './components/Visuals/Confetti.jsx';
import { DoodleReceiverModal } from './components/Modals/DoodleReceiverModal.jsx';
import { FloatingEnvelope } from './components/Modals/FloatingEnvelope.jsx';
import { OverlayManager } from './components/OverlayManager.jsx';
import { CallOverlay } from './components/CallOverlay.jsx';
import { KeyboardShortcuts } from './components/KeyboardShortcuts.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useTypingIndicator } from './hooks/useTypingIndicator.js';
import { playAudio } from './utils/audio.js';
import { INITIAL_CHAT } from './constants/data.js';
import { StrayTray, CHANNELS } from './components/LofiPlayer.jsx';
import { useAuth, useSync, useCall, useChat } from './context/instances.js';
import { useAssetSync } from './hooks/useAssetSync.js';
import { useAppLogic } from './hooks/useAppLogic.js';
import { DesktopOnly } from './components/MobileOnly.jsx';

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
    calling, isRinging, incomingCall, callDuration, callStatus, callQuality,
    remoteStream, localStream, isMuted, isDeafened, isCameraOff, isScreenSharing,
    acceptCall, declineCall, endCall, toggleMic, toggleCamera, toggleDeafen,
    startScreenShare, stopScreenShare,
    restartIce, changeDevice, isPartnerCameraOff,
    sendReaction, toggleRaiseHand,
  } = useCall();

  // Typing indicator for the call HUD
  const { isPartnerTyping } = useTypingIndicator(userId, partnerId);

  const [theme, setTheme] = useLocalStorage('app_theme', 'matcha');
  const [weather, setWeather] = useState('clear'); 
  const [sfxEnabled, setSfxEnabled] = useLocalStorage('sfx_enabled', true); 
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('notifications_enabled', true);
  const [triggerShake] = useState(false); 
  const [confetti, setConfetti] = useState(false);
  const [radioState, setRadioState] = useLocalStorage('radio_state', { isPlaying: false, channelIdx: 0, volume: 0.4 });
  const [bootFinished, setBootFinished] = useState(false);

  // Ensure radio is off by default on refresh and channel index is valid
  useEffect(() => {
    setRadioState(prev => {
      const newState = { ...prev, isPlaying: false };
      if (!CHANNELS[prev.channelIdx]) newState.channelIdx = 0;
      return newState;
    });
  }, []);
  
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
          id: asset.id,
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

  const handleSaveToScrapbook = useCallback(async (dataUrl) => {
    if (!roomId || !userId) return;
    try {
      toast('Saving to Scrapbook...', 'info');
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `scrapbook_${Date.now()}.png`, { type: 'image/png' });
      
      const asset = await uploadAsset(file, 'scrapbook', userId, { source: 'arcade' });
      if (asset) {
        toast('Saved to Scrapbook! ✨', 'success');
        playAudio('success', sfxEnabled);
      }
    } catch (e) {
      console.error("[APP] Scrapbook save failed:", e);
      toast('Failed to save to scrapbook.', 'error');
    }
  }, [roomId, userId, uploadAsset, toast, sfxEnabled]);

  const isPartnerOnline = partnerId && onlineUsers?.[partnerId]?.status === 'active';
  const navigateTo = (v) => { playAudio('click', sfxEnabled); navigate(v === 'dashboard' ? '/dashboard' : `/${v}`); };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme); 
  }, [theme]);

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
    textNotifications, setTextNotifications,
    handleReadLater, handleMarkSeen
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

  const isOnboarding = ['/login', '/signup', '/signin', '/handshake'].includes(location.pathname);

  return (
    <>
      {!bootFinished && <BootLoader onComplete={() => setBootFinished(true)} sfxEnabled={sfxEnabled} />}
      
      <div className={`retro-everywhere min-h-[100dvh] w-full mesh-bg flex flex-col relative ${isOnboarding ? '' : 'items-center p-0 sm:p-4 md:p-8'} ${triggerShake ? 'animate-shake' : ''} ${hasInitialized ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
        <div className={`absolute inset-0 bg-pattern-${coupleData.settings?.bgPattern || 'grid'} opacity-10 pointer-events-none`} />
        <LivingBackground weather={weather} />
        <WeatherOverlay weather={weather} />
        <Confetti active={confetti} />

        {hasInitialized && (
          <>
            {user && roomId && <DesktopOnly><StrayTray radioState={radioState} setRadioState={setRadioState} /></DesktopOnly>}

            <OverlayManager 
              showKiss={showKiss} floatingDoodles={floatingDoodles} doodleQueue={doodleQueue} 
              setDoodleQueue={setDoodleQueue} setFloatingDoodles={setFloatingDoodles} 
              activeDoodleView={activeDoodleView} closeDoodle={closeDoodle} 
              gameInvite={gameInvite} setGameInvite={setGameInvite} 
              watchpartyInvite={watchpartyInvite} setWatchpartyInvite={setWatchpartyInvite} 
              textNotifications={textNotifications} setTextNotifications={setTextNotifications} 
              partnerName={partnerName} partnerId={partnerId} roomProfiles={roomProfiles} 
              sfxEnabled={sfxEnabled} navigate={navigateTo} toast={toast} 
              lobbyState={globalState?.arcade_lobby} userId={userId} roomId={roomId} 
              updateSyncState={updateSyncState} 
              onReadLater={handleReadLater}
              onMarkSeen={handleMarkSeen}
            />

            <CallOverlay 
              incomingCall={incomingCall} isRinging={isRinging} partnerProfile={partnerProfile} 
              partnerName={partnerName} endCall={endCall} acceptCall={acceptCall} declineCall={declineCall}
              calling={calling} callDuration={callDuration} callStatus={callStatus} callQuality={callQuality}
              isMuted={isMuted} isDeafened={isDeafened} isCameraOff={isCameraOff} isScreenSharing={isScreenSharing}
              toggleMic={toggleMic} toggleDeafen={toggleDeafen} toggleCamera={toggleCamera}
              startScreenShare={startScreenShare} stopScreenShare={stopScreenShare}
              restartIce={restartIce} changeDevice={changeDevice}
              isPartnerTyping={isPartnerTyping} isPartnerCameraOff={isPartnerCameraOff}
              sfxEnabled={sfxEnabled} remoteStream={remoteStream} localStream={localStream}
              onReaction={sendReaction} onRaiseHand={toggleRaiseHand}
            />

            <KeyboardShortcuts
              isCalling={!!calling}
              onMuteToggle={toggleMic}
              onCameraToggle={toggleCamera}
              onEndCall={endCall}
              onDeafenToggle={toggleDeafen}
              onScreenShare={startScreenShare}
              onGoChat={() => navigateTo('chat')}
              onGoArcade={() => navigateTo('activities')}
            />

            {partnerOnlineModal && (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[var(--z-toast)] animate-in slide-in-from-top-10 fade-in duration-500 pointer-events-none">
                <div className="bg-primary text-primary-text px-6 py-3 retro-border retro-shadow-dark flex items-center gap-3 rounded-full">
                  <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse shadow-[0_0_10px_#4ade80]"></div>
                  <span className="font-black uppercase tracking-widest text-xs">{partnerName} is Online!</span>
                </div>
              </div>
            )}

        <div className="app-glitch-wrapper flex-1 w-full flex flex-col items-center" data-hawkins={theme === 'hawkins'}>
          <Suspense fallback={<AppLoader />}>
            <Routes key={location.pathname}>
              <Route path="/" element={<PublicRoute><LandingView /></PublicRoute>} />
              <Route path="/dashboard" element={
                !user ? <Navigate to="/" replace /> :
                !roomId ? <Navigate to="/handshake" replace /> :
                <Dashboard 
                  setView={navigateTo} 
                  theme={theme} setTheme={setTheme} 
                  sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} 
                  notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled}
                  weather={weather} setWeather={setWeather} 
                  radioState={radioState} setRadioState={setRadioState} 
                  setShowKiss={setShowKiss} 
                />
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
              <Route path="/shared-canvas" element={<ProtectedRoute><PersistentDoodleApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/capsule" element={<ProtectedRoute><TimeCapsuleApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/lists" element={<ProtectedRoute><ListsApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><CalendarApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/scrapbook" element={<ProtectedRoute><ScrapbookApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/pixelart" element={<ProtectedRoute><PixelArtApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/notes" element={<ProtectedRoute><SharedNotes onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/dreams" element={<ProtectedRoute><DreamJournal onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/daily-q" element={<ProtectedRoute><DailyQuestion onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
              <Route path="/resume" element={<ProtectedRoute><RelationshipResume onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} userId={userId} roomId={roomId} /></ProtectedRoute>} />
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
                onSaveToScrapbook={handleSaveToScrapbook}
              /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        </>
        )}
      </div>
    </>
  );
}
