import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { Keyboard } from 'lucide-react';

const PASSAGES = [
  "I love you without knowing how, or when, or from where. I love you simply, without problems or pride.",
  "Whatever our souls are made of, his and mine are the same. He's more myself than I am.",
  "I have died every day waiting for you. Darling, don't be afraid I have loved you for a thousand years.",
  "You have bewitched me, body and soul, and I love, I love, I love you. I never wish to be parted from you.",
  "I saw that you were perfect, and so I loved you. Then I saw that you were not perfect and I loved you even more.",
  "In all the world, there is no heart for me like yours. In all the world, there is no love for you like mine.",
  "You are my heart, my life, my one and only thought. I love you more than words can express.",
  "Grow old along with me! The best is yet to be, the last of life, for which the first was made.",
];

export function TypingRace({ config, setScores, onBack, sfx, onWin, onShareToChat, profile }) {
  const [passage] = useState(() => PASSAGES[Math.floor(Math.random() * PASSAGES.length)]);
  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [errors, setErrors] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleInput = useCallback((e) => {
    const val = e.target.value;
    if (!started) { setStarted(true); setStartTime(Date.now()); }
    
    // Count errors
    let newErrors = 0;
    for (let i = 0; i < val.length; i++) { if (val[i] !== passage[i]) newErrors++; }
    setErrors(newErrors);
    setTyped(val);

    if (val.length === passage.length) {
      const end = Date.now();
      setEndTime(end);
      playAudio('win', sfx);
      onWin();
      setTimeout(() => setShowOverlay(true), 500);
    }
  }, [passage, started, sfx, onWin]);

  const wpm = endTime && startTime ? Math.round((passage.split(' ').length / ((endTime - startTime) / 60000))) : (started && startTime ? Math.round((typed.split(' ').length / ((Date.now() - startTime) / 60000))) : 0);
  const accuracy = typed.length > 0 ? Math.round(((typed.length - errors) / typed.length) * 100) : 100;
  const progress = Math.round((typed.length / passage.length) * 100);

  const restart = () => { setTyped(''); setStarted(false); setStartTime(null); setEndTime(null); setErrors(0); setShowOverlay(false); inputRef.current?.focus(); };

  if (showOverlay) {
    return <ShareOutcomeOverlay isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")} gameName="Typing Race" stats={{ WPM: wpm, Accuracy: `${accuracy}%`, Time: `${((endTime - startTime) / 1000).toFixed(1)}s` }} onClose={() => { restart(); onBack(); }} onRematch={restart} onShareToChat={onShareToChat} sfx={sfx} profile={profile} partnerNickname={profile?.partnerNickname} />;
  }

  return (
    <RetroWindow title="typing_race.exe" className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 px-4 flex justify-between font-bold text-sm">
        <span><Keyboard size={14} className="inline mr-1"/> WPM: {wpm}</span>
        <span>Accuracy: {accuracy}%</span>
      </div>
      <div className="w-full h-2 bg-[var(--bg-main)]"><div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }}></div></div>
      <div className="flex-1 p-6 flex flex-col gap-6">
        <div className="retro-border retro-shadow-dark p-6 bg-[var(--bg-main)] font-mono text-lg sm:text-xl leading-relaxed tracking-wide select-none">
          {passage.split('').map((char, i) => {
            let color = 'opacity-40';
            if (i < typed.length) { color = typed[i] === char ? 'text-[var(--primary)] font-bold' : 'text-red-500 bg-red-100 font-bold'; }
            else if (i === typed.length) { color = 'bg-[var(--accent)] text-[var(--text-main)] font-bold animate-pulse'; }
            return <span key={i} className={color}>{char}</span>;
          })}
        </div>
        <input 
          ref={inputRef} 
          type="text" 
          value={typed} 
          onChange={handleInput} 
          disabled={!!endTime} 
          autoFocus 
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          autoComplete="off"
          className="w-full p-4 retro-border retro-bg-window font-mono text-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" 
          placeholder={started ? '' : 'Start typing...'} 
        />
        <div className="flex justify-between text-sm font-bold opacity-60">
          <span>Progress: {progress}%</span>
          <span>Errors: {errors}</span>
        </div>
      </div>
    </RetroWindow>
  );
}
