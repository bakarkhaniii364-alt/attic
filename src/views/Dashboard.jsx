import React, { useState, useEffect, useRef } from 'react';
import { Mail, Heart, Hand, Gamepad2, MessageSquare, Brush, Pen, Clock, Calendar as CalendarIcon, Image as ImageIcon, Settings as SettingsIcon, ListTodo, Flame, Moon, MessageCircle, FileText, Grid3x3, Volume2 } from 'lucide-react';
import { RetroWindow, RetroButton, AppIcon, ConfirmDialog, useToast } from '../components/UI.jsx';
import { DashboardRadio } from '../components/LofiPlayer.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { getScoreForUser } from '../utils/userDataHelpers.js';
import { StreakBadge, WeatherWidget } from '../components/Features.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSync } from '../context/SyncContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { supabase } from '../lib/supabase.js';

const PixelPet = React.memo(({ happy, onPet, onHit, skin, isPartnerAfk, externalAction }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [currentAction, setCurrentAction] = useState('idle');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState(null);
  const [lastPetTime, setLastPetTime] = useState(0);

  const actionTimeoutRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const pointerDownTimeRef = useRef(0);
  const actionVariantRef = useRef(0);

  // Handle skin path (convert .png to folder path if needed)
  let skinFolder = '/assets/cat_1_9';
  if (skin && typeof skin === 'string' && skin !== 'undefined' && skin !== 'null' && !skin.includes('[object')) {
    skinFolder = skin;
    // Legacy migration: map old sprite sheet path to the new folder structure
    if (skinFolder.includes('Cat Sprite Sheet')) skinFolder = '/assets/cat_1_9';
    
    if (skinFolder.endsWith('.png')) skinFolder = skinFolder.replace('.png', '');
    if (!skinFolder.startsWith('/') && !skinFolder.startsWith('http')) skinFolder = '/assets/' + skinFolder;
  }
  
  // Sadness logic: Hungry (low happy) or ignored for a long time (> 4 hours)
  const isHungry = happy < 50;
  const isIgnored = lastPetTime > 0 && (Date.now() - lastPetTime > 4 * 60 * 60 * 1000);
  const isSad = !isSleeping && (isHungry || isIgnored || happy < 30);

  const sleepRows = [12, 13, 14, 15, 16, 17, 18, 19];
  const randomIdleActions = ['yawn', 'wash', 'paw', 'stretch', 'scratch', 'walk'];

  useEffect(() => {
    setIsSleeping(false);
    setLastActivityTime(Date.now());

    const interval = setInterval(() => {
      const now = Date.now();
      const hr = new Date().getHours();
      const isNight = hr < 6 || hr > 22;

      if (isNight && !isSleeping && (now - lastActivityTime > 120000)) {
        setIsSleeping(true);
        setSleepStartTime(now);
      }

      // Daytime nap chance (5%)
      if (!isNight && !isSleeping && (now - lastActivityTime > 60000) && Math.random() > 0.95) {
        setIsSleeping(true);
        setSleepStartTime(now);
      }

      if (isSleeping && sleepStartTime && (now - sleepStartTime > 1 * 60 * 60 * 1000)) {
        setIsSleeping(false);
        setLastActivityTime(now);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [isSleeping, lastActivityTime, sleepStartTime]);

  const triggerAction = (actionName, duration) => {
    actionVariantRef.current = Math.random();
    setCurrentAction(actionName);
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    actionTimeoutRef.current = setTimeout(() => {
      setCurrentAction('idle');
    }, duration);
  };

  useEffect(() => {
    if (externalAction) triggerAction(externalAction, 3000);
  }, [externalAction]);

  useEffect(() => {
    if (isSleeping || currentAction !== 'idle' || isSad) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.8) { // 20% chance every 10s
        const randomAction = randomIdleActions[Math.floor(Math.random() * randomIdleActions.length)];
        triggerAction(randomAction, 3000);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isSleeping, currentAction, isSad]);

  const startPress = () => {
    const now = Date.now();
    setLastPetTime(now); // Interaction counts as petting for sadness logic
    setLastActivityTime(now);
    pointerDownTimeRef.current = now;

    if (isSleeping) {
      setIsSleeping(false);
      setSleepStartTime(null);
      triggerAction('yawn', 2000);
      return;
    }

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }

    holdTimeoutRef.current = setTimeout(() => {
      setLastPetTime(Date.now());
      triggerAction('paw', 1200);
      if (onPet) onPet();
      holdTimeoutRef.current = null;
    }, 400);
  };

  const releasePress = () => {
    const now = Date.now();
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
      if (now - pointerDownTimeRef.current < 400) {
        setLastPetTime(now);
        triggerAction('hiss', 800);
        if (onHit) onHit();
      }
    }
  };

  const cancelPress = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  const getSpriteForState = () => {
    if (isSleeping) {
      const sleepOpts = [
        { start: 132, frames: 2 },
        { start: 143, frames: 2 },
        { start: 176, frames: 2 },
        { start: 187, frames: 2 }
      ];
      const opt = sleepOpts[Math.floor(Date.now() / 10000) % sleepOpts.length];
      return { start: opt.start, frames: opt.frames, duration: 1000 };
    }

    const variant = actionVariantRef.current;

    if (currentAction === 'hiss') {
      const start = variant > 0.5 ? 451 : 462;
      return { start, frames: 2, duration: 500 };
    }
    if (currentAction === 'eat') return { start: 220, frames: 8, duration: 1000 };
    
    if (currentAction === 'meow') {
      const meows = [{s:308, f:3}, {s:319, f:3}, {s:330, f:3}, {s:341, f:3}];
      const m = meows[Math.floor(variant * meows.length)];
      return { start: m.s, frames: m.f, duration: 700 };
    }
    
    if (currentAction === 'yawn') {
      const yawns = [{s:352, f:8}, {s:363, f:8}, {s:374, f:8}, {s:385, f:8}];
      const y = yawns[Math.floor(variant * yawns.length)];
      return { start: y.s, frames: y.f, duration: 1100 };
    }
    
    if (currentAction === 'wash') {
      const licks = [{s:396, f:9}, {s:407, f:9}, {s:418, f:7}];
      const l = licks[Math.floor(variant * licks.length)];
      return { start: l.s, frames: l.f, duration: 1000 };
    }
    
    if (currentAction === 'paw') return { start: 484, frames: 9, duration: 900 };
    if (currentAction === 'stretch') return { start: 572, frames: 4, duration: 1200 };
    
    if (currentAction === 'scratch') {
      const scratches = [{s:429, f:11}, {s:440, f:11}];
      const s = scratches[Math.floor(variant * scratches.length)];
      return { start: s.s, frames: s.f, duration: 1200 };
    }
    
    if (currentAction === 'walk') {
      const walks = [{s:66, f:8}, {s:77, f:8}];
      const w = walks[Math.floor(variant * walks.length)];
      return { start: w.s, frames: w.f, duration: 1200 };
    }

    if (isSad) return { start: 473, frames: 1, duration: 1000 };
    if (isPartnerAfk) return { start: 176, frames: 2, duration: 1200 }; // Curled sleep
    if (isHovering) return { start: 308, frames: 3, duration: 1000 }; // Meow sit

    // Default / Rest position: Randomize between sleep and walk as requested
    const defaultOptions = [
      {s:132, f:2}, {s:143, f:2}, {s:176, f:2}, {s:187, f:2}, // Sleeps
      {s:66, f:8}, {s:77, f:8} // Walks
    ];
    const def = defaultOptions[Math.floor(variant * defaultOptions.length)];
    return { start: def.s, frames: def.f, duration: def.f > 2 ? 1200 : 2000 };
  };

  const { start, frames, duration } = getSpriteForState();

  useEffect(() => {
    setCurrentFrame(0);
    if (frames <= 1) return;
    const interval = setInterval(() => {
      setCurrentFrame(f => (f + 1) % frames);
    }, duration / frames);
    return () => clearInterval(interval);
  }, [start, frames, duration]);

  const frameId = (start + currentFrame).toString().padStart(3, '0');
  const frameSrc = `${skinFolder}/tile${frameId}.png`;

  const scale = 4;
  const frameSize = 32 * scale; // 128px

  return (
    <div
      className={`relative cursor-pointer select-none transition-opacity ${isSleeping ? 'opacity-80' : ''}`}
      onMouseEnter={() => !isSleeping && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onPointerDown={startPress}
      onPointerUp={releasePress}
      onPointerLeave={cancelPress}
      title={isSleeping ? "Shh, pet is sleeping. Hold to pet, tap to hit." : "Hold to pet, tap to hit."}
    >
      <img
        src={frameSrc}
        alt="pet"
        draggable="false"
        onDragStart={e => e.preventDefault()}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '/assets/cat_1_9/tile0.png';
        }}
        style={{
          width: `${frameSize}px`,
          height: `${frameSize}px`,
          imageRendering: 'pixelated',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'none',
        }}
      />
      {isSleeping && (
        <span className="absolute -top-2 -right-2 text-sm font-mono font-bold animate-pulse text-border drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)] opacity-0">zzz</span>
      )}
      {isSad && !isSleeping && (
        <div className="absolute -top-3 -right-2 flex flex-col items-center text-[11px] font-bold text-accent-text drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)] opacity-0">
          <span>:(</span>
          <span className="text-[10px] opacity-80">sad</span>
        </div>
      )}
      {currentAction === 'meow' && (
        <svg width="24" height="24" viewBox="0 0 16 16" className="absolute -top-4 right-0 animate-bounce drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">
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
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [val, displayVal]);

  const currentStr = String(displayVal).padStart(2, '0');
  const nextStr = String(val).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-10 h-12 sm:w-12 sm:h-14 bg-window border-2 border-border shadow-[1.5px_1.5px_0px_0px_var(--border)] font-black text-xl sm:text-2xl text-main-text perspective-1000 preserve-3d">
        
        {/* Layer 1: TOP STATIC (Next value, revealed as flap moves) */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-window overflow-hidden flex items-end justify-center pb-[1px] border-b border-border/10">
          <span className="translate-y-1/2">{nextStr}</span>
        </div>
        
        {/* Layer 2: BOTTOM STATIC (Current value, hidden until flap hits 180) */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-window overflow-hidden flex items-start justify-center pt-[1px]">
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
          <div className="absolute inset-0 bg-window overflow-hidden flex items-end justify-center pb-[1px] backface-hidden border-b border-border/20" style={{ backfaceVisibility: 'hidden' }}>
            <span className="translate-y-1/2">{currentStr}</span>
          </div>
          
          {/* Back of Flap: New Bottom Half */}
          <div className="absolute inset-0 bg-window overflow-hidden flex items-start justify-center pt-[1px] backface-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateX(-180deg)' }}>
            <span className="-translate-y-1/2">{nextStr}</span>
          </div>
        </div>

        {/* Center Crease/Divider */}
        <div className="absolute top-1/2 left-0 w-full h-[1.5px] bg-border opacity-30 z-30"></div>
      </div>
      <span className="text-[10px] font-bold opacity-60 uppercase mt-1.5 tracking-tighter">{label}</span>
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
    <div className="border-t border-dashed border-border pt-2 mt-2 text-[10px] font-bold opacity-40 uppercase tracking-widest text-center">
      No upcoming events
    </div>
  );
  const daysUntil = Math.ceil((new Date(next.date) - now) / (1000 * 60 * 60 * 24));
  return (
    <div className="border-t border-dashed border-border pt-2 mt-2">
      <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-1">📅 upcoming</p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 retro-border bg-primary text-primary-text flex items-center justify-center font-bold text-xs">{daysUntil}d</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs truncate">{next.title || next.text || 'Event'}</p>
          <p className="text-[10px] opacity-50">{new Date(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ setView, theme, setTheme, sfxEnabled, setSfxEnabled, weather, setWeather, radioState, setRadioState }) {
  const { userId, partnerId, roomId, logout } = useAuth();
  const { globalState, updateSyncState, broadcast: syncBroadcast, onlineUsers } = useSync();
  const { messages: chatHistory } = useChat();
  const toast = useToast();

  // Derived State
  const profile = globalState?.room_profiles?.[userId] || {};
  const partnerProfile = globalState?.room_profiles?.[partnerId] || {};
  const coupleData = globalState?.couple_data || { petName: 'pet', petSkin: '/assets/cat_1_9', petHappy: 60 };
  const streaks = globalState?.user_streaks?.[userId] || { count: 0 };
  
  const partnerName = partnerProfile.name || 'Partner';
  const partnerStatus = partnerProfile.status || 'offline';

  const partnerPresence = onlineUsers[partnerId] || {};
  const isPartnerOnline = partnerPresence.status === 'active';
  const isPartnerIdle = partnerPresence.status === 'idle';

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
  const [lastActionTime, setLastActionTime] = useState(0);
  
  const handleSendKiss = () => {
    if (Date.now() - lastActionTime < 3000) return;
    setLastActionTime(Date.now());
    playAudio('click', sfxEnabled);
    syncBroadcast('interaction', { type: 'kiss', from: userId, timestamp: Date.now().toString() });
    updateSyncState('couple_data', { ...coupleData, lastKissFrom: userId, lastKissTimestamp: Date.now().toString() });
  };

  const nav = (v) => setView(v);
  const unreadDoodles = safeDoodles.filter(d => {
    const readBy = Array.isArray(d.metadata?.read_by) ? d.metadata.read_by : [];
    return d.owner_id === partnerId && !readBy.includes(userId);
  });
  const [petCooldown, setPetCooldown] = useState(false);
  const [petAction, setPetAction] = useState(null); // eat or other triggered external actions
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Fetch and manage doodles
  const [seenAssets, setSeenAssets] = useLocalStorage('seen_assets', []);
  const [unviewedDoodle, setUnviewedDoodle] = useState(null);

  // ── Geolocation: store MY location in room_profiles on mount ──
  useEffect(() => {
    if (!userId || !roomId || !updateSyncState) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const cacheKey = `geo_${lat.toFixed(2)}_${lon.toFixed(2)}`;
        const cachedGeo = localStorage.getItem(cacheKey);
        let city = 'Unknown';
        if (cachedGeo) {
          city = cachedGeo;
        } else {
          // Reverse geocode to get city name with unique User-Agent and specific locale
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'AtticArcade/1.0 (contact@atticarcade.internal)' } }
          );
          const geo = await res.json();
          city =
            geo?.address?.city ||
            geo?.address?.town ||
            geo?.address?.village ||
            geo?.address?.county ||
            'Unknown';
          localStorage.setItem(cacheKey, city);
        }
        const currentProfiles = globalState?.room_profiles || {};
        updateSyncState('room_profiles', {
          ...currentProfiles,
          [userId]: { ...currentProfiles[userId], location: { lat, lon, city } }
        });
      } catch (e) {
        console.warn('[GEO] Reverse geocode failed:', e.message);
      }
    }, () => { /* permission denied — silent */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, roomId]); // Run once on mount

  // ── Partner weather: fetch when their location is available ──
  const WMO_EMOJI = {
    0: '☀️', 1: '🌤', 2: '⛅', 3: '☁️',
    45: '🌫', 48: '🌫',
    51: '🌦', 53: '🌦', 55: '🌧',
    61: '🌧', 63: '🌧', 65: '🌧',
    71: '🌨', 73: '🌨', 75: '❄️',
    80: '🌦', 81: '🌧', 82: '⛈',
    95: '⛈', 96: '⛈', 99: '⛈',
  };
  const [partnerWeather, setPartnerWeather] = useState(null);
  useEffect(() => {
    const loc = partnerProfile?.location;
    if (!loc?.lat || !loc?.lon) return;
    let cancelled = false;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current_weather=true&temperature_unit=celsius`
    )
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const cw = data?.current_weather;
        if (cw) {
          const emoji = WMO_EMOJI[cw.weathercode] ?? '🌡';
          setPartnerWeather({ temp: Math.round(cw.temperature), emoji, city: loc.city });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [partnerProfile?.location?.lat, partnerProfile?.location?.lon]);

  useEffect(() => {
    if (!roomId || !partnerId) return;
    const fetchDoodles = async () => {
      const { data, error } = await supabase
        .from('shared_assets')
        .select('*')
        .eq('room_id', roomId)
        .eq('type', 'doodle')
        .eq('owner_id', partnerId)          // ← correct column name
        .order('created_at', { ascending: false });
      if (error || !data) return;
      // seenAssets read via closure snapshot — does not need to be a dep
      setSeenAssets(prev => {
        const newDoodles = data.filter(a => !prev.includes(a.id));
        if (newDoodles.length > 0) setUnviewedDoodle(newDoodles[0]);
        return prev; // don't change seenAssets, just read it
      });
    };
    fetchDoodles();
  }, [roomId, partnerId]); // ← no seenAssets — prevents re-fetch spam

  const markDoodleAsSeen = (id) => {
    if (!seenAssets.includes(id)) {
      setSeenAssets([...seenAssets, id]);
    }
    setUnviewedDoodle(null);
  };

  const handleFeed = () => {
    if (petCooldown) return;
    playAudio('click', sfxEnabled);
    updateSyncState('couple_data', { ...coupleData, petHappy: Math.min(100, (coupleData.petHappy || 60) + 20) });
    toast('Fed the pet!', 'success', 1500);
    setPetAction('eat');
    setTimeout(() => setPetAction(null), 3000);
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };

  const handlePet = () => {
    if (petCooldown) return;
    playAudio('click', sfxEnabled);
    updateSyncState('couple_data', { ...coupleData, petHappy: Math.min(100, (coupleData.petHappy || 60) + 10) });
    toast('Petted the pet!', 'success', 1200);
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };

  const handleHit = () => {
    if (petCooldown) return;
    playAudio('click', sfxEnabled);
    updateSyncState('couple_data', { ...coupleData, petHappy: Math.max(0, (coupleData.petHappy || 60) - 5) });
    toast('Ouch... that was a hit.', 'warning', 1400);
    setPetCooldown(true);
    setTimeout(() => setPetCooldown(false), 2000);
  };

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
                <div className="flex items-center gap-4 mt-3 bg-black/5 p-2 retro-border border-dashed">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {partnerProfile.pfp ? (
                        <img src={partnerProfile.pfp} alt="partner" className="w-10 h-10 retro-border object-cover bg-white retro-shadow-dark" />
                      ) : (
                        <div className="w-10 h-10 retro-bg-secondary retro-border flex items-center justify-center text-lg">{partnerProfile.emoji || '👤'}</div>
                      )}
                      {/* Single dot indicator — purely decorative, color matches displayStatus */}
                      <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white ${isPartnerOnline ? 'bg-green-500' : isPartnerIdle ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase opacity-40 tracking-widest leading-none mb-1">Partner</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold truncate max-w-[120px] leading-none">
                          {partnerProfile.name || coupleData.partnerNickname || 'Partner'}
                        </p>
                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 retro-border leading-none ${displayStatus.includes('Playing') ? 'bg-pink-400 text-white border-pink-600' : isPartnerOnline ? 'bg-green-500 text-white border-green-700' : isPartnerIdle ? 'bg-yellow-400 text-black border-yellow-600' : 'bg-transparent border-2 border-border/50 text-main-text opacity-50'}`}>
                          {displayStatus.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-border opacity-20 mx-1"></div>
                  <StreakBadge streak={streaks} />
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

          <div className="flex flex-wrap gap-2 items-center justify-between pt-2 border-t border-dashed border-border mt-auto">
            {/* Left: partner's local weather */}
            <div className="flex items-center gap-2">
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
            <div className="flex gap-2">
              <button onClick={() => nav('settings')} className="bg-window text-main-text font-black text-[10px] py-1.5 px-3 retro-border retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-transform uppercase tracking-wider flex items-center gap-1.5">
                <SettingsIcon size={11} /> Control Panel
              </button>
              <button onClick={() => setShowLogoutConfirm(true)} className="bg-red-500 text-white font-black text-[10px] py-1.5 px-3 retro-border border-red-700 retro-shadow-dark hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-transform uppercase tracking-wider">
                Log Out
              </button>
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
        <div className="flex flex-col h-full justify-center p-2 text-sm font-bold opacity-80 gap-2 text-main-text">
          <p>TicTacToe Wins: {getScoreForUser(scores, userId, 'tictactoe')}</p>
          <p>Pictionary Guessed: {getScoreForUser(scores, userId, 'pictionary')}</p>
          <p>Memory Pairs: {getScoreForUser(scores, userId, 'memory')}</p>
          <p>Wordles Solved: {getScoreForUser(scores, userId, 'wordle')}</p>
          <p>Sudoku Solved: {getScoreForUser(scores, userId, 'sudoku')}</p>
        </div>
      </RetroWindow>

      <RetroWindow title="applications" className="md:col-span-12">
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-6 sm:gap-8 p-4">
          <AppIcon icon={<MessageSquare size={28} />} label="Chat"     color="#3b82f6" onClick={() => nav('chat')} badge={unreadChatCount > 0 ? unreadChatCount : null} />
          <AppIcon icon={<Gamepad2     size={28} />} label="Arcade"   color="#a855f7" onClick={() => nav('activities')} />
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
