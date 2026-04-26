import React, { useState, useEffect, useRef } from 'react';
import { Download, Brush, Trash2, PenTool, Eraser, PaintBucket, Square, Circle, Minus, Send, Image as ImageIcon, Camera, ChevronLeft, ChevronRight, Check, Lock, Unlock, Type, Heart, Pipette } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useAssetSync } from '../hooks/useAssetSync.js';
import { floodFill } from '../utils/helpers.js';
import { base64ToBlob } from '../utils/file.js';

export function DoodleViewer({ doodle, onClose, onRedoodle, onReplyToChat, profileName, sfx }) {
  const handleDownload = () => { playAudio('click', sfx); const a = document.createElement('a'); a.href = doodle.img; a.download = `doodle_from_partner_${Date.now()}.png`; a.click(); };
  const handleReplyChat = () => { playAudio('send', sfx); if (onReplyToChat) onReplyToChat(`💌 ${profileName || 'You'} replied to a doodle`, doodle.img); };
  return (
    <RetroWindow title="received_doodle.msg" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
       <div className="flex-1 bg-[#fdfbf7] p-6 sm:p-8 flex flex-col retro-border shadow-inner relative overflow-y-auto">
          <div className="border-b-2 border-dashed border-[var(--border)] pb-4 mb-6 flex flex-col gap-2">
             <div className="flex justify-between items-end"><span className="font-bold text-lg sm:text-xl text-[var(--primary)]">From: <span className="text-[var(--text-main)]">Partner ❤️</span></span><span className="text-xs opacity-50">{new Date(doodle.id).toLocaleDateString()}</span></div>
             <div className="font-bold text-lg sm:text-xl text-[var(--secondary)]">To: <span className="text-[var(--text-main)]">{profileName || 'Me'} ✨</span></div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-white retro-border retro-shadow-dark p-2 mb-6 min-h-[300px]"><img src={doodle.img} alt="Doodle from partner" className="max-w-full max-h-full object-contain" /></div>
          <p className="text-center italic opacity-50 text-sm mb-6">* Saved automatically to your Scrapbook *</p>
          <div className="flex-1 flex flex-col sm:flex-row gap-3 justify-center mt-auto">
             <RetroButton variant="secondary" onClick={handleDownload} className="px-5 py-3 flex items-center justify-center gap-2 retro-border"><Download size={18}/> Save</RetroButton>
             <RetroButton variant="primary" onClick={() => onRedoodle(doodle)} className="px-5 py-3 flex items-center justify-center gap-2 retro-border"><Brush size={18}/> Redoodle</RetroButton>
             {onReplyToChat && <RetroButton variant="accent" onClick={handleReplyChat} className="px-5 py-3 flex items-center justify-center gap-2 retro-border"><Send size={18}/> Reply in Chat</RetroButton>}
          </div>
       </div>
    </RetroWindow>
  );
}

