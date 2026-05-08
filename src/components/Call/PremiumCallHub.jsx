import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Phone, PhoneOff, MicOff, Mic, Volume2, VolumeX,
         Maximize2, Minimize2, VideoOff, Camera, Monitor, MonitorOff,
         Wifi, WifiOff } from 'lucide-react';
import { playAudio } from '../../utils/audio.js';

// Quality indicator dots (like WhatsApp's signal bars)
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
  const [position, setPosition] = useState({ x: window.innerWidth > 640 ? window.innerWidth - 420 : 10, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const rafRef = useRef();

  // Bind remote video stream
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (remoteStream && video) {
      console.log('[WebRTC] Assigning remote stream to video element');
      video.srcObject = remoteStream;
      video.play().catch(err => {
        console.warn('[WebRTC] Remote video play blocked or failed:', err);
      });
    }
  }, [remoteStream]);

  // Bind local video stream
  useEffect(() => {
    if (localStream && localVideoRef.current && !isCameraOff) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff]);

  // Dragging
  const handleStart = (cx, cy) => { setIsDragging(true); setDragOffset({ x: cx - position.x, y: cy - position.y }); };
  const handleMove  = useCallback((cx, cy) => {
    if (!isDragging) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setPosition({ x: cx - dragOffset.x, y: cy - dragOffset.y }));
  }, [isDragging, dragOffset]);
  const handleEnd = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (!isDragging) return;
    const mm = e => handleMove(e.clientX, e.clientY);
    const tm = e => e.touches[0] && handleMove(e.touches[0].clientX, e.touches[0].clientY);
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', tm, { passive: true }); window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', handleEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, handleMove, handleEnd]);

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;
  const isReconnecting = callStatus === 'reconnecting';

  const handleScreenToggle = () => {
    playAudio('click', sfx);
    if (isScreenSharing) onStopScreenShare?.(); else onScreenShare?.();
  };

  return (
    <div
      className={`fixed z-[900] bg-window retro-border-thick ${isDragging ? '' : 'transition-all duration-300'} ${
        isMinimized ? 'w-64 h-14 overflow-hidden' : 'w-[90vw] sm:w-[420px] retro-shadow-dark'
      } animate-in zoom-in-95 fade-in select-none`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseDown={e => { if (!e.target.closest('button')) handleStart(e.clientX, e.clientY); }}
      onTouchStart={e => { if (!e.target.closest('button')) handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
    >
      {/* Title bar */}
      <div className="px-3 py-2 flex justify-between items-center font-bold text-[11px] sm:text-sm border-b-2 border-border select-none"
           style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
        <span className="flex items-center gap-2 truncate">
          {isReconnecting
            ? <WifiOff size={14} className="text-yellow-400 animate-pulse" />
            : <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          }
          {type === 'video' ? <Video size={16} className="text-pink-300" /> : <Phone size={16} className="text-cyan-300" />}
          <span className="opacity-90 uppercase tracking-widest">{type === 'video' ? 'VIDEO' : 'AUDIO'} CALL</span>
          <span className="opacity-50">|</span>
          <span className="truncate">{partnerName}</span>
          {!isMinimized && (
            <span className="opacity-70 ml-1">
              {isRinging ? '...' : isReconnecting ? 'Reconnecting' : `${mins}:${secs.toString().padStart(2, '0')}`}
            </span>
          )}
        </span>
        <div className="flex gap-2 items-center">
          {!isMinimized && !isRinging && <QualityBadge quality={callQuality} />}
          <button onClick={() => { playAudio('click', sfx); setIsMinimized(!isMinimized); }}
                  className="p-1 retro-border bg-window/10 hover:bg-window/20 transition-all">
            {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button onClick={onEndCall} className="p-1 retro-border bg-red-500 text-white hover:bg-red-600 transition-colors">
            <PhoneOff size={12} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col bg-window">
          {/* Video/Avatar area */}
          <div className="w-full aspect-video bg-black relative overflow-hidden flex items-center justify-center border-b-2 border-border">

            {/* Reconnecting overlay */}
            {isReconnecting && (
              <div className="absolute inset-0 z-30 bg-black/70 flex flex-col items-center justify-center gap-3">
                <Wifi size={32} className="text-yellow-400 animate-pulse" />
                <p className="text-white text-[11px] font-black uppercase tracking-widest animate-pulse">Reconnecting...</p>
              </div>
            )}

            {isRinging ? (
              <div className="flex flex-col items-center gap-4 animate-in fade-in">
                <div className="w-20 h-20 retro-border flex items-center justify-center animate-pulse shadow-[0_0_40px_var(--secondary)] overflow-hidden bg-border relative">
                  {type === 'video' ? <Video size={36} className="text-white absolute z-0" /> : <Phone size={36} className="text-white absolute z-0" />}
                  {partnerPfp && <img src={partnerPfp} alt="partner" className="w-full h-full object-cover relative z-10" onError={e => { e.target.style.display = 'none'; }} />}
                </div>
                <div className="text-white font-black text-[11px] uppercase tracking-[0.2em] animate-bounce">Ringing {partnerName}...</div>
              </div>
            ) : type === 'video' ? (
              <div className="w-full h-full bg-black relative">
                {remoteStream
                  ? <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover animate-in fade-in duration-500" />
                  : <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <VideoOff size={32} className="text-white/40" />
                      <span className="text-[10px] font-bold text-white/40 uppercase">Waiting for video...</span>
                    </div>
                }
                {!isCameraOff && !isScreenSharing && localStream && (
                  <div className="absolute bottom-3 right-3 w-28 aspect-video bg-border retro-border overflow-hidden shadow-lg z-20">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                  </div>
                )}
                {isScreenSharing && (
                  <div className="absolute top-2 left-2 z-20 bg-primary/90 text-white px-2 py-1 text-[9px] font-black uppercase tracking-widest retro-border flex items-center gap-1">
                    <Monitor size={10} /> Screen Sharing
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 group animate-in fade-in">
                <div className="w-20 h-20 retro-bg-accent retro-border flex items-center justify-center overflow-hidden relative">
                  {partnerPfp
                    ? <img src={partnerPfp} alt="partner" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                    : <Phone size={36} className="text-white/80" />
                  }
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">{partnerName}</p>
                  <p className="text-[10px] font-bold text-white/30 uppercase mt-1 italic tracking-wider">Voice Only</p>
                </div>
              </div>
            )}

            {/* Status badges */}
            {!isRinging && (
              <div className="absolute top-2.5 right-2.5 bg-black/70 px-2.5 py-1 retro-border text-[10px] text-white font-black tracking-widest uppercase backdrop-blur-md border-white/20">
                {isReconnecting ? '⚠ RECONNECTING' : 'LIVE'}
              </div>
            )}
            <div className="absolute bottom-2.5 left-2.5 flex gap-2">
              {isMuted    && <div className="bg-red-500/90 backdrop-blur-sm p-2 rounded-full retro-border text-white shadow-lg"><MicOff   size={12} /></div>}
              {isDeafened && <div className="bg-red-500/90 backdrop-blur-sm p-2 rounded-full retro-border text-white shadow-lg"><VolumeX  size={12} /></div>}
            </div>
          </div>

          {/* Controls — 5 buttons */}
          <div className="p-3.5 grid grid-cols-5 gap-2 bg-window border-t-2 border-border">
            <button onClick={() => { playAudio('click', sfx); onMicToggle(); }}
                    className={`flex flex-col items-center justify-center p-2 retro-border transition-all ${isMuted ? 'bg-red-500 text-white' : 'retro-bg-accent hover:-translate-y-0.5'}`}>
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              <span className="text-[8px] font-black mt-1 uppercase">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button onClick={() => { playAudio('click', sfx); onDeafenToggle(); }}
                    className={`flex flex-col items-center justify-center p-2 retro-border transition-all ${isDeafened ? 'bg-red-500 text-white' : 'retro-bg-secondary hover:-translate-y-0.5'}`}>
              {isDeafened ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <span className="text-[8px] font-black mt-1 uppercase">{isDeafened ? 'Hear' : 'Deafen'}</span>
            </button>

            <button onClick={() => { playAudio('click', sfx); onCameraToggle(); }}
                    className={`flex flex-col items-center justify-center p-2 retro-border transition-all ${isCameraOff ? 'bg-red-500 text-white' : 'retro-bg-primary hover:-translate-y-0.5'}`}>
              {isCameraOff ? <VideoOff size={16} /> : <Camera size={16} />}
              <span className="text-[8px] font-black mt-1 uppercase">Cam</span>
            </button>

            <button onClick={handleScreenToggle}
                    className={`flex flex-col items-center justify-center p-2 retro-border transition-all ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-window hover:-translate-y-0.5'}`}
                    title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
              {isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
              <span className="text-[8px] font-black mt-1 uppercase">Screen</span>
            </button>

            <button onClick={() => { playAudio('click', sfx); onEndCall(); }}
                    className="flex flex-col items-center justify-center p-2 retro-border bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-105">
              <PhoneOff size={16} className="rotate-[135deg]" />
              <span className="text-[8px] font-black mt-1 uppercase">End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
