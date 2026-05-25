import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Mail, Heart, Hand, Gamepad2, MessageSquare, Brush, Pen, Clock, Calendar as CalendarIcon, Image as ImageIcon, Settings as SettingsIcon, ListTodo, Flame, Moon, MessageCircle, FileText, Grid3x3, Volume2, Monitor, Zap, LogOut, Sparkles } from 'lucide-react';
import { RetroWindow, RetroButton, AppIcon, ConfirmDialog, useToast } from '../components/UI.jsx';
import { DashboardRadio } from '../components/LofiPlayer.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { getScoreForUser } from '../utils/userDataHelpers.js';
import { StreakBadge, WeatherWidget } from '../components/Features.jsx';
import { PixelPet } from '../components/Dashboard/PixelPet.jsx';
import { AnniversaryTimer } from '../components/Dashboard/AnniversaryTimer.jsx';
import { CalendarReminder } from '../components/Dashboard/CalendarReminder.jsx';
import { useAuth, useSync, useChat } from '../context/instances.js';
import { supabase } from '../lib/supabase.js';
import { useDashboardLogic } from '../hooks/useDashboardLogic.js';
import { useLastSeen } from '../hooks/useLastSeen.js';
import { useMobile } from '../hooks/useMobile.js';
import {
  RetentionNudges,
  WelcomeBackBanner,
  recordVisit,
  getDaysSinceLastVisit,
} from '../components/Dashboard/RetentionNudges.jsx';

const todayKey = () => new Date().toLocaleDateString('en-CA');

const ChatView = React.lazy(() => import('./ChatView.jsx').then(m => ({ default: m.ChatView })));
const SettingsView = React.lazy(() => import('./SettingsView.jsx').then(m => ({ default: m.SettingsView })));


