import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gamepad2, ArrowLeft, Users, Loader, Settings, Play, Swords, User, Monitor, Zap, Heart, Brush, X, Activity } from 'lucide-react';
import { RetroButton, RetroWindow, ScoreboardCountdown, ConfirmDialog } from '../components/UI.jsx';
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
import { UnoGame } from './UnoGame.jsx';
import { OthelloGame } from './OthelloGame.jsx';
import { PoolGame } from './PoolGame.jsx';
import { BluffGame } from './BluffGame.jsx';

const GAME_CATALOG = {
  pictionary: { title: 'Pictionary', desc: 'Draw and guess the hidden word.', color: '#fca5a5', modes: [
    { id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'One draws, the other guesses in real-time.', diffs: ['easy', 'hard'], options: [{key: 'genre', label: 'Word Genre', choices: ['General', 'Animals', 'Movies', 'Food']}, {key: 'rounds', label: 'Rounds', choices: [1, 2, 3, 5]}] }
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
  ]},
  uno: { title: 'Retro Uno', desc: 'Classic card game for 2.', color: '#ef4444', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', desc: 'Practice against the computer.' },
    { id: '1v1_remote', label: 'Vs Partner (Online)', type: 'remote', desc: 'Challenge your partner to Uno.' }
  ]},
  othello: { title: 'Othello', desc: 'Classic Reversi.', color: '#16a34a', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Outflank the computer.' },
    { id: '1v1_remote', label: 'Vs Partner (Online)', type: 'remote', desc: 'Online 1v1 match.' }
  ]},
  pool: { title: '8-Ball Pool', desc: 'Billiards physics.', color: '#8b5cf6', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Play against the computer.' },
    { id: '1v1_remote', label: 'Vs Partner (Online)', type: 'remote', desc: 'Real-time online pool.' }
  ]},
  bluff: { title: 'Cheat (Bluff)', desc: 'Lie to win.', color: '#1e3a8a', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'hard'], desc: 'Can you outsmart the computer?' },
    { id: '1v1_remote', label: 'Vs Partner (Online)', type: 'remote', desc: 'Call your partner\'s bluffs!' }
  ]}
};

