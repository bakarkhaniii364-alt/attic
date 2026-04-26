import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { calculateLevenshtein, floodFill } from '../utils/helpers.js';
import { incrementUserScore, getScoreForUser } from '../utils/userDataHelpers.js';
import { PICTIONARY_CATEGORIES } from '../constants/data.js';
import { useBroadcast } from '../hooks/useSupabaseSync.js';
import { Brush, Undo2, Trash2, PenTool, Eraser, Grid, Lightbulb, SkipForward, PaintBucket, Smile } from 'lucide-react';

export function PictionaryGame({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, userId, partnerId, pictionaryState, setPictionaryState }) {
  const { gameState, drawerId, word, displayWord, timeLeft, currentCanvas } = pictionaryState;
  const isDrawer = userId === drawerId;
  const partnerName = profile?.partnerNickname || 'Partner';

  const [guess, setGuess] = useState('');
  const [hotCold, setHotCold] = useState('');
  
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [tool, setTool] = useState('pen'); 
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [undoStack, setUndoStack] = useState([]);
  const colorInputRef = useRef(null);
  
  const timerLength = parseInt(config.diff) || 60;
  const [finalImage, setFinalImage] = useState(null);
  
  const [gridEnabled, setGridEnabled] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [fakeCursor, setFakeCursor] = useState({ x: 0, y: 0, show: false });
  const [partnerCursor, setPartnerCursor] = useState({ x: 0, y: 0, show: false });

  const getNewWord = () => {
    if (config.category === 'custom' && config.customWord) return config.customWord;
    const words = PICTIONARY_CATEGORIES[config.category] || PICTIONARY_CATEGORIES.animals; 
    return words[Math.floor(Math.random() * words.length)];
  };

  const startRound = () => { 
    playAudio('click', sfx); 
    const newWord = getNewWord();
    setPictionaryState({
        gameState: 'drawing',
        drawerId: userId,
        word: newWord,
        displayWord: newWord.split('').map(() => '_'),
        timeLeft: timerLength,
        currentCanvas: null
    });
    setUndoStack([]); 
  };

  const handleSkip = () => {
      playAudio('click', sfx);
      const newWord = getNewWord();
      setPictionaryState(prev => ({
          ...prev,
          word: newWord,
          displayWord: newWord.split('').map(() => '_')
      }));
      setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1));
  };

  useEffect(() => { 
      if (!isDrawer) return; // Only drawer controls timer
      let timer; 
      if (gameState === 'drawing') { 
        timer = setInterval(() => { 
          setPictionaryState(prev => { 
            if (prev.timeLeft <= 1) { clearInterval(timer); return { ...prev, gameState: 'lost', timeLeft: 0 }; } 
            return { ...prev, timeLeft: prev.timeLeft - 1 }; 
          }); 
        }, 1000); 
      } 
      return () => clearInterval(timer); 
  }, [gameState, isDrawer, setPictionaryState]);

  const updateCanvasResolution = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); if (rect.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!canvas.dataset.initialized) { canvas.width = rect.width; canvas.height = rect.height; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); canvas.dataset.initialized = 'true'; saveStateToUndo(); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  useEffect(() => { 
      if (gameState === 'drawing') updateCanvasResolution(); 
  }, [gameState]);
  
  // Sync Canvas fallback for re-joining or lag
  useEffect(() => {
    if (!isDrawer && currentCanvas && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = currentCanvas;
    }
  }, [currentCanvas, isDrawer]);

  // Realtime Drawing Sync
  const sendDraw = useBroadcast('pictionary_draw');
  
  const handleRemoteDraw = useCallback((payload) => {
      if (isDrawer) return; 
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const { x, y, type, color, tool, brushSize } = payload;
      
      if (type === 'clear') {
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
      }

      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; 
      ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize; 
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      if (type === 'down') {
          ctx.beginPath();
          ctx.moveTo(x, y);
      } else if (type === 'move') {
          ctx.lineTo(x, y);
          ctx.stroke();
      } else if (type === 'fill') {
          floodFill(canvas, Math.floor(x), Math.floor(y), color);
      }
  }, [isDrawer]);

  useBroadcast('pictionary_draw', handleRemoteDraw);

  const sendCursor = useBroadcast('pictionary_cursor');
  useBroadcast('pictionary_cursor', (payload) => {
      if (isDrawer) return;
      setPartnerCursor(payload);
  });

  const sendEmoji = useBroadcast('pictionary_emoji');
  useBroadcast('pictionary_emoji', (payload) => {
      setFloatingEmojis(p => [...p, { id: Date.now(), ...payload }]);
      setTimeout(() => { setFloatingEmojis(p => p.slice(1)); }, 2000);
  });

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
      if (!isDrawer || gameState !== 'drawing') return; 
      const { x, y } = getCoords(e); 
      
      if (tool === 'fill') {
          floodFill(canvasRef.current, Math.floor(x), Math.floor(y), color);
          sendDraw({ type: 'fill', x, y, color });
          saveStateToUndo();
          return;
      }
      
      isDrawingRef.current = true; 
      const ctx = canvasRef.current.getContext('2d'); 
      ctx.beginPath(); ctx.moveTo(x, y); 
      sendDraw({ type: 'down', x, y, color, tool, brushSize });
      sendCursor({ x, y, show: true });
  };

  const handlePointerMove = (e) => { 
      const { x, y } = getCoords(e); 
      if (isDrawer) {
          sendCursor({ x, y, show: true });
          if (isDrawingRef.current && gameState === 'drawing') {
              const ctx = canvasRef.current.getContext('2d'); 
              ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; 
              ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize; 
              ctx.lineTo(x, y); ctx.stroke(); 
              sendDraw({ type: 'move', x, y, color, tool, brushSize });
          }
      }
      setFakeCursor({ x, y, show: true });
  };

  const handlePointerUp = () => { 
      if(isDrawer && isDrawingRef.current) { 
          isDrawingRef.current = false; 
          saveStateToUndo(); 
          sendDraw({ type: 'up' });
          sendCursor(p => ({...p, show: false}));

          // Sync full canvas state to database for partner persistence
          const canvas = canvasRef.current;
          if (canvas) {
            setPictionaryState(prev => ({ ...prev, currentCanvas: canvas.toDataURL() }));
          }
      } 
  };
  const handleClear = () => { 
    if (isDrawer && window.confirm("Are you sure you want to clear the entire canvas?")) { 
        playAudio('click', sfx); 
        const canvas = canvasRef.current; 
        const ctx = canvas.getContext('2d'); 
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        saveStateToUndo(); 
        sendDraw({ type: 'clear' });
    } 
  };

  const submitGuess = (e) => { 
      e.preventDefault(); 
      if (guess.toUpperCase() === word.toUpperCase()) { 
          onWin(); 
          setFinalImage(canvasRef.current.toDataURL()); 
          let pts = 1;
          if (timeLeft >= timerLength - 10) pts = 2;
          setScores(prev => incrementUserScore(prev, userId, 'pictionary', pts));
          
          setPictionaryState(prev => ({ ...prev, gameState: 'won' }));
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
    
    setPictionaryState(prev => ({ ...prev, displayWord: newDisplay }));
    setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1));
  };

  const spawnEmoji = () => {
      const eList = ['👍', '🤣', '👎', '❤️', '🔥', '👀'];
      const emj = eList[Math.floor(Math.random()*eList.length)];
      const payload = { emj, left: Math.random()*80+10, top: Math.random()*80+10 };
      setFloatingEmojis(p => [...p, { id: Date.now(), ...payload }]);
      setTimeout(() => { setFloatingEmojis(p => p.slice(1)); }, 2000);
      sendEmoji(payload);
  };

    if (gameState === 'won' || gameState === 'lost') { 
      return ( <ShareOutcomeOverlay gameName="Pictionary" stats={{ Result: gameState === 'won' ? 'Victory!' : 'Time Up', Word: word, "Time Left": `${timeLeft}s` }} resultImage={finalImage} onClose={onBack} onShareToChat={onShareToChat} onSaveToScrapbook={onSaveToScrapbook} sfx={sfx} /> ); 
    }

  if (gameState === 'prep') {
    return (
      <RetroWindow title="pictionary.exe" className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-bold mb-4">{drawerId ? (isDrawer ? "You're the Drawer" : `${partnerName} is drawing...`) : "Ready to start?"}</h2>
          <div className="w-full mb-6"><p className="font-bold opacity-70 mb-1 text-sm">Category: {config.category}</p><p className="font-bold opacity-70 text-xs">Timer: {timerLength}s limit.</p></div>
          <RetroButton className="w-full py-4 text-lg" onClick={startRound} disabled={drawerId && !isDrawer}>
            {drawerId ? (isDrawer ? "Drawing in progress" : "Waiting for partner...") : "Start Round"}
          </RetroButton>
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
             <span className="text-sm opacity-80">{isDrawer ? "You are drawing" : `${partnerName} is drawing`}</span>
             {isDrawer && <RetroButton variant="white" onClick={() => { setPictionaryState(prev => ({...prev, gameState: 'guessing'})); setFinalImage(canvasRef.current.toDataURL()); }} className="px-4 py-1 text-xs">Hand to Guesser</RetroButton>}
           </div>
         ) : (
           <span>{isDrawer ? 'Waiting for partner to guess...' : `${partnerName} is drawing`}</span>
         )}
      </div>

      {gameState === 'drawing' && isDrawer && (
        <div className="p-2 retro-bg-accent retro-border-b flex flex-wrap gap-2 items-center select-none overflow-x-auto">
          <button onClick={() => setTool('pen')} className={`p-2 rounded-md retro-border ${tool === 'pen' ? 'bg-white shadow-inner' : 'opacity-70'}`}><PenTool size={18}/></button>
          <button onClick={() => setTool('eraser')} className={`p-2 rounded-md retro-border ${tool === 'eraser' ? 'bg-white shadow-inner' : 'opacity-70'}`}><Eraser size={18}/></button>
          <button onClick={() => setTool('fill')} className={`p-2 rounded-md retro-border ${tool === 'fill' ? 'bg-white shadow-inner' : 'opacity-70'}`}><PaintBucket size={18}/></button>
          
          <div className="flex items-center gap-1 mx-2 bg-white/50 px-2 py-1 rounded retro-border"><div className="w-2 h-2 bg-black rounded-full"></div><input type="range" min="1" max="20" value={brushSize} onChange={e=>setBrushSize(e.target.value)} className="w-16" /><div className="w-4 h-4 bg-black rounded-full"></div></div>
          
          <div className="flex gap-1">
            {['#000000', '#ff0000', '#0000ff', '#00ff00', '#ffb6b9', '#f9e2af'].map(c => ( <button key={c} onClick={() => { setColor(c); setTool('pen'); }} className={`w-5 h-5 rounded-full retro-border flex-shrink-0 transition-transform ${color === c && tool !== 'eraser' ? 'ring-2 ring-black scale-125' : ''}`} style={{backgroundColor: c}} /> ))}
          </div>
          
          <div className="ml-auto flex gap-2">
              <button onClick={() => setGridEnabled(!gridEnabled)} className={`p-2 bg-white retro-border rounded-md ${gridEnabled?'bg-gray-200':''}`} title="Toggle Tracing Grid"><Grid size={14}/></button>
              <button onClick={spawnEmoji} className="p-2 bg-white retro-border rounded-md hover:bg-gray-100" title="Spawn floating emoji hint"><Smile size={14}/></button>
              <button onClick={handleSkip} className="p-2 bg-white retro-border rounded-md hover:bg-yellow-100 text-yellow-600" title="Skip Word (-1 pt)"><SkipForward size={14}/></button>
              <button onClick={handleUndo} disabled={undoStack.length <= 1} className="p-2 bg-white retro-border rounded-md hover:bg-gray-100 disabled:opacity-50" title="Undo"><Undo2 size={14}/></button>
              <button onClick={handleClear} className="p-2 bg-white text-red-500 retro-border rounded-md hover:bg-red-50" title="Clear Canvas"><Trash2 size={14}/></button>
          </div>
        </div>
      )}

      <div className={`flex-1 bg-white relative touch-none cursor-none ${gridEnabled ? 'pattern-grid-light' : ''} overflow-hidden`} onPointerMove={handlePointerMove} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <canvas ref={canvasRef} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} className="absolute inset-0 w-full h-full" />
        
        {/* Partner Cursor */}
        {partnerCursor.show && !isDrawer && (
          <div className="absolute pointer-events-none z-[100] transition-all duration-75" style={{ left: partnerCursor.x, top: partnerCursor.y }}>
            <PenTool size={16} className="text-[var(--primary)] -scale-x-100" />
            <div className="bg-[var(--primary)] text-white text-[8px] font-black px-1 rounded-sm -mt-1 ml-4 uppercase whitespace-nowrap shadow-sm border border-white/50">{partnerName}</div>
          </div>
        )}

        {/* Local Cursor */}
        {fakeCursor.show && isDrawer && (
          <div className="absolute pointer-events-none z-[100] canvas-cursor" style={{ left: fakeCursor.x, top: fakeCursor.y }}>
            <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: 'white', transform: 'translate(-50%, -50%)' }}></div>
          </div>
        )}

        {floatingEmojis.map(e => (
            <div key={e.id} className="absolute text-4xl animate-float-up pointer-events-none select-none z-50 drop-shadow-lg" style={{ left: `${e.left}%`, top: `${e.top}%` }}>{e.emj}</div>
        ))}
      </div>

      {isDrawer && (
        <div className="p-4 retro-bg-accent retro-border-t flex justify-center items-center gap-8">
            <div className="text-center">
                <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mb-1">Secret Word</p>
                <div className="text-2xl font-black tracking-widest uppercase text-[var(--primary-hover)] drop-shadow-sm">{word}</div>
            </div>
            <div className="w-px h-10 bg-black/10"></div>
            <div className="text-center">
                <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mb-1">Progress</p>
                <div className="text-2xl font-black tracking-[0.3em] uppercase">{displayWord.join(' ')}</div>
            </div>
            <RetroButton onClick={useHint} className="ml-4" variant="white">Hint (-1 pt)</RetroButton>
        </div>
      )}

      {!isDrawer && (
        <div className="p-4 retro-bg-window retro-border-t shadow-lg">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center px-1 border-b border-dashed border-[var(--border)] pb-2 mb-1">
               <span className="font-bold text-sm sm:text-base flex items-center gap-2">Word: <span className="tracking-[0.5em] text-[var(--primary)] text-lg uppercase">{displayWord.join('')}</span></span>
               <span className="text-xs sm:text-sm font-bold text-[var(--border)]">{hotCold}</span>
            </div>
            {gameState === 'guessing' ? (
                <form onSubmit={submitGuess} className="flex gap-4 max-w-lg mx-auto w-full">
                    <input type="text" value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Type your guess here..." className="flex-1 p-3 retro-border focus:outline-none uppercase font-black text-lg tracking-widest bg-gray-50 shadow-inner" autoFocus />
                    <RetroButton type="submit" className="px-8 text-lg">GUESS!</RetroButton>
                </form>
            ) : (
                <p className="text-sm font-bold opacity-60 uppercase tracking-widest animate-pulse text-center">{partnerName} is drawing something amazing...</p>
            )}
          </div>
          {hotCold && <div className={`mt-2 text-center font-black uppercase italic tracking-widest animate-bounce ${hotCold.includes('Hot') ? 'text-orange-500' : hotCold.includes('Warm') ? 'text-yellow-600' : 'text-blue-400'}`}>{hotCold}</div>}
        </div>
      )}
    </RetroWindow>
  );
}
