import React, { useState } from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';
import { Heart } from 'lucide-react';

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
