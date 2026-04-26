import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gamepad2, ArrowLeft, Users, Loader } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

// Games
import { TicTacToe } from './TicTacToeGame.jsx';
import { PictionaryGame } from './PictionaryGame.jsx';
import { MemoryGame } from './MemoryGame.jsx';
import { WordleClone } from './WordleClone.jsx';
import { Sudoku } from './SudokuGame.jsx';
import { ChessEngine } from './ChessEngine.jsx';
import { CouplesQuiz } from './CouplesQuiz.jsx';
import { Game2048 } from './Game2048.jsx';
import { TypingRace } from './TypingRace.jsx';
import { WouldYouRather } from './WouldYouRather.jsx';

export function ActivitiesHub({ onClose, scores, setScores, sfx, setConfetti, onShareToChat, profile, userId, partnerId, pictionaryState, setPictionaryState, onSaveToScrapbook }) {
  const { '*': gameRoute } = useParams();
  const navigate = useNavigate();
  
  // Unified Lobby State
  const [lobbyState, setLobbyState] = useGlobalSync('arcade_lobby', { players: [], gameId: null, status: 'waiting' });

  const handleWin = () => { 
    if (sfx) {
      const winAudio = new Audio('/assets/win.mp3');
      winAudio.volume = 0.5;
      winAudio.play().catch(e => console.log('SFX block'));
    }
    setConfetti(true); 
    setTimeout(() => setConfetti(false), 4000); 
  };

  // Join Lobby on Mount
  useEffect(() => {
    if (gameRoute && gameRoute !== '') {
      setLobbyState(prev => {
        const players = prev.players || [];
        if (!players.includes(userId)) {
          return { ...prev, gameId: gameRoute, players: [...players, userId], status: players.length + 1 >= 2 ? 'ready' : 'waiting' };
        }
        return prev;
      });
    }
  }, [gameRoute, userId, setLobbyState]);

  // Leave Lobby on Unmount
  useEffect(() => {
    return () => {
      setLobbyState(prev => {
        if (!prev) return { players: [], gameId: null, status: 'idle' };
        const newPlayers = (prev.players || []).filter(p => p !== userId);
        return { ...prev, players: newPlayers, status: newPlayers.length < 2 ? 'waiting' : prev.status };
      });
    };
  }, [userId, setLobbyState]);

  const partnerInLobby = (lobbyState.players || []).includes(partnerId);
  const isReady = (lobbyState.players || []).includes(userId) && partnerInLobby;

  const startGame = () => {
    if (isReady) setLobbyState({ ...lobbyState, status: 'playing' });
  };

  const renderGame = () => {
    const commonProps = { 
        sfx, 
        userId, 
        partnerId, 
        setScores, 
        onWin: handleWin,
        onBack: () => navigate('/activities'), 
        onShareToChat, 
        onSaveToScrapbook, 
        profile,
        config: { mode: 'competitive', diff: 'medium', category: 'animals' } // Default config for co-op start
    };

    switch (gameRoute) {
      case 'tictactoe': return <TicTacToe {...commonProps} config={{ ...commonProps.config, mode: '1v1_local', size: 3 }} />;
      case 'pictionary': return <PictionaryGame {...commonProps} gameState={pictionaryState} setGameState={setPictionaryState} />;
      case 'memory': return <MemoryGame {...commonProps} />;
      case 'wordle': return <WordleClone {...commonProps} />;
      case 'sudoku': return <Sudoku {...commonProps} />;
      case 'chess': return <ChessEngine {...commonProps} />;
      case 'quiz': return <CouplesQuiz {...commonProps} />;
      case '2048': return <Game2048 {...commonProps} />;
      case 'typing': return <TypingRace {...commonProps} />;
      case 'wyr': return <WouldYouRather {...commonProps} />;
      default: return <div className="p-8 text-center font-bold">Game not found</div>;
    }
  };

  // 1. Arcade Menu (No specific game selected)
  if (!gameRoute || gameRoute === '') {
    const games = [
      { id: 'pictionary', title: 'Pictionary', desc: 'Draw and guess the hidden word.', color: '#fca5a5' },
      { id: 'tictactoe', title: 'Tic-Tac-Toe', desc: 'Classic 3x3. Try Memory Fading mode.', color: '#ef4444' },
      { id: 'memory', title: 'Memory Match', desc: 'Flip cards and find pairs.', color: '#3b82f6' },
      { id: 'wordle', title: 'Retro Word', desc: 'Guess the hidden word.', color: '#fef3c7' },
      { id: 'sudoku', title: 'Sudoku', desc: 'Logic puzzles. Race or Share.', color: '#fca5a5' },
      { id: 'chess', title: 'Chess', desc: 'Full rules engine. Standard or Sandbox.', color: '#bfdbfe' },
      { id: 'quiz', title: 'Couples Quiz', desc: 'How well do you know them?', color: '#fde68a' },
      { id: '2048', title: '2048', desc: 'Merge tiles. Reach 2048!', color: '#a855f7' },
      { id: 'typing', title: 'Typing Race', desc: 'Type fast. Beat your WPM.', color: '#14b8a6' },
      { id: 'wyr', title: 'Would You Rather', desc: 'See if you match!', color: '#ec4899' },
      { id: 'love', title: 'Love Language', desc: 'Discover your love style.', color: '#f472b6' },
      { id: 'watch', title: 'Sync Watcher', desc: 'Watch YT together.', color: '#c084fc' }
    ];

    return (
      <RetroWindow title="activities_hub.exe" onClose={onClose} className="w-full max-w-5xl h-[calc(100dvh-4rem)] relative overflow-hidden" noPadding>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-8 overflow-y-auto h-full bg-[var(--bg-window)]">
          {games.map(game => (
            <div 
              key={game.id} 
              onClick={() => navigate(`/activities/${game.id}`)} 
              className="p-6 bg-white border-2 border-[var(--border)] shadow-[3px_3px_0px_0px_var(--border)] cursor-pointer hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_var(--border)] transition-all flex flex-col items-start text-left min-h-[140px] relative overflow-hidden"
            >
              <div 
                className="w-8 h-8 border-2 border-[var(--border)] mb-4" 
                style={{ backgroundColor: game.color }}
              />
              <h3 className="font-black text-xl leading-none mb-2 text-[var(--border)]">{game.title}</h3>
              <p className="text-xs font-bold opacity-60 leading-relaxed text-[var(--border)] max-w-[200px]">{game.desc}</p>
            </div>
          ))}
        </div>
      </RetroWindow>
    );
  }

  // 2. The Lobby (Waiting for partner or ready to start)
  if (lobbyState.status === 'waiting' || lobbyState.status === 'ready') {
    return (
      <RetroWindow title={`lobby_${gameRoute}.exe`} onClose={() => navigate('/activities')} className="w-full max-w-2xl">
         <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-main)] retro-border retro-shadow-dark">
            <h2 className="text-3xl font-black uppercase mb-2">Arcade Lobby</h2>
            <p className="text-sm font-bold opacity-70 mb-8 uppercase tracking-widest">{gameRoute}</p>

            <div className="flex gap-8 items-center justify-center mb-10 w-full">
               {/* Player 1 (You) */}
               <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-[var(--primary)] retro-border flex items-center justify-center text-[var(--text-on-primary)] shadow-[0_0_15px_var(--primary)]">
                     <span className="font-black text-2xl">P1</span>
                  </div>
                  <span className="mt-3 font-bold text-xs uppercase bg-black text-white px-2 py-1">READY</span>
               </div>

               <div className="text-2xl font-black opacity-30">VS</div>

               {/* Player 2 (Partner) */}
               <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 retro-border flex items-center justify-center transition-all ${partnerInLobby ? 'bg-[var(--secondary)] text-[var(--text-on-secondary)] shadow-[0_0_15px_var(--secondary)]' : 'bg-transparent border-dashed opacity-50'}`}>
                     <span className="font-black text-2xl">{partnerInLobby ? 'P2' : '?'}</span>
                  </div>
                  {partnerInLobby ? (
                     <span className="mt-3 font-bold text-xs uppercase bg-black text-white px-2 py-1 animate-pulse">READY</span>
                  ) : (
                     <span className="mt-3 font-bold text-[10px] uppercase flex items-center gap-1 opacity-60"><Loader size={12} className="animate-spin" /> Waiting</span>
                  )}
               </div>
            </div>

            {isReady ? (
               <button onClick={startGame} className="bg-[var(--primary)] text-[var(--text-on-primary)] font-black text-xl px-12 py-4 retro-border retro-shadow-dark hover:scale-105 transition-transform animate-pulse">
                 INSERT COIN (START)
               </button>
            ) : (
               <div className="flex flex-col gap-3">
                 <p className="text-xs font-bold opacity-60 italic">Waiting for partner to accept the invite...</p>
                 <RetroButton onClick={() => onShareToChat(`Join me in the lobby for ${gameRoute}!`, null, { gameId: gameRoute, gameTitle: gameRoute })} className="text-xs">
                    Resend Invite to Chat
                 </RetroButton>
               </div>
            )}
         </div>
      </RetroWindow>
    );
  }

  // 3. Active Game State
  if (lobbyState.status === 'playing') {
    return (
      <RetroWindow title={`${gameRoute}.exe`} onClose={() => navigate('/activities')} className="w-full max-w-4xl h-[calc(100dvh-4rem)]" noPadding>
         <div className="h-full bg-[var(--bg-window)] overflow-y-auto">
            {renderGame()}
         </div>
      </RetroWindow>
    );
  }

  return <div className="p-8 text-center font-bold">Lobby initializing...</div>;
}
