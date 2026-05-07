import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Brush } from 'lucide-react';
import { RetroWindow } from '../components/UI.jsx';
import { SecureImage } from '../components/SecureMedia.jsx';
import { useAssetSync } from '../hooks/useAssetSync.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';

export function ScrapbookApp({ onClose, images: propImages = [], sfx, userId, roomId }) {
   const { assets } = useAssetSync(roomId); // Fetch all assets for the room
  const [layoutMode, setLayoutMode] = useLocalStorage('scrapbook_mode', 'grid');
  const [layout, setLayout] = useGlobalSync('scrapbook_layout', {});
  const [page, setPage] = useState(1);
  
  const normalizedImages = assets.map(a => a.url);
  const images = [...new Set([...normalizedImages, ...(propImages || [])])];
  const visibleImages = images.slice(0, page * 12);
  const containerRef = useRef(null);

  const handleDragStart = (e, url) => {
    if (layoutMode === 'grid') return;
    const rect = containerRef.current.getBoundingClientRect();
    const handleMove = (moveEvent) => {
      const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setLayout(prev => ({ ...prev, [url]: { ...prev[url], x, y } }));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
  };

  const rotateImage = (url) => {
    setLayout(prev => ({
      ...prev,
      [url]: { ...prev[url], rotate: ((prev[url]?.rotate || 0) + 15) % 360 }
    }));
  };

  return (
    <RetroWindow title="scrapbook_v2.exe" onClose={onClose} className="w-full max-w-5xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
      <div className="p-3 bg-[var(--bg-main)] border-b-2 retro-border flex items-center justify-between shrink-0">
        <div className="flex gap-2">
          <button onClick={() => setLayoutMode('grid')} className={`px-3 py-1 text-xs font-bold retro-border ${layoutMode === 'grid' ? 'retro-bg-primary' : 'bg-white'}`}>Grid View</button>
          <button onClick={() => setLayoutMode('collage')} className={`px-3 py-1 text-xs font-bold retro-border ${layoutMode === 'collage' ? 'retro-bg-primary' : 'bg-white'}`}>Collage Mode</button>
        </div>
        <h2 className="font-black text-xs uppercase tracking-[0.2em] hidden sm:block">Memory Collection</h2>
        <div className="flex gap-2"><span className="text-[10px] font-bold opacity-40 uppercase mr-2 mt-2">{images.length} photos</span></div>
      </div>
      <div className="flex-1 overflow-auto bg-[#f0f0f0] relative p-4" ref={containerRef}>
        {layoutMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {visibleImages.map((url, i) => (
              <div key={i} className="group relative aspect-square retro-border bg-white p-1 retro-shadow-dark hover:-translate-y-1 transition-transform">
                <SecureImage url={url} alt="memory" loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button onClick={() => { playAudio('click', sfx); setLayoutMode('collage'); setLayout(p => ({ ...p, [url]: { x: 10 + Math.random()*70, y: 10+Math.random()*70, rotate: 0 } })); }} className="p-2 bg-white retro-border hover:bg-[var(--accent)]"><ImageIcon size={16}/></button>
                </div>
              </div>
            ))}
            {visibleImages.length < images.length && (
               <button onClick={() => setPage(p => p + 1)} className="aspect-square retro-border border-dashed border-2 flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                  <span className="font-black text-2xl">+</span><span className="text-[10px] font-bold">More</span>
               </button>
            )}
          </div>
        ) : (
          <div className="w-full h-full min-h-[1000px] relative bg-pattern-grid opacity-80">
            {images.map((url, i) => {
              const pos = layout[url] || { x: 10 + (i % 5) * 15, y: 10 + Math.floor(i / 5) * 20, rotate: (i * 7) % 30 - 15 };
              return (
                <div key={i} onMouseDown={(e) => handleDragStart(e, url)} onTouchStart={(e) => handleDragStart(e, url)} style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%, -50%) rotate(${pos.rotate || 0}deg)`, zIndex: i + 10 }} className="absolute w-32 sm:w-48 bg-white p-1 sm:p-2 retro-border shadow-xl cursor-grab active:cursor-grabbing group select-none">
                   <SecureImage url={url} alt="" className="w-full h-auto pointer-events-none" />
                   <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); rotateImage(url); }} className="p-1 bg-white retro-border rounded-full shadow-md hover:bg-[var(--accent)]"><Brush size={12}/></button>
                   </div>
                </div>
              );
            })}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full font-bold text-xs backdrop-blur-md border border-white/20 pointer-events-none z-[100]">DRAG PHOTOS TO CREATE A COLLAGE ❤️</div>
          </div>
          )}
       </div>
    </RetroWindow>
  );
}
