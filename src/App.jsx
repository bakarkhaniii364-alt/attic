import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { WeatherOverlay, Confetti, ToastProvider, ConfirmDialog } from './components/UI.jsx';
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

  // 3. Room Pairing & Sync logic
  const checkRoomAndSync = async (uid) => {
    try {
      const { data: room } = await supabase.rpc('get_my_room');
      const isPaired = !!(room && room.is_paired);
      setHasRoom(isPaired);
      
      if (isPaired && syncedRoomId !== room.id) {
        setSyncedRoomId(room.id);
        await initializeRoomSync(room.id);
      }
    } catch (err) {
      console.error("Room sync check failed:", err);
      setHasRoom(false);
    } finally {
      setLoading(false);
    }
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

  useEffect(() => { 
    document.documentElement.setAttribute('data-theme', theme); 
  }, [theme]);

  // 4. Milestone Calculation (Safe)
  const milestone = useMemo(() => {
    if (!milestoneShown && userId && coupleData?.anniversary) {
      return getMilestoneToday(coupleData.anniversary);
    }
    return null;
  }, [milestoneShown, userId, coupleData?.anniversary]);

  // 5. Shared Handlers
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setSession(null);
    setHasRoom(false);
    setSyncedRoomId(null);
    navigate('/login');
  };

  const handlePaired = async (roomId) => {
    setHasRoom(true);
    setSyncedRoomId(roomId);
    await initializeRoomSync(roomId);
    navigate('/');
  };

  const handleShareToChat = (text, imgData) => { 
    setChatHistory(p => [...p, { 
      id: Date.now(), 
      sender: userId, 
      type: imgData ? 'image' : 'text', 
      url: imgData, 
      text: text, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      status: 'sent' 
    }]); 
  };

  const showConfirm = (title, message, onOk) => {
    setConfirmDialog({ title, message, onConfirm: () => { onOk(); setConfirmDialog(null); }, onCancel: () => setConfirmDialog(null) });
  };

  const navigateTo = (v) => { 
    playAudio('click', sfxEnabled); 
    if (v === 'dashboard') navigate('/');
    else navigate(`/${v}`);
  };

  const handleDeleteAccount = async () => {
    showConfirm('delete_account.exe', 'This will PERMANENTLY delete all your data. Continue?', async () => {
      await supabase.rpc('delete_user_data');
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.reload();
    });
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#fffdf9]">
        <div className="w-8 h-8 border-4 border-[#ff6b9d] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-bold text-xs opacity-40 tracking-widest uppercase">Initializing Attic...</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className={`min-h-screen w-full bg-pattern-grid flex flex-col items-center p-2 sm:p-4 md:p-8 relative ${triggerShake ? 'animate-shake' : ''}`}>
        <WeatherOverlay weather={weather} />
        <Confetti active={confetti} />
        {confirmDialog && <ConfirmDialog {...confirmDialog} sfx={sfxEnabled} />}
        {session && hasRoom && <StrayTray radioState={radioState} setRadioState={setRadioState} />}

        <Routes>
          {/* Public */}
          <Route path="/login" element={<PublicRoute session={session} hasRoom={hasRoom}><LandingView onTryAttic={() => navigate('/signup')} onSignIn={() => navigate('/signin')} /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signup" onAuthSuccess={() => navigate('/')} onBack={() => navigate('/login')} /></PublicRoute>} />
          <Route path="/signin" element={<PublicRoute session={session} hasRoom={hasRoom}><AuthView mode="signin" onAuthSuccess={() => navigate('/')} onBack={() => navigate('/login')} /></PublicRoute>} />
          <Route path="/password-reset" element={<ResetPasswordView sfx={true} />} />
          
          {/* Handshake */}
          <Route path="/handshake" element={<ProtectedRoute session={session} hasRoom={hasRoom}><HandshakeView session={session} onPaired={handlePaired} onLogout={handleLogout} /></ProtectedRoute>} />

          {/* Protected Main Views */}
          <Route path="/" element={<ProtectedRoute session={session} hasRoom={hasRoom}><Dashboard setView={navigateTo} profile={profile} coupleData={coupleData} setCoupleData={setCoupleData} scores={scores} doodles={doodles} onOpenDoodle={setViewingDoodle} sfx={sfxEnabled} setTriggerShake={setTriggerShake} radioState={radioState} setRadioState={setRadioState} userId={userId} partnerId={partnerId} streaks={streaks} theme={theme} setTheme={setTheme} setProfile={setProfile} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} onLogout={handleLogout} onDelete={handleDeleteAccount} weather={weather} setWeather={setWeather} /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute session={session} hasRoom={hasRoom}><SettingsView theme={theme} setTheme={setTheme} weather={weather} setWeather={setWeather} profile={profile} setProfile={setProfile} coupleData={coupleData} setCoupleData={setCoupleData} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} scores={scores} userId={userId} onLogout={handleLogout} onDelete={handleDeleteAccount} onClose={()=>navigateTo('dashboard')} /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute session={session} hasRoom={hasRoom}><ChatView profile={profile} partnerNickname={coupleData?.partnerNickname} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} chatHistory={chatHistory} setChatHistory={setChatHistory} userId={userId} partnerId={partnerId} /></ProtectedRoute>} />
          <Route path="/doodle" element={<ProtectedRoute session={session} hasRoom={hasRoom}><DoodleApp initialDoodle={replyDoodle} onClose={()=>{navigateTo('dashboard'); setReplyDoodle(null);}} onSendDoodle={(d) => { 
            const doodleEntry = {id: Date.now(), sender: userId, senderName: profile?.name, userId: userId, ...d};
            setDoodles(p=>[...p, doodleEntry]); 
            setSharedImages(p => [...new Set([...p, d.img])]);
          }} onSaveToScrapbook={(url) => setSharedImages(p=>[...new Set([...p, url])])} sfx={sfxEnabled} /></ProtectedRoute>} />
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

        {viewingDoodle && ( 
          <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
             <DoodleViewer doodle={viewingDoodle} onClose={() => { setViewingDoodle(null); }} profileName={profile?.name} sfx={sfxEnabled} onRedoodle={(d) => { setViewingDoodle(null); setReplyDoodle(d); navigateTo('doodle'); }} onReplyToChat={(text, img) => { handleShareToChat(text, img); setViewingDoodle(null); navigateTo('chat'); }} /> 
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
