import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gamepad2, ArrowLeft, Users, Loader, Settings, Play, Swords, User, Monitor, Zap, Heart, Brush, X, Activity } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { playAudio } from '../utils/audio.js';

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

const GAME_CATALOG = {
  pictionary: { title: 'Pictionary', desc: 'Draw and guess the hidden word.', color: '#fca5a5', modes: [
    { id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'One draws, the other guesses in real-time.' }
  ]},
  tictactoe: { title: 'Tic-Tac-Toe', desc: 'Classic 3x3 match.', color: '#ef4444', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'medium', 'hard'], options: [{key: 'matchType', label: 'Best Of', choices: [1, 3, 5]}], desc: 'Play locally against the computer.' },
    { id: '1v1_remote', label: 'Vs Partner (Online)', type: 'remote', options: [{key: 'matchType', label: 'Best Of', choices: [1, 3, 5]}], desc: 'Challenge your partner remotely.' }
  ]},
  memory: { title: 'Memory Match', desc: 'Flip cards and find pairs.', color: '#3b82f6', modes: [
    { id: 'solo', label: 'Solo Practice', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Find all pairs as fast as you can.' },
    { id: 'coop_remote', label: 'Co-op (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Work together to clear the board.' },
    { id: 'competitive', label: 'Versus (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Compete to find the most pairs.' }
  ]},
  wordle: { title: 'Retro Word', desc: 'Guess the hidden word.', color: '#fbbf24', modes: [
    { id: 'solo', label: 'Solo', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Guess the daily word alone.' },
    { id: 'coop_remote', label: 'Co-op (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Solve the same word together.' },
    { id: 'competitive', label: 'Mastermind (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Set a secret word for your partner to guess.' }
  ]},
  sudoku: { title: 'Sudoku', desc: 'Logic puzzles.', color: '#fca5a5', modes: [
    { id: 'solo', label: 'Solo', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Classic Sudoku experience.' },
    { id: 'parallel_remote', label: 'Parallel Play (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Race your partner on the same puzzle.' }
  ]},
  chess: { title: 'Chess', desc: 'Standard or Sandbox.', color: '#bfdbfe', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', desc: 'Play against the chess engine.' },
    { id: '1v1_remote', label: 'Vs Partner (Online)', type: 'remote', desc: 'Online 1v1 match.' }
  ]},
  quiz: { title: 'Couples Quiz', desc: 'How well do you know them?', color: '#fde68a', modes: [
    { id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'Answer questions about each other.' }
  ]},
  '2048': { title: '2048', desc: 'Merge tiles. Reach 2048!', color: '#a855f7', modes: [
    { id: 'solo', label: 'Solo', type: 'local', desc: 'Standard 2048 game.' },
    { id: 'parallel_remote', label: 'Parallel Play (Online)', type: 'remote', desc: 'Hang out in a lobby while you both play.' }
  ]},
  typing: { title: 'Typing Race', desc: 'Type fast. Beat your WPM.', color: '#14b8a6', modes: [
    { id: 'solo', label: 'Practice', type: 'local', desc: 'Test your typing speed alone.' },
    { id: '1v1_remote', label: 'Race Partner (Online)', type: 'remote', desc: 'First to finish the passage wins.' }
  ]},
  wyr: { title: 'Would You Rather', desc: 'See if you match!', color: '#ec4899', modes: [
    { id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'Answer dilemmas and compare choices.' }
  ]}
};

export function ActivitiesHub({ onClose, scores, setScores, sfx, setConfetti, onShareToChat, profile, userId, partnerId, pictionaryState, setPictionaryState, onSaveToScrapbook, syncedRoomId }) {
  const { '*': gameRoute } = useParams();
  const navigate = useNavigate();
  
  const [lobbyState, setLobbyState] = useGlobalSync('arcade_lobby', { players: [], gameId: null, status: 'idle', config: null });
  const [localPlayConfig, setLocalPlayConfig] = useState(null);
  
  const [view, setView] = useState('arcade');
  const [selectedModeId, setSelectedModeId] = useState(null);
  const [selectedDiff, setSelectedDiff] = useState('medium');
  const [selectedOptions, setSelectedOptions] = useState({ matchType: 1 });

  const game = GAME_CATALOG[gameRoute];

  // Cleanup logic
  useEffect(() => {
      setLocalPlayConfig(null);
      setSelectedModeId(null);
  }, [gameRoute]);

  useEffect(() => {
      if (!gameRoute || gameRoute === '') {
          setLobbyState(prev => {
              if (!prev || !(prev.players || []).includes(userId)) return prev;
              const p = prev.players.filter(id => id !== userId);
              return { ...prev, players: p, gameId: p.length ? prev.gameId : null, status: p.length ? prev.status : 'idle' };
          });
      }
  }, [gameRoute, userId, setLobbyState]);

  const handleWin = () => { 
    try { if (sfx) { const winAudio = new Audio('/assets/win.mp3'); winAudio.volume = 0.5; winAudio.play().catch(()=>{}); } } catch(e){}
    setConfetti(true); setTimeout(() => setConfetti(false), 4000); 
  };

  const handleStartLocal = (mode) => {
      playAudio('click', sfx);
      setLocalPlayConfig({ mode: mode.id, diff: selectedDiff, ...selectedOptions });
  };

  const handleCreateLobby = (mode) => {
      playAudio('click', sfx);
      const gameConfig = { mode: mode.id, diff: selectedDiff, ...selectedOptions };
      setLobbyState({ players: [userId], gameId: gameRoute, status: 'waiting', config: gameConfig });
      onShareToChat(`Join me for ${game.title} (${mode.label})!`, null, { gameId: gameRoute });
  };

  const handleJoinLobby = () => {
      playAudio('click', sfx);
      setLobbyState(prev => {
          const p = Array.from(new Set([...(prev?.players || []), userId]));
          return { ...prev, players: p, status: p.length >= 2 ? 'ready' : 'waiting' };
      });
  };

  // Determine current active phase
  let currentPhase = 'menu';
  if (gameRoute && game) {
      if (localPlayConfig) {
          currentPhase = 'playing_local';
      } else if (lobbyState?.gameId === gameRoute && (lobbyState?.players || []).includes(userId)) {
          if (lobbyState.status === 'playing') currentPhase = 'playing_remote';
          else currentPhase = 'lobby';
      } else {
          currentPhase = 'details';
      }
  }

  const renderActiveGame = () => {
    const activeConfig = currentPhase === 'playing_local' ? localPlayConfig : lobbyState?.config;
    const commonProps = { 
        config: activeConfig || { diff: 'easy', mode: 'solo', matchType: 1 }, 
        sfx, userId, partnerId, setScores, onWin: handleWin,
        onBack: () => {
             if (currentPhase === 'playing_local') setLocalPlayConfig(null);
             else {
                 setLobbyState(prev => {
                     const p = (prev?.players || []).filter(id => id !== userId);
                     return { ...prev, players: p, status: p.length < 2 ? 'waiting' : prev?.status };
                 });
                 navigate('/activities');
             }
        }, 
        onShareToChat, onSaveToScrapbook, profile,
        roomId: syncedRoomId || 'global'
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
      default: return <div className="p-8 text-center font-bold">Game Engine Offline</div>;
    }
  };

  // 1. Arcade Menu Phase
  if (currentPhase === 'menu') {
    return (
      <RetroWindow title="activities_hub.exe" onClose={onClose} className="w-full max-w-5xl h-[calc(100dvh-4rem)] relative overflow-hidden flex flex-col" noPadding>
        <div className="flex border-b-2 retro-border shrink-0 bg-[var(--bg-main)]">
           <button onClick={() => setView('arcade')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs transition-all ${view === 'arcade' ? 'bg-[var(--primary)] text-white' : 'opacity-60 grayscale'}`}>Games</button>
           <button onClick={() => setView('scores')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs border-l-2 retro-border transition-all ${view === 'scores' ? 'bg-[var(--secondary)] text-white' : 'opacity-60 grayscale'}`}>High Scores</button>
        </div>

        {view === 'scores' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[var(--bg-window)] text-[var(--text-main)]">
             <div className="max-w-2xl mx-auto border-4 border-double border-[var(--border)] p-4 sm:p-8 bg-pattern-grid relative">
                <h2 className="text-2xl sm:text-3xl font-black text-center mb-8 uppercase tracking-[0.3em]">Hall of Fame</h2>
                <div className="space-y-4">
                  {Object.entries(scores || {}).map(([gId, data]) => (
                    <div key={gId} className="flex flex-col sm:flex-row items-center justify-between bg-white retro-border p-4 shadow-[4px_4px_0_var(--border)] gap-4">
                      <span className="font-black text-xl uppercase tracking-widest text-[var(--primary)]">{gId}</span>
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
            {Object.entries(GAME_CATALOG).map(([id, g]) => (
              <button 
                key={id} onClick={() => { try{playAudio('click', sfx);}catch(e){} navigate(`/activities/${id}`); }}
                className="flex flex-col items-center p-4 bg-[var(--bg-window)] retro-border retro-shadow-dark hover:-translate-y-1 transition-all group relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-current" style={{ color: g.color }}></div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 retro-border shadow-inner" style={{ backgroundColor: g.color }}>
                   <Gamepad2 size={24} className="text-white" />
                </div>
                <h3 className="font-black text-sm uppercase tracking-tighter mb-1 text-center">{g.title}</h3>
                <p className="text-[9px] opacity-50 text-center leading-tight">{g.desc}</p>
              </button>
            ))}
          </div>
        )}
      </RetroWindow>
    );
  }

  // 2. Game Details / Mode Selector Phase
  if (currentPhase === 'details') {
      const partnerWaitingHere = lobbyState?.gameId === gameRoute && (lobbyState?.players || []).includes(partnerId) && lobbyState?.status !== 'playing';

      return (
        <RetroWindow title={`${gameRoute}_setup.exe`} onClose={() => navigate('/activities')} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
          <div className="flex flex-col h-full bg-[var(--bg-main)]">
             <div className="p-8 border-b-4 border-double border-[var(--border)] bg-pattern-grid flex items-center gap-6 shrink-0">
                 <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center retro-border bg-white" style={{ color: game.color }}>
                    <Gamepad2 size={48} />
                 </div>
                 <div>
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-widest text-[var(--primary)] text-shadow-sm leading-none">{game.title}</h1>
                    <p className="text-sm sm:text-lg font-bold opacity-70 mt-2">{game.desc}</p>
                 </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                 {partnerWaitingHere && (
                     <div className="bg-[var(--secondary)] text-[var(--text-on-secondary)] p-6 mb-8 retro-border retro-shadow-dark animate-pulse flex flex-col sm:flex-row items-center justify-between gap-4">
                         <div>
                             <h2 className="text-xl font-black uppercase mb-1">Partner is Waiting!</h2>
                             <p className="font-bold opacity-90 text-sm">They have set up a lobby for {game.title} and are waiting for you.</p>
                         </div>
                         <RetroButton variant="white" className="text-black px-8 py-3 whitespace-nowrap" onClick={handleJoinLobby}>Join Lobby</RetroButton>
                     </div>
                 )}

                 <h3 className="text-xl font-black uppercase tracking-widest mb-4 border-b-2 border-black/10 pb-2">Select Game Mode</h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {game.modes.map(mode => (
                         <div key={mode.id} className={`p-4 retro-border bg-[var(--bg-window)] flex flex-col gap-4 transition-transform ${selectedModeId === mode.id ? 'ring-4 ring-inset ring-[var(--primary)] scale-[1.02] retro-shadow-dark' : 'hover:scale-[1.01]'}`}>
                             <div className="flex items-start justify-between cursor-pointer" onClick={() => { playAudio('click', sfx); setSelectedModeId(mode.id); }}>
                                 <div>
                                     <h4 className="text-lg font-black uppercase">{mode.label}</h4>
                                     <p className="text-sm font-bold opacity-60 mt-1 leading-tight">{mode.desc}</p>
                                 </div>
                                 {mode.type === 'remote' ? <Users className="text-[var(--secondary)] shrink-0" /> : <User className="text-[var(--primary)] shrink-0" />}
                             </div>
                             
                             {selectedModeId === mode.id && (
                                 <div className="pt-4 border-t-2 border-dashed border-black/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                                     {mode.diffs && (
                                         <div>
                                             <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-2 block">Difficulty</label>
                                             <div className="flex gap-2">
                                                 {mode.diffs.map(d => (
                                                     <button key={d} onClick={() => { playAudio('click', sfx); setSelectedDiff(d); }} className={`flex-1 py-2 text-xs font-bold uppercase retro-border transition-colors ${selectedDiff === d ? 'bg-[var(--primary)] text-white' : 'bg-white opacity-70 hover:opacity-100'}`}>
                                                         {d}
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     )}

                                     {mode.options && mode.options.map(opt => (
                                         <div key={opt.key}>
                                             <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-2 block">{opt.label}</label>
                                             <div className="flex gap-2">
                                                 {opt.choices.map(c => (
                                                     <button key={c} onClick={() => { playAudio('click', sfx); setSelectedOptions(p => ({...p, [opt.key]: c})); }}
                                                             className={`flex-1 py-2 text-xs font-bold uppercase retro-border transition-colors ${selectedOptions[opt.key] === c ? 'bg-[var(--primary)] text-white' : 'bg-white opacity-70 hover:opacity-100'}`}>
                                                         {c}
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     ))}
                                     
                                     <RetroButton 
                                         variant={mode.type === 'remote' ? 'secondary' : 'primary'} 
                                         className="w-full py-3 text-lg mt-2 retro-shadow-dark"
                                         onClick={() => mode.type === 'remote' ? handleCreateLobby(mode) : handleStartLocal(mode)}
                                     >
                                         {mode.type === 'remote' ? 'Create Lobby & Invite' : 'Start Game'}
                                     </RetroButton>
                                 </div>
                             )}
                         </div>
                     ))}
                 </div>
             </div>
          </div>
        </RetroWindow>
      );
  }

  // 3. Lobby Waiting Phase
  if (currentPhase === 'lobby') {
    const currentPlayers = lobbyState?.players || [];
    const partnerInLobby = currentPlayers.includes(partnerId);
    const isReady = currentPlayers.includes(userId) && partnerInLobby;

    return (
      <RetroWindow title={`lobby_${gameRoute}.exe`} onClose={() => navigate('/activities')} className="w-full max-w-2xl">
         <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-main)] retro-border retro-shadow-dark">
            <h2 className="text-3xl font-black uppercase mb-2">Arcade Lobby</h2>
            
            <div className="bg-[var(--bg-window)] border-2 border-black border-dashed px-6 py-2 mb-8 inline-flex flex-col items-center">
                <span className="font-black text-[var(--primary)] uppercase tracking-widest text-xl">{game.title}</span>
                <span className="text-xs font-bold opacity-70 uppercase tracking-widest mt-1">Mode: {lobbyState.config?.mode} | {lobbyState.config?.diff ? `Diff: ${lobbyState.config.diff}` : 'Standard'}</span>
            </div>

            <div className="flex gap-8 items-center justify-center mb-10 w-full">
               <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-[var(--primary)] retro-border flex items-center justify-center text-[var(--text-on-primary)] shadow-[0_0_15px_var(--primary)]">
                     <span className="font-black text-2xl">P1</span>
                  </div>
                  <span className="mt-3 font-bold text-xs uppercase bg-black text-white px-2 py-1">READY</span>
               </div>

               <div className="text-2xl font-black opacity-30">VS</div>

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
               <button onClick={() => setLobbyState(prev => ({ ...prev, status: 'playing' }))} className="bg-[var(--primary)] text-[var(--text-on-primary)] font-black text-xl px-12 py-4 retro-border retro-shadow-dark hover:scale-105 transition-transform animate-pulse cursor-pointer">
                 INSERT COIN (START)
               </button>
            ) : (
               <div className="flex flex-col gap-3">
                 <p className="text-xs font-bold opacity-60 italic">Waiting for partner to accept the invite...</p>
                 <RetroButton onClick={() => onShareToChat(`Join my lobby for ${game.title}!`, null, { gameId: gameRoute })} className="text-xs">
                    Resend Invite to Chat
                 </RetroButton>
               </div>
            )}
         </div>
      </RetroWindow>
    );
  }

  // 4. Active Game Phase
  if (currentPhase === 'playing_local' || currentPhase === 'playing_remote') {
      return (
        <RetroWindow title={`${gameRoute}.exe`} onClose={() => navigate('/activities')} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[850px]" noPadding>
           <div className="h-full bg-[var(--bg-window)] overflow-y-auto">
              {renderActiveGame()}
           </div>
        </RetroWindow>
      );
  }

  return null;
}
