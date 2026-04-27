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

export function ActivitiesHub({ onClose, scores, setScores, sfx, setConfetti, onShareToChat, profile, userId, partnerId, pictionaryState, setPictionaryState, onSaveToScrapbook, syncedRoomId }) {
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

  // 1. Identify if the current game is a solo game
  const soloGames = ['wordle', 'sudoku', '2048', 'typing'];
  const isSoloGame = soloGames.includes(gameRoute);

  // 2. Handle Entry & Cleanup based on route changes
  useEffect(() => {
    if (!gameRoute || gameRoute === '') {
      // User is in the Main Menu -> Clear them from the lobby
      setLobbyState(prev => {
        if (!prev) return { players: [], gameId: null, status: 'idle' };
        const newPlayers = (prev.players || []).filter(p => p !== userId);
        return { ...prev, gameId: null, players: newPlayers, status: 'waiting' };
      });
    } else {
      // User clicked a game -> Add them to the lobby and set the correct gameId
      setLobbyState(prev => {
        const players = prev.players || [];
        const needsJoin = !players.includes(userId);
        const gameChanged = prev.gameId !== gameRoute;
        
        if (needsJoin || gameChanged) {
          const newPlayers = needsJoin ? [...players, userId] : players;
          // If it's a solo game, we are immediately ready. Otherwise, wait for 2 players.
          const ready = isSoloGame || newPlayers.length >= 2;
          
          return { 
            ...prev, 
            gameId: gameRoute, 
            players: newPlayers, 
            status: ready ? 'ready' : 'waiting' 
          };
        }
        return prev;
      });
    }
  }, [gameRoute, userId, setLobbyState, isSoloGame]);

  // Full Unmount Cleanup
  useEffect(() => {
    return () => {
      setLobbyState(prev => {
        if (!prev) return { players: [], gameId: null, status: 'idle' };
        const newPlayers = (prev.players || []).filter(p => p !== userId);
        return { ...prev, players: newPlayers, status: newPlayers.length < 2 ? 'waiting' : prev.status };
      });
    };
  }, [userId, setLobbyState]);

  // 3. Fix Readiness Logic
  const partnerInLobby = (lobbyState.players || []).includes(partnerId);
  
  // You are ready if you are in the lobby AND (it's a solo game OR your partner is here)
  const isReady = (lobbyState.players || []).includes(userId) && (isSoloGame || partnerInLobby);

  const startGame = () => {
    if (isReady) setLobbyState({ ...lobbyState, status: 'playing' });
  };

  const [view, setView] = useState('arcade'); // 'arcade' or 'scores'

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
        roomId: syncedRoomId || 'global' // roomId for scrapbook sync
    };

    switch (gameRoute) {
      case 'tictactoe': return <TicTacToe {...commonProps} />;
      case 'pictionary': return <PictionaryGame {...commonProps} gameState={pictionaryState} setGameState={setPictionaryState} />;
      case 'memory': return <MemoryGame {...commonProps} roomId={commonProps.roomId} />;
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
      { id: 'tictactoe', title: 'Tic-Tac-Toe', desc: 'Classic 3x3 match.', color: '#ef4444' },
      { id: 'memory', title: 'Memory Match', desc: 'Flip cards and find pairs.', color: '#3b82f6' },
      { id: 'wordle', title: 'Retro Word', desc: 'Guess the hidden word.', color: '#fbbf24' },
      { id: 'sudoku', title: 'Sudoku', desc: 'Logic puzzles.', color: '#fca5a5' },
      { id: 'chess', title: 'Chess', desc: 'Standard or Sandbox.', color: '#bfdbfe' },
      { id: 'quiz', title: 'Couples Quiz', desc: 'How well do you know them?', color: '#fde68a' },
      { id: '2048', title: '2048', desc: 'Merge tiles. Reach 2048!', color: '#a855f7' },
      { id: 'typing', title: 'Typing Race', desc: 'Type fast. Beat your WPM.', color: '#14b8a6' },
      { id: 'wyr', title: 'Would You Rather', desc: 'See if you match!', color: '#ec4899' },
    ];

    return (
      <RetroWindow title="activities_hub.exe" onClose={onClose} className="w-full max-w-5xl h-[calc(100dvh-4rem)] relative overflow-hidden flex flex-col" noPadding>
        {/* Toggle Bar */}
        <div className="flex border-b-2 retro-border shrink-0 bg-[var(--bg-main)]">
           <button onClick={() => setView('arcade')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs transition-all ${view === 'arcade' ? 'bg-[var(--primary)] text-white' : 'opacity-60 grayscale'}`}>Games</button>
           <button onClick={() => setView('scores')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs border-l-2 retro-border transition-all ${view === 'scores' ? 'bg-[var(--secondary)] text-white' : 'opacity-60 grayscale'}`}>High Scores</button>
        </div>

        {view === 'scores' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[var(--bg-window)] text-[var(--text-main)]">
             <div className="max-w-2xl mx-auto border-4 border-double border-[var(--border)] p-4 sm:p-8 bg-pattern-grid relative">
                <h2 className="text-2xl sm:text-3xl font-black text-center mb-8 uppercase tracking-[0.3em]">Hall of Fame</h2>
                <div className="space-y-4">
                  {Object.entries(scores || {}).map(([game, data]) => (
                    <div key={game} className="flex flex-col sm:flex-row items-center justify-between bg-white retro-border p-4 shadow-[4px_4px_0_var(--border)] gap-4">
                      <span className="font-black text-xl uppercase tracking-widest text-[var(--primary)]">{game}</span>
                      <div className="flex gap-6 font-bold text-lg">
                        <span className="flex flex-col items-center">You: <span className="text-2xl">{data[userId] || 0}</span></span>
                        <span className="flex flex-col items-center">Partner: <span className="text-2xl">{data[partnerId] || 0}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-4 pb-12 overflow-y-auto h-full bg-[var(--bg-main)]">
            {games.map(game => (
              <button 
                key={game.id} 
                onClick={() => { playAudio('click', sfx); navigate(`/activities/${game.id}`); }}
                className="flex flex-col items-center p-4 bg-[var(--bg-window)] retro-border retro-shadow-dark hover:-translate-y-1 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-current" style={{ color: game.color }}></div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 retro-border shadow-inner" style={{ backgroundColor: game.color }}>
                   <Gamepad2 size={24} className="text-white" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-tighter mb-1 text-center">{game.title}</h3>
                <p className="text-[9px] opacity-50 text-center leading-tight">{game.desc}</p>
              </button>
            ))}
          </div>
        )}
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
