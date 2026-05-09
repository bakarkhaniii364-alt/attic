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
      <RetroWindow title="welcome.exe" className="md:col-span-8 h-auto min-h-[10rem]">
        <div className="flex flex-col h-full justify-between gap-2 p-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {profile.pfp ? <img src={profile.pfp} alt="pfp" className="w-12 h-12 retro-border retro-shadow-dark object-cover bg-white" /> : <div className="w-12 h-12 retro-border retro-bg-accent flex items-center justify-center text-2xl">{profile.emoji}</div>}
              <div>
                <h1 className="text-xl font-black leading-none lowercase flex items-center gap-2">
                  hi {myDisplayName}! {mood}
                </h1>

                <div className="flex items-center gap-3 mt-2 bg-black/5 p-1.5 retro-border border-dashed">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      {partnerProfile.pfp ? (
                        <img src={partnerProfile.pfp} alt="partner" className="w-8 h-8 retro-border object-cover bg-white" />
                      ) : (
                        <div className="w-8 h-8 retro-bg-secondary retro-border flex items-center justify-center text-sm">{partnerProfile.emoji || '👤'}</div>
                      )}
                      <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-white rounded-full ${isPartnerOnline ? 'bg-green-500' : isPartnerIdle ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold truncate max-w-[120px] leading-none">
                          {partnerProfile.name && partnerProfile.name !== 'You' ? partnerProfile.name : 'Partner'}
                        </p>
                        <span className={`text-[8px] font-black uppercase px-1 py-0.5 retro-border leading-none ${displayStatus.includes('Playing') ? 'bg-pink-400 text-white border-pink-600' : isPartnerOnline ? 'bg-green-500 text-white border-green-700' : isPartnerIdle ? 'bg-yellow-400 text-black border-yellow-600' : 'bg-transparent border-2 border-border/50 text-main-text opacity-50'}`}>
                          {displayStatus.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={handleSendKiss} 
              disabled={Date.now() - lastActionTime < 3000}
              className={`p-1.5 w-14 retro-border flex flex-col items-center justify-center transition-all ${Date.now() - lastActionTime < 3000 ? 'opacity-40 grayscale cursor-not-allowed' : 'bg-window retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0'}`} 
            >
              <Heart size={20} fill={Date.now() - lastActionTime < 3000 ? "none" : "var(--primary)"} className={Date.now() - lastActionTime < 3000 ? 'text-border' : 'text-primary'} />
              <span className="text-[9px] font-bold mt-0.5 uppercase">Kiss</span>
            </button>
          </div>

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
            </div>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title={`${coupleData.petName || 'pet'}.tamagotchi`} className="md:col-span-4 h-auto min-h-[10rem]">
        <div className="flex flex-col items-center text-center h-full justify-between p-1">
          <PixelPet skin={petSkin} happy={petHappy} isPartnerAfk={isPartnerIdle} externalAction={petAction} onPet={handlePet} onHit={handleHit} />
          
          <div className="w-full px-2 mt-1">
            <div className="flex gap-1 h-3.5 w-full">
              {[...Array(10)].map((_, i) => (
                <div 
                  key={i} 
                  className={`flex-1 retro-border transition-colors duration-300 ${i < Math.round(petHappy / 10) ? 'bg-primary' : 'bg-main opacity-20'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 w-full mt-2 px-2">
            <RetroButton variant="secondary" className="flex-1 py-1 text-[10px] font-black uppercase" disabled={petCooldown} onClick={handleFeed}>Feed</RetroButton>
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
                const start = profile.created_at ? new Date(profile.created_at) : new Date();
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