export function Dashboard({ setView, theme, setTheme, sfxEnabled, setSfxEnabled, notificationsEnabled, setNotificationsEnabled, weather, setWeather, radioState, setRadioState, setShowKiss }) {
  const { userId, partnerId, roomId, logout, user } = useAuth();
  const sync = useSync();
  const { globalState, isInitialized, updateSyncState, updateSyncStateAtomic, mergeSyncState, broadcast: syncBroadcast, onlineUsers } = sync;
  const { messages: chatHistory } = useChat();
  const toast = useToast();
  const isMobile = useMobile();
  const [mobileTab, setMobileTab] = useState('home');

  const profile = globalState?.room_profiles?.[userId] || {};
  const partnerProfile = globalState?.room_profiles?.[partnerId] || {};
  const coupleData = globalState?.couple_data || { petName: 'pet', petSkin: '/assets/cat_1_9', petHappy: 60 };
  const streaks = globalState?.user_streaks?.[userId] || { count: 0 };
  const dailyAnswers = globalState?.daily_answers || {};
  
  const partnerName = coupleData.nicknames?.[partnerId] || (partnerProfile.name && partnerProfile.name !== 'You' ? partnerProfile.name : 'Partner');
  const partnerStatus = partnerProfile.status || 'offline';

  const { partnerStatusData, partnerStatusLabel } = useLastSeen();
  const isPartnerOnline = partnerStatusData.status === 'active';
  const isPartnerIdle = partnerStatusData.status === 'idle';
  const displayStatus = partnerStatusLabel;

  const scores = globalState?.game_scores || {};
  const myDisplayName = profile.name || 'you';
  const mood = coupleData.petHappy > 80 ? '✨' : coupleData.petHappy > 50 ? '❤️' : '☁️';
  const safeDoodles = globalState?.doodles || [];

  const unreadChatCount = (chatHistory || []).filter(m => m.sender === partnerId && (!m.status || m.status !== 'read')).length;
  
  const nav = (v) => setView(v);
  const unreadDoodles = safeDoodles.filter(d => {
    const readBy = Array.isArray(d.metadata?.read_by) ? d.metadata.read_by : [];
    return d.owner_id === partnerId && !readBy.includes(userId);
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [daysAway, setDaysAway] = useState(0);

  useEffect(() => {
    const prev = recordVisit();
    setDaysAway(getDaysSinceLastVisit(prev));
  }, []);

  const {
    dbStats, partnerWeather, unviewedDoodle,
    petCooldown, petAction, lastActionTime,
    handleFeed, handlePet, handleHit, handleSendKiss,
    setUnviewedDoodle
  } = useDashboardLogic({
    userId, roomId, partnerId, partnerProfile,
    updateSyncStateAtomic, mergeSyncState, sfxEnabled,
    toast, setShowKiss, syncBroadcast, coupleData,
    globalState, isInitialized, user
  });

  const petSkin = coupleData.petSkin || '/assets/cat_1_9';
  const petHappy = coupleData.petHappy ?? 60;
  const petName = coupleData.petName || 'pet';

  const mobilePivot = (
    <div className="sticky top-0 z-[600] bg-window border-b-2 border-border pt-8 pb-3 px-6 overflow-x-auto whitespace-nowrap scrollbar-hide flex items-center justify-between shrink-0 shadow-sm">
      {[
        { id: 'home', icon: <Heart size={24} fill={mobileTab === 'home' ? 'currentColor' : 'none'} /> },
        { id: 'chat', icon: <MessageSquare size={24} fill={mobileTab === 'chat' ? 'currentColor' : 'none'} /> },
        { id: 'apps', icon: <Grid3x3 size={24} /> },
        { id: 'settings', icon: <SettingsIcon size={24} /> }
      ].map(tab => (
        <button 
          key={tab.id} 
          onClick={() => {
            playAudio('click', sfxEnabled);
            setMobileTab(tab.id);
          }}
          className={`transition-all duration-300 relative pb-2 ${mobileTab === tab.id ? 'text-primary scale-110' : 'opacity-20 hover:opacity-40'}`}
        >
          {tab.icon}
          {mobileTab === tab.id && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />}
        </button>
      ))}
    </div>
  );

  const retentionBlock = (
    <>
      {!welcomeDismissed && daysAway >= 1 && (
        <WelcomeBackBanner
          partnerName={partnerName}
          daysAway={daysAway}
          onDismiss={() => setWelcomeDismissed(true)}
        />
      )}
      <RetentionNudges
        streakCount={streaks.count || 0}
        unreadChatCount={unreadChatCount}
        dailyAnswers={dailyAnswers}
        userId={userId}
        partnerName={partnerName}
        onOpenChat={() => nav('chat')}
        onOpenDailyQuestion={() => nav('daily-q')}
        excludeDaily={!isMobile}
      />
    </>
  );

  const welcomeWindow = (
    <RetroWindow title="welcome.exe" className={isMobile ? "w-full" : "md:col-span-8 h-auto min-h-[10rem]"}>
      <div className="flex flex-col h-full justify-between gap-2 p-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {profile.pfp ? <img src={profile.pfp} alt={`${myDisplayName} profile`} className="w-12 h-12 retro-border retro-shadow-dark object-cover bg-white" /> : <div className="w-12 h-12 retro-border retro-bg-accent flex items-center justify-center text-2xl" aria-hidden="true">{profile.emoji}</div>}
            <div>
              <h1 className="text-xl font-black leading-none lowercase flex items-center gap-2">
                hi {myDisplayName}! {mood}
              </h1>

              <div className="flex flex-wrap items-center gap-3 mt-2 bg-black/5 p-1.5 retro-border border-dashed">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    {partnerProfile.pfp ? (
                      <img src={partnerProfile.pfp} alt={`${partnerName} profile`} className="w-8 h-8 retro-border object-cover bg-white" />
                    ) : (
                      <div className="w-8 h-8 retro-bg-secondary retro-border flex items-center justify-center text-sm">{partnerProfile.emoji || '👤'}</div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-window rounded-full ${isPartnerOnline ? 'bg-success' : isPartnerIdle ? 'bg-warning' : 'bg-disabled'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-black truncate max-w-[150px] leading-tight">
                        {partnerName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 retro-border leading-none shadow-sm shrink-0 ${
                          partnerStatusData.activity ? 'bg-secondary text-secondary-text border-secondary' : 
                          isPartnerOnline ? 'bg-success text-success-text border-success' : 
                          isPartnerIdle ? 'bg-warning text-warning-text border-warning' : 
                          'bg-disabled text-disabled-text border-disabled opacity-60'
                        }`}>
                          {partnerStatusData.activity ? 'Playing' : partnerStatusData.status}
                        </span>
                        <p className="text-[9px] font-bold opacity-60 truncate whitespace-nowrap">
                          {(() => {
                            if (partnerStatusData.activity) return partnerStatusData.activity;
                            if (partnerStatusData.status === 'offline') {
                              const parts = [];
                              // 1. Last Seen
                              if (partnerStatusData.label !== 'Offline') parts.push(partnerStatusData.label);
                              // 2. Played Last
                              if (partnerStatusData.lastActivity) parts.push(`Played ${partnerStatusData.lastActivity.game}`);
                              // 3. Prompt / "Miss you" logic
                              const lastSeenAt = partnerProfile.last_online_at || partnerProfile.updated_at;
                              if (lastSeenAt) {
                                const hoursAway = (Date.now() - new Date(lastSeenAt).getTime()) / 3600000;
                                if (hoursAway > 12) parts.push("Missing them?");
                                else if (hoursAway > 3) parts.push("Send a nudge?");
                              }
                              return parts.length > 0 ? parts.join(' · ') : 'Resting...';
                            }
                            return displayStatus.toLowerCase();
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleSendKiss} 
            disabled={Date.now() - lastActionTime < 3000}
            aria-label={`Send a kiss to ${partnerName}`}
            className={`p-1.5 w-14 retro-border flex flex-col items-center justify-center transition-all ${Date.now() - lastActionTime < 3000 ? 'opacity-40 grayscale cursor-not-allowed' : 'bg-window retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0'}`} 
          >
            <Heart size={20} fill={Date.now() - lastActionTime < 3000 ? "none" : "var(--primary)"} className={Date.now() - lastActionTime < 3000 ? 'text-border' : 'text-primary'} />
            <span className="text-[9px] font-bold mt-0.5 uppercase">Kiss</span>
          </button>
        </div>

        {!dailyAnswers?.[todayKey()]?.[userId] && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 font-bold min-w-0">
              <Sparkles size={16} className="text-primary shrink-0" />
              <span className="text-[10px] leading-tight">Today's couple question is waiting — answer together.</span>
            </div>
            <RetroButton
              type="button"
              className="text-[9px] py-1 px-2.5 shrink-0"
              onClick={() => nav('daily-q')}
            >
              Answer
            </RetroButton>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-dashed border-border pt-2 mt-2">
          <div className="flex items-center gap-2">
            {partnerWeather && (
              <>
                <span className="text-lg leading-none">{partnerWeather.emoji}</span>
                <p className="text-[10px] font-black">{partnerWeather.temp}°C · {partnerWeather.city}</p>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => nav('settings')} className="bg-window text-main-text font-black text-[9px] py-1 px-2.5 retro-border retro-shadow-dark uppercase tracking-wider flex items-center gap-1">
              <SettingsIcon size={10} /> Control Panel
            </button>
            <button onClick={() => setShowLogoutConfirm(true)} className="bg-red-500 text-white font-black text-[9px] py-1 px-2.5 retro-border retro-shadow-dark uppercase tracking-wider flex items-center gap-1">
              <LogOut size={10} /> Logout
            </button>
          </div>
        </div>
      </div>
    </RetroWindow>
  );

  const petWindow = (
    <RetroWindow title={`${coupleData.petName || 'pet'}.tamagotchi`} className={isMobile ? "w-full" : "md:col-span-4 h-auto min-h-[10rem]"} overflowVisible={true}>
      <div className="flex flex-col items-center text-center h-full justify-between p-1">
        <PixelPet skin={petSkin} happy={petHappy} isPartnerAfk={!isPartnerOnline} externalAction={petAction} onPet={handlePet} onHit={handleHit} partnerName={partnerName} />
        
        <div className="w-full px-3 mt-1">
          <div className="retro-border bg-black/5 p-1 flex gap-1 h-5">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className={`flex-1 transition-colors duration-300 ${i < Math.round(petHappy / 10) ? 'bg-primary' : 'bg-transparent'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 w-full mt-2 px-2">
          <RetroButton variant="secondary" className="flex-1 py-1 text-[10px] font-black uppercase" disabled={petCooldown} onClick={handleFeed}>Feed</RetroButton>
        </div>
      </div>
    </RetroWindow>
  );

  const timerWindow = (
    <RetroWindow title="together.timer" className={isMobile ? "w-full" : "md:col-span-4 h-auto"}>
      <div className="flex flex-col h-full justify-center gap-3">
        <AnniversaryTimer anniversary={coupleData.anniversary} />
        <CalendarReminder />
      </div>
    </RetroWindow>
  );

  const radioWindow = (
    <RetroWindow title="radio.sys" className={isMobile ? "window-screen" : "md:col-span-4 h-auto min-h-[12rem]"} noPadding>
      <DashboardRadio radioState={radioState} setRadioState={setRadioState} />
    </RetroWindow>
  );

  const statsContent = (
    <div className="flex flex-col h-full p-2 text-[11px] font-black uppercase tracking-wider text-main-text space-y-1">
      <div className="flex justify-between border-b border-dashed border-border/30 pb-1">
        <span>Current Streak</span>
        <span className="text-primary">{streaks.count || 0} Days</span>
      </div>
      <div className="flex justify-between border-b border-dashed border-border/30 pb-1">
        <span>Best Streak</span>
        <span className="text-secondary">{streaks.best || streaks.count || 0} Days</span>
      </div>
      <div className="flex justify-between border-b border-dashed border-border/30 pb-1">
        <span>Attic Usage</span>
        <span className="text-accent">
          {(() => {
            const start = profile.created_at ? new Date(profile.created_at) : (user?.created_at ? new Date(user.created_at) : new Date());
            const days = Math.max(1, Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24)));
            return `${days} Day${days !== 1 ? 's' : ''}`;
          })()}
        </span>
      </div>

      <div className="mt-auto pt-2 flex justify-between items-center opacity-40 text-[9px] font-black">
        <span>v1.2.1-rigid</span>
        <span>Theme: {theme}</span>
      </div>
    </div>
  );

  const statsWindow = (
    <RetroWindow title="stats.sys" className={isMobile ? "window-screen" : "md:col-span-4 h-auto"}>
      {statsContent}
    </RetroWindow>
  );

  const appsWindow = (
    <RetroWindow title="applications" className={isMobile ? "window-screen" : "md:col-span-12"}>
      <div className={`grid ${isMobile ? 'grid-cols-3 gap-8' : 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-6 sm:gap-8'} p-4`}>
        <AppIcon icon={<MessageSquare size={28} />} label="Chat"     color="#3b82f6" onClick={() => nav('chat')} badge={unreadChatCount > 0 ? unreadChatCount : null} />
        <AppIcon icon={<Gamepad2     size={28} />} label="Arcade"   color="#a855f7" onClick={() => nav('activities')} />
        <AppIcon icon={<Monitor      size={28} />} label="Watch"    color="#f472b6" onClick={() => nav('watch')} />
        <AppIcon icon={<Pen          size={28} />} label="Doodle"   color="#ec4899" onClick={() => nav('doodle')} />
        <AppIcon icon={<Brush        size={28} />} label="Pixels"   color="#f97316" onClick={() => nav('pixelart')} />
        {isMobile && <AppIcon icon={<Volume2 size={28} />} label="Radio" color="var(--primary)" onClick={() => setMobileTab('radio')} />}
        <AppIcon icon={<Clock        size={28} />} label="Capsule"  color="#10b981" onClick={() => nav('capsule')} />
        <AppIcon icon={<Moon         size={28} />} label="Dreams"   color="#6366f1" onClick={() => nav('dreams')} />
        <AppIcon icon={<ListTodo     size={28} />} label="Lists"    color="#ef4444" onClick={() => nav('lists')} />
        <AppIcon icon={<CalendarIcon size={28} />} label="Calendar" color="#06b6d4" onClick={() => nav('calendar')} />
        <AppIcon icon={<ImageIcon    size={28} />} label="Album"    color="#eab308" onClick={() => nav('scrapbook')} />
        <AppIcon icon={<FileText     size={28} />} label="Notes"    color="#0ea5e9" onClick={() => nav('notes')} />
        <AppIcon icon={<Heart        size={28} />} label="Story"    color="#f43f5e" onClick={() => nav('resume')} />
        <AppIcon icon={<MessageCircle size={28} />} label="Daily Q"  color="#f59e0b" onClick={() => nav('daily-q')} />
        <AppIcon icon={<SettingsIcon size={28} />} label="Settings" color="#64748b" onClick={() => nav('settings')} />
      </div>
    </RetroWindow>
  );

  if (isMobile) {
    return (
      <div className="w-full flex flex-col min-h-[100dvh] bg-window relative overflow-hidden">
        {mobilePivot}
        <div className="flex-1 overflow-y-auto pb-8">
          {mobileTab === 'home' && (
            <div className="flex flex-col gap-4 p-4 animate-in slide-in-from-right-8 duration-300">
               {/* Simplified Home Layout */}
               <div className="space-y-1">
                  <h1 className="text-3xl font-black lowercase tracking-tighter">hi {myDisplayName}! {mood}</h1>
                   <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isPartnerOnline ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : isPartnerIdle ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{partnerName} is {partnerStatusData.status}</p>
                    </div>
                    <p className="text-[9px] font-bold opacity-40 mt-0.5 truncate whitespace-nowrap">
                      {(() => {
                        if (partnerStatusData.activity) return `Playing ${partnerStatusData.activity}`;
                        if (partnerStatusData.status === 'offline') {
                          const parts = [];
                          if (partnerStatusData.label !== 'Offline') parts.push(partnerStatusData.label);
                          if (partnerStatusData.lastActivity) parts.push(`Played ${partnerStatusData.lastActivity.game}`);
                          return parts.join(' · ');
                        }
                        return partnerStatusData.label.toLowerCase();
                      })()}
                    </p>
                   </div>
               </div>

               <div className="space-y-4">
                  {retentionBlock}
                  {welcomeWindow}
                  {petWindow}
                  {timerWindow}
                  <RetroWindow title="system_stats" className="w-full">
                    {statsContent}
                  </RetroWindow>
               </div>
            </div>
          )}
          {mobileTab === 'chat' && (
            <div className="h-[calc(100dvh-100px)] flex flex-col animate-in slide-in-from-right-8 duration-300">
              <Suspense fallback={<div className="p-8 bg-window text-main-text font-bold text-center">Loading...</div>}>
                <ChatView onClose={() => setMobileTab('home')} isMobile={true} />
              </Suspense>
            </div>
          )}
          {mobileTab === 'apps' && (
            <div className="animate-in slide-in-from-right-8 duration-300">
              {appsWindow}
            </div>
          )}
          {mobileTab === 'settings' && (
            <div className="animate-in slide-in-from-right-8 duration-300">
              <Suspense fallback={<div className="p-8 bg-window text-main-text font-bold text-center">Loading...</div>}>
                <SettingsView 
                  onClose={() => setMobileTab('home')}
                  theme={theme} setTheme={setTheme}
                  profile={profile} setProfile={(p) => updateSyncStateAtomic('room_profiles', userId, p)}
                  onLogout={logout}
                  sfxEnabled={sfxEnabled} setSfxEnabled={setSfxEnabled}
                  notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled}
                  weather={weather} setWeather={setWeather}
                  scores={scores}
                  userId={userId} partnerId={partnerId}
                  coupleData={coupleData} setCoupleData={(d) => mergeSyncState('couple_data', d)}
                  streaks={streaks}
                />
              </Suspense>
            </div>
          )}
        </div>

        {showLogoutConfirm && (
          <ConfirmDialog
            title="logout.exe"
            message="Are you sure you want to log out?"
            onConfirm={logout}
            onCancel={() => setShowLogoutConfirm(false)}
            sfx={sfxEnabled}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 relative z-10 pb-8">
      {unreadDoodles.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="animate-in zoom-in-50 spin-in-6 duration-500 cursor-pointer hover:scale-110 transition-transform flex flex-col items-center" onClick={() => nav('doodle')}>
            <div className="relative"><Mail size={120} className="text-window drop-shadow-2xl" fill="var(--primary)" /><div className="absolute inset-0 flex items-center justify-center animate-pulse"><Heart size={40} className="text-white" fill="white" /></div></div>
            <div className="text-center font-bold text-main-text mt-6 bg-accent text-accent-text retro-border retro-shadow-dark px-6 py-2 text-lg">You have a new doodle!</div>
            <p className="text-window font-bold mt-2 animate-pulse">Click to open</p>
          </div>
        </div>
      )}
      
      <div className="md:col-span-12">{retentionBlock}</div>
      {welcomeWindow}
      {petWindow}
      {timerWindow}
      {radioWindow}
      {statsWindow}
      {appsWindow}

      {showLogoutConfirm && (
        <ConfirmDialog
          title="logout.exe"
          message="Are you sure you want to log out of the Attic?"
          onConfirm={logout}
          onCancel={() => setShowLogoutConfirm(false)}
          sfx={sfxEnabled}
        />
      )}
    </div>
  );
}