export function DoodleApp({ onClose, initialDoodle, onSendDoodle, onSaveToScrapbook, sfx, roomId, userId }) {
  const { uploadAsset } = useAssetSync(roomId);
  const isNormalized = !!roomId;
  const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false); const [tool, setTool] = useState('pen'); const [color, setColor] = useState('#5c3a21'); const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 }); const snapshotRef = useRef(null); const snapshotHistory = useRef([]);
  const colorInputRef = useRef(null);
  
  const initCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return;
    const ctx = canvas.getContext('2d'); const imgData = canvas.dataset.initialized === 'true' && canvas.width > 0 && canvas.height > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
    canvas.width = rect.width; canvas.height = rect.height;
    if (initialDoodle && !canvas.dataset.initialized) { const img = new Image(); img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); snapshotHistory.current=[canvas.toDataURL()]; }; img.src = initialDoodle.img; canvas.dataset.initialized = 'true'; } 
    else if (imgData) { ctx.putImageData(imgData, 0, 0); } 
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); canvas.dataset.initialized = 'true'; snapshotHistory.current=[canvas.toDataURL()]; }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };
  useEffect(() => { initCanvas(); window.addEventListener('resize', initCanvas); return () => window.removeEventListener('resize', initCanvas); }, [initialDoodle]);

  const getCoords = (e) => { const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }; };

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current; if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const { x, y } = getCoords(e);
    if (tool.startsWith('stamp_')) { const ctx = canvas.getContext('2d'); ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tool.split('_')[1], x, y); setHasUnsavedChanges(true); snapshotHistory.current.push(canvas.toDataURL()); return; }
    if (tool === 'fill') { floodFill(canvas, Math.floor(x), Math.floor(y), color); setHasUnsavedChanges(true); snapshotHistory.current.push(canvas.toDataURL()); return; }
    setIsDrawing(true); setHasUnsavedChanges(true); startPosRef.current = { x, y }; const ctx = canvas.getContext('2d');
    if (['rect', 'circle', 'line'].includes(tool)) { snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height); } else { ctx.beginPath(); ctx.moveTo(x, y); }
  };
  const handlePointerMove = (e) => {
    if (!isDrawing || tool === 'fill' || tool.startsWith('stamp_')) return;
    const { x, y } = getCoords(e); const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; ctx.lineWidth = tool === 'eraser' ? 24 : 4;
    if (['rect', 'circle', 'line'].includes(tool)) {
      if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0);
      let startX = startPosRef.current.x; let startY = startPosRef.current.y; let width = x - startX; let height = y - startY;
      if (e.shiftKey) { const maxDist = Math.max(Math.abs(width), Math.abs(height)); width = width < 0 ? -maxDist : maxDist; height = height < 0 ? -maxDist : maxDist; }
      if (e.altKey) { startX = startX - width; startY = startY - height; width = width * 2; height = height * 2; }
      ctx.beginPath();
      if (tool === 'rect') { ctx.rect(startX, startY, width, height); } else if (tool === 'circle') { const rx = Math.abs(width / 2); const ry = Math.abs(height / 2); const cx = startX + width / 2; const cy = startY + height / 2; ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI); } else if (tool === 'line') { let lx = x; let ly = y; if (e.shiftKey) { const angle = Math.atan2(y - startPosRef.current.y, x - startPosRef.current.x); const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4); const dist = Math.hypot(y - startPosRef.current.y, x - startPosRef.current.x); lx = startPosRef.current.x + dist * Math.cos(snapped); ly = startPosRef.current.y + dist * Math.sin(snapped); } if (e.altKey) { const dx = lx - startPosRef.current.x; const dy = ly - startPosRef.current.y; ctx.moveTo(startPosRef.current.x - dx, startPosRef.current.y - dy); } else { ctx.moveTo(startPosRef.current.x, startPosRef.current.y); } ctx.lineTo(lx, ly); }
      ctx.stroke();
    } else { ctx.lineTo(x, y); ctx.stroke(); }
  };
  const handlePointerUp = () => { if(isDrawing){ setIsDrawing(false); snapshotRef.current = null; snapshotHistory.current.push(canvasRef.current.toDataURL()); } };
  const clearCanvas = () => { playAudio('click', sfx); const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); setHasUnsavedChanges(true); snapshotHistory.current=[canvas.toDataURL()]; };
  const [showSentOverlay, setShowSentOverlay] = useState(false);
  const handleSend = async () => {
    playAudio('send', sfx);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    
    if (isNormalized) {
        try {
            const blob = base64ToBlob(dataUrl);
            const file = new File([blob], `doodle_${Date.now()}.png`, { type: 'image/png' });
            await uploadAsset(file, 'doodle', userId);
        } catch (e) {
            alert("Failed to send doodle: " + e.message);
            return;
        }
    } else {
        if (onSendDoodle) onSendDoodle({img: dataUrl, history: snapshotHistory.current});
    }
    
    setHasUnsavedChanges(false);
    setShowSentOverlay(true);
  };

  const handleSaveScrapbook = async () => {
    playAudio('click', sfx);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    
    if (isNormalized) {
        try {
            const blob = base64ToBlob(dataUrl);
            const file = new File([blob], `scrapbook_${Date.now()}.png`, { type: 'image/png' });
            await uploadAsset(file, 'scrapbook', userId);
            alert('Saved to Scrapbook!');
        } catch (e) {
            alert("Failed to save: " + e.message);
        }
    } else {
        if (onSaveToScrapbook) onSaveToScrapbook(dataUrl);
        alert('Saved to Scrapbook!');
    }
  };
  const handleDownload = () => { playAudio('click', sfx); const dataUrl = canvasRef.current.toDataURL('image/png'); const a = document.createElement('a'); a.href = dataUrl; a.download = `doodle_${Date.now()}.png`; a.click(); };
  const toolBtnClass = (t) => `p-2 rounded-md transition-colors retro-border ${tool === t ? 'bg-white shadow-inner' : 'opacity-70 hover:bg-black/10'}`;

  return (
    <RetroWindow title={initialDoodle ? "doodle_editor.exe" : "new_doodle.exe"} onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" confirmOnClose hasUnsavedChanges={hasUnsavedChanges} onSaveBeforeClose={() => { handleSaveScrapbook(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="p-2 retro-bg-accent retro-border-b flex gap-2 items-center overflow-x-auto select-none">
        <button onClick={() => {playAudio('click', sfx); setTool('pen')}} className={toolBtnClass('pen')}><PenTool size={18}/></button><button onClick={() => {playAudio('click', sfx); setTool('fill')}} className={toolBtnClass('fill')}><PaintBucket size={18}/></button><button onClick={() => {playAudio('click', sfx); setTool('eraser')}} className={toolBtnClass('eraser')}><Eraser size={18}/></button><div className="h-6 w-px bg-[var(--border)] mx-1 flex-shrink-0"></div><button onClick={() => {playAudio('click', sfx); setTool('rect')}} className={toolBtnClass('rect')}><Square size={18}/></button><button onClick={() => {playAudio('click', sfx); setTool('circle')}} className={toolBtnClass('circle')}><Circle size={18}/></button><button onClick={() => {playAudio('click', sfx); setTool('line')}} className={toolBtnClass('line')}><Minus size={18} className="rotate-45"/></button><div className="h-6 w-px bg-[var(--border)] mx-1 flex-shrink-0"></div><button onClick={() => setTool('stamp_❤️')} className={toolBtnClass('stamp_❤️')}>❤️</button><button onClick={() => setTool('stamp_⭐')} className={toolBtnClass('stamp_⭐')}>⭐</button><div className="h-6 w-px bg-[var(--border)] mx-1 flex-shrink-0"></div>
        {['#5c3a21', '#ffb6b9', '#a3c4f3', '#f9e2af', '#b5c99a', '#ffffff', '#000000', '#ff0000'].map(c => ( <button key={c} onClick={() => { playAudio('click', sfx); setColor(c); if(tool==='eraser') setTool('pen'); }} className={`w-6 h-6 rounded-full retro-border flex-shrink-0 transition-transform ${color === c && tool !== 'eraser' ? 'ring-2 ring-black scale-125' : ''}`} style={{backgroundColor: c}} /> ))}
        <button onClick={() => colorInputRef.current.click()} className="w-6 h-6 rounded-full retro-border flex-shrink-0 flex items-center justify-center bg-white" title="Custom Color">
           <Pipette size={12} />
           <input type="color" ref={colorInputRef} className="sr-only" onChange={(e) => { setColor(e.target.value); if(tool==='eraser') setTool('pen'); }} />
        </button>
        <div className="ml-auto flex-shrink-0"><RetroButton variant="white" onClick={clearCanvas} className="px-3 py-1 text-xs flex items-center gap-1 retro-border"><Trash2 size={12}/> Clear</RetroButton></div>
      </div>
      <div className="flex-1 bg-white relative touch-none">
        <canvas 
          ref={canvasRef} 
          onMouseDown={handlePointerDown} 
          onMouseMove={handlePointerMove} 
          onMouseUp={handlePointerUp} 
          onMouseLeave={handlePointerUp} 
          onTouchStart={handlePointerDown} 
          onTouchMove={handlePointerMove} 
          onTouchEnd={handlePointerUp} 
          className="absolute inset-0 w-full h-full" 
          style={{ cursor: tool === 'fill' ? 'cell' : tool.startsWith('stamp_') ? 'grab' : 'crosshair' }}
        />
      </div>
      <div className="p-3 retro-bg-window retro-border-t flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2"><RetroButton variant="secondary" onClick={handleDownload} className="px-3 py-2 text-xs sm:text-sm flex items-center gap-2 retro-border"><Download size={14}/> Device</RetroButton><RetroButton variant="white" onClick={handleSaveScrapbook} className="px-3 py-2 text-xs sm:text-sm flex items-center gap-2 retro-border"><ImageIcon size={14}/> Album</RetroButton></div>
        <RetroButton variant="primary" onClick={handleSend} className="px-6 py-2 text-sm sm:text-base flex items-center gap-2 retro-border">Send <Send size={16}/></RetroButton>
      </div>
      {showSentOverlay && (
        <div className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-4">
          <RetroWindow title="doodle_sent.msg" onClose={() => { setShowSentOverlay(false); onClose && onClose(); }} className="w-full max-w-sm" confirmOnClose={false}>
            <div className="p-4 text-center">
              <h3 className="font-bold text-lg text-[var(--primary)] mb-2">Doodle Sent</h3>
              <p className="mb-4 opacity-70">Your doodle has been sent to your partner.</p>
              <div className="flex gap-2">
                <RetroButton variant="white" className="flex-1" onClick={() => { playAudio('click', sfx); setShowSentOverlay(false); }}>Close</RetroButton>
                <RetroButton className="flex-1" onClick={() => { playAudio('click', sfx); setShowSentOverlay(false); onClose && onClose(); }}>Done</RetroButton>
              </div>
            </div>
          </RetroWindow>
        </div>
      )}
    </RetroWindow>
  );
}

