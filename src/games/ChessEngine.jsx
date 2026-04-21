import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { Chess } from 'chess.js';
import { RotateCcw, Flag, Image as ImageIcon, Settings, Clock, Crosshair, ClipboardCopy } from 'lucide-react';

const PIECE_SKINS = {
    classic: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔', P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' },
    modern:  { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚', P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' }, // uses colors via css
};

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PUZZLES = [
    "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1", // Mate in 1
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", // Ruy lopez
];

export function ChessEngine({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook }) {
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [selectedSq, setSelectedSq] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [skin, setSkin] = useState('classic');
  const [history, setHistory] = useState([]);
  
  const [wTime, setWTime] = useState(10 * 60);
  const [bTime, setBTime] = useState(10 * 60);
  const [gameOverResult, setGameOverResult] = useState(null);
  
  const [showSettings, setShowSettings] = useState(false);
  
  useEffect(() => {
     let timer;
     if (!gameOverResult && history.length > 0) {
         timer = setInterval(() => {
             if (chess.turn() === 'w') {
                 setWTime(t => { if(t<=1){ setGameOverResult("Black Wins on Time"); return 0;} return t-1;});
             } else {
                 setBTime(t => { if(t<=1){ setGameOverResult("White Wins on Time"); return 0;} return t-1;});
             }
         }, 1000);
     }
     return () => clearInterval(timer);
  }, [chess.turn(), gameOverResult, history.length]);

  const loadFen = (f) => {
      try {
          chess.load(f);
          setFen(chess.fen());
          setHistory([]);
          setSelectedSq(null);
          setValidMoves([]);
          setGameOverResult(null);
      } catch(e) { alert("Invalid FEN"); }
  };

  const getMaterialDiff = () => {
      const b = chess.board(); let wM = 0; let bM = 0;
      const vals = { p:1, n:3, b:3, r:5, q:9, k:0 };
      for(let r=0; r<8; r++){
          for(let c=0; c<8; c++){
              if (b[r][c]) {
                  if (b[r][c].color === 'w') wM += vals[b[r][c].type];
                  else bM += vals[b[r][c].type];
              }
          }
      }
      return wM - bM;
  };

  const evalPerc = 50 + (getMaterialDiff() * 3);

  const makeMove = (moveObj) => {
      try {
          const move = chess.move(moveObj);
          if (move) {
              playAudio('click', sfx);
              setFen(chess.fen());
              setHistory(chess.history({ verbose: true }));
              setSelectedSq(null);
              setValidMoves([]);
              
              if (chess.isCheckmate()) { playAudio('win', sfx); setGameOverResult(`${chess.turn() === 'w' ? 'Black' : 'White'} Wins by Checkmate!`); setScores(p => ({ ...p, chess: getScore(p, 'chess') + 1 })); onWin(); }
              else if (chess.isDraw()) { setGameOverResult("Draw"); }
              else if (chess.isStalemate()) { setGameOverResult("Draw by Stalemate"); }
              
              if (config.mode === 'vs_ai' && !chess.isGameOver() && chess.turn() === 'b') {
                  setTimeout(() => {
                      const moves = chess.moves();
                      if(moves.length > 0) {
                          const randMove = moves[Math.floor(Math.random() * moves.length)];
                          chess.move(randMove);
                          setFen(chess.fen()); setHistory(chess.history({ verbose: true }));
                          if (chess.isCheckmate()) setGameOverResult("Black Wins by Checkmate!");
                      }
                  }, 500);
              }
          }
      } catch(e) {}
  };

  const handleSquareClick = (sq) => {
      if (gameOverResult || (config.mode === 'vs_ai' && chess.turn() === 'b')) return;

      if (selectedSq) {
          const move = validMoves.find(m => m.to === sq);
          if (move) {
              let promotion = undefined;
              if (move.flags.includes('p')) promotion = prompt("Promote to (q, r, b, n):", "q") || 'q';
              makeMove({ from: selectedSq, to: sq, promotion });
              return;
          }
      }
      const piece = chess.get(sq);
      if (piece && piece.color === chess.turn()) {
          setSelectedSq(sq);
          setValidMoves(chess.moves({ square: sq, verbose: true }));
      } else {
          setSelectedSq(null);
          setValidMoves([]);
      }
  };

  const handleDragStart = (e, sq) => {
      const piece = chess.get(sq);
      if (!piece || piece.color !== chess.turn()) { e.preventDefault(); return; }
      setSelectedSq(sq);
      setValidMoves(chess.moves({ square: sq, verbose: true }));
      e.dataTransfer.setData("text/plain", sq);
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, sq) => {
      e.preventDefault();
      const fromSq = e.dataTransfer.getData("text");
      if (fromSq && fromSq !== sq) {
          const move = validMoves.find(m => m.to === sq);
          if (move) {
              let promotion = undefined;
              if (move.flags.includes('p')) promotion = 'q'; // Default to q on drag
              makeMove({ from: fromSq, to: sq, promotion });
          }
      }
  };

  const renderBoard = () => {
      const boardArr = chess.board();
      if (isFlipped) boardArr.reverse().forEach(r => r.reverse());
      
      const files = ['a','b','c','d','e','f','g','h'];
      const ranks = ['8','7','6','5','4','3','2','1'];
      if(isFlipped) { files.reverse(); ranks.reverse(); }

      const lastMove = history.length > 0 ? history[history.length-1] : null;

      return (
          <div className="w-full max-w-[320px] sm:max-w-[420px] aspect-square grid grid-cols-8 grid-rows-8 retro-border border-4 border-[var(--border)] retro-shadow-dark select-none relative">
              {boardArr.map((row, rIdx) => 
                  row.map((piece, cIdx) => {
                      const sq = `${files[cIdx]}${ranks[rIdx]}`;
                      const isDark = (rIdx + cIdx) % 2 !== 0;
                      const isSelected = selectedSq === sq;
                      const isValidTarget = validMoves.some(m => m.to === sq);
                      const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);
                      const inCheck = piece?.type === 'k' && piece?.color === chess.turn() && chess.inCheck();

                      let bgClass = isDark ? 'bg-[#c5a880]' : 'bg-[#f0d9b5]';
                      if (inCheck) bgClass = 'bg-red-400';
                      else if (isSelected) bgClass = '!bg-[var(--accent)]';
                      else if (isLastMove) bgClass = 'bg-yellow-300';
                      
                      return (
                          <div key={sq} onClick={() => handleSquareClick(sq)} onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e,sq)} className={`relative flex justify-center items-center ${bgClass} ${isValidTarget?'cursor-pointer':''} transition-colors`}>
                              {isValidTarget && <div className="absolute w-3 h-3 bg-black/20 rounded-full z-0 pointer-events-none"></div>}
                              {piece && (
                                  <div draggable onDragStart={(e)=>handleDragStart(e,sq)} className={`z-10 text-4xl sm:text-5xl cursor-grab active:cursor-grabbing hover:scale-110 transition-transform ${piece.color === 'w' && skin === 'modern' ? 'text-white drop-shadow-md' : 'text-black drop-shadow-sm'}`}>
                                      {PIECE_SKINS[skin][piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
                                  </div>
                              )}
                          </div>
                      );
                  })
              )}
          </div>
      );
  };

  const fmtTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  if (gameOverResult) {
      return ( <ShareOutcomeOverlay gameName="Chess" stats={{ Result: gameOverResult, "Moves Played": history.length, "Mode": config.mode==='vs_ai'?'VS AI':'Local 1v1' }} onClose={() => { loadFen(INITIAL_FEN); setGameOverResult(null); onBack();}} onShareToChat={onShareToChat} onSaveToScrapbook={onSaveToScrapbook} sfx={sfx} /> );
  }

  return (
    <RetroWindow title={`chess_${config.mode}.exe`} className="w-full max-w-5xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold px-4 flex-shrink-0 relative overflow-hidden">
         <div className="w-full h-1 bg-red-400 absolute bottom-0 left-0"><div className="h-full bg-green-400 transition-all" style={{width: `${Math.max(0, Math.min(100, evalPerc))}%`}}></div></div>
         <span><Crosshair size={14} className="inline mr-1"/> Eval: {getMaterialDiff() > 0 ? '+'+getMaterialDiff() : getMaterialDiff()}</span>
         <span><Clock size={14} className="inline mr-1"/> {fmtTime(history.length % 2 === (isFlipped ? 1 : 0) ? bTime : wTime)}</span>
         <button onClick={()=>setShowSettings(!showSettings)} className="bg-white/20 px-2 py-1 rounded hover:bg-white/40 active:translate-y-px"><Settings size={14}/></button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
          
          {showSettings && (
             <div className="absolute right-0 top-0 bottom-0 w-64 bg-[var(--bg-window)] retro-border-l z-50 p-4 overflow-y-auto retro-shadow-dark animate-in slide-in-from-right">
                <h3 className="font-bold border-b border-black/10 pb-2 mb-4">Board Settings</h3>
                <div className="space-y-4 text-sm">
                    <RetroButton variant="white" onClick={() => {setIsFlipped(!isFlipped); playAudio('click',sfx)}} className="w-full py-2"><RotateCcw size={14} className="inline mr-2"/> Flip Board</RetroButton>
                    <RetroButton variant="white" onClick={() => {setSkin(skin==='classic'?'modern':'classic'); playAudio('click',sfx)}} className="w-full py-2"><ImageIcon size={14} className="inline mr-2"/> Switch Skin ({skin})</RetroButton>
                    <div className="pt-2 border-t border-black/10">
                        <label className="font-bold opacity-70 block mb-1">Load FEN String</label>
                        <input type="text" value={fen} onChange={(e)=>setFen(e.target.value)} className="w-full p-2 text-xs retro-border" />
                        <RetroButton variant="accent" onClick={() => loadFen(fen)} className="w-full py-1 mt-1 text-xs">Load Position</RetroButton>
                    </div>
                    <div className="pt-2 border-t border-black/10">
                        <label className="font-bold opacity-70 block mb-1">Load Puzzle</label>
                        <RetroButton variant="white" onClick={() => loadFen(PUZZLES[0])} className="w-full py-1 mt-1 text-xs">Mate in 1</RetroButton>
                        <RetroButton variant="white" onClick={() => loadFen(PUZZLES[1])} className="w-full py-1 mt-1 text-xs">Ruy Lopez Opening</RetroButton>
                    </div>
                    <div className="pt-4 border-t border-black/10 text-xs opacity-70">Hint: Try dragging pieces!</div>
                </div>
             </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[#f8f9fa] relative">
              <div className="w-full max-w-[320px] sm:max-w-[420px] flex justify-between mb-2">
                 <div className="font-bold text-sm bg-black text-white px-3 py-1 rounded shadow-md">{isFlipped?'White':'Black'} {fmtTime(isFlipped?wTime:bTime)}</div>
              </div>
              
              {renderBoard()}
              
              <div className="w-full max-w-[320px] sm:max-w-[420px] flex justify-between mt-2">
                 <div className="font-bold text-sm bg-white border border-black/20 px-3 py-1 rounded shadow-md">{isFlipped?'Black':'White'} {fmtTime(isFlipped?bTime:wTime)}</div>
              </div>
          </div>

          <div className="w-full md:w-64 bg-[var(--bg-main)] retro-border-l md:h-full overflow-hidden flex flex-col shrink-0">
             <div className="p-2 font-bold opacity-70 border-b border-black/10 text-sm flex justify-between items-center bg-[var(--bg-window)]">
                 Notation History
                 <button onClick={() => navigator.clipboard.writeText(chess.pgn())} title="Copy PGN"><ClipboardCopy size={14}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 font-mono text-xs sm:text-sm bg-white">
                 {history.reduce((acc, mv, i) => {
                     if (i % 2 === 0) acc.push([mv.san]);
                     else acc[acc.length-1].push(mv.san);
                     return acc;
                 }, []).map((pair, i) => (
                     <div key={i} className={`flex gap-4 p-1 ${i%2===0?'bg-gray-50':''} hover:bg-[var(--accent)] transition-colors`}>
                         <span className="opacity-50 w-6">{i+1}.</span>
                         <span className="w-12 font-bold">{pair[0]}</span>
                         <span className="w-12 font-bold">{pair[1] || ''}</span>
                     </div>
                 ))}
                 {history.length === 0 && <div className="text-center opacity-50 p-4">Make a move to start...</div>}
             </div>
             <div className="p-3 bg-[var(--bg-window)] retro-border-t shrink-0">
                 <RetroButton variant="secondary" onClick={() => {if(window.confirm('Resign?')) setGameOverResult(`${chess.turn()==='w'?'Black':'White'} Wins by Resignation`)}} className="w-full py-2 flex items-center justify-center gap-2 text-sm"><Flag size={14}/> Resign</RetroButton>
             </div>
          </div>

      </div>
    </RetroWindow>
  );
}
