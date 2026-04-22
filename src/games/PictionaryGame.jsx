import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { calculateLevenshtein, floodFill } from '../utils/helpers.js';
import { incrementUserScore, getScoreForUser } from '../utils/userDataHelpers.js';
import { PICTIONARY_CATEGORIES } from '../constants/data.js';
import { Brush, Undo2, Trash2, PenTool, Eraser, Grid, Lightbulb, SkipForward, PaintBucket, Smile } from 'lucide-react';

export function PictionaryGame({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, userId, partnerId }) {
  const [gameState, setGameState] = useState('prep'); 
  const [turn, setTurn] = useState(1);
  const [isDrawer, setIsDrawer] = useState(true);
  const [word, setWord] = useState('LOADING');
  const [displayWord, setDisplayWord] = useState([]);
  const [guess, setGuess] = useState('');
  const [hotCold, setHotCold] = useState('');
  
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [tool, setTool] = useState('pen'); 
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [undoStack, setUndoStack] = useState([]);
  
  const timerLength = parseInt(config.diff) || 60;
  const [timeLeft, setTimeLeft] = useState(timerLength);
  const [finalImage, setFinalImage] = useState(null);
  
  const [gridEnabled, setGridEnabled] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [fakeCursor, setFakeCursor] = useState({ x: 0, y: 0, show: false });

  const getNewWord = () => {
    if (config.category === 'custom' && config.customWord) return config.customWord;
    const words = PICTIONARY_CATEGORIES[config.category] || PICTIONARY_CATEGORIES.animals; 
    return words[Math.floor(Math.random() * words.length)];
  };

  const startRound = () => { 
    playAudio('click', sfx); 
    const newWord = getNewWord();
    setWord(newWord);
    setDisplayWord(newWord.split('').map(() => '_'));
    setTimeLeft(timerLength); 
    setGameState('drawing'); 
    setUndoStack([]); 
    // default: the user who started the round is the drawer
    setIsDrawer(true);
  };

  const handleSkip = () => {
      playAudio('click', sfx);
      const newWord = getNewWord();
      setWord(newWord);
      setDisplayWord(newWord.split('').map(() => '_'));
      // Penalize drawer for skip (per-user)
      setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1));
  };

  useEffect(() => { 
      let timer; 
      if (gameState === 'guessing' || gameState === 'drawing') { 
        timer = setInterval(() => { 
          setTimeLeft(prev => { 
            if (prev <= 1) { clearInterval(timer); setGameState('lost'); return 0; } 
            return prev - 1; 
          }); 
        }, 1000); 
      } 
      return () => clearInterval(timer); 
  }, [gameState]);

  const updateCanvasResolution = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); if (rect.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!canvas.dataset.initialized) { canvas.width = rect.width; canvas.height = rect.height; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); canvas.dataset.initialized = 'true'; saveStateToUndo(); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  useEffect(() => { if (gameState === 'drawing') updateCanvasResolution(); }, [gameState]);

  const saveStateToUndo = () => { const canvas = canvasRef.current; if (!canvas) return; setUndoStack(prev => [...prev, canvas.toDataURL()]); };
  const handleUndo = () => {
    playAudio('click', sfx); if (undoStack.length <= 1) return; 
    const newStack = [...undoStack]; newStack.pop(); const previousState = newStack[newStack.length - 1];
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    const img = new Image(); img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img, 0, 0); }; img.src = previousState;
    setUndoStack(newStack);
  };

  const getCoords = (e) => { const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }; };

  const handlePointerDown = (e) => { 
      if (gameState !== 'drawing') return; 
      const { x, y } = getCoords(e); 
      
      if (tool === 'pattern') {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          const pCanvas = document.createElement('canvas');
          pCanvas.width = 20; pCanvas.height = 20;
          const pCtx = pCanvas.getContext('2d');
          pCtx.fillStyle = '#ffffff'; pCtx.fillRect(0,0,20,20);
          pCtx.fillStyle = color; pCtx.beginPath(); pCtx.arc(10,10,5,0,2*Math.PI); pCtx.fill();
          const pattern = ctx.createPattern(pCanvas, 'repeat');
          ctx.fillStyle = pattern;
          ctx.fillRect(0,0,canvas.width,canvas.height);
          saveStateToUndo();
          return;
      }
      if (tool === 'fill') {
          floodFill(canvasRef.current, Math.floor(x), Math.floor(y), color);
          saveStateToUndo();
          return;
      }
      
      isDrawingRef.current = true; 
      const ctx = canvasRef.current.getContext('2d'); 
      ctx.beginPath(); ctx.moveTo(x, y); 
      setFakeCursor({ x, y, show: true });
  };
  const handlePointerMove = (e) => { 
      const { x, y } = getCoords(e); 
      if (gameState === 'drawing') setFakeCursor({ x, y, show: true });
      if (!isDrawingRef.current || gameState !== 'drawing') return; 
      const ctx = canvasRef.current.getContext('2d'); 
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; 
      ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize; 
      ctx.lineTo(x, y); ctx.stroke(); 
  };
  const handlePointerUp = () => { 
      if(isDrawingRef.current) { isDrawingRef.current = false; saveStateToUndo(); } 
      if (gameState === 'drawing') setFakeCursor(p => ({...p, show: false}));
  };
  const handleClear = () => { if (window.confirm("Are you sure you want to clear the entire canvas?")) { playAudio('click', sfx); const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); saveStateToUndo(); } };

  const submitGuess = (e) => { 
      e.preventDefault(); 
      if (guess.toUpperCase() === word.toUpperCase()) { 
          onWin(); 
          setGameState('won'); 
          setFinalImage(canvasRef.current.toDataURL()); 
          let pts = 1;
          if (timeLeft >= timerLength - 10) pts = 2; // Speed multiplier
        // Award points to the guesser (current user)
        setScores(prev => incrementUserScore(prev, userId, 'pictionary', pts));
      } else { 
          playAudio('click', sfx); 
          const dist = calculateLevenshtein(guess.toUpperCase(), word.toUpperCase());
          if (dist <= 2) setHotCold("🔥 Hot!");
          else if (dist <= 4) setHotCold("🌞 Warm");
          else setHotCold("❄️ Cold");
      } 
      setGuess(''); 
  };

  const useHint = () => {
    playAudio('click', sfx);
    const hidden = []; displayWord.forEach((char, i) => { if (char === '_') hidden.push(i); });
    if (hidden.length === 0) return;
    const rnd = hidden[Math.floor(Math.random() * hidden.length)];
    const newDisplay = [...displayWord];
    newDisplay[rnd] = word[rnd];
    setDisplayWord(newDisplay);
    // hint costs the current user a point
    setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1));
  };

  const spawnEmoji = () => {
      const eList = ['👍', '🤣', '👎', '❤️', '🔥', '👀'];
      const emj = eList[Math.floor(Math.random()*eList.length)];
      setFloatingEmojis(p => [...p, { id: Date.now(), emj, left: Math.random()*80+10, top: Math.random()*80+10 }]);
      setTimeout(() => { setFloatingEmojis(p => p.slice(1)); }, 2000);
  };

    if (gameState === 'won' || gameState === 'lost') { 
      return ( <ShareOutcomeOverlay gameName="Pictionary" stats={{ Result: gameState === 'won' ? 'Victory!' : 'Time Up', Word: word, "Time Left": `${timeLeft}s` }} resultImage={finalImage} onClose={onBack} onShareToChat={onShareToChat} onSaveToScrapbook={onSaveToScrapbook} sfx={sfx} /> ); 
    }

  if (gameState === 'prep') {
    return (
      <RetroWindow title="pictionary.exe" className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-bold mb-4">{profile && profile.name ? `You're the Drawer — ${profile.name}` : `Your Turn to Draw`}</h2>
          <div className="w-full mb-6"><p className="font-bold opacity-70 mb-1 text-sm">Category: {config.category}</p><p className="font-bold opacity-70 text-xs">Timer: {timerLength}s limit.</p></div>
          <RetroButton className="w-full py-4 text-lg" onClick={startRound}>View Secret Word</RetroButton>
        </div>
      </RetroWindow>
    );
  }

  return (
    <RetroWindow title="pictionary.exe" className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col relative" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold">
         <span className={timeLeft < 10 ? 'text-red-400 animate-pulse-fast' : ''}>⏳ {timeLeft}s</span>
         {gameState === 'drawing' ? (
           <div className="flex items-center gap-2">
             <span className="text-sm opacity-80">{isDrawer ? 'You are drawing' : (profile?.partnerNickname || 'Partner') + ' is drawing'}</span>
             <RetroButton variant="white" onClick={() => {setGameState('guessing'); setFinalImage(canvasRef.current.toDataURL()); setFakeCursor(p=>({...p, show:false})); setIsDrawer(false);}} className="px-4 py-1 text-xs">Hand to Guesser</RetroButton>
           </div>
         ) : (
           <span>{isDrawer ? 'Waiting for partner to guess...' : `${profile?.partnerNickname || 'Partner'} is drawing`}</span>
         )}
      </div>
      {gameState === 'drawing' && (
        <div className="p-2 retro-bg-accent retro-border-b flex flex-wrap gap-2 items-center select-none overflow-x-auto">
          <button onClick={() => setTool('pen')} className={`p-2 rounded-md ${tool === 'pen' ? 'bg-white retro-border' : 'opacity-70'}`}><PenTool size={18}/></button>
          <button onClick={() => setTool('eraser')} className={`p-2 rounded-md ${tool === 'eraser' ? 'bg-white retro-border' : 'opacity-70'}`}><Eraser size={18}/></button>
          <button onClick={() => setTool('fill')} className={`p-2 rounded-md ${tool === 'fill' ? 'bg-white retro-border' : 'opacity-70'}`}><PaintBucket size={18}/></button>
          <button onClick={() => setTool('pattern')} className={`p-2 bg-[url('https://www.transparenttextures.com/patterns/polka-dots.png')] rounded-md ${tool === 'pattern' ? 'bg-white retro-border' : 'opacity-70'}`}><div className="w-[18px] h-[18px]"></div></button>
          
          <div className="flex items-center gap-1 mx-2 bg-white/50 px-2 py-1 rounded retro-border"><div className="w-2 h-2 bg-black rounded-full"></div><input type="range" min="1" max="20" value={brushSize} onChange={e=>setBrushSize(e.target.value)} className="w-16" /><div className="w-4 h-4 bg-black rounded-full"></div></div>
          {['#000000', '#ff0000', '#0000ff', '#00ff00', '#ffb6b9', '#f9e2af'].map(c => ( <button key={c} onClick={() => { setColor(c); setTool('pen'); }} className={`w-5 h-5 rounded-full retro-border flex-shrink-0 transition-transform ${color === c && tool !== 'eraser' ? 'scale-125 ring-2' : ''}`} style={{backgroundColor: c}} /> ))}
          
          <div className="ml-auto flex gap-2">
              <button onClick={() => setGridEnabled(!gridEnabled)} className={`p-2 bg-white retro-border rounded-md ${gridEnabled?'bg-gray-200':''}`} title="Toggle Tracing Grid"><Grid size={14}/></button>
              <button onClick={spawnEmoji} className="p-2 bg-white retro-border rounded-md hover:bg-gray-100" title="Spawn floating emoji hint"><Smile size={14}/></button>
              <button onClick={handleSkip} className="p-2 bg-white retro-border rounded-md hover:bg-yellow-100 text-yellow-600" title="Skip Word (-1 pt)"><SkipForward size={14}/></button>
              <button onClick={handleUndo} disabled={undoStack.length <= 1} className="p-2 bg-white retro-border rounded-md hover:bg-gray-100 disabled:opacity-50" title="Undo"><Undo2 size={14}/></button>
              <button onClick={handleClear} className="p-2 bg-white text-red-500 retro-border rounded-md hover:bg-red-50" title="Clear Canvas"><Trash2 size={14}/></button>
          </div>
        </div>
      )}
      <div className={`flex-1 bg-white relative touch-none cursor-none ${gridEnabled ? 'pattern-grid-light' : ''} overflow-hidden`} onMouseMove={(e)=>{ const el = e.currentTarget.getBoundingClientRect(); setFakeCursor({ x: e.clientX - el.left, y: e.clientY - el.top, show: fakeCursor.show }); }}>
        <canvas ref={canvasRef} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} className="absolute inset-0 w-full h-full" />
        
        {/* Fake ghost cursor overlay during guessing to mimic networked motion */}
        {gameState === 'guessing' && fakeCursor.show && (
          <div className="absolute pointer-events-none text-red-500 transition-all duration-150 ease-out" style={{ left: fakeCursor.x, top: fakeCursor.y }}>
            <PenTool size={20} className="drop-shadow-lg opacity-70" />
          </div>
        )}

        {gameState === 'drawing' && fakeCursor.show && (
          <div className="absolute pointer-events-none text-[var(--primary)] transition-all duration-75 ease-out -translate-y-4" style={{ left: fakeCursor.x, top: fakeCursor.y }}>
            <Brush size={22} className="drop-shadow-lg opacity-90" />
          </div>
        )}

        {/* Floating Emojis */}
        {floatingEmojis.map(f => (
            <div key={f.id} className="absolute text-4xl animate-float-up pointer-events-none z-20" style={{ left: `${f.left}%`, top: `${f.top}%` }}>{f.emj}</div>
        ))}
        {gameState === 'guessing' && <div className="absolute inset-0 z-10" onMouseMove={(e)=>{ const r = e.target.getBoundingClientRect(); setFakeCursor({ x: e.clientX-r.left, y: e.clientY-r.top, show: true }); }} onMouseLeave={() => setFakeCursor(p=>({...p, show:false}))}></div>}
      </div>
      {gameState === 'drawing' ? ( <div className="p-3 retro-bg-window retro-border-t flex justify-between items-center font-bold text-lg"><span className="opacity-70 text-sm">Draw:</span> <span className="text-[var(--primary)] text-xl tracking-widest uppercase">{word}</span> <span></span></div> ) : (
        <div className="p-3 retro-bg-window retro-border-t flex flex-col gap-3">
          <div className="flex justify-between items-center px-1 border-b border-dashed border-[var(--border)] pb-2 mb-1">
             <div className="flex items-center gap-4">
                 <span className="font-bold text-sm sm:text-base flex items-center gap-2">Word: <span className="tracking-[0.5em] text-[var(--primary)] text-lg uppercase">{displayWord.join('')}</span></span>
                 <button onClick={useHint} className="text-xs retro-border bg-white px-2 py-1 flex items-center gap-1 hover:bg-yellow-50 active:translate-y-px"><Lightbulb size={12}/> Hint</button>
             </div>
             <span className="text-xs sm:text-sm font-bold text-[var(--border)]">{hotCold}</span>
          </div>
          <form onSubmit={submitGuess} className="flex gap-2"><input type="text" value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Type guess..." className="flex-1 p-2 sm:p-3 retro-border focus:outline-none uppercase font-bold" /><RetroButton type="submit" className="px-4 sm:px-6">Guess</RetroButton></form>
        </div>
      )}
    </RetroWindow>
  );
}
