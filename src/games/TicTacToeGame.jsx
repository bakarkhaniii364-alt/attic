import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { RefreshCw } from 'lucide-react';

export function TicTacToe({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook }) {
  const size = config.size || 3;
  const p1 = config.p1Avatar || 'X';
  const p2 = config.p2Avatar || 'O';
  const matchType = config.matchType || 1;
  const winsRequired = Math.ceil(matchType / 2);

  const [board, setBoard] = useState(Array(size * size).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [gameOverOverlay, setGameOverOverlay] = useState(false);
  const [p1Wins, setP1Wins] = useState(0); 
  const [p2Wins, setP2Wins] = useState(0);
  const [pieceQueue, setPieceQueue] = useState([]); 
  const [winLine, setWinLine] = useState(null); 
  
  const [stats, setLocalStats] = useLocalStorage('tictactoe_lifetime', { wins: 0, losses: 0, draws: 0 });

  const calculateWinner = (squares) => {
    const minReq = size === 3 ? 3 : 4;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const player = squares[r * size + c];
            if (!player) continue;
            if (c + minReq <= size) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push(r * size + c + k); if(squares[r * size + c + k] !== player) match = false; }
                if (match) return { player, line: path, dir: 'h' };
            }
            if (r + minReq <= size) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push((r + k) * size + c); if(squares[(r + k) * size + c] !== player) match = false; }
                if (match) return { player, line: path, dir: 'v' };
            }
            if (r + minReq <= size && c + minReq <= size) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push((r + k) * size + c + k); if(squares[(r + k) * size + c + k] !== player) match = false; }
                if (match) return { player, line: path, dir: 'd1' };
            }
            if (r + minReq <= size && c - minReq + 1 >= 0) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push((r + k) * size + c - k); if(squares[(r + k) * size + c - k] !== player) match = false; }
                if (match) return { player, line: path, dir: 'd2' };
            }
        }
    }
    return null;
  };

  const winData = calculateWinner(board); 
  const isDraw = !winData && !board.includes(null);

  useEffect(() => {
    if (winData) {
      setWinLine(winData.line);
      playAudio('win', sfx);
      let matchOver = false;
      if (winData.player === p1) { 
          if (p1Wins + 1 >= winsRequired) matchOver = true; 
      } else { 
          if (p2Wins + 1 >= winsRequired) matchOver = true; 
      }

      setTimeout(() => {
          if (winData.player === p1) setP1Wins(w=>w+1); else setP2Wins(w=>w+1);
          if (matchOver) {
              setGameOverOverlay(true);
              if (winData.player === p1) {
                  onWin(); 
                  setScores(p => ({ ...p, tictactoe: getScore(p, 'tictactoe') + 1 }));
                  setLocalStats(p => ({...p, wins: p.wins+1}));
              } else {
                  setLocalStats(p => ({...p, losses: p.losses+1}));
              }
          } else {
              setBoard(Array(size * size).fill(null)); setPieceQueue([]); setWinLine(null); setXIsNext(true);
          }
      }, 1500);
      
    } else if (isDraw) { 
        setTimeout(() => {
             setLocalStats(p => ({...p, draws: p.draws+1}));
             setBoard(Array(size * size).fill(null)); setPieceQueue([]); setXIsNext(true);
        }, 1500); 
    }
  }, [winData, isDraw]);

  const minimax = (currBoard, depth, isMaximizing, alpha=-Infinity, beta=Infinity) => {
    const res = calculateWinner(currBoard);
    if (res?.player === p2) return 10 - depth;
    if (res?.player === p1) return depth - 10;
    if (!currBoard.includes(null)) return 0;
    if (size > 3 && depth >= 3) return 0; // Prevent freeze on 4x4+

    if (isMaximizing) { 
        let bestScore = -Infinity; 
        for (let i = 0; i < size*size; i++) { 
            if (!currBoard[i]) { 
                currBoard[i] = p2; let score = minimax(currBoard, depth + 1, false, alpha, beta); currBoard[i] = null; 
                bestScore = Math.max(score, bestScore); alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            } 
        } 
        return bestScore; 
    } else { 
        let bestScore = Infinity; 
        for (let i = 0; i < size*size; i++) { 
            if (!currBoard[i]) { 
                currBoard[i] = p1; let score = minimax(currBoard, depth + 1, true, alpha, beta); currBoard[i] = null; 
                bestScore = Math.min(score, bestScore); beta = Math.min(beta, score);
                if (beta <= alpha) break;
            } 
        } 
        return bestScore; 
    }
  };

  const makeAIMove = (currentBoard) => {
    const empty = currentBoard.map((v, i) => v === null ? i : null).filter(v => v !== null); if (empty.length === 0) return null;
    if (config.diff === 'easy' || (size > 3 && depthLimitRandom())) return empty[Math.floor(Math.random() * empty.length)];
    if (config.diff === 'medium' && Math.random() > 0.4) return empty[Math.floor(Math.random() * empty.length)];
    
    let bestScore = -Infinity; let move = empty[0];
    for (let i = 0; i < size*size; i++) { 
        if (!currentBoard[i]) { 
            currentBoard[i] = p2; let score = minimax(currentBoard, 0, false); currentBoard[i] = null; 
            if (score > bestScore) { bestScore = score; move = i; } 
        } 
    }
    return move;
  };
  
  const depthLimitRandom = () => {
    return (config.diff !== 'hard' && Math.random() > 0.2); // For 4x4/5x5 we fallback to random mostly unless Hard, where we still suffer 3 depth limit.
  }

  useEffect(() => {
    if (config.mode === 'vs_ai' && !xIsNext && !winData && !isDraw) { 
        const timer = setTimeout(() => { 
            const aiMove = makeAIMove([...board]); 
            if (aiMove !== null) handlePlacePiece(aiMove, p2); 
        }, 600); 
        return () => clearTimeout(timer); 
    }
  }, [xIsNext, board, winData, isDraw, config]);

  const handlePlacePiece = (i, player) => {
    playAudio('click', sfx); let newBoard = [...board]; let newQueue = [...pieceQueue];
    if (config.mode === 'memory') {
      const maxPieces = size === 3 ? 3 : 4;
      const playerPieces = newQueue.filter(p => p.player === player);
      if (playerPieces.length >= maxPieces) { const oldest = newQueue.find(p => p.player === player); newBoard[oldest.index] = null; newQueue = newQueue.filter(p => p !== oldest); }
      newQueue.push({ player, index: i }); setPieceQueue(newQueue);
    }
    newBoard[i] = player; setBoard(newBoard); setXIsNext(player === p2);
  };

  const handleClick = (i) => { if (board[i] || winData || (config.mode === 'vs_ai' && !xIsNext)) return; handlePlacePiece(i, xIsNext ? p1 : p2); };
  
  const resetSeries = () => { playAudio('click', sfx); setBoard(Array(size*size).fill(null)); setXIsNext(true); setGameOverOverlay(false); setWinLine(null); setPieceQueue([]); setP1Wins(0); setP2Wins(0); };

  if (gameOverOverlay) {
    const overallWinner = p1Wins >= winsRequired ? p1 : p2;
    return ( 
        <ShareOutcomeOverlay gameName={`Tic-Tac-Toe (${config.mode})`} stats={{ Series: `Best of ${matchType}`, Result: `${overallWinner} takes the crown!`, "Final Score": `${p1Wins} - ${p2Wins}`, "Life Wins": stats.wins, "Life Losses": stats.losses }} onClose={() => {resetSeries(); onBack();}} onShareToChat={onShareToChat} onSaveToScrapbook={onSaveToScrapbook} sfx={sfx} /> 
    );
  }

  const renderWinLine = () => {
    if (!winLine || size > 3) return null; // Simplified CSS line for 3x3. For 4x4 and 5x5, dynamic strike lines are complex.
    const [a, b, c] = winLine; let style = {};
    if (a === 0 && c === 2) style = { top: '16%', left: '5%', width: '90%', height: '8px' }; else if (a === 3 && c === 5) style = { top: '50%', left: '5%', width: '90%', height: '8px', transform: 'translateY(-50%)' }; else if (a === 6 && c === 8) style = { bottom: '16%', left: '5%', width: '90%', height: '8px' }; else if (a === 0 && c === 6) style = { left: '16%', top: '5%', height: '90%', width: '8px' }; else if (a === 1 && c === 7) style = { left: '50%', top: '5%', height: '90%', width: '8px', transform: 'translateX(-50%)' }; else if (a === 2 && c === 8) style = { right: '16%', top: '5%', height: '90%', width: '8px' }; else if (a === 0 && c === 8) style = { top: '50%', left: '-10%', width: '120%', height: '8px', transform: 'rotate(45deg)' }; else if (a === 2 && c === 6) style = { top: '50%', left: '-10%', width: '120%', height: '8px', transform: 'rotate(-45deg)' }; 
    return <div className="absolute bg-[var(--primary)] retro-border shadow-[0_0_15px_var(--primary)] z-10 pointer-events-none rounded-full animate-in zoom-in-0" style={style}></div>;
  };

  const oppName = config.mode === '1v1_local' || config.mode === 'memory' ? `P2 (${p2})` : `AI (${p2})`;

  const renderCrowns = (wins) => {
      let crowns = [];
      for(let i=0; i<winsRequired; i++) {
          crowns.push(<span key={i} className={`text-xl ${i < wins ? 'text-yellow-400 opacity-100' : 'text-gray-400 opacity-30 grayscale'} drop-shadow-md`}>👑</span>);
      }
      return <div className="flex gap-1">{crowns}</div>;
  }

  // Calculate cell size
  const cellSize = size === 3 ? 'w-20 h-20 sm:w-24 sm:h-24 text-4xl' : size === 4 ? 'w-16 h-16 sm:w-20 sm:h-20 text-3xl' : 'w-12 h-12 sm:w-16 sm:h-16 text-2xl';

  return (
    <RetroWindow title={`tictactoe_${config.mode}.exe`} className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[750px]" onClose={onBack}>
      <div className="flex flex-col items-center pb-8 pt-4">
        
        {matchType > 1 && (
            <div className="flex w-full justify-between px-4 sm:px-8 mb-6 bg-[var(--bg-window)] retro-border p-2 shadow-inner">
                <div className="flex flex-col items-center"><span className="text-[var(--primary-hover)] font-bold text-sm mb-1">P1 ({p1})</span>{renderCrowns(p1Wins)}</div>
                <div className="font-bold text-xs opacity-50 uppercase tracking-widest pt-5">Best of {matchType}</div>
                <div className="flex flex-col items-center"><span className="text-[var(--secondary)] font-bold text-sm mb-1">{oppName}</span>{renderCrowns(p2Wins)}</div>
            </div>
        )}

        {matchType === 1 && <div className="flex w-full justify-between px-8 mb-4 font-bold text-lg"><span className="text-[var(--primary-hover)]">P1 ({p1}): {p1Wins}</span><span className="text-[var(--secondary)]">{oppName}: {p2Wins}</span></div>}

        <div className={`mb-6 font-bold text-sm sm:text-lg px-6 py-2 retro-border retro-shadow-dark text-center w-3/4 max-w-xs ${!winData && !isDraw ? (xIsNext ? 'retro-bg-primary' : 'retro-bg-secondary') : 'retro-bg-accent'}`}>{winData ? `Round to ${winData.player}!` : isDraw ? "Round Draw!" : config.mode === 'vs_ai' ? (xIsNext ? `Your Turn (${p1})` : 'AI is thinking...') : `Player ${xIsNext ? p1 : p2}'s Turn`}</div>
        
        <div className="relative p-2 bg-[var(--border)] retro-border retro-shadow-dark rounded-sm">
          <div className="grid gap-2 z-0 relative" style={{gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`}}>
            {board.map((cell, i) => {
              let isFading = false;
              let isWinningPiece = false;
              if (config.mode === 'memory' && cell) { 
                  const playerPieces = pieceQueue.filter(p => p.player === cell); 
                  const maxP = size===3?3:4;
                  if (playerPieces.length === maxP && playerPieces[0].index === i) isFading = true; 
              }
              if (winLine && winLine.includes(i)) isWinningPiece = true;

              return ( 
                  <button key={i} onClick={() => handleClick(i)} className={`${cellSize} retro-bg-window flex items-center justify-center font-bold transition-all duration-300 transform ${isFading && !winData ? 'animate-pulse opacity-30 drop-shadow-none' : ''} ${isDraw ? 'animate-fall opacity-0 delay-700' : ''} ${isWinningPiece ? 'scale-110 !bg-[var(--accent)] ring-2 ring-[var(--border)] z-10' : ''}`}><span className={cell === p1 ? 'text-[var(--primary-hover)] drop-shadow-md' : 'text-[var(--secondary)] drop-shadow-md'}>{cell}</span></button> 
              )
            })}
          </div>
          {renderWinLine()}
        </div>
        <RetroButton className="mt-8 px-6 py-3 text-sm opacity-80 border-dashed" onClick={resetSeries}><RefreshCw size={14} className="inline mr-2" /> restart series</RetroButton>
      </div>
    </RetroWindow>
  );
}
