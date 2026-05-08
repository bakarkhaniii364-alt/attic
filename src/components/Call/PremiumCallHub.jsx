import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Phone, PhoneOff, MicOff, Mic, Volume2, VolumeX,
         Maximize2, Minimize2, VideoOff, Camera, Monitor, MonitorOff,
         Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { playAudio } from '../../utils/audio.js';

// Quality indicator dots
function QualityBadge({ quality }) {
  const colors = { good: 'bg-green-400', fair: 'bg-yellow-400', poor: 'bg-red-400' };
  const labels = { good: 'HD', fair: 'SD', poor: 'LOW' };
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-white ${
      quality === 'good' ? 'bg-green-500/70' : quality === 'fair' ? 'bg-yellow-500/70' : 'bg-red-500/70'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${colors[quality]}`} />
      {labels[quality]}
    </div>
  );
}

export function PremiumCallHub({
  calling, callDuration, callStatus, callQuality = 'good',
  isMuted, isDeafened, isCameraOff, isScreenSharing,
  onMicToggle, onDeafenToggle, onCameraToggle, onEndCall,
  onScreenShare, onStopScreenShare,
  partnerName, partnerPfp, sfx, remoteStream, localStream, isRinging, type,
}) {
  const remoteVideoRef = useRef(null);
  const localVideoRef  = useRef(null);
  
  // Window State
  const [position, setPosition] = useState({ x: window.innerWidth > 640 ? window.innerWidth - 500 : 20, y: 60 });
  const [size, setSize] = useState({ width: 480, height: 340 });
  const [isDragging, setIsDragging] = useState(false);
  const [resizing, setResizing] = useState(null); 
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  
  const rafRef = useRef();

  // Bind remote video stream
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (remoteStream && video) {
      video.srcObject = remoteStream;
      video.play().catch(() => {});
    }
  }, [remoteStream, isMinimized]);

  // Bind local video stream
  useEffect(() => {
    const video = localVideoRef.current;
    if (localStream && video && (!isCameraOff || isScreenSharing)) {
      video.srcObject = localStream;
      video.play().catch(() => {});
    }
  }, [localStream, isCameraOff, isScreenSharing, isMinimized]);

  // Performance Optimized Interaction Handler
  const handlePointerMove = useCallback((e) => {
    if (!isDragging && !resizing) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      const cx = e.clientX || (e.touches && e.touches[0].clientX);
      const cy = e.clientY || (e.touches && e.touches[0].clientY);
      
      if (isDragging) {
        setPosition({ x: cx - dragOffset.x, y: cy - dragOffset.y });
      } else if (resizing) {
        let nW = size.width;
        let nH = size.height;
        let nX = position.x;
        let nY = position.y;

        if (resizing.includes('e')) nW = cx - position.x;
        if (resizing.includes('s')) nH = cy - position.y;
        if (resizing.includes('w')) {
          nW = size.width + (position.x - cx);
          nX = cx;
        }
        if (resizing.includes('n')) {
          nH = size.height + (position.y - cy);
          nY = cy;
        }

        // Constraints
        if (nW > 280) { setSize(s => ({ ...s, width: nW })); setPosition(p => ({ ...p, x: nX })); }
        if (nH > 200) { setSize(s => ({ ...s, height: nH })); setPosition(p => ({ ...p, y: nY })); }
      }
    });
  }, [isDragging, resizing, dragOffset, position, size]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || resizing) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, resizing, handlePointerMove, handlePointerUp]);

  const handleStartDrag = (e) => {
    if (e.target.closest('button') || resizing) return;
    const cx = e.clientX || (e.touches && e.touches[0].clientX);
    const cy = e.clientY || (e.touches && e.touches[0].clientY);
    setIsDragging(true);
    setDragOffset({ x: cx - position.x, y: cy - position.y });
  };

  const handleStartResize = (dir, e) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(dir);
  };

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;
  const isReconnecting = callStatus === 'reconnecting';

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-[950] w-72 bg-window retro-border-thick shadow-[4px_4px_0px_0px_var(--border)] animate-in slide-in-from-bottom-10 fade-in duration-300 overflow-hidden">
        <div className="p-3 flex items-center gap-3">
          <div className="w-12 h-12 retro-border overflow-hidden bg-black flex-shrink-0">
             {type === 'video' && remoteStream ? (
               <video ref={remoteVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
             ) : (
               <img src={partnerPfp || '/assets/avatar_placeholder.png'} className="w-full h-full object-cover" alt="" />
             )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase text-primary tracking-widest truncate">{partnerName}</p>
            <p className="text-[9px] font-bold opacity-60 uppercase">{isRinging ? 'Ringing...' : `${mins}:${secs.toString().padStart(2, '0')}`}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onMicToggle()} className={`p-1.5 retro-border transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`}>
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button onClick={() => setIsMinimized(false)} className="p-1.5 retro-border bg-primary text-white hover:opacity-90 transition-opacity">
              <Maximize2 size={14} />
            </button>
            <button onClick={onEndCall} className="p-1.5 retro-border bg-red-600 text-white hover:bg-red-700 transition-colors">
              <PhoneOff size={14} className="rotate-[135deg]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-[900] bg-window retro-border-thick flex flex-col animate-in zoom-in-95 fade-in ${isDragging ? '' : 'transition-transform duration-75'}`}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        boxShadow: '4px 4px 0px 0px var(--border)',
      }}
    >
      {/* Invisible Resize Handles (Thick for easier grabbing) */}
      <div className="absolute -top-1 -left-1 w-[calc(100%+8px)] h-2 cursor-ns-resize z-50" onMouseDown={(e) => handleStartResize('n', e)} />
      <div className="absolute -bottom-1 -left-1 w-[calc(100%+8px)] h-2 cursor-ns-resize z-50" onMouseDown={(e) => handleStartResize('s', e)} />
      <div className="absolute -top-1 -left-1 h-[calc(100%+8px)] w-2 cursor-ew-resize z-50" onMouseDown={(e) => handleStartResize('w', e)} />
      <div className="absolute -top-1 -right-1 h-[calc(100%+8px)] w-2 cursor-ew-resize z-50" onMouseDown={(e) => handleStartResize('e', e)} />
      <div className="absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize z-50" onMouseDown={(e) => handleStartResize('nw', e)} />
      <div className="absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize z-50" onMouseDown={(e) => handleStartResize('ne', e)} />
      <div className="absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize z-50" onMouseDown={(e) => handleStartResize('sw', e)} />
      <div className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize z-50" onMouseDown={(e) => handleStartResize('se', e)} />

      {/* Header */}
      <div 
        className="px-3 py-2 flex justify-between items-center border-b-2 border-border cursor-grab active:cursor-grabbing shrink-0"
        onMouseDown={handleStartDrag}
        onTouchStart={handleStartDrag}
        style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}
      >
        <div className="flex items-center gap-2 truncate">
          <div className={`w-2 h-2 rounded-full ${isReconnecting ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest truncate">{partnerName}</span>
          <span className="opacity-50 text-xs">|</span>
          <span className="text-[10px] sm:text-xs font-bold opacity-80">{mins}:${secs.toString().padStart(2, '0')}</span>
        </div>
        <div className="flex gap-1.5 items-center">
          {!isRinging && <QualityBadge quality={callQuality} />}
          <button onClick={() => { playAudio('click', sfx); setIsMinimized(true); }} className="p-1 hover:bg-white/10 transition-colors">
            <Minimize2 size={14} />
          </button>
          <button onClick={onEndCall} className="p-1 bg-red-500/80 hover:bg-red-500 transition-colors retro-border-thin">
            <PhoneOff size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 bg-black relative flex items-center justify-center group overflow-hidden">
        {isRinging ? (
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <div className="w-24 h-24 retro-border overflow-hidden bg-border relative">
              <img src={partnerPfp || '/assets/avatar_placeholder.png'} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <Phone size={32} className="text-white" />
              </div>
            </div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Dialing {partnerName}...</p>
          </div>
        ) : (
          <>
            {/* Main Video (Remote) */}
            {remoteStream ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 retro-border overflow-hidden">
                  <img src={partnerPfp || '/assets/avatar_placeholder.png'} className="w-full h-full object-cover opacity-50" alt="" />
                </div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  {type === 'video' ? 'Waiting for video...' : 'Voice Connected'}
                </p>
              </div>
            )}

            {/* Local Preview (PIP) - Discord Style */}
            {(!isCameraOff || isScreenSharing) && localStream && (
              <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video bg-black retro-border-thick shadow-2xl overflow-hidden z-20 group-hover:scale-105 transition-transform duration-300">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute top-2 left-2 bg-black/60 px-1.5 py-0.5 text-[8px] text-white font-black uppercase tracking-tighter retro-border-thin">
                  {isScreenSharing ? 'Your Screen' : 'You'}
                </div>
              </div>
            )}

            {/* Status Overlays */}
            <div className="absolute bottom-4 left-4 flex gap-2 z-30">
              {isMuted && <div className="p-2 bg-red-600/90 text-white rounded-full retro-border shadow-lg"><MicOff size={14} /></div>}
              {isDeafened && <div className="p-2 bg-red-600/90 text-white rounded-full retro-border shadow-lg"><VolumeX size={14} /></div>}
              {isCameraOff && type === 'video' && <div className="p-2 bg-red-600/90 text-white rounded-full retro-border shadow-lg"><VideoOff size={14} /></div>}
            </div>

            {isReconnecting && (
              <div className="absolute inset-0 bg-black/80 z-40 flex flex-col items-center justify-center gap-2">
                <WifiOff size={40} className="text-yellow-400 animate-bounce" />
                <p className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Connection Weak...</p>
              </div>
            )}
          </>
        )}

        {/* Hover Controls (Discord-like) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-window/80 backdrop-blur-md p-2.5 retro-border-thick opacity-0 group-hover:opacity-100 transition-all duration-300 z-50">
          <button onClick={onMicToggle} className={`p-2 retro-border transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Toggle Mic">
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button onClick={onDeafenToggle} className={`p-2 retro-border transition-all ${isDeafened ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Deafen">
            {isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={onCameraToggle} className={`p-2 retro-border transition-all ${isCameraOff ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Toggle Camera">
            {isCameraOff ? <VideoOff size={18} /> : <Camera size={18} />}
          </button>
          <button onClick={() => isScreenSharing ? onStopScreenShare() : onScreenShare()} 
                  className={`p-2 retro-border transition-all ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-window hover:bg-border'}`} title="Share Screen">
            {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <button onClick={onEndCall} className="p-2 bg-red-600 text-white retro-border hover:bg-red-700 hover:scale-105 transition-all" title="End Call">
            <PhoneOff size={18} className="rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
