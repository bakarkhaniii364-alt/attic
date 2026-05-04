import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { Download, Trash2, PaintBucket, Eraser, Pipette, MousePointer2, Undo, Redo } from 'lucide-react';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

const PALETTE = ['#5c3a21','#e94560','#4f9ef8','#f9e2af','#b5c99a','#ffffff','#000000','#ff6b6b','#a855f7','#14b8a6','#f97316','#ec4899'];

export function PixelArtApp({ onClose, sfx, onSaveToScrapbook, userId }) {
  const SIZE = 24;
  const [grid, setGrid] = useGlobalSync('pixel_art_grid', Array(SIZE).fill(null).map(() => Array(SIZE).fill('#ffffff')));
  const [localGrid, setLocalGrid] = useState(grid);
  const [color, setColor] = useState('#5c3a21');
  const [tool, setTool] = useState('pen'); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const colorInputRef = useRef(null);

  // Local History State
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Initialize history on first load
  useEffect(() => {
    if (grid && history.length === 0) {
      setHistory([grid]);
      setHistoryStep(0);
    }
  }, [grid]);

  useEffect(() => {
    setLocalGrid(grid);
  }, [grid]);

  const pushToHistory = (newGrid) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newGrid);
    if (newHistory.length > 20) newHistory.shift(); 
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      playAudio('click', sfx);
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setGrid(history[prevStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      playAudio('click', sfx);
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setGrid(history[nextStep]);
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    // Sync the final state to Supabase once drawing is done
    setGrid(localGrid);
    if (JSON.stringify(grid) !== JSON.stringify(localGrid)) {
        pushToHistory(localGrid);
    }
  };

  const paint = (r, c) => {
    if (tool === 'bucket') {
      floodFill(r, c, localGrid[r][c], color);
      return;
    }
    const newGrid = localGrid.map(row => [...row]);
    newGrid[r][c] = tool === 'eraser' ? '#ffffff' : color;
    setLocalGrid(newGrid);
    setDirty(true);
  };

  const floodFill = (r, c, targetColor, replacementColor) => {
    if (targetColor === replacementColor) return;
    const newGrid = localGrid.map(row => [...row]);
    const stack = [[r, c]];
    while (stack.length > 0) {
      const [currR, currC] = stack.pop();
      if (currR < 0 || currR >= SIZE || currC < 0 || currC >= SIZE) continue;
      if (newGrid[currR][currC] !== targetColor) continue;
      newGrid[currR][currC] = replacementColor;
      stack.push([currR + 1, currC], [currR - 1, currC], [currR, currC + 1], [currR, currC - 1]);
    }
    setGrid(newGrid);
    setDirty(true);
  };

  const clear = () => { 
    playAudio('click', sfx); 
    const newGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill('#ffffff'));
    setGrid(newGrid);
    pushToHistory(newGrid);
  };

  const handleExport = () => {
    playAudio('click', sfx);
    const canvas = document.createElement('canvas');
    const px = 16;
    canvas.width = SIZE * px; canvas.height = SIZE * px;
    const ctx = canvas.getContext('2d');
    grid.forEach((row, r) => row.forEach((c, ci) => { ctx.fillStyle = c; ctx.fillRect(ci * px, r * px, px, px); }));
    const url = canvas.toDataURL('image/png');
    if (onSaveToScrapbook) onSaveToScrapbook(url);
    const a = document.createElement('a'); a.href = url; a.download = `pixel_art_${Date.now()}.png`; a.click();
  };

  return (
    <RetroWindow title="pixel_art.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]" confirmOnClose hasUnsavedChanges={dirty} onSaveBeforeClose={() => { handleExport(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="p-2 retro-bg-accent retro-border-b flex gap-2 items-center flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {PALETTE.map(c => (
            <button key={c} onClick={() => { setColor(c); if(tool==='eraser') setTool('pen'); }} className={`w-6 h-6 rounded-full retro-border ${color === c && tool !== 'eraser' ? 'ring-2 ring-black scale-125' : ''}`} style={{ backgroundColor: c }} />
          ))}
          <button onClick={() => colorInputRef.current.click()} className="w-6 h-6 rounded-full retro-border flex items-center justify-center bg-white" title="Custom Color">
             <Pipette size={12} />
             <input type="color" ref={colorInputRef} className="sr-only" onChange={(e) => { setColor(e.target.value); if(tool==='eraser') setTool('pen'); }} />
          </button>
        </div>
        
        <div className="h-6 w-px bg-[var(--border)] mx-1"></div>
        
        <div className="flex gap-1">
          <button 
            onClick={() => { playAudio('click', sfx); setTool('pen'); }} 
            className={`p-2 retro-border transition-all ${tool === 'pen' ? 'bg-white shadow-inner scale-110 z-10' : 'retro-bg-window opacity-70 hover:opacity-100'}`}
            title="Pen Tool"
          >
            <PenTool size={18} />
          </button>
          <button 
            onClick={() => { playAudio('click', sfx); setTool('eraser'); }} 
            className={`p-2 retro-border transition-all flex items-center gap-1 ${tool === 'eraser' ? 'bg-pink-100 shadow-inner scale-110 z-10 border-pink-400' : 'retro-bg-window opacity-70 hover:opacity-100'}`}
            title="Eraser Tool"
          >
            <Eraser size={18} className={tool === 'eraser' ? 'text-pink-600' : ''} />
            {tool === 'eraser' && <span className="text-[9px] font-black uppercase text-pink-600">Eraser</span>}
          </button>
          <button 
            onClick={() => { playAudio('click', sfx); setTool('bucket'); }} 
            className={`p-2 retro-border transition-all ${tool === 'bucket' ? 'bg-white shadow-inner scale-110 z-10' : 'retro-bg-window opacity-70 hover:opacity-100'}`}
            title="Fill Bucket"
          >
            <PaintBucket size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-[var(--border)] mx-1"></div>

        <div className="flex gap-1">
          <button 
            onClick={handleUndo} 
            disabled={historyStep <= 0} 
            className="p-2 retro-border bg-white disabled:opacity-30 hover:bg-[var(--accent)] transition-colors"
            title="Undo"
          >
            <Undo size={18}/>
          </button>
          <button 
            onClick={handleRedo} 
            disabled={historyStep >= history.length - 1} 
            className="p-2 retro-border bg-white disabled:opacity-30 hover:bg-[var(--accent)] transition-colors"
            title="Redo"
          >
            <Redo size={18}/>
          </button>
        </div>

        <RetroButton variant="white" onClick={() => { clear(); setDirty(false); }} className="px-2 py-1 text-xs ml-auto retro-border"><Trash2 size={12}/></RetroButton>
        <RetroButton onClick={handleExport} className="px-3 py-1 text-xs retro-border"><Download size={12} className="mr-1 inline"/>Save</RetroButton>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div 
          className={`retro-border retro-shadow-dark aspect-square w-full max-w-[480px] grid select-none cursor-crosshair`} 
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)`, cursor: tool === 'bucket' ? 'cell' : 'crosshair' }}
          onMouseLeave={handlePointerUp}
          onMouseUp={handlePointerUp}
        >
          {localGrid.map((row, r) => row.map((c, ci) => (
            <div key={`${r}-${ci}`}
              style={{ backgroundColor: c, border: '0.5px solid rgba(0,0,0,0.05)' }}
              onMouseDown={() => { setIsDrawing(true); paint(r, ci); }}
              onMouseEnter={() => { if (isDrawing) paint(r, ci); }}
              onTouchStart={(e) => { e.preventDefault(); paint(r, ci); }}
            />
          )))}
        </div>
      </div>
    </RetroWindow>
  );
}
