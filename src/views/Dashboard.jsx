import React, { useState, useEffect } from 'react';
import { Mail, Heart, Hand, Gamepad2, MessageSquare, Brush, Clock, Calendar as CalendarIcon, Image as ImageIcon, Settings as SettingsIcon, ListTodo, Flame, Moon, MessageCircle, FileText, Grid3x3 } from 'lucide-react';
import { RetroWindow, RetroButton, AppIcon, useToast } from '../components/UI.jsx';
import { DashboardRadio } from '../components/LofiPlayer.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { getScoreForUser } from '../utils/userDataHelpers.js';
import { StreakBadge, WeatherWidget } from '../components/Features.jsx';

const PixelPet = React.memo(({ happy, sleeping, onClick, skin }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPressing, setIsPressing] = useState(false);

  const bgImage = (skin && skin !== 'undefined' && skin !== 'null') ? skin : '/assets/Cat Sprite Sheet.png';
  const isAltSkin = bgImage.includes('cat 1');

  // Frame size is 128px (scaled by 4 from 32px)
  const frameScale = 4;

  // Background sizes
  const bgSizeX = isAltSkin ? 352 * frameScale : 256 * frameScale;
  const bgSizeY = isAltSkin ? 1696 * frameScale : 320 * frameScale;

  let frames = 4;
  let yOffset = 0; // Row index

  if (isAltSkin) {
    if (sleeping) {
      yOffset = 31; // Common row for sleep in 53-row sheets
      frames = 4;
    } else if (isPressing) {
      yOffset = 21; // Purr/excited
      frames = 8;
    } else if (isHovering) {
      yOffset = 18; // Wag/attention
      frames = 8;
    } else if (happy > 70) {
      yOffset = 8; // Run
      frames = 8;
    } else {
      yOffset = 0; // Idle
      frames = 4;
    }
  } else {
    // Default skin
    if (sleeping) {
      yOffset = 4;
      frames = 4;
    } else if (isPressing) {
      yOffset = 7;
      frames = 8;
    } else if (isHovering) {
      yOffset = 5;
      frames = 8;
    } else if (happy > 70) {
      yOffset = 5;
      frames = 8;
    } else {
      yOffset = 0;
      frames = 4;
    }
  }

  const bgPosY = `-${yOffset * 128}px`;

  return (
    <div
      className={`relative cursor-pointer select-none transition-opacity ${sleeping ? 'opacity-80' : ''}`}
      onMouseEnter={() => !sleeping && setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setIsPressing(false); }}
      onMouseDown={() => !sleeping && setIsPressing(true)}
      onMouseUp={() => { setIsPressing(false); if (onClick) onClick(); }}
      onTouchStart={() => !sleeping && setIsPressing(true)}
      onTouchEnd={() => { setIsPressing(false); if (onClick) onClick(); }}
      title={sleeping ? "Shh, pet is sleeping" : "Click to pet!"}
    >
      <div className="cat-sprite" style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: `${bgSizeX}px ${bgSizeY}px`,
        backgroundPositionY: bgPosY,
        animation: `cat-step-${frames} ${frames * 0.15}s steps(${frames}) infinite`
      }} />
      {sleeping && <span className="absolute -top-2 -right-2 text-sm font-mono font-bold animate-pulse text-[var(--border)] drop-shadow-md">zzz</span>}
      {isPressing && !sleeping && (
        <svg width="24" height="24" viewBox="0 0 16 16" className="absolute -top-4 right-0 animate-bounce drop-shadow-md">
          <path d="M4,2 L7,2 L7,3 L9,3 L9,2 L12,2 L12,3 L14,3 L14,6 L13,6 L13,8 L12,8 L12,10 L11,10 L11,11 L10,11 L10,12 L9,12 L9,13 L7,13 L7,12 L6,12 L6,11 L5,11 L5,10 L4,10 L4,8 L3,8 L3,6 L2,6 L2,3 Z" fill="#ff4d4d" />
        </svg>
      )}
    </div>
  );
});

