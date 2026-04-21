import React, { useState } from 'react';
import { Routes, Route, useNavigate, Navigate, useParams } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { Play } from 'lucide-react';

import { PictionaryGame } from './PictionaryGame.jsx';
import { TicTacToe } from './TicTacToeGame.jsx';
import { MemoryGame } from './MemoryGame.jsx';
import { WordleClone } from './WordleClone.jsx';
import { Sudoku } from './SudokuGame.jsx';
import { ChessEngine } from './ChessEngine.jsx';
import { CouplesQuiz } from './CouplesQuiz.jsx';
import { SyncWatcher } from './SyncWatcher.jsx';
import { Game2048 } from './Game2048.jsx';
import { TypingRace } from './TypingRace.jsx';
import { WouldYouRather } from './WouldYouRather.jsx';
import { LoveLanguageQuiz } from '../components/Features.jsx';

export function GameCard({ title, desc, color, onClick }) {
  return (
    <div onClick={onClick} className="retro-border retro-bg-window retro-shadow-dark p-4 cursor-pointer hover:-translate-y-1 transition-transform flex flex-col h-auto min-h-[8rem] sm:min-h-[10rem] group">
      <div className="w-8 h-8 retro-border mb-2 retro-shadow-dark group-hover:scale-110 transition-transform flex-shrink-0" style={{backgroundColor: color}}></div>
      <h3 className="font-bold text-lg sm:text-xl">{title}</h3><p className="text-xs sm:text-sm opacity-80 mt-1">{desc}</p>
    </div>
  );
}

