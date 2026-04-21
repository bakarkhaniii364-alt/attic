import React, { useState, useEffect } from 'react';
import { Headphones, Disc } from 'lucide-react';
import { WeatherOverlay, Confetti, ToastProvider, ConfirmDialog } from './components/UI.jsx';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { playAudio } from './utils/audio.js';
import { INITIAL_CHAT } from './constants/data.js';
import { StrayTray } from './components/LofiPlayer.jsx';

import { LandingView, AuthView, HandshakeView } from './views/Onboarding.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { ChatView } from './views/ChatView.jsx';
import { SettingsView } from './views/SettingsView.jsx';
import { Lobby } from './views/Lobby.jsx';
import { useGlobalSync, initializeRoomSync } from './hooks/useSupabaseSync.js';

import { DoodleApp, TimeCapsuleApp, ListsApp, CalendarApp, ScrapbookApp, DoodleViewer } from './apps/UtilityApps.jsx';
import { PixelArtApp } from './apps/PixelArtApp.jsx';
import { DreamJournal } from './apps/DreamJournal.jsx';
import { DailyQuestion, useStreaks, getMilestoneToday, MilestoneCelebration, RelationshipResume } from './components/Features.jsx';
import { ActivitiesHub } from './games/index.jsx';

function AppContent() {
  // Generate a simple demo doodle (heart) as base64
  const demoDoodleDataUrl = () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#e94560'; ctx.font = '120px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('❤️', 150, 130);
    ctx.fillStyle = '#5c3a21'; ctx.font = 'bold 20px monospace'; ctx.fillText('Welcome to Attic!', 150, 240);
    ctx.font = '14px monospace'; ctx.fillText('Draw something cute 🎨', 150, 270);
    return c.toDataURL('image/png');
  };
  const [view, setView] = useLocalStorage('current_view', 'landing'); 
  const [profile, setProfile] = useLocalStorage('user_profile', { name: '', emoji: '😊', petName: '', partnerName: '', anniversary: '' }); 
  const [partnerLinked, setPartnerLinked] = useLocalStorage('partner_linked', false);
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
  
  // Route guard: if not authenticated, redirect to landing for protected views
  const protectedViews = ['dashboard','settings','chat','doodle','capsule','lists','calendar','scrapbook','activities','pixelart','dreams','dailyq','resume'];
  useEffect(() => {
    if (protectedViews.includes(view) && !profile.name) {
      setView('landing');
    }
  }, [view, profile.name]);

  useEffect(() => { 
    if (['landing', 'login', 'signup', 'handshake'].includes(view)) {
       document.documentElement.setAttribute('data-theme', 'default');
    } else {
       document.documentElement.setAttribute('data-theme', theme); 
    }
  }, [theme, view]);
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

  return (
    <div className={`min-h-screen w-full bg-pattern-grid flex flex-col items-center p-2 sm:p-4 md:p-8 relative ${triggerShake ? 'animate-shake' : ''}`}>
      <WeatherOverlay weather={weather} />
      <Confetti active={confetti} />
      {confirmDialog && <ConfirmDialog {...confirmDialog} sfx={sfxEnabled} />}
      {!['landing', 'login', 'signup', 'handshake'].includes(view) && (
          <StrayTray radioState={radioState} setRadioState={setRadioState} />
      )}

      {view === 'landing' && <LandingView setProfile={setProfile} onComplete={() => setView('dashboard')} sfx={sfxEnabled}/>}

      {view !== 'landing' && (
        <>
          {view === 'dashboard' && <Dashboard setView={navigateTo} profile={profile} scores={scores} doodles={doodles} onOpenDoodle={setViewingDoodle} sfx={sfxEnabled} setTriggerShake={setTriggerShake} radioState={radioState} setRadioState={setRadioState} />}
          {view === 'settings' && <SettingsView theme={theme} setTheme={setTheme} weather={weather} setWeather={setWeather} profile={profile} setProfile={setProfile} sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled} scores={scores} onLogout={() => setView('landing')} onDelete={() => showConfirm('danger_zone.exe', 'Are you sure? This will permanently delete all your data, including chat history, scores, and settings.', () => { localStorage.clear(); window.location.reload(); })} onClose={()=>navigateTo('dashboard')} />}
          
          {view === 'chat' && <ChatView profile={profile} onClose={()=>navigateTo('dashboard')} sfx={sfxEnabled} chatHistory={chatHistory} setChatHistory={setChatHistory} />}
          
          {view === 'doodle' && <DoodleApp initialDoodle={replyDoodle} onClose={()=>{setView('dashboard'); setReplyDoodle(null);}} onSendDoodle={(d) => { 
            const doodleEntry = {id: Date.now(), sender: 'me', ...d};
            setDoodles(p=>[...p, doodleEntry]); 
            // Auto-save to scrapbook
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
        </>
      )}

      {milestone && <MilestoneCelebration milestone={milestone} onClose={() => setMilestoneShown(true)} />}

      {viewingDoodle && ( 
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <DoodleViewer doodle={viewingDoodle} onClose={() => { setViewingDoodle(null); setDoodles(p => p.map(d => d.id === viewingDoodle.id ? {...d, isRead: true} : d)); }} profileName={profile.name} sfx={sfxEnabled} onRedoodle={(d) => { setViewingDoodle(null); setDoodles(p => p.map(dd => dd.id === viewingDoodle.id ? {...dd, isRead: true} : dd)); setReplyDoodle(d); setView('doodle'); }} onReplyToChat={(text, img) => { handleShareToChat(text, img); setViewingDoodle(null); setDoodles(p => p.map(dd => dd.id === viewingDoodle.id ? {...dd, isRead: true} : dd)); navigateTo('chat'); }} /> 
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [roomId, setRoomId] = useState(window.localStorage.getItem('attic_room_id') || '');
  const [syncReady, setSyncReady] = useState(false);

  useEffect(() => {
    if (roomId) {
      const cleanupPromise = initializeRoomSync(roomId);
      cleanupPromise.then(() => setSyncReady(true));
      return () => cleanupPromise.then(cleanup => cleanup && cleanup());
    }
  }, [roomId]);

  const handleJoinLobby = (code) => {
    window.localStorage.setItem('attic_room_id', code);
    setRoomId(code);
  };

  if (!roomId) {
    return (
      <ToastProvider>
        <Lobby onJoin={handleJoinLobby} />
      </ToastProvider>
    );
  }

  if (!syncReady) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-matrix-pattern relative overflow-hidden">
        <div className="absolute inset-0 scanlines pointer-events-none z-10"></div>
        <h1 className="text-4xl text-[var(--primary)] font-black animate-pulse glitch-text tracking-widest z-20">SYNCING LIVE DB...</h1>
        <p className="text-white mt-4 font-bold z-20">establishing secure websocket connection</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
