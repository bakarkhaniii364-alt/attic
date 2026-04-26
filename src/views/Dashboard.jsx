import React, { useState, useEffect } from 'react';
import { Mail, Heart, Hand, Gamepad2, MessageSquare, Brush, Clock, Calendar as CalendarIcon, Image as ImageIcon, Settings as SettingsIcon, ListTodo, Moon, MessageCircle, FileText, Grid3x3, Disc } from 'lucide-react';
import { RetroWindow, RetroButton, AppIcon, useToast } from '../components/UI.jsx';
import { DashboardRadio } from '../components/LofiPlayer.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';
import { getScoreForUser } from '../utils/userDataHelpers.js';
import { StreakBadge } from '../components/Features.jsx';

const PixelPet = React.memo(({ happy, sleeping, onClick, skin }) => {
  const bgImage = (skin && skin !== 'undefined' && skin !== 'null') ? skin : '/assets/Cat Sprite Sheet.png';
  const isAltSkin = bgImage.includes('cat 1');
  const frameScale = 4;
  const bgSizeX = isAltSkin ? 352 * frameScale : 256 * frameScale;
  const bgSizeY = isAltSkin ? 1696 * frameScale : 320 * frameScale;
  let frames = 4;
  let yOffset = sleeping ? (isAltSkin ? 31 : 4) : (happy > 70 ? (isAltSkin ? 8 : 5) : 0);
  const bgPosY = `-${yOffset * 128}px`;

  return (
    <div className={`relative cursor-pointer select-none transition-opacity flex flex-col items-center ${sleeping ? 'opacity-80' : ''}`} onClick={onClick}>
       {sleeping && <span className="text-[10px] font-black uppercase opacity-40 mb-1 tracking-widest animate-pulse">zzz</span>}
       <div className="cat-sprite" style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: `${bgSizeX}px ${bgSizeY}px`,
        backgroundPositionY: bgPosY,
        animation: `cat-step-${frames} ${frames * 0.15}s steps(${frames}) infinite`
      }} />
    </div>
  );
});

function AnniversaryTimer({ anniversary }) {
  const [elapsed, setElapsed] = useState(null);

  useEffect(() => {
    if (!anniversary) return;
    const start = new Date(anniversary);
    if (isNaN(start.getTime())) return;
    const update = () => {
      const now = new Date();
      let diff = Math.max(0, now - start);
      const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      setElapsed({ 
          y: Math.floor(totalDays / 365), 
          mo: Math.floor((totalDays % 365) / 30), 
          d: totalDays % 30, 
          h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)), 
          m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)), 
          s: Math.floor((diff % (1000 * 60)) / 1000), 
          totalDays 
      });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [anniversary]);

  if (!anniversary) return <div className="text-center text-[10px] font-bold opacity-50 uppercase tracking-widest px-4 py-2">Set your anniversary date in Settings to start the counter!</div>;
  if (!elapsed) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap justify-center gap-1.5">
        {[
          { v: elapsed.y, l: 'yr' }, { v: elapsed.mo, l: 'mo' }, { v: elapsed.d, l: 'd' }, 
          { v: elapsed.h, l: 'h' }, { v: elapsed.m, l: 'm' }, { v: elapsed.s, l: 's' }
        ].map(u => (u.v > 0 || u.l === 's' || u.l === 'm') && (
          <div key={u.l} className="flex flex-col items-center min-w-[32px] bg-white retro-border p-1 shadow-sm">
            <span className="font-black text-lg leading-none">{String(u.v).padStart(2, '0')}</span>
            <span className="text-[8px] font-black uppercase opacity-40">{u.l}</span>
          </div>
        ))}
      </div>
      <p className="text-[9px] font-black opacity-30 uppercase tracking-[0.2em] mt-2">{elapsed.totalDays} days together</p>
    </div>
  );
}

