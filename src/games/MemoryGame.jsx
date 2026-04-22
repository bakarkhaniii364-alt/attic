import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { Star, RefreshCw, Eye, Lightbulb } from 'lucide-react';

const DECKS = {
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔'],
    animals: ['🦅','🦆','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🐢'],
    food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝']
};

export function MemoryGame({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, userId }) {
  const [cards, setCards] = useState([]); 
  const [flipped, setFlipped] = useState([]); 
  const [solved, setSolved] = useState([]); 
  const [disabled, setDisabled] = useState(false); 
  const [turn, setTurn] = useState(1); 
  const [p1Score, setP1Score] = useState(0); 
  const [p2Score, setP2Score] = useState(0);
  
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  
  const [peekAvailable, setPeekAvailable] = useState(2);
  const [flashlightMode, setFlashlightMode] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [combo, setCombo] = useState(1);
  const [gameOverOverlay, setGameOverOverlay] = useState(false);

  useEffect(() => { shuffleCards(); }, [config.diff, config.category]);
  
  useEffect(() => {
     let interval = null;
     if (timerActive) interval = setInterval(() => setTime(t => t+1), 1000);
     else clearInterval(interval);
     return () => clearInterval(interval);
  }, [timerActive]);

  const shuffleCards = () => { 
      const deck = DECKS[config.category] || DECKS.emojis;
      const pairCount = config.diff === 'easy' ? 8 : config.diff === 'medium' ? 12 : 16;
      let selectedDeck = [...deck].sort(() => Math.random() - 0.5).slice(0, pairCount);
      const shuffled = [...selectedDeck, ...selectedDeck].sort(() => Math.random() - 0.5).map((emoji, id) => ({ id, emoji })); 
      setCards(shuffled); setFlipped([]); setSolved([]); setTurn(1); setP1Score(0); setP2Score(0); setMoves(0); setTime(0); setTimerActive(true); setCombo(1); setPeekAvailable(2); setGameOverOverlay(false);
  };

  const handleCardClick = (index) => {
    if (disabled || flipped.includes(index) || solved.includes(index)) return; 
    playAudio('click', sfx);
    const newFlipped = [...flipped, index]; 
    setFlipped(newFlipped);
    
    if (newFlipped.length === 2) {
      setMoves(m => m+1);
      setDisabled(true); 
      const match = cards[newFlipped[0]].emoji === cards[newFlipped[1]].emoji;
      
      setTimeout(() => {
        if (match) {
          playAudio('win', sfx);
          const newSolved = [...solved, ...newFlipped]; 
          setSolved(newSolved);
          
          let pointsEarned = 1 * combo;
          if (config.mode === 'competitive') { 
              turn === 1 ? setP1Score(p=>p+pointsEarned) : setP2Score(p=>p+pointsEarned); 
          }
          setCombo(c => c+1);
          
            if (newSolved.length === cards.length) { 
              setTimerActive(false);
            setScores(prev => incrementUserScore(prev, userId, 'memory', 1)); 
              onWin(); 
              setTimeout(() => setGameOverOverlay(true), 1500);
          }
        } else { 
            setCombo(1);
            if (config.mode === 'competitive') setTurn(turn === 1 ? 2 : 1); 
        }
        setFlipped([]); setDisabled(false);
      }, 800);
    }
  };

  const usePeek = () => {
      if (peekAvailable <= 0 || disabled) return;
      playAudio('click', sfx);
      setPeekAvailable(p => p - 1);
      const unsolved = cards.map((_, i) => i).filter(i => !solved.includes(i));
      setFlipped(unsolved);
      setDisabled(true);
      setTimeout(() => { setFlipped([]); setDisabled(false); }, 1000);
  };

  const handleMouseMove = (e) => {
      if (!flashlightMode) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  if (gameOverOverlay) {
      const stats = {
          "Time": `${Math.floor(time/60)}:${(time%60).toString().padStart(2, '0')}`,
          "Total Moves": moves,
          "Max Combo": `${combo}x`
      };
      if (config.mode === 'competitive') { stats["Final Score"] = `${p1Score} - ${p2Score}`; stats.Winner = p1Score > p2Score ? 'P1 Wins!' : p2Score > p1Score ? 'P2 Wins!' : 'Draw!'; }
      else { stats.Result = "Team Victory!"; }
      return <ShareOutcomeOverlay gameName={`Memory Match`} stats={stats} onClose={() => {shuffleCards(); onBack();}} onShareToChat={onShareToChat} onSaveToScrapbook={onSaveToScrapbook} sfx={sfx} profile={profile} partnerNickname={profile?.partnerNickname} onRematch={shuffleCards} />;
  }

  const gridCols = config.diff === 'easy' ? 'grid-cols-4' : config.diff === 'medium' ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-4 sm:grid-cols-8';
  const cardSize = config.diff === 'easy' ? 'w-16 h-20 sm:w-20 sm:h-24 text-3xl sm:text-4xl' : config.diff === 'medium' ? 'w-12 h-16 sm:w-16 sm:h-20 text-2xl sm:text-3xl' : 'w-10 h-14 sm:w-14 sm:h-16 text-xl sm:text-2xl';

  return (
    <RetroWindow title={`memory_${config.mode || 'solo'}.exe`} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[850px] relative" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold px-4 z-10 relative">
         <span>⏱️ {Math.floor(time/60)}:{(time%60).toString().padStart(2, '0')}</span>
         <span className="opacity-70 text-sm">Moves: {moves}</span>
      </div>
      
      <div className="p-2 retro-bg-accent retro-border-b flex justify-between items-center z-10 relative">
          <div className="flex gap-2">
              <button disabled={peekAvailable<=0 || disabled} onClick={usePeek} className="text-xs retro-bg-window text-[var(--text-main)] p-1 px-2 retro-border rounded flex items-center gap-1 disabled:opacity-50"><Eye size={12}/> Peek ({peekAvailable})</button>
              <button onClick={() => setFlashlightMode(f=>!f)} className={`text-xs retro-bg-window text-[var(--text-main)] p-1 px-2 retro-border rounded flex items-center gap-1 ${flashlightMode ? 'ring-2 ring-yellow-400' : ''}`}><Lightbulb size={12}/> Flashlight</button>
          </div>
          <div className="font-bold text-[var(--primary)] mr-2 flex items-center gap-1">Combo: {combo}x {combo>1 && <span className="animate-bounce">🔥</span>}</div>
      </div>

      <div className="flex flex-col items-center pb-8 pt-4 flex-1 overflow-y-auto relative" onMouseMove={handleMouseMove} onTouchMove={(e)=>handleMouseMove(e.touches[0])}>
        
        {flashlightMode && (
             <div className="absolute inset-0 pointer-events-none z-20" style={{
                 background: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, #000000ee 100%)`, 
                 opacity: 0.95
             }}></div>
        )}

        <div className={`flex w-full justify-between items-center px-4 sm:px-8 mb-6 font-bold text-xs sm:text-base z-30 ${flashlightMode ? 'opacity-40' : 'opacity-100'}`}>
            {config.mode === 'competitive' ? (
                <>
                <div className={`p-2 px-4 transition-all duration-300 ${turn === 1 ? 'retro-bg-primary scale-110' : 'retro-bg-window opacity-70'} retro-border`}>P1: {p1Score}</div>
                <div className={`p-2 px-4 transition-all duration-300 ${turn === 2 ? 'retro-bg-secondary scale-110' : 'retro-bg-window opacity-70'} retro-border`}>P2: {p2Score}</div>
                </>
            ) : ( <div className="text-center w-full opacity-60">Team Effort</div>)}
        </div>
        
        <div className={`grid ${gridCols} gap-2 sm:gap-3 z-10 px-2`}>
          {cards.map((card, i) => { 
            const isFlipped = flipped.includes(i) || solved.includes(i); 
            return (
                <div key={i} onClick={() => handleCardClick(i)} className={`${cardSize} cursor-pointer`} style={{ perspective: '600px' }}>
                    <div className={`relative w-full h-full preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''} ${solved.includes(i) ? 'opacity-40 grayscale' : ''}`}>
                        {/* FRONT — card back (star pattern, visible when NOT flipped) */}
                        <div className="absolute inset-0 backface-hidden retro-border retro-shadow-dark flex items-center justify-center hover:-translate-y-1 transition-transform" style={{ backgroundColor: 'var(--secondary)' }}>
                            <div className="absolute inset-2 border-2 border-dashed opacity-30 rounded-sm" style={{ borderColor: 'var(--bg-window)' }}></div>
                            <Star size={24} style={{ color: 'var(--bg-window)', opacity: 0.6 }}/>
                        </div>
                        {/* BACK — card face (emoji, visible when flipped) */}
                        <div className="absolute inset-0 backface-hidden rotate-y-180 retro-border flex items-center justify-center" style={{ backgroundColor: 'var(--bg-window)' }}>
                            <span>{card.emoji}</span>
                        </div>
                    </div>
                </div>
            ); 
          })}
        </div>
        <RetroButton className="mt-8 px-6 sm:px-8 py-3 text-sm sm:text-base z-30 relative" onClick={() => {playAudio('click', sfx); shuffleCards()}}><RefreshCw size={16} className="inline mr-2" /> restart memory</RetroButton>
      </div>

    </RetroWindow>
  );
}