export function GameSetupWindow({ game, onStart, onBack, sfx, onShareToChat }) {
  const isTurnBased = ['tictactoe', 'chess', 'pictionary'].includes(game.id);
  const isIndependent = ['sudoku', 'memory', 'wordle', 'quiz'].includes(game.id);

  const [mode, setMode] = useState(
    game.id === 'tictactoe' ? '1v1_local' : 
    isIndependent ? 'solo' : 
    'competitive'
  );
  const [diff, setDiff] = useState('medium');
  const [category, setCategory] = useState('animals');
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [partnerJoined, setPartnerJoined] = useState(false);

  const sendInvite = () => {
    playAudio('click', sfx);
    setWaitingForPartner(true);
    if (onShareToChat) {
      onShareToChat(`🎮 I want to play ${game.title}! Join me?`);
    }
    // Simulate partner joining after 3-5s
    setTimeout(() => { setPartnerJoined(true); playAudio('win', sfx); }, 3000 + Math.random() * 2000);
  };

  const handleStart = () => {
    playAudio('click', sfx); 
    let configData = { mode, diff, category };
    if (category === 'custom') { const cw = document.getElementById('customWordInput')?.value; if(cw) configData.customWord = cw; }
    if (game.id === 'tictactoe') {
       configData.size = parseInt(category) || 3;
       configData.p1Avatar = document.getElementById('p1Avatar')?.value || 'X';
       configData.p2Avatar = document.getElementById('p2Avatar')?.value || 'O';
       configData.matchType = parseInt(document.getElementById('matchType')?.value) || 1;
    }
    if (game.id === 'memory' && !['emojis','animals','food'].includes(category)) {
       configData.category = 'emojis';
    }
    onStart(configData);
  };

  if (waitingForPartner) {
    return (
      <RetroWindow title={`${game.id}_lobby.exe`} className="w-full max-w-md h-auto" onClose={onBack}>
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-20 h-20 retro-border retro-shadow-dark bg-[var(--accent)] flex items-center justify-center text-4xl animate-pulse">
            {partnerJoined ? '✅' : '⏳'}
          </div>
          <h2 className="text-xl font-bold text-center">{game.title}</h2>
          {partnerJoined ? (
            <>
              <p className="text-sm font-bold text-[var(--primary)] animate-pulse uppercase tracking-widest">Partner joined!</p>
              <RetroButton className="py-3 px-12 text-lg" onClick={handleStart}>
                Start Game <Play size={16} className="inline ml-2"/>
              </RetroButton>
            </>
          ) : (
            <>
              <p className="text-sm font-bold opacity-70">Waiting for partner to join<span className="animate-pulse">...</span></p>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-3 h-3 rounded-full bg-[var(--secondary)] animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-3 h-3 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
              <p className="text-xs opacity-50 mt-4">Invite sent to chat</p>
              <RetroButton variant="accent" className="py-2 px-8 text-sm mt-2" onClick={() => { setWaitingForPartner(false); handleStart(); }}>
                Skip — Play Solo
              </RetroButton>
            </>
          )}
        </div>
      </RetroWindow>
    );
  }

  return (
    <RetroWindow title={`${game.id}_setup.exe`} className="w-full max-w-md h-auto max-h-[calc(100dvh-4rem)]" onClose={onBack}>
      <div className="flex flex-col gap-6">
        <h2 className="text-xl sm:text-2xl font-bold text-center border-b-2 border-dashed border-[var(--border)] pb-4">{game.title}</h2>

        {(game.id === 'pictionary' || game.id === 'wordle') && (
          <div><label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Word Category</label>
           <div className="flex flex-col gap-2">
            {game.id === 'pictionary' && <RetroButton variant={category === 'animals' ? 'primary' : 'white'} className="py-2" onClick={() => {playAudio('click',sfx); setCategory('animals')}}>Animals</RetroButton>}
            {game.id === 'pictionary' && <RetroButton variant={category === 'objects' ? 'primary' : 'white'} className="py-2" onClick={() => {playAudio('click',sfx); setCategory('objects')}}>Household Objects</RetroButton>}
            {game.id === 'pictionary' && <RetroButton variant={category === 'hard' ? 'primary' : 'white'} className="py-2" onClick={() => {playAudio('click',sfx); setCategory('hard')}}>Hard Mode</RetroButton>}
            <RetroButton variant={category === 'custom' ? 'accent' : 'white'} className="py-2" onClick={() => {playAudio('click',sfx); setCategory('custom')}}>Custom Word (P2 Guesses)</RetroButton>
           </div>
           {category === 'custom' && ( <div className="mt-2"><input type="text" id="customWordInput" placeholder="Enter custom word..." className="w-full p-2 retro-border focus:outline-none uppercase font-bold" /></div> )}
          </div>
        )}

        {game.id === 'tictactoe' && (
           <div>
             <label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Select Mode</label>
             <div className="flex gap-2 mb-4">
               <RetroButton variant={mode === '1v1_local' ? 'primary' : 'white'} className="flex-1 py-2 sm:py-3 text-sm" onClick={() => {playAudio('click',sfx); setMode('1v1_local')}}>1v1 Local</RetroButton>
               <RetroButton variant={mode === 'vs_ai' ? 'secondary' : 'white'} className="flex-1 py-2 sm:py-3 text-sm" onClick={() => {playAudio('click',sfx); setMode('vs_ai')}}>VS AI</RetroButton>
               <RetroButton variant={mode === 'memory' ? 'accent' : 'white'} className="flex-1 py-2 sm:py-3 text-sm" onClick={() => {playAudio('click',sfx); setMode('memory')}}>Memory</RetroButton>
             </div>
             {mode === 'vs_ai' && ( 
               <div className="mb-4">
                 <label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">AI Difficulty</label>
                 <div className="flex gap-2"><RetroButton variant={diff === 'easy' ? 'accent' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setDiff('easy')}}>Easy</RetroButton><RetroButton variant={diff === 'medium' ? 'accent' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setDiff('medium')}}>Medium</RetroButton><RetroButton variant={diff === 'hard' ? 'accent' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setDiff('hard')}}>Unbeatable</RetroButton></div>
               </div> 
             )}
             <div className="mb-4">
                 <label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Grid Size</label>
                 <div className="flex gap-2">
                   <RetroButton variant={category === '3' ? 'primary' : 'white'} className="flex-1 py-2" onClick={() => {playAudio('click',sfx); setCategory('3')}}>3x3</RetroButton>
                   <RetroButton variant={category === '4' ? 'primary' : 'white'} className="flex-1 py-2" onClick={() => {playAudio('click',sfx); setCategory('4')}}>4x4</RetroButton>
                   <RetroButton variant={category === '5' ? 'primary' : 'white'} className="flex-1 py-2" onClick={() => {playAudio('click',sfx); setCategory('5')}}>5x5</RetroButton>
                 </div>
             </div>
             <div className="flex gap-4">
                 <div className="flex-1">
                     <label className="font-bold opacity-70 block mb-1 text-xs">P1 Avatar</label>
                     <input type="text" id="p1Avatar" defaultValue="X" maxLength="2" className="w-full p-2 text-center retro-border focus:outline-none uppercase font-bold text-lg" />
                 </div>
                 <div className="flex-1">
                     <label className="font-bold opacity-70 block mb-1 text-xs">{mode==='vs_ai'?'AI':'P2'} Avatar</label>
                     <input type="text" id="p2Avatar" defaultValue="O" maxLength="2" className="w-full p-2 text-center retro-border focus:outline-none uppercase font-bold text-lg" />
                 </div>
             </div>
             <div className="mt-4">
                 <label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Match Type</label>
                 <select id="matchType" className="w-full p-2 retro-border retro-bg-window font-bold outline-none cursor-pointer">
                     <option value="1">Single Game</option>
                     <option value="3">Best of 3</option>
                     <option value="5">Best of 5</option>
                 </select>
             </div>
          </div>
        )}

        {game.id === 'memory' && (
         <div className="mb-4">
             <label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Deck Category</label>
             <div className="flex gap-2">
                <RetroButton variant={category === 'emojis' ? 'primary' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setCategory('emojis')}}>Emojis</RetroButton>
                <RetroButton variant={category === 'animals' ? 'primary' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setCategory('animals')}}>Animals</RetroButton>
                <RetroButton variant={category === 'food' ? 'primary' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setCategory('food')}}>Food</RetroButton>
             </div>
         </div>
        )}

        {game.id === 'pictionary' && (
          <div><label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Timer Length</label><div className="flex gap-2"><RetroButton variant={diff === '60' ? 'accent' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setDiff('60')}}>60s</RetroButton><RetroButton variant={diff === '90' ? 'accent' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setDiff('90')}}>90s</RetroButton><RetroButton variant={diff === '120' ? 'accent' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setDiff('120')}}>120s</RetroButton></div></div>
        )}

        {!['pictionary', 'quiz', 'tictactoe'].includes(game.id) && (
          <div><label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Select Difficulty</label><div className="flex gap-2">{['easy', 'medium', 'hard'].map(d => ( <RetroButton key={d} variant={diff === d ? 'accent' : 'white'} className="flex-1 py-2 text-xs sm:text-sm" onClick={() => {playAudio('click',sfx); setDiff(d)}}>{d}</RetroButton> ))}</div></div>
        )}

        {!isIndependent && !isTurnBased && (
          <div><label className="font-bold opacity-70 block mb-2 text-sm sm:text-base">Select Mode</label><div className="flex gap-2"><RetroButton variant={mode === 'competitive' ? 'primary' : 'white'} className="flex-1 py-2 sm:py-3 text-sm sm:text-base" onClick={() => {playAudio('click',sfx); setMode('competitive')}}>Competitive</RetroButton>{game.id !== 'chess' && <RetroButton variant={mode === 'coop' ? 'secondary' : 'white'} className="flex-1 py-2 sm:py-3 text-sm sm:text-base" onClick={() => {playAudio('click',sfx); setMode('coop')}}>Co-op</RetroButton>}</div></div>
        )}

        {isIndependent && (
          <div className="bg-[var(--accent)] retro-border p-3 text-xs font-bold opacity-90 text-center uppercase tracking-widest">
            ⏱ Solo race — time tracked, no turns
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <RetroButton className="flex-1 py-3 sm:py-4 text-base sm:text-lg" onClick={handleStart}>
            Solo Play <Play size={16} className="inline ml-2"/>
          </RetroButton>
          <RetroButton variant="secondary" className="flex-1 py-3 sm:py-4 text-base sm:text-lg" onClick={sendInvite}>
            Invite Partner
          </RetroButton>
        </div>
      </div>
    </RetroWindow>
  );
}



