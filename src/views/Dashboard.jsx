import React, { useState, useEffect, useRef } from 'react';
import { Mail, Heart, Hand, Gamepad2, MessageSquare, Brush, Clock, Calendar as CalendarIcon, Image as ImageIcon, Settings as SettingsIcon, ListTodo, Flame, Moon, MessageCircle, FileText, Grid3x3 } from 'lucide-react';
import { RetroWindow, RetroButton, AppIcon, useToast } from '../components/UI.jsx';
import { DashboardRadio } from '../components/LofiPlayer.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { getScoreForUser } from '../utils/userDataHelpers.js';
import { StreakBadge, WeatherWidget } from '../components/Features.jsx';

const PixelPet = React.memo(({ happy, onClick, skin, isPartnerAfk, externalAction }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [currentAction, setCurrentAction] = useState('idle'); // idle, meow, yawn, wash, itch, hiss, eat, sleep
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState(null);
  const [petClickCount, setPetClickCount] = useState(0);
  const [lastPetTime, setLastPetTime] = useState(0);

  // Track the action timeout to prevent overlapping state resets
  const actionTimeoutRef = useRef(null);
  // Hook the animation directly to the DOM node
  const spriteRef = useRef(null); 

  const bgImage = (skin && skin !== 'undefined' && skin !== 'null') ? skin : '/assets/cat 1.9.png';

  // 1. SLEEP/WAKE LOGIC
  useEffect(() => {
    // Wake up on login (mount)
    setIsSleeping(false);
    setLastActivityTime(Date.now());

    const interval = setInterval(() => {
      const now = Date.now();
      const hr = new Date().getHours();
      const isNight = hr < 6 || hr > 22;

      // Auto-sleep at night after 2 mins of inactivity
      if (isNight && !isSleeping && (now - lastActivityTime > 120000)) {
        setIsSleeping(true);
        setSleepStartTime(now);
      }

      // Auto-wake after 4 hours of sleep
      if (isSleeping && sleepStartTime && (now - sleepStartTime > 4 * 60 * 60 * 1000)) {
        setIsSleeping(false);
        setLastActivityTime(now);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isSleeping, lastActivityTime, sleepStartTime]);

  // SAFE TIMEOUT HELPER
  const triggerAction = (actionName, duration) => {
    setCurrentAction(actionName);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    actionTimeoutRef.current = setTimeout(() => {
      setCurrentAction('idle');
    }, duration);
  };

  // 2. RANDOM IDLE BEHAVIORS & EXTERNAL ACTIONS
  useEffect(() => {
    if (externalAction) triggerAction(externalAction, 3000);
  }, [externalAction]);

  useEffect(() => {
    if (isSleeping || currentAction !== 'idle') return;
    const interval = setInterval(() => {
      if (Math.random() > 0.95) { // 5% chance every 10s
        const actions = ['yawn', 'wash', 'itch'];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        triggerAction(randomAction, 3000);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isSleeping, currentAction]);

  // 3. INTERACTION
  const handleInteraction = () => {
    const now = Date.now();
    setLastActivityTime(now);

    if (isSleeping) {
      setIsSleeping(false);
      setSleepStartTime(null);
      triggerAction('yawn', 2000);
      return;
    }

    // Check for rapid clicking (Aggressive Petting)
    if (now - lastPetTime < 300) {
      const newCount = petClickCount + 1;
      setPetClickCount(newCount);
      if (newCount > 5) {
        triggerAction('hiss', 2000);
        setPetClickCount(0);
        return;
      }
    } else {
      setPetClickCount(1);
    }
    setLastPetTime(now);

    // Normal pet meow
    triggerAction('meow', 1500);
    if (onClick) onClick();
  };

  // 4. ANIMATION MAPPING (cat 1.x 32x32 sheets, 53 rows)
  let frames = 4;
  let row = 0;

  if (isSleeping) {
    row = 12; // Sleep
    frames = 3;
  } else if (currentAction === 'hiss') {
    row = 41; // Hiss
    frames = 2;
  } else if (currentAction === 'eat') {
    row = 20; // Eat
    frames = 8;
  } else if (currentAction === 'meow') {
    row = 28; // Meow
    frames = 4;
  } else if (currentAction === 'yawn') {
    row = 32; // Yawn
    frames = 8;
  } else if (currentAction === 'wash') {
    row = 36; // Wash
    frames = 8;
  } else if (currentAction === 'itch') {
    row = 39; // Scratch
    frames = 8;
  } else if (happy < 30) {
    row = 43; // Sad
    frames = 1;
  } else if (isPartnerAfk) {
    row = 2; // Lie down
    frames = 6;
  } else if (isHovering) {
    row = 1; // Stand
    frames = 8;
  } else {
    row = 0; // Sit
    frames = 6;
  }

  // Display scale is 4x for 32x32 frames to reach 128px
  const scale = 4;
  const frameSize = 32 * scale; // 128px
  const labelOffset = 80 * scale; // 320px offset for the 80px margin on the left
  const bgPosY = `-${row * frameSize}px`;
  
  // The actual sprite sheets are 352px wide (11 columns of 32px) and 1696px tall (53 rows of 32px)
  const bgSize = `${352 * scale}px auto`; 

  // WEB ANIMATIONS API: Self-contained dynamic steps!
  useEffect(() => {
    if (spriteRef.current && frames > 1) {
      const animation = spriteRef.current.animate([
        { backgroundPositionX: `-${labelOffset}px` },
        { backgroundPositionX: `-${labelOffset + (frames * 32 * scale)}px` }
      ], {
        duration: frames * 150,
        easing: `steps(${frames})`,
        iterations: Infinity
      });
      return () => animation.cancel();
    }
  }, [frames, scale, labelOffset]);

  return (
    <div
      className={`relative cursor-pointer select-none transition-opacity ${isSleeping ? 'opacity-80' : ''}`}
      onMouseEnter={() => !isSleeping && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseDown={handleInteraction}
      title={isSleeping ? "Shh, pet is sleeping. Click to wake up!" : "Click to pet!"}
    >
      <div 
        ref={spriteRef}
        className="cat-sprite" 
        style={{
          width: `${frameSize}px`,
          height: `${frameSize}px`,
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: bgSize,
          backgroundPositionY: bgPosY,
          backgroundPositionX: `-${labelOffset}px`,
          imageRendering: 'pixelated'
        }} 
      />
      {isSleeping && <span className="absolute -top-2 -right-2 text-sm font-mono font-bold animate-pulse text-[var(--border)] drop-shadow-md">zzz</span>}
      {currentAction === 'meow' && (
        <svg width="24" height="24" viewBox="0 0 16 16" className="absolute -top-4 right-0 animate-bounce drop-shadow-md">
          <path d="M4,2 L7,2 L7,3 L9,3 L9,2 L12,2 L12,3 L14,3 L14,6 L13,6 L13,8 L12,8 L12,10 L11,10 L11,11 L10,11 L10,12 L9,12 L9,13 L7,13 L7,12 L6,12 L6,11 L5,11 L5,10 L4,10 L4,8 L3,8 L3,6 L2,6 L2,3 Z" fill="#ff4d4d" />
        </svg>
      )}
    </div>
  );
});

function AnniversaryTimer({ anniversary }) {
  const [elapsed, setElapsed] = useState(null);

  useEffect(() => {
    if (!anniversary) return;
    
    // Add validation
    const start = new Date(anniversary);
    if (isNaN(start.getTime())) return;

    const update = () => {
      if (isNaN(start.getTime())) return;
      const now = new Date();
      let diff = now - start;
      if (diff < 0) diff = 0;

      const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      const years = Math.floor(totalDays / 365);
      const months = Math.floor((totalDays % 365) / 30);
      const days = totalDays % 30;
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      // Solution 26: Sanitize results
      setElapsed({ 
          years: Math.max(0, years), 
          months: Math.max(0, months), 
          days: Math.max(0, days), 
          hours: Math.max(0, hours), 
          minutes: Math.max(0, minutes), 
          seconds: Math.max(0, seconds), 
          totalDays: Math.max(0, totalDays) 
      });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [anniversary]);

  if (!anniversary) {
    return (
      <div className="text-center text-xs opacity-50 font-bold py-2">
        Set your anniversary date in Settings to start the counter!
      </div>
    );
  }

  if (!elapsed) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1">
        {elapsed.years > 0 && <Unit val={elapsed.years} label="yr" />}
        {(elapsed.years > 0 || elapsed.months > 0) && <Unit val={elapsed.months} label="mo" />}
        <Unit val={elapsed.days} label="d" />
        <Unit val={elapsed.hours} label="h" />
        <Unit val={elapsed.minutes} label="m" />
        <Unit val={elapsed.seconds} label="s" />
      </div>
      <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{elapsed.totalDays} days together</p>
    </div>
  );
}

export const Unit = React.memo(({ val, label }) => {
  const [displayVal, setDisplayVal] = useState(val);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (val !== displayVal) {
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setDisplayVal(val);
        setIsFlipping(false);
      }, 600); // Duration of the full flip
      return () => clearTimeout(timer);
    }
  }, [val, displayVal]);

  const currentStr = String(displayVal).padStart(2, '0');
  const nextStr = String(val).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-10 h-12 sm:w-12 sm:h-14 bg-[var(--bg-window)] border-2 border-[var(--border)] shadow-[1.5px_1.5px_0px_0px_var(--border)] font-black text-xl sm:text-2xl text-[var(--text-main)] perspective-1000 preserve-3d">
        
        {/* Layer 1: TOP STATIC (Next value, revealed as flap moves) */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-[var(--bg-window)] overflow-hidden flex items-end justify-center pb-[1px] border-b border-[var(--border)]/10">
          <span className="translate-y-1/2">{nextStr}</span>
        </div>
        
        {/* Layer 2: BOTTOM STATIC (Current value, hidden until flap hits 180) */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[var(--bg-window)] overflow-hidden flex items-start justify-center pt-[1px]">
          <span className="-translate-y-1/2">{currentStr}</span>
        </div>

        {/* The Animated Flap */}
        <div 
          className={`absolute top-0 left-0 w-full h-1/2 preserve-3d origin-bottom z-20 ${isFlipping ? 'transition-transform duration-[600ms] ease-in-out' : ''}`}
          style={{ 
            transform: isFlipping ? 'rotateX(-180deg)' : 'rotateX(0deg)',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Front of Flap: Old Top Half */}
          <div className="absolute inset-0 bg-[var(--bg-window)] overflow-hidden flex items-end justify-center pb-[1px] backface-hidden border-b border-[var(--border)]/20" style={{ backfaceVisibility: 'hidden' }}>
            <span className="translate-y-1/2">{currentStr}</span>
          </div>
          
          {/* Back of Flap: New Bottom Half */}
          <div className="absolute inset-0 bg-[var(--bg-window)] overflow-hidden flex items-start justify-center pt-[1px] backface-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateX(-180deg)' }}>
            <span className="-translate-y-1/2">{nextStr}</span>
          </div>
        </div>

        {/* Center Crease/Divider */}
        <div className="absolute top-1/2 left-0 w-full h-[1.5px] bg-[var(--border)] opacity-30 z-30"></div>
      </div>
      <span className="text-[9px] font-bold opacity-60 uppercase mt-1.5 tracking-tighter">{label}</span>
    </div>
  );
});

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

export function Dashboard({ setView, profile, myDisplayName, partnerProfile, scores, doodles, onOpenDoodle, sfx, setTriggerShake, radioState, setRadioState, userId, partnerId, theme, setTheme, setProfile, sfxEnabled, setSfxEnabled, onLogout, onDelete, weather, setWeather, coupleData, setCoupleData, chatHistory, onlineUsers = {}, sendInteraction, streaks, isPartnerAfk, lobbyState }) {
  const partnerPresence = onlineUsers[partnerId] || {};
  const isPartnerOnline = partnerPresence.status === 'active';
  
  let displayStatus = 'Offline';
  if (isPartnerAfk) {
      displayStatus = 'Zzz... (Away)';
  } else if (lobbyState.players?.includes(partnerId) && lobbyState.gameId) {
      displayStatus = `Playing ${lobbyState.gameId}`;
  } else if (isPartnerOnline) {
      displayStatus = 'Online';
  } else if (partnerPresence.lastActive) {
      const diffMins = Math.floor((Date.now() - new Date(partnerPresence.lastActive).getTime()) / 60000);
      if (diffMins < 1) displayStatus = 'Last seen just now';
      else if (diffMins < 60) displayStatus = `Last seen ${diffMins}m ago`;
      else displayStatus = `Last seen ${Math.floor(diffMins/60)}h ago`;
  }
  // SAFEGUARD: Ensure objects are never null when mapping
  const safeCoupleData = coupleData || {};
  const safeChatHistory = chatHistory || [];
  const safeDoodles = doodles || [];
  
  const unreadChatCount = safeChatHistory.filter(m => m.sender === partnerId && (!m.status || m.status !== 'read') && !m.isDeleted).length;
  const updatePetHappy = (val) => setCoupleData({ ...safeCoupleData, petHappy: val });
  const mood = profile?.mood || '😊';
  const setMood = (m) => setProfile(prev => ({ ...prev, mood: m }));
  const [lastActionTime, setLastActionTime] = useState(0);
  const toast = useToast();
  const streak = useLocalStorage('streak_data', { count: 0, best: 0 })[0];
  const hr = new Date().getHours(); const isSleeping = hr < 6 || hr > 22;
  
  const handleSendKiss = () => {
    if (Date.now() - lastActionTime < 3000) return;
    const now = Date.now().toString();
    setLastActionTime(Number(now));
    playAudio('click', sfxEnabled);
    
    // 1. Instant broadcast (ephemeral flurry for active session)
    if (sendInteraction) sendInteraction({ type: 'kiss', from: userId, timestamp: now });
    
    // 2. Persistent update (offline flurry for next session)
    setCoupleData(prev => ({
      ...prev,
      lastKissFrom: userId,
      lastKissTimestamp: now
    }));
  };

  const nav = (v) => setView(v);
  const unreadDoodles = safeDoodles.filter(d => d.owner_id === partnerId && !d.isRead);
  const [petCooldown, setPetCooldown] = useState(false);
  const [petAction, setPetAction] = useState(null); // meow, eat, etc.
  
  const handlePetAction = (val, msg, action = null) => {
    if (petCooldown) return;
    playAudio('click', sfx);
    updatePetHappy(Math.min(100, (safeCoupleData.petHappy || 60) + val));
    if (msg) toast(msg, 'success', 1500);
    if (action) {
      setPetAction(action);
      setTimeout(() => setPetAction(null), 3000);
    }
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };
  
  const partnerName = partnerProfile?.name || safeCoupleData.partnerNickname || 'Partner';
  const petSkin = safeCoupleData.petSkin || '/assets/cat 1.9.png';
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
            {streaks?.count > 0 && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-orange-100/80 backdrop-blur-sm retro-border px-3 py-1 rounded-full shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-500">
                <Flame size={14} className={`text-orange-500 ${streaks.count > 3 ? 'animate-bounce' : ''}`} fill={streaks.count > 3 ? 'currentColor' : 'none'} />
                <span className="font-black text-orange-700 text-[10px] tracking-widest uppercase">
                  {streaks.count} Day{streaks.count !== 1 ? 's' : ''}
                </span>
              </div>
            )}
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
                        className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-[var(--border)] transition-all ${onlineUsers[partnerId] === 'active' ? 'bg-green-400 animate-pulse shadow-[0_0_8px_#4ade80]' : 'bg-gray-400 opacity-50'}`}
                        title={onlineUsers[partnerId] === 'active' ? 'Online' : 'Offline'}
                      ></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none mb-1">Partner</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold truncate max-w-[120px] leading-none">
                          {partnerProfile.name || coupleData.partnerNickname || 'Partner'}
                        </p>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 retro-border leading-none ${displayStatus.includes('Playing') ? 'bg-pink-400 text-white border-pink-600' : onlineUsers[partnerId] ? 'bg-blue-400 text-white' : 'bg-gray-200 opacity-50'}`}>
                          {displayStatus.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-[var(--border)] opacity-20 mx-1"></div>
                  <StreakBadge streak={streak} />
                </div>
              </div>
            </div>
            <button 
              onClick={handleSendKiss} 
              disabled={Date.now() - lastActionTime < 3000}
              className={`p-2 w-16 retro-border flex flex-col items-center justify-center transition-all ${Date.now() - lastActionTime < 3000 ? 'opacity-40 grayscale cursor-not-allowed' : 'retro-bg-window retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0 active:shadow-none'}`} 
              title="Send a kiss!"
            >
              <Heart size={24} fill={Date.now() - lastActionTime < 3000 ? "none" : "var(--primary)"} className={Date.now() - lastActionTime < 3000 ? 'text-[var(--border)]' : 'text-[var(--primary)]'} />
              <span className="text-[10px] font-bold mt-1 uppercase">Kiss</span>
            </button>
          </div>

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
          <PixelPet skin={petSkin} happy={petHappy} isPartnerAfk={isPartnerAfk} externalAction={petAction} onClick={() => handlePetAction(5)} />
          <div className="w-full px-4 mt-2"><div className="h-4 retro-border bg-[var(--bg-main)] w-full relative overflow-hidden rounded-sm"><div className="absolute top-0 left-0 h-full retro-bg-primary transition-all" style={{ width: `${petHappy}%` }}></div></div></div>
          <div className="flex gap-2 w-full mt-4"><RetroButton variant="secondary" className="flex-1 py-1 text-xs" disabled={petCooldown} onClick={() => handlePetAction(20, 'Fed the pet!', 'eat')}>Feed</RetroButton><RetroButton variant="accent" className="flex-1 py-1 text-xs" disabled={petCooldown} onClick={() => handlePetAction(10)}>Pet</RetroButton></div>
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
        <div className="flex flex-col h-full justify-center p-2 text-sm font-bold opacity-80 gap-2">
          <p>TicTacToe Wins: {getScoreForUser(scores, userId, 'tictactoe')}</p>
          <p>Pictionary Guessed: {getScoreForUser(scores, userId, 'pictionary')}</p>
          <p>Memory Pairs: {getScoreForUser(scores, userId, 'memory')}</p>
          <p>Wordles Solved: {getScoreForUser(scores, userId, 'wordle')}</p>
          <p>Sudoku Solved: {getScoreForUser(scores, userId, 'sudoku')}</p>
        </div>
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
          <AppIcon icon={<FileText size={28} />} label="notes" color="#f59e0b" onClick={() => nav('notes')} />
          <AppIcon icon={<FileText size={28} />} label="our story" color="#f472b6" onClick={() => nav('resume')} />
          <AppIcon icon={<SettingsIcon size={28} />} label="settings" color="var(--accent)" onClick={() => nav('settings')} />
        </div>
      </RetroWindow>
    </div>
  );
}
