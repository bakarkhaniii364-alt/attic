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
          return { ...prev, gameId: gameRoute, players: [...players, userId], status: (players.length + 1) >= 2 ? 'ready' : 'waiting' };
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
      default: return <div className="p-8 text-center font-bold">Game not found</div>;
    }
  };

  // 1. Arcade Menu (No specific game selected)
  if (!gameRoute || gameRoute === '') {
    return (
      <RetroWindow title="arcade.exe" onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-4rem)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
          {[
            { id: 'tictactoe', title: 'Tic-Tac-Toe', desc: 'Classic connection game.' },
            { id: 'pictionary', title: 'Pictionary', desc: 'Draw and guess words.' },
            { id: 'memory', title: 'Memory Match', desc: 'Find the hidden pairs.' },
            { id: 'wordle', title: 'Wordle Co-op', desc: 'Guess the word together.' },
            { id: 'sudoku', title: 'Sudoku', desc: 'Solve the grid.' }
          ].map(game => (
            <div key={game.id} onClick={() => navigate(`/activities/${game.id}`)} className="p-6 retro-bg-window retro-border retro-shadow-dark cursor-pointer hover:-translate-y-1 transition-all group flex flex-col items-center text-center">
              <Gamepad2 size={40} className="mb-4 text-[var(--primary)] group-hover:scale-110 transition-transform" />
              <h3 className="font-black uppercase text-lg">{game.title}</h3>
              <p className="text-xs opacity-70 mt-2">{game.desc}</p>
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
                  <div className="w-20 h-20 bg-[var(--primary)] retro-border flex items-center justify-center text-white shadow-[0_0_15px_var(--primary)]">
                     <span className="font-black text-2xl">P1</span>
                  </div>
                  <span className="mt-3 font-bold text-xs uppercase bg-black text-white px-2 py-1">READY</span>
               </div>

               <div className="text-2xl font-black opacity-30">VS</div>

               {/* Player 2 (Partner) */}
               <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 retro-border flex items-center justify-center transition-all ${partnerInLobby ? 'bg-[var(--secondary)] text-white shadow-[0_0_15px_var(--secondary)]' : 'bg-transparent border-dashed border-[var(--border)] opacity-50'}`}>
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
               <button onClick={startGame} className="bg-[var(--primary)] text-white font-black text-xl px-12 py-4 retro-border retro-shadow-dark hover:scale-105 transition-transform animate-pulse">
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
  return (
    <RetroWindow title={`${gameRoute}.exe`} onClose={() => navigate('/activities')} className="w-full max-w-4xl h-[calc(100dvh-4rem)]" noPadding>
       <div className="h-full bg-[var(--bg-window)] overflow-y-auto">
          {renderGame()}
       </div>
    </RetroWindow>
  );
}
