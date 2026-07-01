import React, { useState } from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';
import { useGlobalSync } from '../../hooks/useSupabaseSync.js';
import { Send } from 'lucide-react';

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
               <span className={myDone ? 'text-[var(--color-game)]' : 'opacity-30'}>You: {myDone ? 'READY' : 'PENDING'}</span>
               <span className={partnerDone ? 'text-[var(--color-game)]' : 'opacity-30'}>{partnerName}: {partnerDone ? 'READY' : 'PENDING'}</span>
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