export function ActivitiesHub({ onClose, scores, setScores, sfx, setConfetti, onShareToChat, profile }) {
  const [setupGame, setSetupGame] = useLocalStorage('hub_setup', null); 
  const [activeConfig, setActiveConfig] = useLocalStorage('hub_active', null);
  const navigate = useNavigate();

  const handleWin = () => { playAudio('win', sfx); setConfetti(true); setTimeout(() => setConfetti(false), 4000); };

  const closeGame = () => {
    setActiveConfig(null);
    setSetupGame(null);
    navigate('/activities');
  };

  const launch = (id, title) => { 
    playAudio('click', sfx); 
    navigate(`/activities/${id}`);
    if(id === 'sync'){ setActiveConfig({ id: 'sync' }); return; } 
    setSetupGame({id, title}); 
  };

  const HubMenu = () => (
    <RetroWindow title="activities_hub.exe" onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <GameCard title="Pictionary" desc="Draw and guess the hidden word." color="#ffb6b9" onClick={() => launch('pictionary', 'Pictionary')} />
        <GameCard title="Tic-Tac-Toe" desc="Classic 3x3. Try Memory Fading mode." color="var(--primary)" onClick={() => launch('tictactoe', 'Tic-Tac-Toe')} />
        <GameCard title="Memory Match" desc="Flip cards and find pairs." color="var(--secondary)" onClick={() => launch('memory', 'Memory Match')} />
        <GameCard title="Retro Word" desc="Guess the hidden word." color="var(--accent)" onClick={() => launch('wordle', 'Retro Word')} />
        <GameCard title="Sudoku" desc="Logic puzzles. Race or Share." color="#ffb6b9" onClick={() => launch('sudoku', 'Sudoku')} />
        <GameCard title="Chess" desc="Full rules engine. Standard or Sandbox." color="#a3c4f3" onClick={() => launch('chess', 'Chess')} />
        <GameCard title="Couples Quiz" desc="How well do you know them?" color="#f9e2af" onClick={() => launch('quiz', 'Couples Quiz')} />
        <GameCard title="2048" desc="Merge tiles. Reach 2048!" color="#a855f7" onClick={() => launch('2048', '2048')} />
        <GameCard title="Typing Race" desc="Type fast. Beat your WPM." color="#14b8a6" onClick={() => launch('typing', 'Typing Race')} />
        <GameCard title="Would You Rather" desc="See if you match!" color="#ec4899" onClick={() => launch('wyr', 'Would You Rather')} />
        <GameCard title="Love Language" desc="Discover your love style." color="#f472b6" onClick={() => launch('lovelang', 'Love Language Quiz')} />
        <GameCard title="Sync Watcher" desc="Watch YT together." color="#c1a3ff" onClick={() => launch('sync', 'Sync Watcher')} />
      </div>
    </RetroWindow>
  );

  const GameRenderer = () => {
    const { gameId } = useParams();

    if (activeConfig && activeConfig.id === gameId) {
      const props = { config: activeConfig, setScores, onBack: closeGame, sfx, onWin: handleWin, onShareToChat, profile };
      if (activeConfig.id === 'pictionary') return <PictionaryGame {...props} />;
      if (activeConfig.id === 'tictactoe') return <TicTacToe {...props} />;
      if (activeConfig.id === 'memory') return <MemoryGame {...props} />;
      if (activeConfig.id === 'wordle') return <WordleClone {...props} />;
      if (activeConfig.id === 'sudoku') return <Sudoku {...props} />;
      if (activeConfig.id === 'chess') return <ChessEngine {...props} />; 
      if (activeConfig.id === 'quiz') return <CouplesQuiz {...props} />;
      if (activeConfig.id === '2048') return <Game2048 {...props} />;
      if (activeConfig.id === 'typing') return <TypingRace {...props} />;
      if (activeConfig.id === 'wyr') return <WouldYouRather {...props} />;
      if (activeConfig.id === 'lovelang') return <LoveLanguageQuiz {...props} />;
      if (activeConfig.id === 'sync') return <SyncWatcher config={activeConfig} onBack={closeGame} sfx={sfx} />;
    }

    if (setupGame && setupGame.id === gameId) {
      return <GameSetupWindow game={setupGame} sfx={sfx} onShareToChat={onShareToChat} onStart={(config) => { setActiveConfig({ id: setupGame.id, ...config }); setSetupGame(null); }} onBack={closeGame} />;
    }

    // Fallback if they hit a direct link but have no setup/config
    const fallbackTitles = {
      'pictionary': 'Pictionary', 'tictactoe': 'Tic-Tac-Toe', 'memory': 'Memory Match', 'wordle': 'Retro Word',
      'sudoku': 'Sudoku', 'chess': 'Chess', 'quiz': 'Couples Quiz', '2048': '2048', 'typing': 'Typing Race',
      'wyr': 'Would You Rather', 'lovelang': 'Love Language Quiz'
    };
    if (fallbackTitles[gameId]) {
      setSetupGame({ id: gameId, title: fallbackTitles[gameId] });
      return null;
    }

    return <Navigate to="/activities" replace />;
  };

  return (
    <Routes>
      <Route path="/" element={<HubMenu />} />
      <Route path="/:gameId" element={<GameRenderer />} />
    </Routes>
  );
}
