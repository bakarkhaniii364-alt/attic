import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { Heart, Flame, Award, MessageCircle, Send, Trophy, MapPin, Calendar, Star } from 'lucide-react';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

// ── DAILY QUESTION ──
const DAILY_QUESTIONS = [
  "What's your favorite memory of us?", "What song reminds you of me?", "What's something new you want to try together?",
  "What's the sweetest thing I've ever done for you?", "Where would you take me on a surprise trip?", "What made you fall in love with me?",
  "What's your favorite thing about our relationship?", "What do you admire most about me?", "What's a hobby you'd love us to do together?",
  "What's your favorite way to spend a lazy day with me?", "What's a movie we should watch together?", "What's a food you want us to cook together?",
  "What's one thing you've never told me?", "What's the funniest moment we've shared?", "If we could live anywhere, where would it be?",
  "What's a goal you want us to achieve together?", "What outfit do you love seeing me in?", "What's something I do that always makes you smile?",
  "What's a bucket list item we should do?", "What's a dream date you'd plan for us?", "What's one thing you'd change about our routine?",
  "What's your love language?", "What's a show we should binge together?", "What do you want our future to look like?",
  "What's the best advice you'd give us?", "What's a challenge we've overcome together?", "What's a small thing I do that means a lot?",
  "What would you write in a letter to future us?", "What's a tradition you want us to start?", "What's your favorite photo of us?",
];

