import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { WeatherOverlay, Confetti, ToastProvider, ConfirmDialog } from './components/UI.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
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
import { DailyQuestion, useStreaks, getMilestoneToday, MilestoneCelebration, RelationshipResume } from './components/Features.jsx';
import { ActivitiesHub } from './games/index.jsx';

/* ═══════════════════════════════════════════════════════
   APP CONTENT — the main dashboard / views (post-auth)
   ═══════════════════════════════════════════════════════ */
function AppContent({ onLogout }) {
  const [view, setView] = useLocalStorage('current_view', 'dashboard'); 
  const [profile, setProfile] = useLocalStorage('user_profile', { name: '', emoji: '😊', petName: '', partnerName: '', anniversary: '' }); 
  const [theme, setTheme] = useLocalStorage('app_theme', 'default');
  const [weather, setWeather] = useState('clear'); 
  const [sfxEnabled, setSfxEnabled] = useLocalStorage('sfx_enabled', true); 
  const [triggerShake, setTriggerShake] = useState(false); 
  const [confetti, setConfetti] = useState(false);
  const [radioState, setRadioState] = useLocalStorage('radio_state', { isPlaying: false, channelIdx: 0, volume: 0.4 });
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Synced Global States (Supabase)
  const [scores, setScores] = useGlobalSync('game_scores', { tictactoe: 0, pictionary: 0, memory: 0, wordle: 0, sudoku: 0, chess: 0 });
  const [chatHistory, setChatHistory] = useGlobalSync('chat_history', INITIAL_CHAT);
  const [sharedImages, setSharedImages] = useGlobalSync('shared_images', []);
  const [doodles, setDoodles] = useGlobalSync('shared_doodles', []); 
  const [letters, setLetters] = useGlobalSync('shared_letters', []);

  const [viewingDoodle, setViewingDoodle] = useState(null);  
  const [replyDoodle, setReplyDoodle] = useState(null);
  const [milestoneShown, setMilestoneShown] = useState(false);
  const streak = useStreaks();
  const milestone = !milestoneShown ? getMilestoneToday(profile.anniversary) : null;
  
  // Route guard: if profile not set, redirect to dashboard (it's always dashboard now)
  const protectedViews = ['settings','chat','doodle','capsule','lists','calendar','scrapbook','activities','pixelart','dreams','dailyq','resume'];
  useEffect(() => {
    if (protectedViews.includes(view) && !profile.name) {
      setView('dashboard');
    }
    // If somehow the view is 'landing', redirect to dashboard
    if (view === 'landing' || view === 'login' || view === 'signup' || view === 'handshake') {
      setView('dashboard');
    }
  }, [view, profile.name]);

  useEffect(() => { 
    document.documentElement.setAttribute('data-theme', theme); 
  }, [theme]);
  useEffect(() => { if (triggerShake) { setTimeout(() => setTriggerShake(false), 400); } }, [triggerShake]);
  useEffect(() => { const imgs = chatHistory.filter(m => m.type === 'image' && !m.isDeleted).map(m => m.url); setSharedImages(prev => { const unique = new Set([...prev, ...imgs]); return Array.from(unique); }); }, [chatHistory]);

  const handleShareToChat = (text, imgData) => { 
    if (imgData) { 
      setChatHistory(p => [...p, { id: Date.now(), sender: 'me', type: 'image', url: imgData, text: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent' }]); 
    } else { 
      setChatHistory(p => [...p, { id: Date.now(), sender: 'me', type: 'text', text: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent' }]); 
    } 
  };

  const showConfirm = (title, message, onOk) => {
    setConfirmDialog({ title, message, onConfirm: () => { onOk(); setConfirmDialog(null); }, onCancel: () => setConfirmDialog(null) });
  };

  const navigateTo = (v) => { playAudio('click', sfxEnabled); setView(v); };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    onLogout();
  };

  return (
    <div className={`min-h-screen w-full bg-pattern-grid flex flex-col items-center p-2 sm:p-4 md:p-8 relative ${triggerShake ? 'animate-shake' : ''}`}>
      <WeatherOverlay weather={weather} />
      <Confetti active={confetti} />
      {confirmDialog && <ConfirmDialog {...confirmDialog} sfx={sfxEnabled} />}
      <StrayTray radioState={radioState} setRadioState={setRadioState} />

      {view === 'dashboard' && <Dashboard setView={navigateTo} profile={profile} scores={scores} doodles={doodles} onOpenDoodle={setViewingDoodle} sfx={sfxEnabled} setTriggerShake={setTriggerShake} radioState={radioState} setRadioState={setRadioState} />}
      {view === 'settings' && <SettingsView theme={theme} setTheme={setTheme} weather={weather} setWeather={setWeather} profile={profile} setProfile={setProfile} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} scores={scores} onLogout={handleLogout} onDelete={() => showConfirm('danger_zone.exe', 'Are you sure? This will permanently delete all your data, including chat history, scores, and settings.', () => { localStorage.clear(); window.location.reload(); })} onClose={()=>navigateTo('dashboard')} />}
      
      {view === 'chat' && <ChatView profile={profile} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} chatHistory={chatHistory} setChatHistory={setChatHistory} />}
      
      {view === 'doodle' && <DoodleApp initialDoodle={replyDoodle} onClose={()=>{setView('dashboard'); setReplyDoodle(null);}} onSendDoodle={(d) => { 
        const doodleEntry = {id: Date.now(), sender: 'me', ...d};
        setDoodles(p=>[...p, doodleEntry]); 
        setSharedImages(p => [...new Set([...p, d.img])]);
      }} onSaveToScrapbook={(url) => setSharedImages(p=>[...new Set([...p, url])])} sfx={sfxEnabled} />
      }

      {view === 'capsule' && <TimeCapsuleApp onClose={()=>navigateTo('dashboard')} letters={letters} setLetters={setLetters} sfx={sfxEnabled} />}
      {view === 'lists' && <ListsApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} />}
      {view === 'calendar' && <CalendarApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} />}
      {view === 'scrapbook' && <ScrapbookApp images={sharedImages} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} />}
      {view === 'pixelart' && <PixelArtApp onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} onSaveToScrapbook={(url) => setSharedImages(p=>[...new Set([...p, url])])} />}
      {view === 'dreams' && <DreamJournal onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} />}
      {view === 'dailyq' && <DailyQuestion onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} />}
      {view === 'resume' && <RelationshipResume onClose={()=>navigateTo('dashboard')} profile={profile} scores={scores} sfx={sfxEnabled} />}
      
      {view === 'activities' && <ActivitiesHub onClose={()=>navigateTo('dashboard')} scores={scores} setScores={setScores} sfx={sfxEnabled} setConfetti={setConfetti} onShareToChat={handleShareToChat} profile={profile} />}

      {milestone && <MilestoneCelebration milestone={milestone} onClose={() => setMilestoneShown(true)} />}

      {viewingDoodle && ( 
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <DoodleViewer doodle={viewingDoodle} onClose={() => { setViewingDoodle(null); setDoodles(p => p.map(d => d.id === viewingDoodle.id ? {...d, isRead: true} : d)); }} profileName={profile.name} sfx={sfxEnabled} onRedoodle={(d) => { setViewingDoodle(null); setDoodles(p => p.map(dd => dd.id === viewingDoodle.id ? {...dd, isRead: true} : dd)); setReplyDoodle(d); setView('doodle'); }} onReplyToChat={(text, img) => { handleShareToChat(text, img); setViewingDoodle(null); setDoodles(p => p.map(dd => dd.id === viewingDoodle.id ? {...dd, isRead: true} : dd)); navigateTo('chat'); }} /> 
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   APP — auth gate + room pairing + sync
   ═══════════════════════════════════════════════════════ */
export default function App() {
  // Auth states: loading | landing | auth-signup | auth-signin | handshake | syncing | ready
  const [appState, setAppState] = useState('loading');
  const [session, setSession] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);

  useEffect(() => {
    // 1. Check URL for invite code
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setInviteCode(invite.toUpperCase());
      window.history.replaceState({}, '', window.location.pathname); // clean URL
    }

    // 2. Check auth session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s);
        checkRoom(s, invite);
      } else {
        setAppState(invite ? 'auth-signup' : 'landing');
      }
    });

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setAppState('landing');
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkRoom = async (s, pendingInvite) => {
    // If there's a pending invite code, try to claim it first
    if (pendingInvite) {
      const { data } = await supabase.rpc('claim_invite', { code: pendingInvite.toUpperCase() });
      if (data && data.success) {
        await startSync(data.room_id);
        return;
      }
    }

    // Check if user already has a room
    const { data } = await supabase.rpc('get_my_room');
    if (data && data.is_paired) {
      await startSync(data.id);
    } else {
      setAppState('handshake');
    }
  };

  const startSync = async (roomId) => {
    setAppState('syncing');
    window.localStorage.setItem('attic_room_id', roomId);
    await initializeRoomSync(roomId);
    setAppState('ready');
  };

  const handleAuthSuccess = async ({ name, session: s, isNewUser }) => {
    setSession(s);
    // Set profile in localStorage for AppContent to pick up
    window.localStorage.setItem('user_profile', JSON.stringify({
      name, emoji: '😊', petName: '', partnerName: '', anniversary: ''
    }));
    window.localStorage.setItem('current_view', JSON.stringify('dashboard'));

    // Check room (and auto-claim invite if exists)
    await checkRoom(s, inviteCode);
  };

  const handlePaired = async (roomId) => {
    await startSync(roomId);
  };

  const handleLogout = () => {
    setSession(null);
    setAppState('landing');
    setInviteCode(null);
  };

  // ── RENDER ──

  if (appState === 'loading') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--bg-main)] relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern-grid opacity-40" />
        <Loader size={28} className="animate-spin text-[var(--primary)] mb-3 relative z-10" />
        <p className="font-bold text-xs opacity-40 relative z-10 tracking-widest">loading attic...</p>
      </div>
    );
  }

  if (appState === 'landing') {
    return (
      <ToastProvider>
        <LandingView
          onTryAttic={() => setAppState('auth-signup')}
          onSignIn={() => setAppState('auth-signin')}
        />
      </ToastProvider>
    );
  }

  if (appState === 'auth-signup' || appState === 'auth-signin') {
    return (
      <ToastProvider>
        <AuthView
          mode={appState === 'auth-signup' ? 'signup' : 'signin'}
          inviteCode={inviteCode}
          onAuthSuccess={handleAuthSuccess}
          onBack={() => setAppState('landing')}
        />
      </ToastProvider>
    );
  }

  if (appState === 'handshake') {
    return (
      <ToastProvider>
        <HandshakeView
          session={session}
          onPaired={handlePaired}
          onLogout={async () => { await supabase.auth.signOut(); localStorage.clear(); handleLogout(); }}
        />
      </ToastProvider>
    );
  }

  if (appState === 'syncing') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--bg-main)] relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern-grid opacity-40" />
        <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />
        <Loader size={28} className="animate-spin text-[var(--primary)] mb-3 relative z-10" />
        <p className="font-bold text-xs opacity-40 relative z-10 tracking-widest">syncing your attic...</p>
      </div>
    );
  }

  // ready
  return (
    <ToastProvider>
      <AppContent onLogout={handleLogout} />
    </ToastProvider>
  );
}
