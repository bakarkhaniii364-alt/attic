import React, { useState } from 'react';
import { Type } from 'lucide-react';
import { RetroWindow } from '../components/UI.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';

export function PoetryApp({ onClose, sfx }) {
  const initialWords = ['love', 'you', 'are', 'my', 'sun', 'star', 'forever', 'always', 'cute', 'sweet', 'the', 'is', 'a', 'to', 'we', 'us', 'happy', 'today', 'smiles', 'kisses'];
  const [words, setWords] = useLocalStorage('poetry_words', initialWords.map((w,i)=>({id:i, text:w, x: 20 + (i%5)*70, y: 20 + Math.floor(i/5)*50})));
  const [dragging, setDragging] = useState(null);
  
  const handlePointerDown = (e, id) => { e.preventDefault(); setDragging(id); e.target.setPointerCapture(e.pointerId); };
  const handlePointerMove = (e) => { if (dragging === null) return; setWords(words.map(w => w.id === dragging ? { ...w, x: w.x + e.movementX, y: w.y + e.movementY } : w)); };
  const handlePointerUp = (e) => { if (dragging !== null) { playAudio('click', sfx); setDragging(null); e.target.releasePointerCapture(e.pointerId); } };
  
  return (
    <RetroWindow title="poetry_fridge.exe" onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
      <div className="p-4 bg-gray-200 border-b-2 retro-border font-bold flex justify-between"><h2 className="flex items-center gap-2"><Type size={20}/> Magnetic Poetry</h2></div>
      <div className="flex-1 relative bg-gray-100 overflow-hidden touch-none" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        {words.map(w => ( <div key={w.id} onPointerDown={(e) => handlePointerDown(e, w.id)} style={{ left: w.x, top: w.y, zIndex: dragging === w.id ? 10 : 1 }} className={`absolute px-3 py-1 bg-white retro-border cursor-grab select-none font-bold text-sm ${dragging === w.id ? 'retro-shadow-primary scale-110' : 'retro-shadow-dark'}`}>{w.text}</div> ))}
      </div>
    </RetroWindow>
  );
}