export function DailyQuestion({ onClose, sfx, userId, roomProfiles = {} }) {
  const today = new Date().toDateString();
  const questionIdx = Math.abs(today.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % DAILY_QUESTIONS.length;
  const question = DAILY_QUESTIONS[questionIdx];
  
  const [answers, setAnswers] = useGlobalSync('daily_answers', {});
  const [myAnswerText, setMyAnswerText] = useState('');

  const myDone = !!answers[today]?.[userId];
  const partnerId = Object.keys(roomProfiles).find(id => id !== userId);
  const partnerDone = partnerId && !!answers[today]?.[partnerId];
  const bothDone = myDone && partnerDone;

  const submit = () => {
    if (!myAnswerText.trim()) return;
    playAudio('send', sfx);
    setAnswers(prev => ({
      ...prev,
      [today]: {
        ...(prev[today] || {}),
        [userId]: myAnswerText,
        question
      }
    }));
  };

  const partnerName = roomProfiles[partnerId]?.name || 'Partner';

  return (
    <RetroWindow title="daily_question.exe" onClose={onClose} className="w-full max-w-lg" confirmOnClose hasUnsavedChanges={() => !myDone && myAnswerText.trim() !== ''} onSaveBeforeClose={() => { submit(); onClose && onClose(); }} sfx={sfx}>
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-16 h-16 rounded-full bg-accent text-accent-text border-2 border-border flex items-center justify-center text-3xl shadow-inner animate-pulse">❓</div>
        <h2 className="font-black text-[10px] uppercase opacity-40 tracking-[0.2em]">Today's Inquiry</h2>
        <p className="font-bold text-xl sm:text-2xl text-center leading-tight px-4 italic">"{question}"</p>
        
        {!bothDone ? (
          <div className="w-full space-y-4 mt-4">
            {!myDone ? (
              <div className="space-y-3">
                <textarea value={myAnswerText} onChange={e => setMyAnswerText(e.target.value)} placeholder="Type your answer..." className="w-full min-h-[100px] p-4 border-2 border-border bg-window text-main-text focus:outline-none resize-none font-bold" />
                <RetroButton variant="primary" onClick={submit} className="py-4 w-full flex items-center justify-center gap-2"><Send size={18} /> Reveal My Answer</RetroButton>
              </div>
            ) : (
              <div className="p-8 border-2 border-border bg-window text-main-text text-center italic opacity-60 animate-pulse">
                Your answer is locked in. Waiting for {partnerName} to reveal theirs...
              </div>
            )}
            <div className="flex justify-center gap-6 text-[10px] font-black uppercase tracking-widest">
               <span className={myDone ? 'text-green-500' : 'opacity-30'}>You: {myDone ? 'READY' : 'PENDING'}</span>
               <span className={partnerDone ? 'text-green-500' : 'opacity-30'}>{partnerName}: {partnerDone ? 'READY' : 'PENDING'}</span>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-4 mt-4 animate-in zoom-in-95 duration-500 text-main-text">
            <div className="border-2 border-border bg-window p-4 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
               <p className="text-[10px] font-black uppercase text-primary mb-1">Your Perspective:</p>
               <p className="font-bold text-lg">{answers[today][userId]}</p>
            </div>
            <div className="border-2 border-border bg-window p-4 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-secondary" />
               <p className="text-[10px] font-black uppercase text-secondary mb-1">{partnerName}'s Perspective:</p>
               <p className="font-bold text-lg">{answers[today][partnerId]}</p>
            </div>
          </div>
        )}
      </div>
    </RetroWindow>
  );
}

// ── STREAKS ──
export function useStreaks() {
  const [streakData, setStreakData] = useLocalStorage('streak_data', { lastLogin: null, count: 0, best: 0 });
  useEffect(() => {
    const today = new Date().toDateString();
    if (streakData.lastLogin === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newCount = streakData.lastLogin === yesterday ? streakData.count + 1 : 1;
    let newBest = Math.max(streakData.best, newCount);
    setStreakData({ lastLogin: today, count: newCount, best: newBest });
  }, []);
  return streakData;
}

export function StreakBadge({ streak }) {
  if (!streak || streak.count <= 0) return null;
  return (
    <div className="flex items-center gap-1 border-2 border-border bg-accent text-accent-text px-2 py-1 text-xs font-bold" title={`Best: ${streak.best} days`}>
      <Flame size={14} className="text-orange-500" />
      <span>{streak.count}</span>
    </div>
  );
}

// ── MILESTONES ──
const MILESTONES_LIST = [
  { days: 1, label: 'Day One ❤️' }, { days: 7, label: 'One Week!' }, { days: 30, label: 'One Month 🌙' },
  { days: 50, label: '50 Days 🎯' }, { days: 100, label: '100 Days! 💯' }, { days: 150, label: '150 Days 🌟' },
  { days: 200, label: '200 Days ✨' }, { days: 365, label: 'ONE YEAR! 🎉' }, { days: 500, label: '500 Days 🏆' },
  { days: 730, label: 'TWO YEARS 💫' }, { days: 1000, label: '1000 DAYS! 🌈' }, { days: 1095, label: 'THREE YEARS 🎊' },
];

export function getMilestoneToday(anniversary) {
  if (!anniversary) return null;
  // Solution 26: Validate date before calculation
  const start = new Date(anniversary);
  if (isNaN(start.getTime())) return null;
  const diff = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
  return MILESTONES_LIST.find(m => m.days === diff) || null;
}

export function MilestoneCelebration({ milestone, onClose }) {
  if (!milestone) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <RetroWindow title="milestone.exe" onClose={onClose} className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 py-6">
          <Trophy size={48} className="text-primary animate-bounce" />
          <h2 className="text-2xl font-bold text-center text-main-text">{milestone.label}</h2>
          <p className="text-sm opacity-60 text-center">Congratulations on reaching {milestone.days} days together!</p>
          <RetroButton onClick={onClose} className="px-8 py-3">Celebrate! 🎉</RetroButton>
        </div>
      </RetroWindow>
    </div>
  );
}

// ── LOVE LANGUAGE QUIZ ──
const LLQ = [
  { q: "I feel most loved when my partner...", a: "Tells me they love me", b: "Gives me a thoughtful gift", c: "Spends quality time with me", d: "Helps me with tasks", e: "Gives me a hug or holds my hand" },
  { q: "My ideal date would involve...", a: "Deep conversation", b: "Surprise presents", c: "Undivided attention", d: "My partner planning everything", e: "Cuddling on the couch" },
  { q: "I feel hurt when my partner...", a: "Doesn't say encouraging things", b: "Forgets special occasions", c: "Is always distracted", d: "Doesn't help when I'm stressed", e: "Doesn't show physical affection" },
  { q: "The best way to cheer me up is...", a: "Kind words and compliments", b: "A surprise treat", c: "Dropping everything to be with me", d: "Doing a chore for me", e: "A long warm hug" },
  { q: "When apart, I miss most...", a: "Hearing their voice", b: "Receiving little gifts", c: "Being together", d: "Their help around the house", e: "Physical closeness" },
];
const LL_LABELS = { a: 'Words of Affirmation', b: 'Receiving Gifts', c: 'Quality Time', d: 'Acts of Service', e: 'Physical Touch' };
const LL_COLORS = { a: 'var(--primary)', b: 'var(--accent)', c: 'var(--secondary)', d: '#4ade80', e: '#f472b6' };

export function LoveLanguageQuiz({ config, onBack, sfx, profile }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [done, setDone] = useState(false);

  const answer = (choice) => {
    playAudio('click', sfx);
    const newA = [...answers, choice];
    setAnswers(newA);
    if (newA.length >= LLQ.length) { setDone(true); } else { setIdx(idx + 1); }
  };

  // Tally
  const tally = { a: 0, b: 0, c: 0, d: 0, e: 0 };
  answers.forEach(a => { tally[a] = (tally[a] || 0) + 1; });
  const maxKey = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'c';

  if (done) {
    return (
      <RetroWindow title="love_language.exe" onClose={onBack} className="w-full max-w-lg h-[calc(100dvh-4rem)] max-h-[700px]">
        <div className="flex flex-col items-center gap-4 py-4">
          <Heart size={40} className="text-primary" />
          <h2 className="font-bold text-xl text-main-text">Your Love Language</h2>
          <h3 className="font-bold text-2xl text-primary">{LL_LABELS[maxKey]}</h3>
          <div className="w-full flex flex-col gap-2 mt-4">
            {Object.entries(tally).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-main-text">
                <span className="text-xs font-bold w-32 text-right">{LL_LABELS[key]}</span>
                <div className="flex-1 h-6 border-2 border-border bg-main relative">
                  <div className="h-full transition-all" style={{ width: `${(val / LLQ.length) * 100}%`, backgroundColor: LL_COLORS[key] }}></div>
                </div>
                <span className="text-xs font-bold w-8">{val}</span>
              </div>
            ))}
          </div>
          <RetroButton className="mt-4 px-6 py-2" onClick={onBack}>Done</RetroButton>
        </div>
      </RetroWindow>
    );
  }

  return (
    <RetroWindow title="love_language.exe" onClose={onBack} className="w-full max-w-xl h-[calc(100dvh-4rem)] max-h-[700px]" noPadding>
      <div className="bg-border text-border-text p-2 px-4 font-bold text-sm">Q {idx + 1}/{LLQ.length}</div>
      <div className="w-full h-2 bg-main"><div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / LLQ.length) * 100}%` }}></div></div>
      <div className="flex-1 flex flex-col p-6 gap-4">
        <h2 className="font-bold text-lg text-center">{LLQ[idx].q}</h2>
        <div className="flex flex-col gap-2 mt-4">
          {['a', 'b', 'c', 'd', 'e'].map(k => (
            <RetroButton key={k} variant="white" onClick={() => answer(k)} className="py-3 text-left px-4 text-sm w-full">{LLQ[idx][k]}</RetroButton>
          ))}
        </div>
      </div>
    </RetroWindow>
  );
}

// ── RELATIONSHIP RESUME ──
export function RelationshipResume({ onClose, profile, coupleData = {}, scores, sfx, userId, roomProfiles = {} }) {
  const partnerId = Object.keys(roomProfiles).find(id => id !== userId);
  const partnerProfile = roomProfiles[partnerId] || {};

  const anniversary = coupleData?.anniversary;
  let daysTogether = 0;
  if (anniversary) { daysTogether = Math.floor((new Date() - new Date(anniversary)) / (1000 * 60 * 60 * 24)); }
  
  const handleDownload = async () => {
    playAudio('click', sfx);
    const el = document.getElementById('resume-card');
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `relationship_resume.png`; a.click();
    } catch (e) { console.error(e); }
  };

  return (
    <RetroWindow title="our_resume.doc" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
       <div id="resume-card" className="flex-1 bg-window p-6 sm:p-12 overflow-y-auto text-main-text">
          <div className="border-b-4 border-border pb-8 mb-10 flex flex-col sm:flex-row justify-between items-center gap-6">
             <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">Relationship Resume</h1>
                <p className="font-bold opacity-40 uppercase text-[10px] tracking-[0.3em]">Established {anniversary || 'Day One'}</p>
             </div>
             <div className="flex -space-x-6">
                <div className="w-20 h-20 rounded-full retro-border bg-white overflow-hidden shadow-xl z-10 hover:scale-110 transition-transform">
                   <img src={profile?.pfp} className="w-full h-full object-cover" alt="me" />
                </div>
                <div className="w-20 h-20 rounded-full retro-border bg-white overflow-hidden shadow-xl hover:scale-110 transition-transform">
                   <img src={partnerProfile?.pfp} className="w-full h-full object-cover" alt="partner" />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
             <section className="space-y-6">
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-dashed border-border mb-4 pb-1 flex items-center gap-2"><Star size={14}/> Core Competencies</h2>
                   <ul className="space-y-2 font-bold text-sm">
                      <li className="flex items-center gap-2">✨ Infinite Cuddling & Emotional Support</li>
                      <li className="flex items-center gap-2">🍕 Advanced Pizza Selection Skills</li>
                      <li className="flex items-center gap-2">🎤 Expert Level Bad Karaoke</li>
                      <li className="flex items-center gap-2">🕒 Professional Late Night Talking</li>
                   </ul>
                </div>
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-dashed border-border mb-4 pb-1 flex items-center gap-2"><Trophy size={14}/> High Scores</h2>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border-2 border-border bg-main text-center">
                         <p className="text-[9px] font-black uppercase opacity-50">Days Sync'd</p>
                         <p className="text-xl font-black">{daysTogether}</p>
                      </div>
                      <div className="p-3 border-2 border-border bg-main text-center">
                         <p className="text-[9px] font-black uppercase opacity-50">Games Won</p>
                         <p className="text-xl font-black">{Object.values(scores || {}).reduce((a, b) => a + b, 0)}</p>
                      </div>
                   </div>
                </div>
             </section>
             <section className="space-y-6">
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-dashed border-border mb-4 pb-1 flex items-center gap-2"><Calendar size={14}/> Key Milestones</h2>
                   <div className="space-y-4">
                      <div className="flex justify-between items-end border-b border-dashed border-border pb-1">
                         <p className="text-[10px] font-black uppercase opacity-40">The Beginning</p>
                         <p className="font-bold text-sm">{anniversary || '---'}</p>
                      </div>
                      <div className="flex justify-between items-end border-b border-dashed border-border pb-1">
                         <p className="text-[10px] font-black uppercase opacity-40">First Collaborative Art</p>
                         <p className="font-bold text-sm">2026-04-27</p>
                      </div>
                   </div>
                </div>
                <div className="p-4 bg-accent text-accent-text border-2 border-border border-dashed text-center">
                   <p className="italic font-serif leading-relaxed text-sm">
                      "Certified authentic connection, synchronized across all digital dimensions."
                   </p>
                </div>
             </section>
          </div>

          <div className="mt-12 flex justify-around border-t-2 border-border pt-8">
             <div className="text-center">
                <div className="h-px w-32 bg-border mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">{profile?.name || 'You'}</p>
             </div>
             <div className="text-center">
                <div className="h-px w-32 bg-border mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">{partnerProfile?.name || 'Partner'}</p>
             </div>
          </div>
       </div>
       <div className="p-4 bg-main border-t-2 border-border flex justify-center gap-4">
          <RetroButton variant="primary" onClick={handleDownload} className="px-8">📥 Download PNG</RetroButton>
          <RetroButton variant="white" onClick={() => window.print()} className="px-8">🖨️ Print Resume</RetroButton>
       </div>
    </RetroWindow>
  );
}
// ── WEATHER WIDGET (Optimized) ──
export function WeatherWidget({ compact = false }) {
  const [weatherData, setWeatherData] = useState(() => {
    try {
      const cached = window.localStorage.getItem('attic_weather_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache valid for 30 minutes
        if (Date.now() - timestamp < 1800000) return data;
      }
    } catch (e) {}
    return null;
  });

  const [loading, setLoading] = useState(!weatherData);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // wttr.in format: ?format=j1 (JSON format)
        // Using a generic location or user-set city if we had one. 
        // For now, let's use auto-location based on IP via wttr.in
        const res = await fetch('https://wttr.in/?format=j1');
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        
        const simplified = {
          temp: data.current_condition[0].temp_C,
          desc: data.current_condition[0].weatherDesc[0].value,
          city: data.nearest_area[0].areaName[0].value
        };

        setWeatherData(simplified);
        window.localStorage.setItem('attic_weather_cache', JSON.stringify({
          data: simplified,
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn("Weather fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    // If no cache or cache expired, fetch
    if (!weatherData) fetchWeather();
    else {
      // Silently refresh in background even if cache exists
      const timer = setTimeout(fetchWeather, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!weatherData && loading) return (
    <div className="border-t border-dashed border-border pt-2 mt-2 text-[10px] font-bold opacity-30 uppercase tracking-widest text-center animate-pulse text-main-text">
      Fetching sky status...
    </div>
  );

  if (!weatherData) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-main-text">
        <div className="w-8 h-8 border-2 border-border bg-accent text-accent-text flex items-center justify-center font-bold text-[10px] shadow-sm">
          {weatherData.temp}°C
        </div>
        <div className="flex flex-col">
          <p className="font-bold text-[9px] uppercase leading-none">{weatherData.desc}</p>
          <p className="text-[8px] opacity-40 uppercase tracking-tighter leading-none">{weatherData.city}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-dashed border-border pt-2 mt-2 text-main-text">
      <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-1">🌤️ Local Weather</p>
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 border-2 border-border bg-accent text-accent-text flex items-center justify-center font-bold text-xs shadow-sm">
          {weatherData.temp}°C
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-xs truncate leading-none mb-1">{weatherData.desc}</p>
          <p className="text-[10px] opacity-40 uppercase tracking-tighter">{weatherData.city}</p>
        </div>
      </div>
    </div>
  );
}