function AnniversaryTimer({ anniversary }) {
  const [progress, setProgress] = useState(0);
  const [timeTogether, setTimeTogether] = useState({ years: 0, days: 0 });

  useEffect(() => {
    if (!anniversary || isNaN(new Date(anniversary).getTime())) return;
    
    const start = new Date(anniversary);
    const now = new Date();
    
    // Calculate Scoreboard Time
    const diffTime = Math.abs(now - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const days = diffDays % 365;
    setTimeTogether({ years, days });

    // Calculate Progress Bar to NEXT anniversary
    const currentYearAnniversary = new Date(start);
    currentYearAnniversary.setFullYear(now.getFullYear());
    
    let nextAnniversary = new Date(currentYearAnniversary);
    let lastAnniversary = new Date(currentYearAnniversary);
    
    if (now > currentYearAnniversary && now.toDateString() !== currentYearAnniversary.toDateString()) {
      nextAnniversary.setFullYear(now.getFullYear() + 1);
    } else {
      lastAnniversary.setFullYear(now.getFullYear() - 1);
    }
    
    const totalDaysInYear = (nextAnniversary - lastAnniversary) / (1000 * 60 * 60 * 24);
    const daysPassed = (now - lastAnniversary) / (1000 * 60 * 60 * 24);
    const percent = Math.min(100, Math.max(0, (daysPassed / totalDaysInYear) * 100));
    
    // Delay progress update to trigger the CSS transition
    setTimeout(() => setProgress(percent), 300);
  }, [anniversary]);

  if (!anniversary) return null;

  return (
    <div className="retro-bg-window retro-border retro-shadow-dark p-5 flex flex-col items-center justify-center relative group">
      <h3 className="font-black text-lg uppercase tracking-widest text-[var(--text-main)] mb-1">Time Together</h3>
      
      {/* Scoreboard Animation/Text */}
      <div className="text-3xl font-black text-[var(--primary)] group-hover:scale-110 transition-transform mb-4">
        {timeTogether.years} <span className="text-sm opacity-60">YRS</span> {timeTogether.days} <span className="text-sm opacity-60">DAYS</span>
      </div>
      
      {/* Theme-Responsive Animated Progress Bar */}
      <div className="w-full h-5 bg-[var(--border)]/10 retro-border overflow-hidden relative">
        <div 
          className="h-full bg-[var(--primary)] transition-all duration-[1500ms] ease-out relative overflow-hidden"
          style={{ width: `${progress}%` }}
        >
          {/* Shine Effect */}
          <div className="absolute top-0 left-0 w-8 h-full bg-white/30 animate-shine"></div>
        </div>
      </div>
      <p className="text-[9px] font-bold uppercase tracking-widest mt-2 opacity-50">Progress to next milestone</p>
    </div>
  );
}

function UpcomingEvents({ events, anniversary }) {
  const safeEvents = Array.isArray(events) ? [...events] : [];

  // Auto-inject the upcoming anniversary
  if (anniversary && !isNaN(new Date(anniversary).getTime())) {
    const start = new Date(anniversary);
    const now = new Date();
    let nextAnniversary = new Date(start);
    nextAnniversary.setFullYear(now.getFullYear());
    
    if (now > nextAnniversary && now.toDateString() !== nextAnniversary.toDateString()) {
      nextAnniversary.setFullYear(now.getFullYear() + 1);
    }
    safeEvents.push({ title: "Anniversary 💖", date: nextAnniversary.toISOString() });
  }

  // Filter out past events and sort
  const upcoming = safeEvents
    .filter(e => e && e.date && new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4); // Display max 4

  return (
    <div className="retro-bg-window retro-border retro-shadow-dark p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 border-b-2 border-dashed border-[var(--border)] pb-2">
        <CalendarIcon size={18} className="text-[var(--primary)]" />
        <h3 className="font-black text-sm uppercase tracking-widest text-[var(--text-main)]">Upcoming Events</h3>
      </div>
      
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
        {upcoming.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-50 text-xs font-bold italic text-center">
            No events scheduled.
          </div>
        ) : (
          upcoming.map((ev, i) => {
            const d = new Date(ev.date);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={i} className={`p-2 retro-border text-xs flex justify-between items-center ${isToday ? 'bg-[var(--primary)] text-[var(--text-on-primary)] animate-pulse' : 'bg-[var(--bg-main)] text-[var(--text-main)]'}`}>
                <span className="font-bold truncate pr-2">{ev.title}</span>
                <span className="font-black opacity-80 whitespace-nowrap">
                  {isToday ? 'TODAY!' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function CalendarReminder() {
  const [events] = useLocalStorage('calendar_events', []);
  const now = new Date();
  const upcoming = (events || [])
    .filter(e => e && e.date && new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = upcoming[0];
  if (!next) return (
    <div className="border-t border-dashed border-[var(--border)] pt-2 mt-2 text-[10px] font-bold opacity-40 uppercase tracking-widest text-center">
      No upcoming events
    </div>
  );
  const daysUntil = Math.ceil((new Date(next.date) - now) / (1000 * 60 * 60 * 24));
  return (
    <div className="border-t border-dashed border-[var(--border)] pt-2 mt-2">
      <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-1">📅 upcoming</p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 retro-border retro-bg-primary flex items-center justify-center font-bold text-xs">{daysUntil}d</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs truncate">{next.title || next.text || 'Event'}</p>
          <p className="text-[10px] opacity-50">{new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ setView, profile, myDisplayName, partnerProfile, scores, doodles, onOpenDoodle, sfx, setTriggerShake, radioState, setRadioState, userId, partnerId, theme, setTheme, setProfile, sfxEnabled, setSfxEnabled, onLogout, onDelete, weather, setWeather, coupleData, setCoupleData, chatHistory, onlineUsers = {} }) {
  // SAFEGUARD: Ensure objects are never null when mapping
  const safeCoupleData = coupleData || {};
  const safeChatHistory = chatHistory || [];
  const safeDoodles = doodles || [];
  
  const unreadChatCount = safeChatHistory.filter(m => m.sender === partnerId && m.status !== 'read' && !m.isDeleted).length;
  const updatePetHappy = (val) => setCoupleData({ ...safeCoupleData, petHappy: val });
  const mood = profile?.mood || '😊';
  const setMood = (m) => setProfile(prev => ({ ...prev, mood: m }));
  const [pokeActive, setPokeActive] = useState(false);
  const toast = useToast();
  const streak = useLocalStorage('streak_data', { count: 0, best: 0 })[0];
  const hr = new Date().getHours(); const isSleeping = hr < 6 || hr > 22;
  const handlePoke = () => { playAudio('click', sfx); setPokeActive(true); setTriggerShake(true); toast('Poke sent to partner!', 'success'); setTimeout(() => setPokeActive(false), 2000); };
  const nav = (v) => setView(v);
  const unreadDoodles = safeDoodles.filter(d => d.owner_id === partnerId && !d.isRead);
  const [petCooldown, setPetCooldown] = useState(false);
  
  const handlePetAction = (val, msg) => {
    if (petCooldown || isSleeping) return;
    playAudio('click', sfx);
    updatePetHappy(Math.min(100, (safeCoupleData.petHappy || 60) + val));
    if (msg) toast(msg, 'success', 1500);
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };
  
  const partnerName = partnerProfile?.name || safeCoupleData.partnerNickname || 'Partner';
  const petSkin = safeCoupleData.petSkin || '/assets/Cat Sprite Sheet.png';
  const petHappy = safeCoupleData.petHappy ?? 60;
  const petName = safeCoupleData.petName || 'pet';

  return (
    <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 relative z-10 pb-8">
      {unreadDoodles.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="animate-in zoom-in-50 spin-in-6 duration-500 cursor-pointer hover:scale-110 transition-transform flex flex-col items-center" onClick={() => onOpenDoodle(unreadDoodles[0])}>
            <div className="relative"><Mail size={120} className="text-[var(--bg-window)] drop-shadow-2xl" fill="var(--primary)" /><div className="absolute inset-0 flex items-center justify-center animate-pulse"><Heart size={40} className="text-white" fill="white" /></div></div>
            <div className="text-center font-bold text-[var(--text-main)] mt-6 bg-[var(--accent)] retro-border retro-shadow-dark px-6 py-2 text-lg">You have a new doodle!</div>
            <p className="text-[var(--bg-window)] font-bold mt-2 animate-pulse">Click to open</p>
          </div>
        </div>
      )}
      <RetroWindow title="welcome.exe" className="md:col-span-8 h-auto min-h-[12rem]">
        <div className="flex flex-col h-full justify-between gap-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {profile.pfp ? <img src={profile.pfp} alt="pfp" className="w-16 h-16 retro-border retro-shadow-dark object-cover bg-white" /> : <div className="w-16 h-16 sm:w-20 sm:h-20 retro-border retro-bg-accent flex items-center justify-center text-3xl sm:text-4xl">{profile.emoji}</div>}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black mb-1 leading-none lowercase">hi {myDisplayName}! {mood}</h1>
                <div className="flex items-center gap-4 mt-3 bg-black/5 p-2 retro-border border-dashed">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {partnerProfile.pfp ? (
                        <img src={partnerProfile.pfp} alt="partner" className="w-10 h-10 retro-border object-cover bg-white shadow-sm" />
                      ) : (
                        <div className="w-10 h-10 retro-bg-secondary retro-border flex items-center justify-center text-lg">{partnerProfile.emoji || '👤'}</div>
                      )}
                      <div 
                        className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 border-2 border-[var(--border)] shadow-[0.5px_0.5px_0px_0px_var(--border)] ${onlineUsers[partnerId] === 'active' ? 'bg-green-500' : 'bg-red-500'}`}
                        title={onlineUsers[partnerId] === 'active' ? 'Online' : 'Offline'}
                      ></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none mb-1">Partner</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold truncate max-w-[120px] leading-none">
                          {partnerProfile.name || coupleData.partnerNickname || 'Partner'}
                        </p>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 retro-border leading-none ${onlineUsers[partnerId] ? 'bg-blue-400 text-white' : 'bg-gray-200 opacity-50'}`}>
                          {onlineUsers[partnerId] === 'active' ? 'online' : onlineUsers[partnerId] === 'idle' ? 'away' : 'offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-[var(--border)] opacity-20 mx-1"></div>
                  <StreakBadge streak={streak} />
                </div>
              </div>
            </div>
            <button onClick={handlePoke} className={`p-2 retro-border flex flex-col items-center justify-center transition-all ${pokeActive ? 'retro-bg-primary' : 'retro-bg-window retro-shadow-dark'}`} title="Send a poke!"><Hand size={24} className={pokeActive ? 'animate-bounce' : ''} /><span className="text-[10px] font-bold mt-1">POKE</span></button>
          </div>

          {pokeActive && <p className="text-xs font-bold text-[var(--primary)] animate-pulse">Poke sent!</p>}
          <div className="flex flex-wrap gap-3 items-center justify-between pt-2 border-t border-dashed border-[var(--border)] mt-auto">
            <WeatherWidget compact />
            <div className="flex gap-2">
              <button onClick={() => nav('settings')} className="bg-[var(--window)] text-[var(--text-main)] font-bold py-2 px-4 retro-border hover:-translate-y-1 transition-transform text-xs">Control panel</button>
              <button onClick={onLogout} className="bg-red-600 text-white font-bold py-2 px-4 retro-border border-red-800 retro-shadow-dark hover:-translate-y-1 transition-transform text-xs">Log out</button>
            </div>
          </div>
        </div>
      </RetroWindow>

      <RetroWindow title={`${coupleData.petName || 'pet'}.tamagotchi`} className="md:col-span-4 h-auto min-h-[12rem]">
        <div className="flex flex-col items-center text-center h-full justify-between">
          <PixelPet skin={coupleData.petSkin} happy={coupleData.petHappy} sleeping={isSleeping} onClick={() => handlePetAction(10)} />
          <div className="w-full px-4 mt-2"><div className="h-4 retro-border bg-[var(--bg-main)] w-full relative overflow-hidden rounded-sm"><div className="absolute top-0 left-0 h-full retro-bg-primary transition-all" style={{ width: `${coupleData.petHappy}%` }}></div></div></div>
          <div className="flex gap-2 w-full mt-4"><RetroButton variant="secondary" className="flex-1 py-1 text-xs" disabled={isSleeping || petCooldown} onClick={() => handlePetAction(20, 'Fed the pet!')}>Feed</RetroButton><RetroButton variant="accent" className="flex-1 py-1 text-xs" disabled={isSleeping || petCooldown} onClick={() => handlePetAction(10)}>Pet</RetroButton></div>
        </div>
      </RetroWindow>

      <RetroWindow title="together.timer" className="md:col-span-4 h-auto">
        <div className="flex flex-col h-full justify-center gap-3">
          <AnniversaryTimer anniversary={safeCoupleData.anniversary} />
          <UpcomingEvents events={safeCoupleData?.events} anniversary={safeCoupleData?.anniversary} />
        </div>
      </RetroWindow>

      <RetroWindow title="radio.sys" className="md:col-span-4 h-auto min-h-[12rem]" noPadding>
        <DashboardRadio radioState={radioState} setRadioState={setRadioState} />
      </RetroWindow>

      <RetroWindow title="stats.sys" className="md:col-span-4 h-auto">
        <div className="flex flex-col h-full justify-center p-2 text-sm font-bold opacity-80 gap-2">
          <p>TicTacToe Wins: {getScoreForUser(scores, userId, 'tictactoe')}</p>
          <p>Pictionary Guessed: {getScoreForUser(scores, userId, 'pictionary')}</p>
          <p>Memory Pairs: {getScoreForUser(scores, userId, 'memory')}</p>
          <p>Wordles Solved: {getScoreForUser(scores, userId, 'wordle')}</p>
          <p>Sudoku Solved: {getScoreForUser(scores, userId, 'sudoku')}</p>
        </div>
        <CalendarReminder />
      </RetroWindow>

      <RetroWindow title="applications" className="md:col-span-12">
        <div className="flex flex-wrap justify-center gap-6 sm:gap-8 py-4">
          <AppIcon icon={<MessageSquare size={28} />} label="chat" color="var(--primary)" onClick={() => nav('chat')} badge={unreadChatCount > 0 ? unreadChatCount : null} />
          <AppIcon icon={<Gamepad2 size={28} />} label="games" color="var(--secondary)" onClick={() => nav('activities')} />
          <AppIcon icon={<Brush size={28} />} label="doodle" color="var(--primary)" onClick={() => nav('doodle')} />
          <AppIcon icon={<Grid3x3 size={28} />} label="pixels" color="#a855f7" onClick={() => nav('pixelart')} />
          <AppIcon icon={<Clock size={28} />} label="capsule" color="var(--secondary)" onClick={() => nav('capsule')} />
          <AppIcon icon={<Moon size={28} />} label="dreams" color="#6366f1" onClick={() => nav('dreams')} />
          <AppIcon icon={<MessageCircle size={28} />} label="daily Q" color="#ec4899" onClick={() => nav('dailyq')} />
          <AppIcon icon={<ListTodo size={28} />} label="lists" color="var(--primary)" onClick={() => nav('lists')} />
          <AppIcon icon={<CalendarIcon size={28} />} label="calendar" color="var(--accent)" onClick={() => nav('calendar')} />
          <AppIcon icon={<ImageIcon size={28} />} label="album" color="var(--bg-window)" onClick={() => nav('scrapbook')} />
          <AppIcon icon={<FileText size={28} />} label="our story" color="#f472b6" onClick={() => nav('resume')} />
          <AppIcon icon={<SettingsIcon size={28} />} label="settings" color="var(--accent)" onClick={() => nav('settings')} />
        </div>
      </RetroWindow>
    </div>
  );
}