export function ActivitiesHub({ onClose, scores, setScores, sfx, setConfetti, onShareToChat, profile, userId, partnerId, pictionaryState, setPictionaryState, onSaveToScrapbook, syncedRoomId, myName, partnerName, roomProfiles }) {
  const { '*': gameRoute } = useParams();
  const navigate = useNavigate();
  
  const [lobbyState, setLobbyState] = useGlobalSync('arcade_lobby', { players: [], gameId: null, status: 'idle', config: null });
  const [localPlayConfig, setLocalPlayConfig] = useState(null);
  
  const [view, setView] = useState('arcade');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
     if (view === 'scores') {
         setLoadingLeaderboard(true);
         import('../lib/supabase.js').then(({ supabase }) => {
             supabase.from('highscores').select('*').order('score', { ascending: false }).limit(100)
               .then(({ data }) => {
                   const localScores = JSON.parse(localStorage.getItem('attic_local_highscores') || '[]');
                   const combined = [...(data || []), ...localScores];
                   const seen = new Set();
                   const unique = [];
                   for (const s of combined) {
                      const key = `${s.user_id}_${s.game_id}_${s.mode}_${s.score}`;
                      if (!seen.has(key)) {
                         seen.add(key);
                         unique.push(s);
                      }
                   }
                   unique.sort((a, b) => (b.score || 0) - (a.score || 0));
                   setLeaderboardData(unique);
                   setLoadingLeaderboard(false);
               }).catch(() => {
                   const localScores = JSON.parse(localStorage.getItem('attic_local_highscores') || '[]');
                   localScores.sort((a, b) => (b.score || 0) - (a.score || 0));
                   setLeaderboardData(localScores);
                   setLoadingLeaderboard(false);
               });
         });
     }
  }, [view]);
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
      setLobbyState({ players: [userId], hostId: userId, gameId: gameRoute, status: 'waiting', config: gameConfig });
      if (game) {
        onShareToChat(`Join me for ${game.title} (${mode.label})!`, null, { gameId: gameRoute });
      } else {
        onShareToChat(`Join me for a game!`, null, { gameId: gameRoute });
      }
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
          if (lobbyState?.status === 'playing') currentPhase = 'playing_remote';
          else currentPhase = 'lobby';
      } else {
          currentPhase = 'details';
      }
  }
  console.log('[ActivitiesHub] userId:', userId, 'gameRoute:', gameRoute, 'lobbyState:', lobbyState);
  console.log('[ActivitiesHub] currentPhase:', currentPhase);

  const renderActiveGame = () => {
    const activeConfig = currentPhase === 'playing_local' ? localPlayConfig : lobbyState?.config;
    const isMultiplayer = currentPhase === 'playing_remote';
    const isHost = isMultiplayer ? (lobbyState?.hostId === userId) : true;
    const myPlayerId = userId;
    const oppPlayerId = isMultiplayer ? partnerId : 'ai';

    const commonProps = { 
        config: activeConfig || { diff: 'easy', mode: 'solo', matchType: 1 }, 
        sfx, userId, partnerId, setScores, onWin: handleWin,
        isHost, isMultiplayer, myPlayerId, oppPlayerId,
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
        myName, partnerName, roomProfiles,
        roomId: syncedRoomId || 'global'
    };

    switch (gameRoute) {
      case 'tictactoe': return <TicTacToe {...commonProps} />;
      case 'pictionary': return <PictionaryGame {...commonProps} pictionaryState={pictionaryState} setPictionaryState={setPictionaryState} />;
      case 'memory': return <MemoryGame {...commonProps} roomId={commonProps.roomId} />;
      case 'wordle': return <WordleClone {...commonProps} />;
      case 'sudoku': return <Sudoku {...commonProps} />;
      case 'chess': return <ChessEngine {...commonProps} />;
      case 'quiz': return <CouplesQuiz {...commonProps} />;
      case '2048': return <Game2048 {...commonProps} />;
      case 'typing': return <TypingRace {...commonProps} />;
      case 'wyr': return <WouldYouRather {...commonProps} />;
      case 'uno': return <UnoGame {...commonProps} />;
      case 'othello': return <OthelloGame {...commonProps} />;
      case 'pool': return <PoolGame {...commonProps} />;
      case 'bluff': return <BluffGame {...commonProps} />;
      default: return <div className="p-8 text-center font-bold">Game Engine Offline</div>;
    }
  };

  // 1. Arcade Menu Phase
  if (currentPhase === 'menu') {
    return (
      <RetroWindow title="activities_hub.exe" onClose={onClose} className="w-full max-w-5xl h-[calc(100dvh-4rem)] relative overflow-hidden flex flex-col" noPadding>
        <div className="flex border-b-2 retro-border shrink-0 bg-[var(--bg-main)]">
           <button onClick={() => setView('arcade')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs transition-all ${view === 'arcade' ? 'bg-[var(--primary)] text-white' : 'opacity-60 grayscale'}`}>Games</button>
           <button onClick={() => setView('scores')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs border-l-2 retro-border transition-all ${view === 'scores' ? 'bg-[var(--secondary)] text-white' : 'opacity-60 grayscale'}`}>Leaderboard</button>
        </div>

        {view === 'scores' ? (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[var(--bg-window)] text-[var(--text-main)]">
             <div className="max-w-4xl mx-auto border-4 border-double border-[var(--border)] p-4 sm:p-8 relative">
                <h2 className="text-2xl sm:text-3xl font-black text-center mb-8 uppercase tracking-[0.3em]">Global Leaderboard</h2>
                
                {loadingLeaderboard ? (
                    <div className="flex justify-center py-12"><Loader className="animate-spin text-[var(--primary)]" size={32}/></div>
                ) : leaderboardData.length > 0 ? (
                    <div className="space-y-8">
                       {/* Group by Game and Mode */}
                       {Object.entries(
                           leaderboardData.reduce((acc, curr) => {
                               const key = curr.game_id + ' | ' + curr.mode;
                               if (!acc[key]) acc[key] = [];
                               acc[key].push(curr);
                               return acc;
                           }, {})
                       ).map(([groupKey, scores]) => (
                           <div key={groupKey} className="bg-[var(--bg-main)] retro-border p-4">
                               <h3 className="font-black text-xl uppercase text-[var(--primary)] mb-4 bg-black text-white inline-block px-3 py-1">{groupKey}</h3>
                               <div className="space-y-2">
                                  {scores.slice(0, 10).map((s, i) => (
                                      <div key={s.id || i} className="flex justify-between items-center bg-white p-2 border-b-2 border-dashed border-[var(--border)]">
                                          <div className="flex items-center gap-4">
                                              <span className="font-black text-xl opacity-40 w-6">#{i+1}</span>
                                              <span className="font-bold">{s.player_name || 'Unknown'}</span>
                                          </div>
                                          <span className="font-black text-[var(--secondary)] text-xl">{s.score}</span>
                                      </div>
                                  ))}
                               </div>
                           </div>
                       ))}
                    </div>
                ) : (
                    <div className="text-center opacity-60 font-bold py-12">No highscores recorded yet. Be the first!</div>
                )}
             </div>
          </div>
        ) : (
           <div className="flex-1 overflow-hidden flex flex-col bg-[var(--bg-main)]">
            {lobbyState?.gameId && (lobbyState?.players || []).includes(partnerId) && lobbyState?.status !== 'playing' && (
              <div className="bg-[var(--secondary)] text-[var(--text-on-secondary)] p-4 border-b-2 retro-border flex items-center justify-between gap-4 animate-pulse shrink-0">
                  <div className="flex items-center gap-3">
                      <Users className="shrink-0" />
                      <div>
                          <h2 className="text-sm font-black uppercase mb-0.5">{partnerName} is Waiting!</h2>
                          <p className="font-bold text-[10px] opacity-90">They are in a lobby for {GAME_CATALOG[lobbyState?.gameId]?.title || lobbyState?.gameId}.</p>
                      </div>
                  </div>
                  <RetroButton variant="white" className="text-black px-4 py-1.5 text-xs whitespace-nowrap" onClick={() => {
                    navigate(`/activities/${lobbyState?.gameId}`);
                  }}>View Lobby</RetroButton>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6 overflow-y-auto h-full">
            {Object.entries(GAME_CATALOG).map(([id, g]) => (
              <button 
                key={id} 
                onClick={() => { try{playAudio('click', sfx);}catch(e){} navigate(`/activities/${id}`); }}
                data-testid={`game-card-${id}`}
                className="game-card flex flex-col items-start p-6 bg-white border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all text-left"
              >
                <div className="w-5 h-5 mb-4 border-2 border-[var(--border)] shadow-[2px_2px_0_0_var(--border)]" style={{ backgroundColor: g.color }}></div>
                <h3 className="font-black text-lg mb-2 text-[var(--text-main)] tracking-tight">{g.title}</h3>
                <p className="text-xs text-[var(--text-main)] opacity-70 leading-tight font-medium">{g.desc}</p>
              </button>
            ))}
            </div>
          </div>
        )}
      </RetroWindow>
    );
  }


  
  const leaveLobby = () => {
      setLobbyState(prev => {
          const newPlayers = (prev.players || []).filter(p => p !== userId);
          if (newPlayers.length === 0) {
              return { gameId: null, status: 'waiting', players: [], config: null };
          }
          return { ...prev, players: newPlayers };
      });
      setShowLeaveConfirm(false);
      navigate('/activities');
  };

  const handleLeaveClick = () => {
      const currentPlayers = lobbyState?.players || [];
      const partnerInLobby = currentPlayers.includes(partnerId);
      if (!partnerInLobby) {
          setShowLeaveConfirm(true);
      } else {
          leaveLobby();
      }
  };

  // 2. Game Details / Mode Selector Phase

  if (currentPhase === 'details') {
      const partnerWaitingHere = lobbyState?.gameId === gameRoute && (lobbyState?.players || []).includes(partnerId) && lobbyState?.status !== 'playing';

      const hasSolo = game.modes.find(m => m.id === 'solo' || m.id === '1v1_local' || m.id === 'practice');
      const hasAI = game.modes.find(m => m.id === 'vs_ai');
      const partnerModes = game.modes.filter(m => m.type === 'remote');
      const hasPartner = partnerModes.length > 0;

      const topCategory = selectedModeId === 'solo' || selectedModeId === '1v1_local' || selectedModeId === 'practice' ? 'solo' : selectedModeId === 'vs_ai' ? 'ai' : partnerModes.some(m => m.id === selectedModeId) ? 'partner' : null;

      const handleCategoryClick = (cat) => {
          playAudio('click', sfx);
          if (cat === 'solo') setSelectedModeId(hasSolo?.id || 'solo');
          if (cat === 'ai') setSelectedModeId(hasAI?.id || 'vs_ai');
          if (cat === 'partner') {
              setSelectedModeId(partnerModes[0]?.id || 'partner');
          }
      };

      const activeModeObj = game.modes.find(m => m.id === selectedModeId) || game.modes[0];

      return (
        <RetroWindow title={`${gameRoute}_setup.exe`} onClose={() => navigate('/activities')} className="w-full max-w-md flex flex-col bg-white transition-all duration-300" noPadding>
          <div className="flex flex-col bg-white text-[var(--text-main)]">
             <div className="p-6 border-b-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center text-center shrink-0">
                 <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-widest" style={{ color: game.color || 'var(--primary)' }}>{game.title}</h1>
                 <p className="text-sm font-bold opacity-70 mt-2">{game.desc}</p>
             </div>

             <div className="p-4 sm:p-6 flex flex-col">
                 {partnerWaitingHere && (
                     <div className="bg-[var(--secondary)] text-[var(--text-on-secondary)] p-4 mb-6 retro-border flex items-center justify-between gap-4 animate-pulse">
                         <div>
                             <h2 className="text-lg font-black uppercase mb-1">Partner is Waiting!</h2>
                             <p className="font-bold text-xs opacity-90">They set up a lobby for {game.title}.</p>
                         </div>
                         <RetroButton variant="white" className="text-black px-4 py-2 text-sm" onClick={handleJoinLobby}>Join</RetroButton>
                     </div>
                 )}

                 <h3 className="text-sm font-black uppercase tracking-widest mb-4 opacity-50">Game Mode</h3>
                 
                 <div className="flex gap-3 mb-6 shrink-0">
                     {hasSolo && <RetroButton variant={topCategory === 'solo' ? 'primary' : 'white'} onClick={() => handleCategoryClick('solo')} className={`flex-1 py-3 text-sm ${topCategory !== 'solo' ? 'opacity-70' : ''}`}><User size={16} /> Solo</RetroButton>}
                     {hasAI && <RetroButton variant={topCategory === 'ai' ? 'primary' : 'white'} onClick={() => handleCategoryClick('ai')} className={`flex-1 py-3 text-sm ${topCategory !== 'ai' ? 'opacity-70' : ''}`}><Monitor size={16} /> With AI</RetroButton>}
                     {hasPartner && <RetroButton variant={topCategory === 'partner' ? 'primary' : 'white'} onClick={() => handleCategoryClick('partner')} className={`flex-1 py-3 text-sm ${topCategory !== 'partner' ? 'opacity-70' : ''}`}><Users size={16} /> With Partner</RetroButton>}
                 </div>
                 
                 {topCategory && (
                     <div className="bg-[var(--bg-window)] retro-border p-4 sm:p-6 flex-1 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                        {topCategory === 'partner' && partnerModes.length > 1 && (
                            <div className="mb-6">
                               <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-3 block">Partner Mode</label>
                               <div className="flex gap-2">
                                  {partnerModes.map(m => (
                                     <RetroButton key={m.id} variant={selectedModeId === m.id ? 'secondary' : 'white'} onClick={() => { playAudio('click', sfx); setSelectedModeId(m.id); }} className="flex-1 py-2 text-xs">
                                        {m.label.replace(' (Online)', '')}
                                     </RetroButton>
                                  ))}
                               </div>
                            </div>
                        )}

                        {activeModeObj?.diffs && (topCategory !== 'partner' || gameRoute === 'pictionary') && (
                            <div className="mb-6">
                                <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-3 block">Difficulty</label>
                                <div className="flex gap-2">
                                    {activeModeObj.diffs.map(d => (
                                        <button key={d} onClick={() => { playAudio('click', sfx); setSelectedDiff(d); }} className={`flex-1 py-2 text-xs font-bold uppercase retro-border transition-colors ${selectedDiff === d ? 'bg-[var(--primary)] text-white' : 'bg-white opacity-70 hover:opacity-100'}`}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeModeObj?.options && activeModeObj.options.map(opt => (
                            <div key={opt.key} className="mb-6">
                                <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-3 block">{opt.label}</label>
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
                        
                        <div className="mt-auto pt-6">
                            <RetroButton 
                                variant={topCategory === 'partner' ? 'accent' : 'primary'} 
                                className="w-full py-4 text-lg retro-shadow-dark flex items-center justify-center gap-2"
                                onClick={() => {
                                    if (topCategory === 'partner') {
                                        handleCreateLobby(activeModeObj);
                                        onShareToChat(`I'm waiting in the lobby for ${game.title}!`, null, { gameId: gameRoute, mode: activeModeObj.label, type: 'game_invite_modal' });
                                    } else {
                                        handleStartLocal(activeModeObj);
                                    }
                                }}
                            >
                                {topCategory === 'partner' ? <><Zap size={20}/> Proceed to Lobby</> : <><Play size={20}/> Start Game</>}
                            </RetroButton>
                        </div>
                     </div>
                 )}
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
    const isPartnerWhoWasLeft = !partnerInLobby && currentPlayers.length === 1 && lobbyState?.hostId !== userId;

    return (
      <>
      <RetroWindow title={`lobby_${gameRoute}.exe`} onClose={handleLeaveClick} className="w-full max-w-2xl bg-white" noPadding>
         <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-white">
            <h2 className="text-3xl font-black uppercase mb-2 text-[var(--primary)]">Arcade Lobby</h2>
            
            <div className="bg-[var(--bg-window)] border-2 border-black border-dashed px-6 py-2 mb-8 inline-flex flex-col items-center">
                <span className="font-black text-[var(--primary)] uppercase tracking-widest text-xl">{game?.title || gameRoute}</span>
                <span className="text-xs font-bold opacity-70 uppercase tracking-widest mt-1">Mode: {lobbyState?.config?.mode} | {lobbyState?.config?.diff ? `Diff: ${lobbyState.config.diff}` : 'Standard'}</span>
            </div>

            <div className="flex gap-8 items-center justify-center mb-10 w-full">
               <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-[var(--primary)] retro-border flex items-center justify-center text-[var(--text-on-primary)] shadow-[4px_4px_0_0_var(--border)] overflow-hidden">
                     {profile?.pfp ? <img src={profile.pfp} className="w-full h-full object-cover" /> : <span className="font-black text-2xl">P1</span>}
                  </div>
                  <span className="mt-3 font-bold text-[10px] uppercase bg-black text-white px-2 py-1 truncate max-w-[80px]">{myName || 'You'}</span>
               </div>

               <div className="text-2xl font-black opacity-30">VS</div>

               <div className="flex flex-col items-center">
                  <div className={`w-20 h-20 retro-border flex items-center justify-center transition-all overflow-hidden ${partnerInLobby ? 'bg-[var(--secondary)] text-[var(--text-on-secondary)] shadow-[4px_4px_0_0_var(--border)]' : 'bg-transparent border-dashed opacity-50'}`}>
                     {partnerInLobby && roomProfiles?.[partnerId]?.pfp ? <img src={roomProfiles[partnerId].pfp} className="w-full h-full object-cover" /> : <span className="font-black text-2xl">{partnerInLobby ? 'P2' : '?'}</span>}
                  </div>
                  {partnerInLobby ? (
                     <span className="mt-3 font-bold text-[10px] uppercase bg-black text-white px-2 py-1 truncate max-w-[80px]">{partnerName}</span>
                  ) : (
                     <span className="mt-3 font-bold text-[10px] uppercase flex items-center gap-1 opacity-60"><Loader size={12} className="animate-spin" /> Waiting</span>
                  )}
               </div>
            </div>

            {lobbyState?.status === 'starting' ? (
                <div className="py-4">
                    <ScoreboardCountdown count={3} onComplete={() => setLobbyState(prev => ({ ...prev, status: 'playing' }))} sfx={sfx} />
                </div>
            ) : isReady ? (
               <button onClick={() => setLobbyState(prev => ({ ...prev, status: 'starting' }))} className="bg-[var(--primary)] text-[var(--text-on-primary)] font-black text-xl px-12 py-4 retro-border shadow-[4px_4px_0_0_var(--border)] hover:translate-y-[2px] hover:shadow-none transition-all animate-pulse cursor-pointer">
                 START GAME
               </button>
            ) : (
               <div className="flex flex-col gap-3">
                 <p className={`text-xs font-bold italic ${isPartnerWhoWasLeft ? 'text-red-500 opacity-100' : 'opacity-60'}`}>
                    {isPartnerWhoWasLeft ? 'Your partner has left the lobby.' : 'Waiting for partner to accept the invite...'}
                 </p>
                 <RetroButton onClick={() => onShareToChat(`Join my lobby for ${game?.title || gameRoute}!`, null, { gameId: gameRoute, mode: lobbyState?.config?.mode, type: 'game_invite_modal' })} className="text-xs">
                    {isPartnerWhoWasLeft ? 'Send Invite Again' : 'Resend Invite'}
                 </RetroButton>
               </div>
            )}
         </div>
      </RetroWindow>
      {showLeaveConfirm && (
        <ConfirmDialog 
          title="leave_lobby.exe" 
          message="Are you sure you want to leave lobby? An invitation has been sent to your partner." 
          onConfirm={() => { playAudio('click', sfx); leaveLobby(); }} 
          onCancel={() => { playAudio('click', sfx); setShowLeaveConfirm(false); }} 
          showSave={false} 
          sfx={sfx}
        />
      )}
      </>
    );
  }

  // 4. Active Game Phase
  if (currentPhase === 'playing_local' || currentPhase === 'playing_remote') {
      return renderActiveGame();
  }

  return null;
}
