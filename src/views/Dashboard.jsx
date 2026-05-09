import React, { useState, useEffect, useRef } from 'react';
import { Mail, Heart, Hand, Gamepad2, MessageSquare, Brush, Pen, Clock, Calendar as CalendarIcon, Image as ImageIcon, Settings as SettingsIcon, ListTodo, Flame, Moon, MessageCircle, FileText, Grid3x3, Volume2, Monitor, Zap } from 'lucide-react';
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


export function Dashboard({ setView, theme, setTheme, sfxEnabled, setSfxEnabled, weather, setWeather, radioState, setRadioState, setShowKiss }) {
  const { userId, partnerId, roomId, logout } = useAuth();
  const sync = useSync();
  const { globalState, updateSyncState, updateSyncStateAtomic, mergeSyncState, broadcast: syncBroadcast, onlineUsers } = sync;
  const { messages: chatHistory } = useChat();
  const toast = useToast();

  const profile = globalState?.room_profiles?.[userId] || {};
  const partnerProfile = globalState?.room_profiles?.[partnerId] || {};
  const coupleData = globalState?.couple_data || { petName: 'pet', petSkin: '/assets/cat_1_9', petHappy: 60 };
  const streaks = globalState?.user_streaks?.[userId] || { count: 0 };
  
  const partnerName = coupleData.nicknames?.[partnerId] || (partnerProfile.name && partnerProfile.name !== 'You' ? partnerProfile.name : 'Partner');
  const partnerStatus = partnerProfile.status || 'offline';

  const partnerPresence = partnerId ? (onlineUsers[partnerId] || {}) : {};
  const isPartnerOnline = partnerId && partnerPresence.status === 'active';
  const isPartnerIdle = partnerId && partnerPresence.status === 'idle';

  let displayStatus = 'Offline';
  if (isPartnerOnline) displayStatus = 'Online';
  else if (isPartnerIdle) displayStatus = 'Idle (Away)';
  else if (partnerPresence.online_at) {
    const diffMins = Math.floor((Date.now() - new Date(partnerPresence.online_at).getTime()) / 60000);
    displayStatus = diffMins < 60 ? `Last seen ${diffMins}m ago` : `Last seen ${Math.floor(diffMins/60)}h ago`;
  }

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

  const {
    dbStats, partnerWeather, unviewedDoodle,
    petCooldown, petAction, lastActionTime,
    handleFeed, handlePet, handleHit, handleSendKiss,
    setUnviewedDoodle
  } = useDashboardLogic({
    userId, roomId, partnerId, partnerProfile,
    updateSyncStateAtomic, mergeSyncState, sfxEnabled,
    toast, setShowKiss, syncBroadcast, coupleData
  });

  const petSkin = coupleData.petSkin || '/assets/cat_1_9';
  const petHappy = coupleData.petHappy ?? 60;
  const petName = coupleData.petName || 'pet';

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
      <RetroWindow title="welcome.exe" className="md:col-span-8 h-auto min-h-[12rem]">
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex justify-between items-start">
            {streaks?.count > 0 && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-orange-100/80 backdrop-blur-sm retro-border px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-500">
                <Flame size={14} className={`text-orange-500 ${streaks.count > 3 ? 'animate-bounce' : ''}`} fill={streaks.count > 3 ? 'currentColor' : 'none'} />
                <span className="font-black text-orange-700 text-[10px] tracking-widest uppercase">
                  {streaks.count} Day{streaks.count !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            <div className="flex items-center gap-4">
              {profile.pfp ? <img src={profile.pfp} alt="pfp" className="w-16 h-16 retro-border retro-shadow-dark object-cover bg-white" /> : <div className="w-16 h-16 sm:w-20 sm:h-20 retro-border retro-bg-accent flex items-center justify-center text-3xl sm:text-4xl">{profile.emoji}</div>}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black mb-1 leading-none lowercase flex items-center gap-2">
                  hi {myDisplayName}! {mood}
                  {coupleData.settings?.masterMode && (
                    <span className="bg-yellow-400 text-black text-[10px] px-2 py-0.5 retro-border animate-pulse shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black uppercase tracking-tighter">Master</span>
                  )}
                </h1>

                <div className="flex items-center gap-4 mt-3 bg-black/5 p-2 retro-border border-dashed min-h-[50px]">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {partnerProfile.pfp ? (
                        <img src={partnerProfile.pfp} alt="partner" className="w-10 h-10 retro-border object-cover bg-white retro-shadow-dark" />
                      ) : (
                        <div className="w-10 h-10 retro-bg-secondary retro-border flex items-center justify-center text-lg">{partnerProfile.emoji || '👤'}</div>
                      )}
                      {/* Presence indicator */}
                      <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${isPartnerOnline ? 'bg-green-500' : isPartnerIdle ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none mb-1">Partner Connection</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate max-w-[140px] leading-none">
                          {partnerProfile.name && partnerProfile.name !== 'You' ? partnerProfile.name : 'Partner'}
                        </p>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 retro-border leading-none ${displayStatus.includes('Playing') ? 'bg-pink-400 text-white border-pink-600' : isPartnerOnline ? 'bg-green-500 text-white border-green-700' : isPartnerIdle ? 'bg-yellow-400 text-black border-yellow-600' : 'bg-transparent border-2 border-border/50 text-main-text opacity-50'}`}>
                          {displayStatus.toLowerCase()}
                        </span>
                      </div>

                      {isPartnerOnline && partnerProfile.activity && (
                        <div className="flex items-center gap-2 mt-1.5 animate-in fade-in slide-in-from-left-2">
                          <p className="text-[10px] font-bold text-primary italic lowercase">
                            currently {partnerProfile.activity}
                          </p>
                          {['Playing', 'Watching', 'Browsing'].some(s => partnerProfile.activity.includes(s)) && (
                            <button 
                              onClick={() => {
                                if (partnerProfile.activity.includes('SyncWatcher')) setView('watch');
                                else if (partnerProfile.activity.includes('Games')) setView('activities');
                                else setView('activities');
                              }}
                              className="text-[8px] bg-primary text-white px-1.5 py-0.5 retro-border font-black uppercase hover:scale-105 active:scale-95 transition-transform"
                            >
                              Join
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="h-8 w-px bg-border opacity-20"></div>
                    <StreakBadge streak={streaks} />
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={handleSendKiss} 
              disabled={Date.now() - lastActionTime < 3000}
              className={`p-2 w-16 retro-border flex flex-col items-center justify-center transition-all ${Date.now() - lastActionTime < 3000 ? 'opacity-40 grayscale cursor-not-allowed' : 'bg-window retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0 active:shadow-none'}`} 
              title="Send a kiss!"
            >
              <Heart size={24} fill={Date.now() - lastActionTime < 3000 ? "none" : "var(--primary)"} className={Date.now() - lastActionTime < 3000 ? 'text-border' : 'text-primary'} />
              <span className="text-[10px] font-bold mt-1 uppercase">Kiss</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end justify-between pt-4 border-t border-dashed border-border mt-auto">
            {/* Left: partner's local weather */}
            <div className="flex items-center gap-2 min-h-[40px]">
              {partnerWeather ? (
                <>
                  <span className="text-xl leading-none">{partnerWeather.emoji}</span>
                  <div className="leading-none">
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-widest">{partnerProfile.name || 'Partner'}'s weather</p>
                    <p className="text-xs font-black">{partnerWeather.temp}°C · {partnerWeather.city}</p>
                  </div>
                </>
              ) : (
                <p className="text-[10px] opacity-30 font-bold uppercase tracking-widest">
                  {partnerProfile?.location ? 'fetching weather…' : 'partner location unknown'}
                </p>
              )}
            </div>

            {/* Right: controls */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 items-center">

                <button onClick={() => nav('settings')} className="bg-window text-main-text font-black text-[10px] py-1.5 px-3 retro-border retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-transform uppercase tracking-wider flex items-center gap-1.5">
                  <SettingsIcon size={11} /> Control Panel
                </button>
                <button onClick={() => setShowLogoutConfirm(true)} className="bg-red-500 text-white font-black text-[10px] py-1.5 px-3 retro-border border-red-700 retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-transform uppercase tracking-wider">
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title={`${coupleData.petName || 'pet'}.tamagotchi`} className="md:col-span-4 h-auto min-h-[12rem]">
        <div className="flex flex-col items-center text-center h-full justify-between">
          <PixelPet skin={petSkin} happy={petHappy} isPartnerAfk={isPartnerIdle} externalAction={petAction} onPet={handlePet} onHit={handleHit} />
          <div className="w-full px-4 mt-2 flex flex-col gap-1 select-none">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider select-none text-main-text">
              <span>Happiness</span>
              <span>{petHappy}%</span>
            </div>
            <div className="h-5 retro-border bg-main w-full relative overflow-hidden flex items-center">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${petHappy}%` }}></div>
            </div>
          </div>
          <div className="flex gap-2 w-full mt-4">
            <RetroButton variant="secondary" className="flex-1 py-2 text-xs" disabled={petCooldown} onClick={handleFeed}>Feed</RetroButton>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title="together.timer" className="md:col-span-4 h-auto">
        <div className="flex flex-col h-full justify-center gap-3">
          <AnniversaryTimer anniversary={coupleData.anniversary} />
          <CalendarReminder />
        </div>
      </RetroWindow>

      <RetroWindow title="radio.sys" className="md:col-span-4 h-auto min-h-[12rem]" noPadding>
        <DashboardRadio radioState={radioState} setRadioState={setRadioState} />
      </RetroWindow>

      <RetroWindow title="stats.sys" className="md:col-span-4 h-auto">
        <div className="flex flex-col h-full p-2 text-sm font-bold gap-2 text-main-text">
          {/* Current Streak */}
          <div className="flex justify-between items-center bg-window p-2 retro-border">
            <span className="flex items-center gap-2"><Flame size={14} className="text-orange-500" /> Current Streak</span>
            <span className="text-primary">{streaks.count || 0} Days</span>
          </div>
          
          {/* Best Streak */}
          <div className="flex justify-between items-center bg-window p-2 retro-border">
            <span className="flex items-center gap-2">🏆 Best Streak</span>
            <span className="text-secondary">{streaks.best || streaks.count || 0} Days</span>
          </div>

          {/* Usage longevity */}
          <div className="flex justify-between items-center bg-window p-2 retro-border">
            <span className="flex items-center gap-2">🏠 Attic Usage</span>
            <span className="text-accent">
              {(() => {
                const start = profile.created_at ? new Date(profile.created_at) : new Date();
                const days = Math.max(1, Math.ceil((new Date() - start) / (1000 * 60 * 60 * 24)));
                return `${days} Day${days !== 1 ? 's' : ''}`;
              })()}
            </span>
          </div>

          {/* Highscore Winner */}
          <div className="flex justify-between items-center bg-window p-2 retro-border">
            <span className="flex items-center gap-2">👑 Highscore King</span>
            <span className="text-primary truncate max-w-[100px]">
              {(() => {
                const myTotal = Object.values(scores).reduce((acc, g) => acc + (g[userId] || 0), 0);
                const partnerTotal = Object.values(scores).reduce((acc, g) => acc + (g[partnerId] || 0), 0);
                if (myTotal === 0 && partnerTotal === 0) return 'No games yet';
                if (myTotal === partnerTotal) return 'Tie!';
                return myTotal > partnerTotal ? 'You' : partnerName;
              })()}
            </span>
          </div>

          {/* Site Version and Theme */}
          <div className="mt-auto pt-2 border-t border-dashed border-border flex justify-between items-center opacity-40 text-[9px] uppercase tracking-widest font-black">
            <span>v1.2.0-stable</span>
            <span>Theme: {theme}</span>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title="applications" className="md:col-span-12">
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-6 sm:gap-8 p-4">
          <AppIcon icon={<MessageSquare size={28} />} label="Chat"     color="#3b82f6" onClick={() => nav('chat')} badge={unreadChatCount > 0 ? unreadChatCount : null} />
          <AppIcon icon={<Gamepad2     size={28} />} label="Arcade"   color="#a855f7" onClick={() => nav('activities')} />
          <AppIcon icon={<Monitor      size={28} />} label="Watch"    color="#f472b6" onClick={() => nav('watch')} />
          <AppIcon icon={<Pen          size={28} />} label="Doodle"   color="#ec4899" onClick={() => nav('doodle')} />
          <AppIcon icon={<Brush        size={28} />} label="Pixels"   color="#f97316" onClick={() => nav('pixelart')} />
          <AppIcon icon={<Clock        size={28} />} label="Capsule"  color="#10b981" onClick={() => nav('capsule')} />
          <AppIcon icon={<Moon         size={28} />} label="Dreams"   color="#6366f1" onClick={() => nav('dreams')} />
          <AppIcon icon={<ListTodo     size={28} />} label="Lists"    color="#ef4444" onClick={() => nav('lists')} />
          <AppIcon icon={<CalendarIcon size={28} />} label="Calendar" color="#06b6d4" onClick={() => nav('calendar')} />
          <AppIcon icon={<ImageIcon    size={28} />} label="Album"    color="#eab308" onClick={() => nav('scrapbook')} />
          <AppIcon icon={<FileText     size={28} />} label="Notes"    color="#0ea5e9" onClick={() => nav('notes')} />
          <AppIcon icon={<Heart        size={28} />} label="Story"    color="#f43f5e" onClick={() => nav('resume')} />
          <AppIcon icon={<SettingsIcon size={28} />} label="Settings" color="#64748b" onClick={() => nav('settings')} />
        </div>
      </RetroWindow>

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
