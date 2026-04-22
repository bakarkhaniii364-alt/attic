import React, { useState } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { Heart } from 'lucide-react';

const QUESTIONS = [
  { q: "Would you rather have a picnic on the beach or a candlelit dinner at home?", a: "🏖️ Beach Picnic", b: "🕯️ Dinner at Home" },
  { q: "Would you rather receive a handwritten letter or a surprise gift?", a: "💌 Letter", b: "🎁 Gift" },
  { q: "Would you rather travel the world together or build your dream home?", a: "✈️ Travel", b: "🏡 Dream Home" },
  { q: "Would you rather have breakfast in bed or sunset cocktails?", a: "🥞 Breakfast", b: "🍹 Sunset" },
  { q: "Would you rather stargaze or dance in the rain?", a: "⭐ Stargaze", b: "🌧️ Dance" },
  { q: "Would you rather cook together or order takeout?", a: "👨‍🍳 Cook", b: "📦 Takeout" },
  { q: "Would you rather have matching tattoos or matching outfits?", a: "🎨 Tattoos", b: "👗 Outfits" },
  { q: "Would you rather go on a road trip or a cruise?", a: "🚗 Road Trip", b: "🚢 Cruise" },
  { q: "Would you rather share one dessert or have your own?", a: "🍰 Share", b: "🧁 Own" },
  { q: "Would you rather watch sunrise or sunset?", a: "🌅 Sunrise", b: "🌇 Sunset" },
  { q: "Would you rather have a pet cat or a pet dog together?", a: "🐱 Cat", b: "🐶 Dog" },
  { q: "Would you rather re-live your first date or plan your dream date?", a: "🔄 First Date", b: "💭 Dream Date" },
  { q: "Would you rather slow dance or have a pillow fight?", a: "💃 Slow Dance", b: "🛏️ Pillow Fight" },
  { q: "Would you rather live by the mountains or by the ocean?", a: "⛰️ Mountains", b: "🌊 Ocean" },
  { q: "Would you rather give up coffee or give up sweets?", a: "☕ Coffee", b: "🍬 Sweets" },
];

export function WouldYouRather({ config, onBack, sfx, onShareToChat, profile }) {
  const [idx, setIdx] = useState(0);
  const [myAnswers, setMyAnswers] = useState([]);
  const [partnerAnswers] = useState(() => QUESTIONS.map(() => Math.random() > 0.5 ? 'a' : 'b'));
  const [showResult, setShowResult] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const current = QUESTIONS[idx];
  const myAnswer = myAnswers[idx];

  const answer = (choice) => { playAudio('click', sfx); const newA = [...myAnswers]; newA[idx] = choice; setMyAnswers(newA); setShowResult(true); };
  const next = () => { playAudio('click', sfx); setShowResult(false); if (idx + 1 >= QUESTIONS.length) { setShowOverlay(true); return; } setIdx(idx + 1); };

  const matchCount = myAnswers.filter((a, i) => a === partnerAnswers[i]).length;
  const matchPct = myAnswers.length > 0 ? Math.round((matchCount / myAnswers.length) * 100) : 0;

  if (showOverlay) {
    return <ShareOutcomeOverlay gameName="Would You Rather" stats={{ "Questions": QUESTIONS.length, "Matches": matchCount, "Match %": `${matchPct}%`, "Verdict": matchPct > 70 ? '💕 Perfect Match!' : matchPct > 40 ? '💛 Good Match' : '🌶️ Opposites Attract!' }} onClose={onBack} onShareToChat={onShareToChat} sfx={sfx} profile={profile} partnerNickname={profile?.partnerNickname} />;
  }

  return (
    <RetroWindow title="would_you_rather.exe" className="w-full max-w-xl h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 px-4 flex justify-between font-bold text-sm">
        <span>Q {idx + 1}/{QUESTIONS.length}</span>
        <span className="flex items-center gap-1"><Heart size={14}/> {matchPct}% match</span>
      </div>
      <div className="w-full h-2 bg-[var(--bg-main)]"><div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${((idx + 1) / QUESTIONS.length) * 100}%` }}></div></div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <h2 className="text-lg sm:text-xl font-bold text-center leading-relaxed">{current.q}</h2>
        {!showResult ? (
          <div className="flex flex-col gap-3 w-full">
            <RetroButton onClick={() => answer('a')} className="py-4 text-base w-full">{current.a}</RetroButton>
            <RetroButton variant="secondary" onClick={() => answer('b')} className="py-4 text-base w-full">{current.b}</RetroButton>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-300">
            <div className={`text-2xl font-bold ${myAnswer === partnerAnswers[idx] ? 'text-[var(--primary)]' : 'text-[var(--secondary)]'}`}>
              {myAnswer === partnerAnswers[idx] ? '💕 Match!' : '🌶️ Different!'}
            </div>
            <p className="text-sm opacity-60">Partner chose: {partnerAnswers[idx] === 'a' ? current.a : current.b}</p>
            <RetroButton onClick={next} className="px-8 py-3">{idx + 1 >= QUESTIONS.length ? 'See Results' : 'Next →'}</RetroButton>
          </div>
        )}
      </div>
    </RetroWindow>
  );
}
