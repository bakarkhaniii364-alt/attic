import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { Heart, Flame, Award, MessageCircle, Send, Trophy } from 'lucide-react';

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

export function DailyQuestion({ onClose, sfx }) {
  const today = new Date().toDateString();
  const questionIdx = Math.abs(today.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % DAILY_QUESTIONS.length;
  const question = DAILY_QUESTIONS[questionIdx];
  const [answers, setAnswers] = useLocalStorage('daily_answers', {});
  const [myAnswer, setMyAnswer] = useState(answers[today]?.mine || '');
  const [submitted, setSubmitted] = useState(!!answers[today]?.mine);

  const submit = () => {
    if (!myAnswer.trim()) return;
    playAudio('send', sfx);
    const partnerAnswer = "I think about this all the time... 💭";
    setAnswers({ ...answers, [today]: { mine: myAnswer, partner: partnerAnswer, q: question } });
    setSubmitted(true);
  };

  return (
    <RetroWindow title="daily_question.exe" onClose={onClose} className="w-full max-w-lg" confirmOnClose hasUnsavedChanges={() => myAnswer.trim() !== ''} onSaveBeforeClose={() => { submit(); onClose && onClose(); }} sfx={sfx}>
      <div className="flex flex-col items-center gap-4 py-4">
        <MessageCircle size={32} className="text-[var(--primary)]" />
        <h2 className="font-bold text-sm uppercase opacity-50 tracking-widest">Today's Question</h2>
        <p className="font-bold text-lg sm:text-xl text-center leading-relaxed px-4">{question}</p>
        {!submitted ? (
          <div className="w-full flex flex-col gap-3 mt-4">
            <textarea value={myAnswer} onChange={e => setMyAnswer(e.target.value)} placeholder="Your answer..." className="w-full min-h-[80px] p-4 retro-border retro-bg-window focus:outline-none resize-none" />
            <RetroButton onClick={submit} className="py-3 w-full flex items-center justify-center gap-2"><Send size={16} /> Submit</RetroButton>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3 mt-4">
            <div className="retro-border retro-bg-accent p-3"><p className="text-xs font-bold opacity-50 mb-1">You said:</p><p className="font-bold">{answers[today]?.mine}</p></div>
            <div className="retro-border retro-bg-secondary p-3"><p className="text-xs font-bold opacity-50 mb-1">Partner said:</p><p className="font-bold">{answers[today]?.partner}</p></div>
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
    <div className="flex items-center gap-1 retro-border retro-bg-accent px-2 py-1 text-xs font-bold" title={`Best: ${streak.best} days`}>
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
  const diff = Math.floor((new Date() - new Date(anniversary)) / (1000 * 60 * 60 * 24));
  return MILESTONES_LIST.find(m => m.days === diff) || null;
}

export function MilestoneCelebration({ milestone, onClose }) {
  if (!milestone) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <RetroWindow title="milestone.exe" onClose={onClose} className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 py-6">
          <Trophy size={48} className="text-[var(--primary)] animate-bounce" />
          <h2 className="text-2xl font-bold text-center">{milestone.label}</h2>
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
          <Heart size={40} className="text-[var(--primary)]" />
          <h2 className="font-bold text-xl">Your Love Language</h2>
          <h3 className="font-bold text-2xl text-[var(--primary)]">{LL_LABELS[maxKey]}</h3>
          <div className="w-full flex flex-col gap-2 mt-4">
            {Object.entries(tally).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs font-bold w-32 text-right">{LL_LABELS[key]}</span>
                <div className="flex-1 h-6 retro-border bg-[var(--bg-main)] relative">
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
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 px-4 font-bold text-sm">Q {idx + 1}/{LLQ.length}</div>
      <div className="w-full h-2 bg-[var(--bg-main)]"><div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${((idx + 1) / LLQ.length) * 100}%` }}></div></div>
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
export function RelationshipResume({ onClose, profile, coupleData, scores, sfx, userId }) {
  const [chatHistory] = useLocalStorage('chat_history', []);
  const [doodles] = useLocalStorage('shared_doodles', []);
  const [streakData] = useLocalStorage('streak_data', { count: 0, best: 0 });

  const anniversary = coupleData?.anniversary;
  let daysTogether = 0;
  if (anniversary) { daysTogether = Math.floor((new Date() - new Date(anniversary)) / (1000 * 60 * 60 * 24)); }
  const totalMessages = chatHistory.length;
  const totalDoodles = doodles.length;
  const totalGames = Object.values(scores || {}).reduce((a, b) => a + b, 0);

  const handleDownload = async () => {
    playAudio('click', sfx);
    const el = document.getElementById('resume-card');
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-window').trim() || '#fffdf9', scale: 2 });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `relationship_resume_${Date.now()}.png`; a.click();
    } catch (e) { console.error(e); }
  };

  return (
    <RetroWindow title="our_story.exe" onClose={onClose} className="w-full max-w-lg h-[calc(100dvh-4rem)] max-h-[800px]" noPadding>
      <div id="resume-card" className="flex-1 p-6 sm:p-8 bg-[var(--bg-window)] text-[var(--text-main)] overflow-y-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-[var(--primary)] mb-1">Our Story</h1>
          <p className="text-sm opacity-50 font-bold">{profile?.name || 'You'} & {coupleData?.partnerNickname || 'Partner'}</p>
          {anniversary && <p className="text-xs opacity-40 mt-1">Since {new Date(anniversary).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Days Together', value: daysTogether, icon: '📅' },
            { label: 'Messages Sent', value: totalMessages, icon: '💬' },
            { label: 'Doodles Shared', value: totalDoodles, icon: '🎨' },
            { label: 'Games Won', value: totalGames, icon: '🏆' },
            { label: 'Login Streak', value: streakData.count, icon: '🔥' },
            { label: 'Best Streak', value: streakData.best, icon: '⭐' },
          ].map(s => (
            <div key={s.label} className="retro-border p-3 text-center retro-bg-window">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold text-[var(--primary)]">{s.value}</div>
              <div className="text-[10px] font-bold uppercase opacity-50">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-[9px] font-bold text-[var(--primary)] opacity-30 uppercase tracking-widest">Generated by Attic</p>
        </div>
      </div>
      <div className="p-4 retro-border-t bg-[var(--bg-main)] shrink-0">
        <RetroButton onClick={handleDownload} className="w-full py-3 flex items-center justify-center gap-2">📥 Download as Image</RetroButton>
      </div>
    </RetroWindow>
  );
}
