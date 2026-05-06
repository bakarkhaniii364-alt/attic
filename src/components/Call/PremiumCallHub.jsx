import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Phone, PhoneOff, MicOff, Mic, Volume2, VolumeX, Maximize2, Minimize2, VideoOff, Camera } from 'lucide-react';
import { playAudio } from '../../utils/audio.js';

export function PremiumCallHub({ calling, callDuration, isMuted, isDeafened, isCameraOff, onMicToggle, onDeafenToggle, onCameraToggle, onEndCall, partnerName, partnerPfp, sfx, remoteStream, localStream, isRinging, type }) {
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && !isRinging) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isRinging]);

  useEffect(() => {
    if (localStream && localVideoRef.current && !isCameraOff) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff]);

  const [position, setPosition] = useState({ x: window.innerWidth > 640 ? window.innerWidth - 420 : 10, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const handleStart = (clientX, clientY) => {
    setIsDragging(true);
    setDragOffset({ x: clientX - position.x, y: clientY - position.y });
  };
  const rafRef = useRef();
  const handleMove = useCallback((clientX, clientY) => {
    if (!isDragging) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPosition({ x: clientX - dragOffset.x, y: clientY - dragOffset.y });
    });
  }, [isDragging, dragOffset]);

  const handleEnd = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, handleMove, handleEnd]);

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;

  return (
    <div
      className={`fixed z-[var(--z-callhub)] bg-window retro-border-thick ${isDragging ? '' : 'transition-all duration-300 ease-in-out'} ${isMinimized ? 'w-64 h-14 overflow-hidden' : 'w-[90vw] sm:w-[420px] retro-shadow-dark'} animate-in zoom-in-95 fade-in select-none`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseDown={(e) => { if (!e.target.closest('button')) handleStart(e.clientX, e.clientY); }}
      onTouchStart={(e) => { if (!e.target.closest('button')) handleStart(e.touches[0].clientX, e.touches[0].clientY); }}
    >
      <div className={`px-3 py-2 flex justify-between items-center font-bold text-[11px] sm:text-sm select-none border-b-2 border-border ${isMinimized ? 'bg-primary text-primary-text' : 'bg-border text-window-text'}`} style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
        <span className="flex items-center gap-2 truncate">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          {type === 'video' ? <Video size={16} className="text-pink-300"/> : <Phone size={16} className="text-cyan-300"/>}
          <span className="opacity-90 uppercase tracking-widest">{type === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}</span>
          <span className="opacity-50">|</span>
          <span className="truncate">{partnerName}</span>
          {!isMinimized && <span className="opacity-70 ml-2">{isRinging ? '...' : `${mins}:${secs.toString().padStart(2, '0')}`}</span>}
        </span>
        <div className="flex gap-2">
          <button onClick={() => { playAudio('click', sfx); setIsMinimized(!isMinimized); }} className="p-1 retro-border bg-window/10 hover:bg-window/20 transition-all">
            {isMinimized ? <Maximize2 size={12}/> : <Minimize2 size={12}/>}
          </button>
          <button onClick={onEndCall} className="p-1 retro-border bg-red-500 text-white hover:bg-red-600 transition-colors"><PhoneOff size={12}/></button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col bg-window">
          <div className={`w-full aspect-video bg-black relative overflow-hidden flex items-center justify-center border-b-2 border-border`}>
            {isRinging ? (
              <div className="flex flex-col items-center gap-4 animate-in fade-in">
                <div className="w-20 h-20 retro-border flex items-center justify-center animate-pulse shadow-[0_0_40px_var(--secondary)] overflow-hidden bg-border relative">
                   {type === 'video' ? <Video size={36} className="text-white absolute z-0"/> : <Phone size={36} className="text-white absolute z-0"/>}
                   {partnerPfp && partnerPfp.length > 5 && (
                     <img src={partnerPfp} alt="partner" className="w-full h-full object-cover relative z-10 bg-window" onError={(e) => { e.target.style.display = 'none'; }} />
                   )}
                </div>
                <div className="text-white font-black text-[11px] uppercase tracking-[0.2em] animate-bounce">Ringing {partnerName}...</div>
              </div>
            ) : (
              <>
                {type === 'video' ? (
                  <div className="w-full h-full bg-black relative">
                    {remoteStream ? (
                      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover animate-in fade-in duration-500" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <VideoOff size={32} className="text-white/40" />
                        <span className="text-[10px] font-bold text-white/40 uppercase">Waiting for partner's camera...</span>
                      </div>
                    )}
                    {!isCameraOff && localStream && (
                      <div className="absolute bottom-3 right-3 w-28 aspect-video bg-border retro-border overflow-hidden shadow-lg z-20">
                        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 group animate-in fade-in">
                    <div className="w-20 h-20 retro-bg-accent retro-border flex items-center justify-center transition-transform group-hover:scale-105 duration-500">
                       {type === 'video' ? <VideoOff size={36} className="text-white/80" /> : <Phone size={36} className="text-white/80" />}
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">{partnerName}</p>
                        <p className="text-[10px] font-bold text-white/30 uppercase mt-1 italic tracking-wider">Voice Only</p>
                    </div>
                  </div>
                )}
              </>
            )}
            {!isRinging && <div className="absolute top-2.5 right-2.5 bg-black/70 px-2.5 py-1 retro-border text-[10px] text-white font-black tracking-widest uppercase backdrop-blur-md border-white/20 select-none">LIVE • HIGH RES</div>}
            
            <div className="absolute bottom-2.5 left-2.5 flex gap-2">
                 {isMuted && <div className="bg-red-500/90 backdrop-blur-sm p-2 rounded-full retro-border text-white shadow-lg animate-in zoom-in-50"><MicOff size={12}/></div>}
                 {isDeafened && <div className="bg-red-500/90 backdrop-blur-sm p-2 rounded-full retro-border text-white shadow-lg animate-in zoom-in-50"><VolumeX size={12}/></div>}
            </div>
          </div>

          <div className="p-3.5 grid grid-cols-4 gap-2.5 bg-window border-t-2 border-border">
            <button onClick={onMicToggle} className={`flex flex-col items-center justify-center p-2.5 retro-border transition-all shadow-md ${isMuted ? 'bg-red-500 text-white' : 'retro-bg-accent hover:-translate-y-0.5 hover:shadow-lg'}`}>
              {isMuted ? <MicOff size={18}/> : <Mic size={18}/>}
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button onClick={onDeafenToggle} className={`flex flex-col items-center justify-center p-2.5 retro-border transition-all shadow-md ${isDeafened ? 'bg-red-500 text-white' : 'retro-bg-secondary hover:-translate-y-0.5 hover:shadow-lg'}`}>
              {isDeafened ? <VolumeX size={18}/> : <Volume2 size={18}/>}
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">{isDeafened ? 'Hear' : 'Deafen'}</span>
            </button>
            <button onClick={onCameraToggle} className={`flex flex-col items-center justify-center p-2.5 retro-border transition-all shadow-md ${isCameraOff ? 'bg-red-500 text-white' : 'retro-bg-primary hover:-translate-y-0.5 hover:shadow-lg'}`}>
              {isCameraOff ? <VideoOff size={18}/> : <Camera size={18}/>}
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">Cam</span>
            </button>
            <button onClick={onEndCall} className="flex flex-col items-center justify-center p-2.5 retro-border bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-105 shadow-md">
              <PhoneOff size={18} className="rotate-[135deg]"/>
              <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">End</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