export function PersistentDoodleApp({ onClose, sfx, userId }) {
  const [doodleData, setDoodleData] = useGlobalSync('persistent_doodle', { img: null, lastUpdate: 0, updater: null });
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#5c3a21');
  const [brushSize, setBrushSize] = useState(4);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doodleData.img) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = doodleData.img;
  }, [doodleData.img]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (doodleData.img) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = doodleData.img;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };

  const handlePointerDown = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setDoodleData({ img: dataUrl, lastUpdate: Date.now(), updater: userId });
  };

  return (
    <RetroWindow title="shared_canvas.exe" onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
      <div className="p-2 retro-bg-accent retro-border-b flex gap-4 items-center select-none overflow-x-auto">
        <div className="flex gap-1">
          {['#5c3a21', '#e94560', '#4f9ef8', '#f4d06f', '#4ade80', '#000000'].map(c => (
            <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full retro-border ${color === c ? 'scale-125 ring-2 ring-black' : ''}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-16 sm:w-24 accent-[var(--primary)]" />
        <span className="text-[10px] font-bold uppercase opacity-50 ml-auto">
          {doodleData.updater === userId ? 'You are drawing' : 'Last update by partner'}
        </span>
      </div>
      <div className="flex-1 bg-white relative touch-none" ref={containerRef}>
        <canvas 
          ref={canvasRef} 
          onMouseDown={handlePointerDown} 
          onMouseMove={handlePointerMove} 
          onMouseUp={handlePointerUp} 
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="absolute inset-0 w-full h-full cursor-crosshair" 
        />
      </div>
      <div className="p-2 bg-[var(--bg-window)] retro-border-t text-[9px] font-bold opacity-40 text-center uppercase italic">
        * This drawing is shared and persistent. It never expires. *
      </div>
    </RetroWindow>
  );
}

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

export function TimeCapsuleApp({ onClose, letters, setLetters, sfx }) {
  const [activeTab, setActiveTab] = useState('inbox'); const [newLetter, setNewLetter] = useState(''); const [unlockMins, setUnlockMins] = useState('1'); const [now, setNow] = useState(Date.now());
  const [readingLetter, setReadingLetter] = useState(null);

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const handleSend = () => { if (!newLetter.trim()) return; playAudio('send', sfx); setLetters([...letters, { id: Date.now(), sender: 'me', text: newLetter, unlockDate: Date.now() + parseInt(unlockMins) * 60000 }]); setNewLetter(''); setActiveTab('inbox'); };
  const getTimeLeft = (unlockDate) => { const diff = unlockDate - now; if (diff <= 0) return 'Unlocked!'; return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`; };

  if (readingLetter) {
     const handleDownloadLetter = async () => {
       playAudio('click', sfx);
       const el = document.getElementById('letter-paper');
       if (!el) return;
       try {
         const html2canvas = (await import('html2canvas')).default;
         const canvas = await html2canvas(el, { backgroundColor: '#fdfbf7', scale: 2 });
         const a = document.createElement('a');
         a.href = canvas.toDataURL('image/png');
         a.download = `letter_${readingLetter.id}.png`;
         a.click();
       } catch(e) { 
         console.error(e);
         alert("Failed to generate image. Please try again.");
       }
     };
     return (
       <RetroWindow title="reading_letter.exe" onClose={()=>setReadingLetter(null)} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
          <div id="letter-paper" className="flex-1 p-8 sm:p-12 overflow-y-auto relative" style={{ 
            backgroundColor: '#fdfbf7', 
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e8ddd0 31px, #e8ddd0 32px)',
            backgroundPositionY: '60px'
          }}>
             <div className="absolute top-0 right-0 w-16 h-16 bg-red-600 rounded-bl-full shadow-md z-10 flex items-center justify-center"><Heart size={20} className="text-white -mt-2 -ml-2"/></div>
             
             {/* From / To header */}
             <div className="mb-8 pb-4 border-b-2 border-dashed" style={{ borderColor: '#d4c5b0', color: '#8b7355' }}>
               <p className="font-bold text-sm"><span className="uppercase tracking-widest opacity-60">From:</span> {readingLetter.sender === 'me' ? 'You' : 'Partner'}</p>
               <p className="font-bold text-sm mt-1"><span className="uppercase tracking-widest opacity-60">To:</span> {readingLetter.sender === 'me' ? 'Partner' : 'You'}</p>
               <p className="text-xs opacity-40 mt-2">{new Date(readingLetter.id || Date.now()).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
             </div>

             <p className="font-serif text-lg leading-loose whitespace-pre-wrap" style={{ color: '#3a2f26' }}>{readingLetter.text}</p>
             <p className="text-right italic font-bold mt-8" style={{ color: '#8b7355' }}>— {readingLetter.sender === 'me' ? 'You' : 'Partner'} 💌</p>
          </div>
          <div className="flex gap-2 p-3 retro-border-t bg-[var(--bg-main)] shrink-0">
            <RetroButton className="flex-1 py-2 text-sm" onClick={handleDownloadLetter}>📥 Download Letter</RetroButton>
            <RetroButton variant="secondary" className="flex-1 py-2 text-sm" onClick={() => setReadingLetter(null)}>Close</RetroButton>
          </div>
       </RetroWindow>
     );
  }

  return (
    <RetroWindow title="time_capsule.exe" onClose={onClose} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col relative" confirmOnClose hasUnsavedChanges={() => newLetter.trim() !== ''} onSaveBeforeClose={() => { handleSend(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="flex border-b-2 retro-border shrink-0 z-20 relative"><button onClick={() => {playAudio('click', sfx); setActiveTab('inbox')}} className={`flex-1 py-3 font-bold ${activeTab === 'inbox' ? 'bg-[var(--primary)] text-[var(--bg-window)]' : 'bg-[var(--bg-window)] opacity-70'}`}>Locked Inbox</button><button onClick={() => {playAudio('click', sfx); setActiveTab('write')}} className={`flex-1 py-3 font-bold border-l-2 retro-border ${activeTab === 'write' ? 'bg-[var(--secondary)] text-[var(--bg-window)]' : 'bg-[var(--bg-window)] opacity-70'}`}>Write Letter</button></div>
      {activeTab === 'write' ? (
        <div className="flex-1 p-4 sm:p-6 bg-[var(--bg-main)] flex flex-col gap-4 overflow-y-auto">
           <textarea value={newLetter} onChange={e=>setNewLetter(e.target.value)} placeholder="Write a time capsule letter to your partner... Make it meaningful. (It will be locked until the time expires)" className="flex-1 min-h-[200px] p-6 retro-border retro-bg-window focus:outline-none resize-none font-serif text-base sm:text-lg leading-relaxed shadow-inner" style={{ caretColor: 'var(--primary)' }} />
           <div className="flex flex-col sm:flex-row gap-4 items-end bg-[var(--bg-window)] p-4 retro-border retro-shadow-dark shrink-0">
              <div className="flex-1 w-full"><label className="font-bold text-sm block mb-1">Seal for duration:</label><select value={unlockMins} onChange={e=>setUnlockMins(e.target.value)} className="w-full p-3 font-bold retro-border bg-white cursor-pointer"><option value="1">1 Minute (Test)</option><option value="60">1 Hour</option><option value="1440">1 Day</option><option value="10080">1 Week</option></select></div>
              <RetroButton variant="primary" onClick={handleSend} className="px-8 py-3 w-full sm:w-auto flex items-center justify-center gap-2"><Lock size={18}/> Lock & Send</RetroButton>
           </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-main)]">
           {letters.length === 0 && <p className="text-center opacity-50 mt-10 font-bold uppercase tracking-widest text-sm">Inbox is empty. Time to write!</p>}
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
           {letters.map(l => { 
               const isLocked = l.unlockDate > now; 
               return ( 
                 <div key={l.id} onClick={() => { if(!isLocked) { playAudio('click', sfx); setReadingLetter(l); } else { playAudio('click', sfx); } }} className={`relative w-full aspect-video sm:aspect-square md:aspect-[4/3] retro-border shadow-[4px_4px_0_rgba(0,0,0,0.2)] cursor-pointer transition-transform hover:-translate-y-2 ${isLocked ? 'bg-[#f4d06f]' : 'bg-[#fffdf9]'}`}>
                    {isLocked ? (
                       <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center">
                          <div className="absolute top-0 w-[120%] h-0 border-t-[80px] sm:border-t-[100px] border-t-[#e8c050] border-l-[150px] sm:border-l-[200px] border-l-transparent border-r-[150px] sm:border-r-[200px] border-r-transparent z-10 drop-shadow-md"></div>
                          <div className="absolute z-20 w-14 h-14 bg-red-600 rounded-full flex flex-col items-center justify-center text-[var(--bg-window)] retro-border shadow-xl hover:scale-110 transition-transform"><Lock size={20}/></div>
                          <div className="absolute bottom-3 sm:bottom-4 z-20 font-bold text-xs opacity-90 bg-black text-white px-3 py-1 rounded-full shadow-lg">{getTimeLeft(l.unlockDate)}</div>
                       </div>
                    ) : (
                       <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-[var(--bg-window)] overflow-hidden border-4 border-dashed border-[var(--bg-main)] m-1 hover:bg-[var(--accent)] transition-colors">
                          <Unlock size={28} className="text-[var(--primary)] mb-3"/>
                          <p className="text-sm italic text-center font-serif truncate w-full text-[var(--text-main)] font-bold">Tap to open...</p>
                          <span className="absolute bottom-3 text-[10px] font-bold opacity-50 uppercase tracking-widest">From: {l.sender === 'me' ? 'You' : 'Partner'}</span>
                       </div>
                    )}
                 </div> 
               ) 
           })}
           </div>
        </div>
      )}
    </RetroWindow>
  );
}

export function ListsApp({ onClose, sfx }) {
  const [activeTab, setActiveTab] = useState('bucket'); const [items, setItems] = useLocalStorage('shared_lists', [ { id: 1, type: 'bucket', text: 'Visit Japan', done: false }, { id: 2, type: 'bucket', text: 'Bake a cake together', done: true }, { id: 3, type: 'watch', text: 'Spirited Away', done: false } ]); const [newItem, setNewItem] = useState('');
  const handleAdd = (e) => { e.preventDefault(); if (!newItem.trim()) return; playAudio('click', sfx); setItems([...items, { id: Date.now(), type: activeTab, text: newItem, done: false }]); setNewItem(''); };
  const toggleDone = (id) => { playAudio('click', sfx); setItems(items.map(i => i.id === id ? {...i, done: !i.done} : i)); };
  const deleteItem = (id) => { playAudio('click', sfx); setItems(items.filter(i => i.id !== id)); };
  const currentItems = items.filter(i => i.type === activeTab);
  return (
    <RetroWindow title="shared_lists.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
      <div className="flex border-b-2 retro-border"><button onClick={() => {playAudio('click', sfx); setActiveTab('bucket')}} className={`flex-1 py-3 font-bold ${activeTab === 'bucket' ? 'retro-bg-primary' : 'retro-bg-window opacity-70'}`}>Bucket List</button><button onClick={() => {playAudio('click', sfx); setActiveTab('watch')}} className={`flex-1 py-3 font-bold border-l-2 retro-border ${activeTab === 'watch' ? 'retro-bg-secondary' : 'retro-bg-window opacity-70'}`}>Watchlist</button></div>
      <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg-main)]"><div className="space-y-3">{currentItems.map(item => ( <div key={item.id} className="flex items-center gap-3 p-3 retro-bg-window retro-border retro-shadow-dark"><button onClick={() => toggleDone(item.id)} className={`w-6 h-6 retro-border flex items-center justify-center ${item.done ? 'retro-bg-accent' : 'bg-white'}`}>{item.done && <Check size={14}/>}</button><span className={`flex-1 font-bold ${item.done ? 'line-through opacity-50' : ''}`}>{item.text}</span><button onClick={() => deleteItem(item.id)} className="p-2 hover:bg-red-100 rounded-full text-red-500"><Trash2 size={16}/></button></div> ))}</div></div>
      <form onSubmit={handleAdd} className="p-3 retro-bg-window retro-border-t flex gap-2"><input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder={`Add to ${activeTab === 'bucket' ? 'bucket list' : 'watchlist'}...`} className="flex-1 p-2 retro-border focus:outline-none" /><RetroButton type="submit" className="px-4"><Send size={18}/></RetroButton></form>
    </RetroWindow>
  );
}

export function CalendarApp({ onClose, sfx }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useLocalStorage('calendar_events', []);
  const [selectedDay, setSelectedDay] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('var(--primary)');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => { playAudio('click', sfx); setCurrentDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { playAudio('click', sfx); setCurrentDate(new Date(year, month + 1, 1)); };

  const getDateStr = (day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const getEventsForDay = (day) => events.filter(e => e.date === getDateStr(day));

  const addEvent = () => {
    if (!newTitle.trim() || !selectedDay) return;
    playAudio('click', sfx);
    setEvents([...events, { id: Date.now(), date: getDateStr(selectedDay), title: newTitle, color: newColor }]);
    setNewTitle('');
  };
  const removeEvent = (id) => { playAudio('click', sfx); setEvents(events.filter(e => e.id !== id)); };

  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <RetroWindow title="calendar.exe" onClose={onClose} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth} className="p-2 retro-border retro-bg-window hover:bg-[var(--accent)] transition-colors"><ChevronLeft size={20}/></button>
        <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wider">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 retro-border retro-bg-window hover:bg-[var(--accent)] transition-colors"><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1 text-center font-bold text-[10px] sm:text-xs opacity-60">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr overflow-y-auto">
        {blanks.map(i => <div key={`b-${i}`} className="retro-border opacity-20 bg-[var(--bg-main)]"></div>)}
        {days.map(d => {
          const dayEvents = getEventsForDay(d);
          const isToday = isCurrentMonth && today.getDate() === d;
          return (
            <div key={d} onClick={() => { playAudio('click', sfx); setSelectedDay(d); }} className={`retro-border p-1 flex flex-col cursor-pointer transition-colors ${isToday ? 'ring-2 ring-[var(--primary)] retro-bg-accent' : dayEvents.length > 0 ? 'retro-bg-window' : 'retro-bg-window hover:bg-[var(--accent)]'} ${selectedDay === d ? 'retro-shadow-dark' : ''}`}>
              <span className={`font-bold text-xs ${isToday ? 'text-[var(--primary)]' : ''}`}>{d}</span>
              {dayEvents.slice(0, 2).map(ev => (
                <div key={ev.id} className="w-full h-1 rounded-full mt-auto" style={{ backgroundColor: ev.color || 'var(--primary)' }}></div>
              ))}
            </div>
          );
        })}
      </div>
      {selectedDay && (
        <div className="mt-3 p-3 retro-border retro-bg-accent border-dashed">
          <h3 className="font-bold text-sm mb-2">{monthName.split(' ')[0]} {selectedDay}</h3>
          {getEventsForDay(selectedDay).map(ev => (
            <div key={ev.id} className="flex items-center gap-2 mb-1 text-sm">
              <div className="w-3 h-3 rounded-full retro-border" style={{ backgroundColor: ev.color }}></div>
              <span className="flex-1 font-bold">{ev.title}</span>
              <button onClick={() => removeEvent(ev.id)} className="text-red-500 hover:text-red-700 text-xs font-bold">✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEvent()} placeholder="Add event..." className="flex-1 p-1 retro-border retro-bg-window text-sm focus:outline-none" />
            <select value={newColor} onChange={e => setNewColor(e.target.value)} className="p-1 retro-border retro-bg-window text-xs font-bold">
              <option value="var(--primary)">❤️</option>
              <option value="var(--secondary)">💙</option>
              <option value="#4ade80">💚</option>
              <option value="#f59e0b">🧡</option>
            </select>
            <RetroButton onClick={addEvent} className="px-3 py-1 text-xs">Add</RetroButton>
          </div>
        </div>
      )}
    </RetroWindow>
  );
}

export function ScrapbookApp({ onClose, images: propImages, sfx, userId, roomId }) {
  const { assets } = useAssetSync(roomId, 'scrapbook');
  const [layoutMode, setLayoutMode] = useLocalStorage('scrapbook_mode', 'grid');
  const [layout, setLayout] = useGlobalSync('scrapbook_layout', {});
  const [page, setPage] = useState(1);
  
  // Combine legacy JSON images with new normalized storage assets
  const normalizedImages = assets.map(a => a.url);
  const images = [...new Set([...normalizedImages, ...propImages])];
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
      setLayout(prev => ({
        ...prev,
        [url]: { ...prev[url], x, y }
      }));
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
        <div className="flex gap-2">
           <span className="text-[10px] font-bold opacity-40 uppercase mr-2 mt-2">{images.length} photos</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-[#f0f0f0] relative p-4" ref={containerRef}>
        {layoutMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {visibleImages.map((url, i) => (
              <div key={i} className="group relative aspect-square retro-border bg-white p-1 retro-shadow-dark hover:-translate-y-1 transition-transform">
                <img src={url} alt="memory" loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button onClick={() => { playAudio('click', sfx); setLayoutMode('collage'); setLayout(p => ({ ...p, [url]: { x: 10 + Math.random()*70, y: 10+Math.random()*70, rotate: 0 } })); }} className="p-2 bg-white retro-border hover:bg-[var(--accent)]"><ImageIcon size={16}/></button>
                </div>
              </div>
            ))}
            {visibleImages.length < images.length && (
               <button onClick={() => setPage(p => p + 1)} className="aspect-square retro-border border-dashed border-2 flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                  <span className="font-black text-2xl">+</span>
                  <span className="text-[10px] font-bold">More</span>
               </button>
            )}
          </div>
        ) : (
          <div className="w-full h-full min-h-[1000px] relative bg-pattern-grid opacity-80">
            {images.map((url, i) => {
              const pos = layout[url] || { x: 10 + (i % 5) * 15, y: 10 + Math.floor(i / 5) * 20, rotate: (i * 7) % 30 - 15 };
              return (
                <div 
                  key={i} 
                  onMouseDown={(e) => handleDragStart(e, url)}
                  onTouchStart={(e) => handleDragStart(e, url)}
                  style={{ 
                    left: `${pos.x}%`, 
                    top: `${pos.y}%`, 
                    transform: `translate(-50%, -50%) rotate(${pos.rotate || 0}deg)`,
                    zIndex: i + 10
                  }}
                  className="absolute w-32 sm:w-48 bg-white p-1 sm:p-2 retro-border shadow-xl cursor-grab active:cursor-grabbing group select-none"
                >
                   <img src={url} alt="" className="w-full h-auto pointer-events-none" />
                   <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); rotateImage(url); }} className="p-1 bg-white retro-border rounded-full shadow-md hover:bg-[var(--accent)]"><Brush size={12}/></button>
                   </div>
                </div>
              );
            })}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full font-bold text-xs backdrop-blur-md border border-white/20 pointer-events-none z-[100]">
               DRAG PHOTOS TO CREATE A COLLAGE ❤️
            </div>
          </div>
        )}
      </div>
    </RetroWindow>
  );
}
