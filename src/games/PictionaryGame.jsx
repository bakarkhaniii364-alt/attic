import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { calculateLevenshtein, floodFill } from '../utils/helpers.js';
import { incrementUserScore, getScoreForUser } from '../utils/userDataHelpers.js';
import { PICTIONARY_CATEGORIES } from '../constants/data.js';
import { useBroadcast } from '../hooks/useSupabaseSync.js';
import { Brush, Undo2, Trash2, PenTool, Eraser, Grid, Lightbulb, SkipForward, PaintBucket, Smile } from 'lucide-react';

export function PictionaryGame({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, userId, partnerId, pictionaryState, setPictionaryState, isHost }) {
  const p1Id = isHost ? userId : partnerId;
  const p2Id = isHost ? partnerId : userId;

  const defaultState = {
    gameState: 'prep',
    hostId: p1Id,
    guestId: p2Id,
    currentRound: 1,
    totalRounds: parseInt(config?.rounds) || 3,
    turn: 1, // turn 1: p1Id draws, turn 2: p2Id draws
    drawerId: p1Id,
    wordOptions: [],
    word: '',
    displayWord: [],
    endTime: null,
    currentCanvas: null,
    scores: {},
    turnResult: null
  };

  // Pre-emptive host initialization to guarantee identical state from the beginning
  useEffect(() => {
    if (isHost && !pictionaryState) {
      setPictionaryState(defaultState);
    }
  }, [isHost, pictionaryState, setPictionaryState]);

  const stateToUse = pictionaryState || defaultState;
  const { gameState, drawerId, word, displayWord, currentCanvas } = stateToUse;
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
  
  const [finalImage, setFinalImage] = useState(null);
  
  const [gridEnabled, setGridEnabled] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [partnerCursor, setPartnerCursor] = useState({ x: 0, y: 0, show: false });
  const [fakeCursor, setFakeCursor] = useState({ x: 0, y: 0, show: false });

  const getWordOptions = () => {
    const genre = config.genre || 'General';
    const words = PICTIONARY_CATEGORIES[genre] || PICTIONARY_CATEGORIES['General'] || ['Apple', 'Tree', 'Cat'];
    // Pick 3 distinct words randomly
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  const startRound = () => { 
    if (gameState === 'drawing' || gameState === 'word_selection') return;
    playAudio('click', sfx); 
    const wordOptions = getWordOptions();
    setPictionaryState({
        gameState: 'word_selection',
        hostId: p1Id,
        guestId: p2Id,
        currentRound: 1,
        totalRounds: parseInt(config?.rounds) || 3,
        turn: 1,
        drawerId: p1Id,
        wordOptions,
        word: '',
        displayWord: [],
        endTime: null,
        currentCanvas: null,
        scores: { [p1Id]: 0, [p2Id]: 0 },
        turnResult: null
    });
    setUndoStack([]); 
  };

  const selectWord = (selectedWord) => {
    playAudio('click', sfx);
    setPictionaryState(prev => ({
       ...prev,
       gameState: 'drawing',
       word: selectedWord,
       displayWord: selectedWord.split('').map(() => '_'),
       endTime: Date.now() + 90 * 1000,
       currentCanvas: null
    }));
    setUndoStack([]);
  };

  const handleSkip = () => {
      playAudio('click', sfx);
      const wordOptions = getWordOptions();
      setPictionaryState(prev => ({
          ...prev,
          gameState: 'word_selection',
          wordOptions,
          word: '',
          displayWord: []
      }));
      setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1));
  };

  const [localTimeLeft, setLocalTimeLeft] = useState(90);

  useEffect(() => { 
      if (gameState === 'drawing' && stateToUse.endTime) { 
        const timer = setInterval(() => { 
          const remaining = Math.max(0, Math.ceil((stateToUse.endTime - Date.now()) / 1000));
          setLocalTimeLeft(remaining);

          if (remaining === 0 && isDrawer) { 
             clearInterval(timer); 
             setPictionaryState(prev => ({ ...prev, gameState: 'turn_end', turnResult: 'time_up' })); 
          } 
        }, 100); 
        return () => clearInterval(timer); 
      } 
  }, [gameState, stateToUse.endTime, isDrawer, setPictionaryState]);

  const updateCanvasResolution = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); if (rect.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!canvas.dataset.initialized) { 
      canvas.width = rect.width; 
      canvas.height = rect.height; 
      canvas.dataset.initialized = 'true'; 
      saveStateToUndo(); 
    }
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

  const triggerGuesserEmoji = (emj) => {
      playAudio('click', sfx);
      const payload = { emj, left: Math.random() * 80 + 10, top: Math.random() * 80 + 10 };
      setFloatingEmojis(p => [...p, { id: Date.now(), ...payload }]);
      setTimeout(() => { setFloatingEmojis(p => p.slice(1)); }, 2000);
      sendEmoji(payload);
  };

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
      const rect = e.currentTarget.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      setFakeCursor({ x: fx, y: fy, show: true });

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
  };

  const handlePointerUp = () => { 
      if(isDrawer && isDrawingRef.current) { 
          isDrawingRef.current = false; 
          saveStateToUndo(); 
          sendDraw({ type: 'up' });
          sendCursor(p => ({...p, show: false}));

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
          if (canvasRef.current) setFinalImage(canvasRef.current.toDataURL()); 
          let pts = 1;
          if (localTimeLeft >= 80) pts = 2;

          setPictionaryState(prev => {
             const currentScores = prev.scores || {};
             return { 
                ...prev, 
                gameState: 'turn_end',
                turnResult: 'guessed',
                scores: {
                  ...currentScores,
                  [userId]: (currentScores[userId] || 0) + pts
                }
             };
          });
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

  const handleGiveUp = () => {
    playAudio('click', sfx);
    setPictionaryState(prev => ({
       ...prev,
       gameState: 'turn_end',
       turnResult: 'gave_up'
    }));
  };

  const proceedToNextTurn = () => {
    playAudio('click', sfx);
    let nextRound = stateToUse.currentRound;
    let nextTurn = stateToUse.turn + 1;

    if (nextTurn > 2) {
      nextTurn = 1;
      nextRound += 1;
    }

    if (nextRound > stateToUse.totalRounds) {
      setPictionaryState(prev => ({
        ...prev,
        gameState: 'game_over'
      }));
    } else {
      const nextDrawerId = nextTurn === 1 ? stateToUse.hostId : stateToUse.guestId;
      const wordOptions = getWordOptions();
      setPictionaryState(prev => ({
        ...prev,
        gameState: 'word_selection',
        currentRound: nextRound,
        turn: nextTurn,
        drawerId: nextDrawerId,
        wordOptions,
        word: '',
        displayWord: [],
        endTime: null,
        currentCanvas: null,
        turnResult: null
      }));
      setUndoStack([]);
    }
  };

  const useHint = () => {
    playAudio('click', sfx);
    const hidden = []; displayWord.forEach((char, i) => { if (char === '_') hidden.push(i); });
    if (hidden.length === 0) return;
    const rnd = hidden[hidden.length * Math.random() | 0];
    const newDisplay = [...displayWord];
    newDisplay[rnd] = word[rnd];
    
    setPictionaryState(prev => ({ ...prev, displayWord: newDisplay }));
    setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1));
  };

  if (gameState === 'game_over') {
    const p1Id = stateToUse.hostId;
    const p2Id = stateToUse.guestId;
    const p1Score = stateToUse.scores?.[p1Id] || 0;
    const p2Score = stateToUse.scores?.[p2Id] || 0;

    let winnerId = null;
    if (p1Score > p2Score) winnerId = p1Id;
    else if (p2Score > p1Score) winnerId = p2Id;

    return (
      <RetroWindow title="game_over.exe" className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <h2 className="text-3xl font-black mb-4 uppercase tracking-widest text-[var(--primary)]">
            {winnerId ? (winnerId === userId ? 'YOU WON! 🏆' : `${partnerName} WON! 🎉`) : 'IT\'S A TIE! 🤝'}
          </h2>
          <div className="bg-[var(--bg-main)] retro-border p-4 w-full mb-6 text-left">
            <p className="font-black text-xs uppercase opacity-60 mb-2 tracking-wider">Final Scores</p>
            <div className={`flex justify-between items-center mb-1 p-2 border-b-2 border-dashed border-[var(--border)] ${winnerId === p1Id ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
               <span className="font-bold flex items-center gap-2">
                 {userId === p1Id ? 'You (P1)' : `${partnerName} (P1)`}
                 {winnerId === p1Id && '⭐'}
               </span>
               <span className="font-black text-[var(--secondary)] text-xl">{p1Score} pts</span>
            </div>
            <div className={`flex justify-between items-center p-2 border-b-2 border-dashed border-[var(--border)] ${winnerId === p2Id ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
               <span className="font-bold flex items-center gap-2">
                 {userId === p2Id ? 'You (P2)' : `${partnerName} (P2)`}
                 {winnerId === p2Id && '⭐'}
               </span>
               <span className="font-black text-[var(--secondary)] text-xl">{p2Score} pts</span>
            </div>
          </div>

          <RetroButton className="w-full py-4 text-lg font-black uppercase tracking-widest" onClick={onBack}>
            Back to Arcade
          </RetroButton>
        </div>
      </RetroWindow>
    );
  }

  if (gameState === 'turn_end') {
    return (
      <RetroWindow title="turn_summary.exe" className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-black mb-4 uppercase tracking-widest text-[var(--primary)]">
            {stateToUse.turnResult === 'guessed' ? 'Guessed Correctly! 🎉' : stateToUse.turnResult === 'gave_up' ? 'Gave Up! 🛑' : 'Time Up! ⏰'}
          </h2>
          <p className="text-lg font-bold mb-1">Secret Word: <span className="font-black text-[var(--secondary)] uppercase tracking-wider">{stateToUse.word}</span></p>
          <p className="font-bold opacity-70 text-sm mb-4">
            Round {stateToUse.currentRound} of {stateToUse.totalRounds} • Turn {stateToUse.turn}
          </p>

          <div className="bg-[var(--bg-main)] retro-border p-4 w-full mb-6 text-left">
            <p className="font-black text-xs uppercase opacity-60 mb-2 tracking-wider">Current Scores</p>
            <div className="flex justify-between items-center mb-1 bg-white p-2 border-b-2 border-dashed border-[var(--border)]">
               <span className="font-bold">{userId === stateToUse.hostId ? 'You (P1)' : `${partnerName} (P1)`}</span>
               <span className="font-black text-[var(--secondary)] text-xl">{stateToUse.scores?.[stateToUse.hostId] || 0} pts</span>
            </div>
            <div className="flex justify-between items-center bg-white p-2 border-b-2 border-dashed border-[var(--border)]">
               <span className="font-bold">{userId === stateToUse.guestId ? 'You (P2)' : `${partnerName} (P2)`}</span>
               <span className="font-black text-[var(--secondary)] text-xl">{stateToUse.scores?.[stateToUse.guestId] || 0} pts</span>
            </div>
          </div>

          {isHost ? (
            <RetroButton className="w-full py-4 text-lg font-black uppercase tracking-widest" onClick={proceedToNextTurn}>
              Proceed to Next Turn
            </RetroButton>
          ) : (
             <div className="font-bold opacity-60 text-sm animate-pulse">Waiting for host to advance...</div>
          )}
        </div>
      </RetroWindow>
    );
  }

  if (gameState === 'prep') {
    return (
      <RetroWindow title="pictionary.exe" className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-black mb-1 uppercase tracking-widest text-[var(--primary)]">Pictionary</h2>
          <p className="font-bold opacity-80 mb-6 text-sm">
            {isDrawer ? "You are drawing this round" : `${partnerName} is drawing this round`}
          </p>
          <div className="w-full mb-6 bg-[var(--bg-main)] retro-border p-4 text-left">
             <p className="font-bold opacity-70 mb-1 text-xs">Category: {config.genre || config.category || 'General'}</p>
             <p className="font-bold opacity-70 text-xs">Timer: 90s per turn</p>
          </div>
          
          {isHost ? (
            <RetroButton className="w-full py-4 text-lg font-black uppercase tracking-widest" onClick={startRound}>
              Start Game
            </RetroButton>
          ) : (
             <div className="font-bold text-sm text-[var(--primary)] animate-pulse">Waiting for host to start...</div>
          )}
        </div>
      </RetroWindow>
    );
  }

  if (gameState === 'word_selection') {
    return (
      <RetroWindow title="pictionary.exe" className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-black mb-1 uppercase tracking-widest text-[var(--primary)]">Word Choice</h2>
          
          {isDrawer ? (
            <>
              <p className="font-bold opacity-80 mb-6 text-sm">Select a secret word to draw:</p>
              <div className="flex flex-col gap-3 w-full">
                {(stateToUse.wordOptions || []).map((w, i) => (
                   <RetroButton key={i} className="w-full py-3 text-lg font-black uppercase" onClick={() => selectWord(w)}>
                     {w}
                   </RetroButton>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="font-bold opacity-80 text-sm">Partner is picking a word to draw...</p>
              <div className="loader mt-4 font-bold text-xs animate-pulse">Waiting for partner choice...</div>
            </div>
          )}
        </div>
      </RetroWindow>
    );
  }

  return (
    <RetroWindow title="pictionary.exe" className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col relative" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold">
         <span className={localTimeLeft < 10 ? 'text-red-400 animate-pulse-fast' : ''}>⏳ {localTimeLeft}s</span>
         {gameState === 'drawing' ? (
           <div className="flex items-center gap-2">
             <span className="text-sm opacity-80">{isDrawer ? "You are drawing" : `${partnerName} is drawing`}</span>
             {isDrawer && <RetroButton variant="white" onClick={() => { setPictionaryState(prev => ({...prev, gameState: 'turn_end', turnResult: 'time_up'})); }} className="px-4 py-1 text-xs opacity-0 absolute pointer-events-none">Hand to Guesser</RetroButton>}
           </div>
         ) : (
           <span>{isDrawer ? 'Waiting for partner to guess...' : `${partnerName} is drawing`}</span>
         )}
      </div>

      {gameState === 'drawing' && isDrawer && (
        <div className="p-3 bg-[var(--bg-main)] border-b-2 border-[var(--border)] flex flex-wrap gap-4 items-center select-none overflow-x-auto">
          {/* Main Visual Tool Toggles */}
          <div className="flex gap-2">
            <button onClick={() => setTool('pen')} className={`p-2 retro-border retro-shadow-dark transition-colors ${tool === 'pen' ? 'bg-[var(--accent)]' : 'bg-[var(--bg-window)]'}`} title="Pen Tool"><PenTool size={18}/></button>
            <button onClick={() => setTool('eraser')} className={`p-2 retro-border retro-shadow-dark transition-colors ${tool === 'eraser' ? 'bg-[var(--accent)]' : 'bg-[var(--bg-window)]'}`} title="Eraser Tool"><Eraser size={18}/></button>
            <button onClick={() => setTool('fill')} className={`p-2 retro-border retro-shadow-dark transition-colors ${tool === 'fill' ? 'bg-[var(--accent)]' : 'bg-[var(--bg-window)]'}`} title="Fill Tool"><PaintBucket size={18}/></button>
          </div>
          
          {/* Brush Size Slider */}
          <div className="flex items-center gap-1 mx-2 bg-[var(--bg-window)] px-2 py-1 rounded retro-border"><div className="w-1.5 h-1.5 bg-black rounded-full"></div><input type="range" min="1" max="20" value={brushSize} onChange={e=>setBrushSize(e.target.value)} className="w-16 accent-[var(--primary)]" /><div className="w-3.5 h-3.5 bg-black rounded-full"></div></div>
          
          {/* High-Contrast Palette Colors */}
          <div className="flex flex-wrap gap-1.5 bg-[var(--bg-window)] p-1.5 retro-border">
            {['#000000', '#808080', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'].map(c => (
               <button 
                 key={c} 
                 onClick={() => { setColor(c); setTool('pen'); }} 
                 className={`w-5 h-5 retro-border flex-shrink-0 transition-transform ${color === c && tool !== 'eraser' ? 'scale-125 ring-2 ring-[var(--primary)]' : ''}`} 
                 style={{ backgroundColor: c }} 
               />
            ))}
          </div>
          
          {/* Classic Toolbar Buttons */}
          <div className="ml-auto flex gap-2">
              <button onClick={() => setGridEnabled(!gridEnabled)} className={`p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark ${gridEnabled ? 'bg-[var(--accent)]' : ''}`} title="Toggle Tracing Grid"><Grid size={16}/></button>
              <button onClick={handleUndo} disabled={undoStack.length <= 1} className="p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark active:scale-95 disabled:opacity-50" title="Undo"><Undo2 size={16}/></button>
              <button onClick={handleClear} className="p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark text-red-600 active:scale-95" title="Clear Canvas"><Trash2 size={16}/></button>
          </div>
        </div>
      )}

      <div 
        className={`flex-1 relative touch-none select-none ${gridEnabled ? 'bg-pattern-grid' : ''} overflow-hidden cursor-none`} 
        style={{ backgroundColor: 'var(--bg-window)' }}
        onPointerMove={handlePointerMove} 
        onPointerDown={handlePointerDown} 
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setFakeCursor(p => ({ ...p, show: false }))}
        onPointerEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setFakeCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true });
        }}
      >
        <canvas ref={canvasRef} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} className="absolute inset-0 w-full h-full bg-transparent" />
        
        {/* Local Custom Brush Cursor */}
        {fakeCursor.show && isDrawer && (
          <div 
            className="absolute pointer-events-none z-[100] transform -translate-x-1/2 -translate-y-1/2" 
            style={{ left: `${fakeCursor.x}px`, top: `${fakeCursor.y}px` }}
          >
            <div 
              className="rounded-full border border-black bg-transparent"
              style={{
                width: `${Math.max(6, brushSize * (tool === 'eraser' ? 4 : 1))}px`,
                height: `${Math.max(6, brushSize * (tool === 'eraser' ? 4 : 1))}px`,
                boxShadow: '0 0 0 1px white'
              }}
            ></div>
          </div>
        )}

        {/* Partner Cursor */}
        {partnerCursor.show && !isDrawer && (
          <div className="absolute pointer-events-none z-[100] transition-all duration-75" style={{ left: partnerCursor.x, top: partnerCursor.y }}>
            <PenTool size={16} className="text-[var(--primary)] -scale-x-100" />
            <div className="bg-[var(--primary)] text-white text-[8px] font-black px-1 rounded-sm -mt-1 ml-4 uppercase whitespace-nowrap shadow-sm border border-white/50">{partnerName}</div>
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
            <form onSubmit={submitGuess} className="flex flex-wrap sm:flex-nowrap gap-4 max-w-lg mx-auto w-full">
                <input type="text" value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Type your guess here..." className="flex-1 p-3 retro-border focus:outline-none uppercase font-black text-lg tracking-widest bg-gray-50 shadow-inner" autoFocus />
                <RetroButton type="submit" className="px-8 text-lg">GUESS!</RetroButton>
                <RetroButton type="button" onClick={handleGiveUp} variant="white" className="px-4 text-sm whitespace-nowrap">Give Up</RetroButton>
            </form>
            <div className="mt-3 bg-gray-50 retro-border p-3 flex flex-col gap-2">
                <p className="text-xs font-black opacity-50 uppercase tracking-widest">Emoji Reactions to Drawing</p>
                <div className="flex flex-wrap gap-2">
                   {['👍', '🤣', '👎', '❤️', '🔥', '👀'].map(emj => (
                      <button key={emj} onClick={() => triggerGuesserEmoji(emj)} className="p-2 text-2xl hover:scale-125 transition-transform bg-white retro-border rounded-md hover:bg-gray-100">{emj}</button>
                   ))}
                </div>
            </div>
          </div>
          {hotCold && <div className={`mt-2 text-center font-black uppercase italic tracking-widest animate-bounce ${hotCold.includes('Hot') ? 'text-orange-500' : hotCold.includes('Warm') ? 'text-yellow-600' : 'text-blue-400'}`}>{hotCold}</div>}
        </div>
      )}
    </RetroWindow>
  );
}
