import React, { useState } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { Download, Trash2, PaintBucket } from 'lucide-react';

const PALETTE = ['#5c3a21','#e94560','#4f9ef8','#f9e2af','#b5c99a','#ffffff','#000000','#ff6b6b','#a855f7','#14b8a6','#f97316','#ec4899'];

export function PixelArtApp({ onClose, sfx, onSaveToScrapbook }) {
  const SIZE = 24;
  const [grid, setGrid] = useState(() => Array(SIZE).fill(null).map(() => Array(SIZE).fill('#ffffff')));
  const [color, setColor] = useState('#5c3a21');
  const [tool, setTool] = useState('pen'); // pen or eraser
  const [isDrawing, setIsDrawing] = useState(false);

  const paint = (r, c) => {
    const newGrid = grid.map(row => [...row]);
    newGrid[r][c] = tool === 'eraser' ? '#ffffff' : color;
    setGrid(newGrid);
  };

  const clear = () => { playAudio('click', sfx); setGrid(Array(SIZE).fill(null).map(() => Array(SIZE).fill('#ffffff'))); };

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

  const pixelSize = `${100 / SIZE}%`;

  return (
    <RetroWindow title="pixel_art.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]" noPadding>
      <div className="p-2 retro-bg-accent flex gap-2 items-center flex-wrap">
        {PALETTE.map(c => (
          <button key={c} onClick={() => { setColor(c); setTool('pen'); }} className={`w-6 h-6 rounded-full retro-border ${color === c && tool !== 'eraser' ? 'ring-2 ring-offset-1 ring-[var(--border)] scale-125' : ''}`} style={{ backgroundColor: c }} />
        ))}
        <div className="h-6 w-px bg-[var(--border)] mx-1"></div>
        <button onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')} className={`p-1 retro-border text-xs font-bold ${tool === 'eraser' ? 'retro-bg-primary' : 'retro-bg-window'}`}>🧹</button>
        <RetroButton variant="white" onClick={clear} className="px-2 py-1 text-xs ml-auto"><Trash2 size={12}/></RetroButton>
        <RetroButton onClick={handleExport} className="px-3 py-1 text-xs"><Download size={12} className="mr-1 inline"/>Save</RetroButton>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="retro-border retro-shadow-dark aspect-square w-full max-w-[480px] grid select-none" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)` }}
          onMouseLeave={() => setIsDrawing(false)}
        >
          {grid.map((row, r) => row.map((c, ci) => (
            <div key={`${r}-${ci}`}
              style={{ backgroundColor: c, border: '0.5px solid rgba(0,0,0,0.05)' }}
              className="cursor-crosshair"
              onMouseDown={() => { setIsDrawing(true); paint(r, ci); }}
              onMouseEnter={() => { if (isDrawing) paint(r, ci); }}
              onMouseUp={() => setIsDrawing(false)}
              onTouchStart={(e) => { e.preventDefault(); paint(r, ci); }}
            />
          )))}
        </div>
      </div>
    </RetroWindow>
  );
}
