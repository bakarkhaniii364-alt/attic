import React, { useState } from 'react';
import { Routes, Route, useNavigate, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { RetroWindow, RetroButton, AppIcon } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { Play } from 'lucide-react';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

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
    <div onClick={onClick} className="retro-border retro-bg-window retro-shadow-dark p-4 cursor-pointer transition-transform flex flex-col h-auto min-h-[8rem] sm:min-h-[10rem] group">
      <div className="w-8 h-8 retro-border mb-2 retro-shadow-dark group-hover:scale-110 transition-transform flex-shrink-0" style={{backgroundColor: color}}></div>
      <h3 className="font-bold text-lg sm:text-xl">{title}</h3><p className="text-xs sm:text-sm opacity-80 mt-1">{desc}</p>
    </div>
  );
}

export function GameSetupWindow({ game, onStart, onBack, sfx, onShareToChat, userId }) {
  const isTurnBased = ['tictactoe', 'chess', 'pictionary'].includes(game.id);
  const isIndependent = ['sudoku', 'memory', 'wordle', 'quiz'].includes(game.id);
  const [lobbyState, setLobbyState] = useGlobalSync('game_lobby', { status: 'idle' });

  const [mode, setMode] = useState(
    game.id === 'tictactoe' ? '1v1_local' : 
    isIndependent ? 'solo' : 
    'competitive'
  );
  const [diff, setDiff] = useState('medium');
  const [category, setCategory] = useState('animals');

  const sendInvite = () => {
    playAudio('click', sfx);
    const inviteData = { 
      status: 'inviting', 
      gameId: game.id, 
      gameTitle: game.title, 
      inviterId: userId, 
      timestamp: Date.now() 
    };
    setLobbyState(inviteData);
    if (onShareToChat) {
      onShareToChat(`🎮 I want to play ${game.title}! Join me?`, null, inviteData);
    }
  };

  const handleStart = () => {
    playAudio('click', sfx); 
    // Reset lobby state on start
    setLobbyState({ status: 'idle' });
    
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

  if (lobbyState.status === 'inviting' || lobbyState.status === 'joined') {
    return (
      <div className="relative retro-bg-window retro-border retro-shadow-dark p-2 flex flex-col items-center gap-3 w-full max-w-[400px] mx-auto animate-in zoom-in-95 duration-300">
        <div className="w-full bg-[var(--border)] text-white px-3 py-1 font-bold text-[10px] uppercase flex justify-between items-center">
          <span>activity_lobby.exe</span>
          <button onClick={() => { setLobbyState({ status: 'idle' }); onBack(); }} className="hover:bg-red-500 px-1 transition-colors border border-transparent hover:border-white/50">X</button>
        </div>
        <div className="flex flex-col items-center gap-6 py-8 w-full">
            <div className="w-24 h-24 retro-border retro-shadow-dark bg-[var(--accent)] flex items-center justify-center text-5xl relative">
              {lobbyState.status === 'joined' ? '🎮' : '⏳'}
              {lobbyState.status === 'joined' && <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1 retro-border text-[8px] font-black uppercase">READY</div>}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black italic tracking-tighter">{game.title}</h2>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Status: {lobbyState.status}</p>
            </div>

            {lobbyState.status === 'joined' ? (
              <div className="space-y-4 w-full px-8">
                <div className="bg-green-500/10 border-2 border-dashed border-green-500 p-3 text-center">
                  <p className="text-xs font-black text-green-700 uppercase tracking-widest animate-pulse">Partner is in the lobby!</p>
                </div>
                <RetroButton className="w-full py-4 text-lg" onClick={handleStart}>
                  Launch Activity <Play size={18} className="inline ml-2"/>
                </RetroButton>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xs font-bold opacity-70 animate-pulse uppercase tracking-[0.2em]">Waiting for partner...</p>
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-[var(--primary)] animate-bounce" style={{animationDelay: '0ms'}}></div>
                  <div className="w-3 h-3 bg-[var(--secondary)] animate-bounce" style={{animationDelay: '150ms'}}></div>
                  <div className="w-3 h-3 bg-[var(--primary)] animate-bounce" style={{animationDelay: '300ms'}}></div>
                </div>
                <p className="text-[10px] opacity-40 text-center max-w-[200px] mt-4 uppercase">An invite has been sent to the chat.</p>
                <RetroButton variant="white" className="py-2 px-8 text-[10px] opacity-60 hover:opacity-100 uppercase mt-4" onClick={() => { setLobbyState({ status: 'idle' }); handleStart(); }}>
                  Skip Lobby — Play Solo
                </RetroButton>
              </div>
            )}
        </div>
      </div>
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

const GAMES_LIST = [
  { id: 'pictionary', title: 'Pictionary', icon: '🎨', color: '#ffb6b9', desc: 'Draw and guess the hidden word.' },
  { id: 'tictactoe', title: 'Tic-Tac-Toe', icon: '❌', color: 'var(--primary)', desc: 'Classic 3x3. Try Memory Fading mode.' },
  { id: 'memory', title: 'Memory Match', icon: '🃏', color: 'var(--secondary)', desc: 'Flip cards and find pairs.' },
  { id: 'wordle', title: 'Retro Word', icon: '📝', color: 'var(--accent)', desc: 'Guess the hidden word.' },
  { id: 'sudoku', title: 'Sudoku', icon: '🔢', color: '#ffb6b9', desc: 'Logic puzzles. Race or Share.' },
  { id: 'chess', title: 'Chess', icon: '♟️', color: '#a3c4f3', desc: 'Full rules engine. Standard or Sandbox.' },
  { id: 'quiz', title: 'Couples Quiz', icon: '❓', color: '#f9e2af', desc: 'How well do you know them?' },
  { id: '2048', title: '2048', icon: '🎲', color: '#a855f7', desc: 'Merge tiles. Reach 2048!' },
  { id: 'typing', title: 'Typing Race', icon: '⌨️', color: '#14b8a6', desc: 'Type fast. Beat your WPM.' },
  { id: 'wyr', title: 'Would You Rather', icon: '⚖️', color: '#ec4899', desc: 'See if you match!' },
  { id: 'lovelang', title: 'Love Language', icon: '💖', color: '#f472b6', desc: 'Discover your love style.' },
  { id: 'sync', title: 'Sync Watcher', icon: '📺', color: '#c1a3ff', desc: 'Watch YT together.' }
];

export function ActivitiesHub({ onClose, scores, setScores, sfx, setConfetti, onShareToChat, onSaveToScrapbook, profile, userId, partnerId, pictionaryState, setPictionaryState }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleWin = () => { playAudio('win', sfx); setConfetti(true); setTimeout(() => setConfetti(false), 4000); };

  const closeGame = () => {
    navigate('/activities');
  };

  const launch = (id) => { 
    playAudio('click', sfx); 
    navigate(`/activities/${id}`);
  };

  const HubMenu = () => (
    <RetroWindow 
      title="activities_hub.exe" 
      onClose={onClose} 
      className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col"
      noPadding
    >
      {/* Custom Window Header (Burger + Title + Close) */}
      <div className="bg-[var(--accent)] border-b-2 border-[var(--border)] p-1.5 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-[3px] opacity-80 cursor-pointer">
            <div className="w-4 h-[2px] bg-[var(--border)]"></div>
            <div className="w-4 h-[2px] bg-[var(--border)]"></div>
            <div className="w-4 h-[2px] bg-[var(--border)]"></div>
          </div>
          <span className="font-bold text-xs lowercase tracking-wider">activities_hub.exe</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 bg-[#ef4444] text-white retro-border flex items-center justify-center font-bold text-xs hover:brightness-110 active:translate-y-0.5">×</button>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#fdf2e9]/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES_LIST.map(game => (
            <button 
              key={game.id} 
              onClick={() => launch(game.id)}
              className="group bg-white border-2 border-[var(--border)] shadow-[6px_6px_0px_0px_var(--border)] p-5 flex flex-col items-start text-left hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_var(--border)] transition-all active:scale-[0.98]"
            >
              {/* Category Color Square */}
              <div 
                className="w-8 h-8 border-2 border-[var(--border)] shadow-[2px_2px_0px_0px_var(--border)] mb-4 shrink-0"
                style={{ backgroundColor: game.color }}
              ></div>
              
              <h3 className="text-xl font-black mb-1 leading-none tracking-tighter lowercase">
                {game.title}
              </h3>
              
              <p className="text-[11px] font-bold opacity-60 leading-relaxed uppercase tracking-tight">
                {game.desc}
              </p>
            </button>
          ))}
        </div>
      </div>
    </RetroWindow>
  );

  const GameRenderer = () => {
    const { gameId } = useParams();
    const isActive = searchParams.get('active') === 'true';
    const [lobbyState, setLobbyState] = useGlobalSync('game_lobby', { status: 'idle' });
    
    const fallbackTitles = {
      'pictionary': 'Pictionary', 'tictactoe': 'Tic-Tac-Toe', 'memory': 'Memory Match', 'wordle': 'Retro Word',
      'sudoku': 'Sudoku', 'chess': 'Chess', 'quiz': 'Couples Quiz', '2048': '2048', 'typing': 'Typing Race',
      'wyr': 'Would You Rather', 'lovelang': 'Love Language Quiz', 'sync': 'Sync Watcher'
    };

    // Auto-launch if lobby status becomes 'launching' or similar? 
    // For now, simple direct navigation.
    React.useEffect(() => {
      if (gameId === 'sync' && !isActive) {
        setSearchParams({ active: 'true' });
      }
    }, [gameId, isActive, setSearchParams]);

    if (isActive) {
      const config = { id: gameId };
      searchParams.forEach((value, key) => {
        if (key !== 'active') config[key] = value;
      });

      const props = { config, setScores, onBack: closeGame, sfx, onWin: handleWin, onShareToChat, onSaveToScrapbook, profile, userId, partnerId, pictionaryState, setPictionaryState };
      
      if (gameId === 'pictionary') return <PictionaryGame {...props} />;
      if (gameId === 'tictactoe') return <TicTacToe {...props} />;
      if (gameId === 'memory') return <MemoryGame {...props} />;
      if (gameId === 'wordle') return <WordleClone {...props} />;
      if (gameId === 'sudoku') return <Sudoku {...props} />;
      if (gameId === 'chess') return <ChessEngine {...props} />; 
      if (gameId === 'quiz') return <CouplesQuiz {...props} />;
      if (gameId === '2048') return <Game2048 {...props} />;
      if (gameId === 'typing') return <TypingRace {...props} />;
      if (gameId === 'wyr') return <WouldYouRather {...props} />;
      if (gameId === 'lovelang') return <LoveLanguageQuiz {...props} />;
      if (gameId === 'sync') return <SyncWatcher config={config} onBack={closeGame} sfx={sfx} />;
    }

    if (fallbackTitles[gameId]) {
      if (gameId === 'sync') return null;

      return (
        <GameSetupWindow 
          game={{ id: gameId, title: fallbackTitles[gameId] }} 
          sfx={sfx} 
          onShareToChat={onShareToChat} 
          userId={userId}
          onStart={(config) => {
            const newParams = new URLSearchParams();
            newParams.set('active', 'true');
            Object.entries(config).forEach(([k, v]) => newParams.set(k, v));
            setSearchParams(newParams);
          }} 
          onBack={closeGame} 
        />
      );
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
