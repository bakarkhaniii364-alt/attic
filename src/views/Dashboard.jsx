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

  if (sync.syncError) {
    return (
      <div className="w-full flex items-center justify-center p-8 h-full min-h-[50vh] animate-in fade-in zoom-in duration-300">
         <div className="bg-window retro-border p-8 text-center max-w-md border-red-500 retro-shadow-dark">
            <h2 className="text-xl font-black mb-4 text-red-500 uppercase">Connection Interrupted</h2>
            <p className="text-xs mb-6 font-bold opacity-80">{sync.syncError.message || 'Failed to synchronize couple data with the server.'}</p>
            <RetroButton onClick={() => window.location.reload()} className="px-6 py-2 text-xs">Reconnect</RetroButton>
         </div>
      </div>
    );
  }

  if (roomId && !partnerId) {
    return (
      <div className="w-full flex items-center justify-center p-8 h-full min-h-[50vh] animate-in fade-in zoom-in duration-300">
         <div className="bg-window retro-border p-8 text-center max-w-md retro-shadow-dark">
            <h2 className="text-xl font-black mb-4 uppercase">Waiting for Partner</h2>
            <p className="text-xs mb-6 font-bold opacity-80">Your room is established, but your partner hasn't joined yet. They need your pairing code to enter.</p>
            <RetroButton onClick={() => nav('handshake')} className="px-6 py-2 text-xs bg-primary">View Invite Code</RetroButton>
         </div>
      </div>
    );
  }

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

  // Mobile nav pivot removed as it's now handled globally in App.jsx

  const dynamicFeedItems = [];

  if (!welcomeDismissed && daysAway >= 1) {
    dynamicFeedItems.push({
      id: 'welcome',
      icon: <Sparkles size={14} className="text-secondary shrink-0" fill="currentColor" />,
      text: `welcome back! ${partnerName} missed you${daysAway > 1 ? ` (${daysAway} days)` : ''}.`,
      bgClass: 'bg-secondary/15 border-secondary/30 text-secondary-text',
      action: {
        label: 'Dismiss',
        onClick: () => {
          playAudio('click', sfxEnabled);
          setWelcomeDismissed(true);
        },
      }
    });
  }

  if (unreadChatCount > 0) {
    dynamicFeedItems.push({
      id: 'chat',
      icon: <MessageSquare size={14} className="text-primary shrink-0" fill="currentColor" />,
      text: unreadChatCount === 1 
        ? `${partnerName} sent you a message.` 
        : `${unreadChatCount} new messages from ${partnerName}.`,
      bgClass: 'bg-primary/15 border-primary/30 text-primary-text',
      action: {
        label: 'Open',
        onClick: () => {
          playAudio('click', sfxEnabled);
          nav('chat');
        },
      }
    });
  }

  if (!dailyAnswers?.[todayKey()]?.[userId]) {
    dynamicFeedItems.push({
      id: 'daily-q',
      icon: <Heart size={14} className="text-primary shrink-0" fill="currentColor" />,
      text: "Today's couple question is waiting — answer together.",
      bgClass: 'bg-accent/15 border-accent/30 text-accent-text',
      action: {
        label: 'Answer',
        onClick: () => {
          playAudio('click', sfxEnabled);
          nav('daily-q');
        },
      }
    });
  }

  if (streaks.count >= 3) {
    dynamicFeedItems.push({
      id: 'streak',
      icon: <Flame size={14} className="text-orange-500 shrink-0" fill="currentColor" />,
      text: `${streaks.count}-day streak — keep showing up for ${partnerName}!`,
      bgClass: 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400',
    });
  }

  const fallbackItem = {
    id: 'all-clear',
    icon: <Sparkles size={14} className="text-success shrink-0" />,
    text: "you're all caught up! send a doodle or play a game to connect.",
    bgClass: 'bg-success/10 border-success/30 text-success-text border-dashed'
  };

  const welcomeWindow = (
    <RetroWindow title="welcome.exe" className={`w-full md:col-span-8 h-auto min-h-[10rem] order-1 md:order-none`}>
      <div className="flex flex-col h-full justify-between gap-2 p-1">
        {isMobile ? (
          // Mobile layout: Greeting & Kiss button in row 1, Partner status split in row 2 (prevents horizontal scroll)
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2.5">
                {profile.pfp ? (
                  <img src={profile.pfp} alt={`${myDisplayName} profile`} className="w-10 h-10 retro-border retro-shadow-dark object-cover bg-white animate-in zoom-in duration-300" />
                ) : (
                  <div className="w-10 h-10 retro-border retro-bg-accent flex items-center justify-center text-xl" aria-hidden="true">{profile.emoji}</div>
                )}
                <h1 className="text-base font-black leading-none lowercase">
                  hi {myDisplayName}! {mood}
                </h1>
              </div>
              <RetroButton
                onClick={handleSendKiss}
                disabled={Date.now() - lastActionTime < 3000}
                variant="primary"
                className="h-8 px-2.5 text-xs font-black uppercase shrink-0"
              >
                <Heart size={12} fill={Date.now() - lastActionTime < 3000 ? "none" : "currentColor"} />
                <span>Kiss</span>
              </RetroButton>
            </div>

            <div className="flex items-center gap-2.5 w-full mt-1 border-t border-dashed border-border/30 pt-2">
              <div className="relative shrink-0">
                {partnerProfile.pfp ? (
                  <img src={partnerProfile.pfp} alt={`${partnerName} profile`} className="w-8 h-8 retro-border object-cover bg-white" />
                ) : (
                  <div className="w-8 h-8 retro-bg-secondary retro-border flex items-center justify-center text-sm">{partnerProfile.emoji || '👤'}</div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-2 h-2 border border-window rounded-full ${isPartnerOnline ? 'bg-success' : isPartnerIdle ? 'bg-warning' : 'bg-disabled'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black truncate">{partnerName}</p>
                    <span className={`text-[8px] font-black uppercase px-1 py-0.5 retro-border leading-none shadow-sm shrink-0 ${
                      partnerStatusData.activity ? 'bg-secondary text-secondary-text border-secondary' : 
                      isPartnerOnline ? 'bg-success text-success-text border-success' : 
                      isPartnerIdle ? 'bg-warning text-warning-text border-warning' : 
                      'bg-disabled text-disabled-text border-disabled opacity-60'
                    }`}>
                      {partnerStatusData.activity ? 'Playing' : partnerStatusData.status}
                    </span>
                  </div>
                  <p className="text-[9px] font-bold opacity-60 truncate mt-0.5">
                    {(() => {
                      if (partnerStatusData.activity) return partnerStatusData.activity;
                      if (partnerStatusData.status === 'offline') {
                        const parts = [];
                        if (partnerStatusData.label !== 'Offline') parts.push(partnerStatusData.label);
                        if (partnerStatusData.lastActivity) parts.push(`Played ${partnerStatusData.lastActivity.game}`);
                        return parts.length > 0 ? parts.join(' · ') : 'Resting...';
                      }
                      return displayStatus.toLowerCase();
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Desktop layout
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {profile.pfp ? <img src={profile.pfp} alt={`${myDisplayName} profile`} className="w-12 h-12 retro-border retro-shadow-dark object-cover bg-white" /> : <div className="w-12 h-12 retro-border retro-bg-accent flex items-center justify-center text-2xl" aria-hidden="true">{profile.emoji}</div>}
              <div>
                <h1 className="text-xl font-black leading-none lowercase flex items-center gap-2">
                  hi {myDisplayName}! {mood}
                </h1>

                <div className={`flex flex-wrap items-center gap-3 mt-2 ${isMobile ? '' : 'bg-black/5 p-1.5 retro-border border-dashed'}`}>
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
            {isMobile ? (
              <RetroButton
                onClick={handleSendKiss}
                disabled={Date.now() - lastActionTime < 3000}
                variant="primary"
                className="h-9 px-3 text-xs font-black uppercase shrink-0"
              >
                <Heart size={14} fill={Date.now() - lastActionTime < 3000 ? "none" : "currentColor"} />
                <span>Kiss</span>
              </RetroButton>
            ) : (
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
            )}
          </div>
        )}

        {/* Dynamic, Smart Info Feed — shows only the single most important alert */}
        <div className="pt-2 border-t border-dashed border-border/40 mt-2">
          {(() => {
            const item = dynamicFeedItems[0] || fallbackItem;
            return (
              <div 
                className={`feed-item flex items-center justify-between gap-2 py-2 leading-tight ${isMobile ? 'border-b border-dashed border-border/30 bg-transparent text-main-text text-xs' : `px-2.5 retro-border text-[11px] font-bold ${item.bgClass}`}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="feed-icon-pulse">{item.icon}</span>
                  <span className="truncate lowercase">{item.text}</span>
                </div>
                {item.action && (
                  <RetroButton
                    type="button"
                    variant="primary"
                    className={`${isMobile ? 'h-8 px-3 text-xs' : 'text-[9px] py-0.5 px-2.5 bg-window text-main-text'} shrink-0 font-black uppercase`}
                    onClick={item.action.onClick}
                  >
                    {item.action.label}
                  </RetroButton>
                )}
              </div>
            );
          })()}
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-border pt-2 mt-2">
          <div className="flex items-center gap-2">
            {partnerWeather && (
              <>
                <span className="text-lg leading-none">{partnerWeather.emoji}</span>
                <p className="text-xs font-black">{partnerWeather.temp}°C · {partnerWeather.city}</p>
              </>
            )}
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <button onClick={() => nav('settings')} className="bg-window text-main-text font-black text-[9px] py-1 px-2.5 retro-border retro-shadow-dark uppercase tracking-wider flex items-center gap-1">
                <SettingsIcon size={10} /> Control Panel
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className="bg-red-500 text-white font-black text-[9px] py-1 px-2.5 retro-border retro-shadow-dark uppercase tracking-wider flex items-center gap-1">
                <LogOut size={10} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </RetroWindow>
  );

  const petWindow = (
    <RetroWindow title={`${coupleData.petName || 'pet'}.tamagotchi`} className={`w-full md:col-span-4 h-auto min-h-[10rem] order-3 md:order-none`} overflowVisible={true}>
      <div className="flex flex-col items-center text-center h-full justify-between p-1">
        <PixelPet skin={petSkin} happy={petHappy} isPartnerAfk={!isPartnerOnline} externalAction={petAction} onPet={handlePet} onHit={handleHit} partnerName={partnerName} />
        
        <div className="w-full px-3 mt-1">
          <div className={`${isMobile ? 'bg-black/5' : 'retro-border bg-black/5'} p-1 flex gap-1 h-4`}>
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className={`flex-1 transition-colors duration-300 ${i < Math.round(petHappy / 10) ? 'bg-primary' : 'bg-transparent'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 w-full mt-2 px-2">
          <RetroButton variant="secondary" className={`flex-1 ${isMobile ? 'h-9 text-xs' : 'py-1 text-[10px]'} font-black uppercase`} disabled={petCooldown} onClick={handleFeed}>Feed</RetroButton>
        </div>
      </div>
    </RetroWindow>
  );

  const timerWindow = (
    <RetroWindow title="together.timer" className={`w-full md:col-span-4 h-auto order-2 md:order-none`}>
      <div className="flex flex-col h-full justify-center gap-3">
        <AnniversaryTimer anniversary={coupleData.anniversary} />
        <CalendarReminder />
      </div>
    </RetroWindow>
  );

  const radioWindow = (
    <RetroWindow title="radio.sys" className={`w-full md:col-span-4 h-auto min-h-[12rem] ${isMobile ? 'hidden' : 'flex'}`} noPadding>
      <DashboardRadio radioState={radioState} setRadioState={setRadioState} />
    </RetroWindow>
  );

  const statsContent = (
    <div className={`flex flex-col h-full p-2 ${isMobile ? 'text-xs' : 'text-[11px]'} font-black uppercase tracking-wider text-main-text space-y-1.5`}>
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
    <RetroWindow title="stats.sys" className={`w-full md:col-span-4 h-auto order-4 md:order-none`}>
      {statsContent}
    </RetroWindow>
  );

  const appsWindow = (
    <RetroWindow title="applications" className={`w-full md:col-span-12 ${isMobile ? 'hidden' : 'flex'}`}>
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

  return (
    <div className={`max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 relative z-10 pb-8 ${isMobile ? 'pb-safe-navbar' : ''}`}>
      {unreadDoodles.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="animate-in zoom-in-50 spin-in-6 duration-500 cursor-pointer hover:scale-110 transition-transform flex flex-col items-center" onClick={() => nav('doodle')}>
            <div className="relative"><Mail size={120} className="text-window drop-shadow-2xl" fill="var(--primary)" /><div className="absolute inset-0 flex items-center justify-center animate-pulse"><Heart size={40} className="text-white" fill="white" /></div></div>
            <div className="text-center font-bold text-main-text mt-6 bg-accent text-accent-text retro-border retro-shadow-dark px-6 py-2 text-lg">You have a new doodle!</div>
            <p className="text-window font-bold mt-2 animate-pulse">Click to open</p>
          </div>
        </div>
      )}
      

      {welcomeWindow}
      {timerWindow}
      {petWindow}
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