export function CalendarReminder() {
  const [events] = useLocalStorage('calendar_events', []);
  const upcoming = (events || []).filter(e => e && e.date && new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = upcoming[0];
  return (
    <div className="border-t border-dashed border-[var(--border)] pt-3 mt-auto">
      {next ? (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 retro-border bg-[var(--primary)] flex items-center justify-center font-black text-white text-xs shadow-sm">
            {Math.ceil((new Date(next.date) - new Date()) / (1000 * 60 * 60 * 24))}d
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-xs uppercase truncate leading-none mb-1">{next.title || 'Upcoming Event'}</p>
            <p className="text-[10px] font-bold opacity-40 uppercase">{new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          </div>
        </div>
      ) : (
        <p className="text-[9px] font-black opacity-20 uppercase tracking-widest text-center">No upcoming events</p>
      )}
    </div>
  );
}

export function Dashboard({ setView, profile, myDisplayName, partnerProfile, scores, doodles, onOpenDoodle, sfx, setTriggerShake, radioState, setRadioState, userId, partnerId, setProfile, coupleData, setCoupleData, chatHistory, onlineUsers = {} }) {
  const toast = useToast();
  const [pokeActive, setPokeActive] = useState(false);
  const [petCooldown, setPetCooldown] = useState(false);
  
  const handlePoke = () => { playAudio('click', sfx); setPokeActive(true); setTriggerShake(true); toast('Poke sent to partner!', 'success'); setTimeout(() => setPokeActive(false), 2000); };
  const hr = new Date().getHours(); const isSleeping = hr < 6 || hr > 22;
  const partnerOnline = onlineUsers[partnerId] === 'active';

  const unreadDoodles = (doodles || []).filter(d => d.owner_id === partnerId && !d.isRead);
  const unreadChatCount = (chatHistory || []).filter(m => m.sender === partnerId && m.status !== 'read' && !m.isDeleted).length;

  const handlePetAction = (val, msg) => {
    if (petCooldown || isSleeping) return;
    playAudio('click', sfx);
    setCoupleData({ ...coupleData, petHappy: Math.min(100, (coupleData.petHappy || 60) + val) });
    if (msg) toast(msg, 'success', 1500);
    setPetCooldown(true); setTimeout(() => setPetCooldown(false), 2000);
  };

  return (
    <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 relative z-10 pb-8 animate-in fade-in duration-700">
      {unreadDoodles.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="animate-in zoom-in-50 duration-500 cursor-pointer hover:scale-105 transition-transform flex flex-col items-center" onClick={() => onOpenDoodle(unreadDoodles[0])}>
            <Mail size={120} className="text-[var(--bg-window)] drop-shadow-2xl" fill="var(--primary)" />
            <div className="text-center font-black text-[var(--text-main)] mt-6 bg-[var(--accent)] retro-border shadow-lg px-8 py-3 text-lg uppercase">You have a new doodle!</div>
          </div>
        </div>
      )}

      {/* 1. Welcome Widget */}
      <RetroWindow title="welcome.exe" className="md:col-span-8 h-auto">
        <div className="flex flex-col h-full gap-4 py-2">
          <div className="flex justify-between items-start">
             <div>
                <h1 className="text-4xl sm:text-5xl font-black lowercase tracking-tighter text-[var(--text-main)]">
                   hi {myDisplayName.toLowerCase()}!
                </h1>
                <div className="flex items-center gap-2 mt-4">
                   <span className="text-[11px] font-black uppercase opacity-40">partner is</span>
                   <span className={`text-[10px] font-black uppercase px-2 py-0.5 retro-border shadow-sm transition-colors ${partnerOnline ? 'bg-[var(--secondary)] text-white' : 'bg-gray-200 opacity-40'}`}>
                      {partnerOnline ? 'online' : 'offline'}
                   </span>
                </div>
             </div>
             <button onClick={handlePoke} className={`p-3 retro-border group transition-all ${pokeActive ? 'bg-[var(--primary)] text-white scale-95 shadow-none' : 'bg-white retro-shadow-dark hover:-translate-y-0.5'}`}>
                <Hand size={24} className={pokeActive ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'} />
                <span className="text-[8px] font-black mt-1 block tracking-widest uppercase">POKE</span>
             </button>
          </div>

          <div className="mt-auto pt-6 border-t border-dashed border-[var(--border)] flex justify-between items-center">
             <div className="flex gap-3">
                <button onClick={() => setView('settings')} className="bg-white hover:bg-gray-50 font-black py-2 px-6 retro-border text-[10px] uppercase shadow-sm transition-all active:scale-95">Control panel</button>
                <button onClick={() => setView('settings')} className="bg-[var(--primary)] text-white font-black py-2 px-6 retro-border text-[10px] uppercase shadow-sm transition-all active:scale-95">Log out</button>
             </div>
             <div className="opacity-20 hover:opacity-100 transition-opacity"><StreakBadge streak={{count: 0}} /></div>
          </div>
        </div>
      </RetroWindow>

      {/* 2. Pet Widget */}
      <RetroWindow title={`${coupleData.petName || 'pet'}.tamagotchi`} className="md:col-span-4 h-auto">
        <div className="flex flex-col items-center justify-between h-full py-2">
          <PixelPet skin={coupleData.petSkin} happy={coupleData.petHappy} sleeping={isSleeping} onClick={() => handlePetAction(5)} />
          <div className="w-full px-4 mt-6">
             <div className="h-5 retro-border bg-[var(--bg-main)] w-full relative overflow-hidden shadow-inner">
                <div className="absolute top-0 left-0 h-full bg-[#ff4a6e] transition-all duration-1000" style={{ width: `${coupleData.petHappy || 60}%` }}></div>
                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white/40 uppercase tracking-widest">Health</div>
             </div>
          </div>
          <div className="flex gap-2 w-full mt-6">
             <button onClick={() => handlePetAction(20, 'Fed the pet!')} className="flex-1 bg-[var(--secondary)] text-white py-2 text-[10px] font-black uppercase retro-border shadow-sm active:scale-95">feed</button>
             <button onClick={() => handlePetAction(10)} className="flex-1 bg-[var(--accent)] text-[var(--text-main)] py-2 text-[10px] font-black uppercase retro-border shadow-sm active:scale-95">pet</button>
          </div>
        </div>
      </RetroWindow>

      {/* 3. Anniversary Timer */}
      <RetroWindow title="together.timer" className="md:col-span-4">
        <div className="flex flex-col h-full py-2">
           <AnniversaryTimer anniversary={coupleData.anniversary} />
           <div className="mt-8 border-t border-dashed border-[var(--border)] pt-4 flex flex-wrap justify-center gap-2">
              <p className="w-full text-center text-[9px] font-black opacity-30 uppercase tracking-[0.2em] mb-1">my mood</p>
              {['😊', '😴', '🥺', '😡', '🥰', '😤'].map(m => (
                 <button key={m} onClick={() => { playAudio('click', sfx); setProfile(p => ({...p, mood: m})); }} className={`text-base w-8 h-8 rounded-full retro-border flex items-center justify-center transition-all ${profile?.mood === m ? 'bg-[var(--accent)] scale-110 shadow-md ring-2 ring-[var(--primary)]/20' : 'bg-white hover:scale-105'}`}>{m}</button>
              ))}
           </div>
        </div>
      </RetroWindow>

      {/* 4. Radio Widget */}
      <RetroWindow title="radio.sys" className="md:col-span-4 h-auto" noPadding>
        <DashboardRadio radioState={radioState} setRadioState={setRadioState} />
      </RetroWindow>

      {/* 5. Stats Widget */}
      <RetroWindow title="stats.sys" className="md:col-span-4 h-auto">
        <div className="flex flex-col h-full justify-between gap-3 font-bold text-[11px] opacity-80 uppercase tracking-widest py-1">
           <div className="flex justify-between"><span>TicTacToe Wins</span> <span>{getScoreForUser(scores, userId, 'tictactoe')}</span></div>
           <div className="flex justify-between"><span>Pictionary Guessed</span> <span>{getScoreForUser(scores, userId, 'pictionary')}</span></div>
           <div className="flex justify-between"><span>Memory Pairs</span> <span>{getScoreForUser(scores, userId, 'memory')}</span></div>
           <div className="flex justify-between"><span>Wordles Solved</span> <span>{getScoreForUser(scores, userId, 'wordle')}</span></div>
           <CalendarReminder />
        </div>
      </RetroWindow>

      {/* 6. Applications Grid */}
      <RetroWindow title="applications" className="md:col-span-12" noPadding>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 p-6 md:p-10">
          <AppIcon icon={<MessageSquare size={28} />} label="chat" color="#ff4a6e" onClick={() => setView('chat')} badge={unreadChatCount > 0 ? unreadChatCount : null} />
          <AppIcon icon={<Gamepad2 size={28} />} label="games" color="#0ea5e9" onClick={() => setView('activities')} />
          <AppIcon icon={<Brush size={28} />} label="doodle" color="#ff4a6e" onClick={() => setView('doodle')} />
          <AppIcon icon={<Grid3x3 size={28} />} label="pixels" color="#a855f7" onClick={() => setView('pixelart')} />
          <AppIcon icon={<Clock size={28} />} label="capsule" color="#0ea5e9" onClick={() => setView('capsule')} />
          <AppIcon icon={<Moon size={28} />} label="dreams" color="#6366f1" onClick={() => setView('dreams')} />
          <AppIcon icon={<MessageCircle size={28} />} label="daily Q" color="#ec4899" onClick={() => setView('dailyq')} />
          <AppIcon icon={<ListTodo size={28} />} label="lists" color="#ff4a6e" onClick={() => setView('lists')} />
          <AppIcon icon={<CalendarIcon size={28} />} label="calendar" color="#fcd34d" onClick={() => setView('calendar')} />
          <AppIcon icon={<ImageIcon size={28} />} label="album" color="#ffffff" onClick={() => setView('scrapbook')} />
          <AppIcon icon={<FileText size={28} />} label="our story" color="#f472b6" onClick={() => setView('resume')} />
          <AppIcon icon={<SettingsIcon size={28} />} label="settings" color="#fcd34d" onClick={() => setView('settings')} />
        </div>
      </RetroWindow>
    </div>
  );
}
