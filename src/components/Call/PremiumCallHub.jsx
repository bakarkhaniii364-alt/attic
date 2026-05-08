import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PhoneOff, MicOff, Mic, Volume2, VolumeX,
         Maximize2, Minimize2, VideoOff, Camera, Monitor, MonitorOff,
         Phone, Video, WifiOff } from 'lucide-react';
import { playAudio } from '../../utils/audio.js';

function QualityBadge({ quality }) {
  const colors = { good: 'bg-green-400', fair: 'bg-yellow-400', poor: 'bg-red-400' };
  const labels  = { good: 'HD',          fair: 'SD',            poor: 'LOW'         };
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

  const [pos,  setPos]  = useState(() => ({ x: Math.max(20, window.innerWidth - 520), y: 60 }));
  const [size, setSize] = useState({ w: 480, h: 340 });
  const [isMinimized, setIsMinimized] = useState(false);

  // Use refs for drag/resize so RAF never captures stale state
  const drag   = useRef(null); // { startX, startY, startPosX, startPosY }
  const resize = useRef(null); // { dir, startX, startY, startW, startH, startPosX, startPosY }

  // ── Stream binding ──────────────────────────────────────────────────────
  useEffect(() => {
    const v = remoteVideoRef.current;
    if (v && remoteStream) { v.srcObject = remoteStream; v.play().catch(() => {}); }
  }, [remoteStream, isMinimized]);

  useEffect(() => {
    const v = localVideoRef.current;
    if (v && localStream && (!isCameraOff || isScreenSharing)) {
      v.srcObject = localStream; v.play().catch(() => {});
    }
  }, [localStream, isCameraOff, isScreenSharing, isMinimized]);

  // ── Pointer Events (drag + resize) ──────────────────────────────────────
  const onPointerMove = useCallback((e) => {
    const cx = e.clientX, cy = e.clientY;

    if (drag.current) {
      const { startX, startY, startPosX, startPosY } = drag.current;
      setPos({ x: startPosX + (cx - startX), y: startPosY + (cy - startY) });
      return;
    }

    if (resize.current) {
      const { dir, startX, startY, startW, startH, startPosX, startPosY } = resize.current;
      let nW = startW, nH = startH, nX = startPosX, nY = startPosY;
      const dx = cx - startX, dy = cy - startY;

      if (dir.includes('e')) nW = startW + dx;
      if (dir.includes('s')) nH = startH + dy;
      if (dir.includes('w')) { nW = startW - dx; nX = startPosX + dx; }
      if (dir.includes('n')) { nH = startH - dy; nY = startPosY + dy; }

      setSize({ w: Math.max(300, nW), h: Math.max(220, nH) });
      if (dir.includes('w') && nW > 300) setPos(p => ({ ...p, x: nX }));
      if (dir.includes('n') && nH > 220) setPos(p => ({ ...p, y: nY }));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current   = null;
    resize.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup',   onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup',   onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const startDrag = (e) => {
    if (e.target.closest('button') || resize.current) return;
    drag.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
  };

  const startResize = (dir, e) => {
    e.preventDefault(); e.stopPropagation();
    resize.current = { dir, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startPosX: pos.x, startPosY: pos.y };
  };

  const mins = Math.floor(callDuration / 60);
  const secs = callDuration % 60;
  const timer = `${mins}:${String(secs).padStart(2, '0')}`;
  const isReconnecting = callStatus === 'reconnecting';

  // ── MINIMIZED DOCK ──────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-[950] w-72 bg-window retro-border-thick retro-shadow-dark overflow-hidden"
           style={{ boxShadow: '4px 4px 0 var(--border)' }}>
        <div className="p-3 flex items-center gap-3">
          <div className="w-12 h-12 retro-border overflow-hidden bg-black flex-shrink-0">
            {type === 'video' && remoteStream
              ? <video ref={remoteVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              : <img src={partnerPfp} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} alt="" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary truncate">{partnerName}</p>
            <p className="text-[9px] font-bold opacity-50 uppercase">{isRinging ? 'Ringing...' : timer}</p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={onMicToggle}
                    className={`p-1.5 retro-border ${isMuted ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'} transition-colors`}>
              {isMuted ? <MicOff size={14}/> : <Mic size={14}/>}
            </button>
            <button onClick={() => setIsMinimized(false)}
                    className="p-1.5 retro-border bg-primary text-white hover:opacity-80 transition-opacity" style={{ color: 'var(--text-on-primary)' }}>
              <Maximize2 size={14}/>
            </button>
            <button onClick={onEndCall}
                    className="p-1.5 retro-border bg-red-600 text-white hover:bg-red-700 transition-colors">
              <PhoneOff size={14} className="rotate-[135deg]"/>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FULL WINDOW ─────────────────────────────────────────────────────────
  return (
    <div
      className="fixed z-[900] flex flex-col bg-window retro-border-thick"
      style={{
        left: `${pos.x}px`,
        top:  `${pos.y}px`,
        width:  `${size.w}px`,
        height: `${size.h}px`,
        boxShadow: '4px 4px 0 var(--border)',
      }}
    >
      {/* ── Resize Handles ── */}
      {/* Edges */}
      <div className="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize z-50"   onMouseDown={e => startResize('n', e)} />
      <div className="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize z-50" onMouseDown={e => startResize('s', e)} />
      <div className="absolute left-0 top-2 bottom-2 w-1.5 cursor-w-resize z-50"   onMouseDown={e => startResize('w', e)} />
      <div className="absolute right-0 top-2 bottom-2 w-1.5 cursor-e-resize z-50"  onMouseDown={e => startResize('e', e)} />
      {/* Corners */}
      <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50"  onMouseDown={e => startResize('nw', e)} />
      <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" onMouseDown={e => startResize('ne', e)} />
      <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" onMouseDown={e => startResize('sw', e)} />
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" onMouseDown={e => startResize('se', e)} />

      {/* ── Title Bar ── */}
      <div
        className="shrink-0 px-3 py-2 flex items-center justify-between border-b-2 border-border cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <div className={`w-2 h-2 shrink-0 rounded-full ${isReconnecting ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          {type === 'video' ? <Video size={14} className="shrink-0 text-pink-300"/> : <Phone size={14} className="shrink-0 text-cyan-300"/>}
          <span className="text-[11px] font-black uppercase tracking-widest truncate">{partnerName}</span>
          <span className="opacity-40 text-xs shrink-0">|</span>
          <span className="text-[11px] font-bold opacity-70 shrink-0">{isRinging ? '···' : isReconnecting ? 'Reconnecting' : timer}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!isRinging && <QualityBadge quality={callQuality} />}
          <button
            onClick={() => { playAudio('click', sfx); setIsMinimized(true); }}
            className="p-1.5 retro-border bg-window hover:bg-border transition-colors"
            title="Minimize"
          ><Minimize2 size={13}/></button>
          <button
            onClick={onEndCall}
            className="p-1.5 retro-border bg-red-600 text-white hover:bg-red-700 transition-colors"
            title="End Call"
          ><PhoneOff size={13}/></button>
        </div>
      </div>

      {/* ── Video / Content Area ── */}
      <div className="relative flex-1 min-h-0 bg-black overflow-hidden group flex items-center justify-center">

        {/* Reconnecting overlay */}
        {isReconnecting && (
          <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center gap-3">
            <WifiOff size={36} className="text-yellow-400 animate-bounce"/>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Reconnecting…</p>
          </div>
        )}

        {/* Ringing state */}
        {isRinging ? (
          <div className="flex flex-col items-center gap-5">
            <div className="w-24 h-24 retro-border overflow-hidden relative bg-black animate-pulse">
              <img src={partnerPfp} className="w-full h-full object-cover opacity-60" onError={e => e.target.style.display='none'} alt=""/>
              <div className="absolute inset-0 flex items-center justify-center">
                {type === 'video' ? <Video size={36} className="text-white/80"/> : <Phone size={36} className="text-white/80"/>}
              </div>
            </div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.25em]">Ringing {partnerName}…</p>
          </div>
        ) : (
          <>
            {/* Remote stream or avatar placeholder */}
            {remoteStream
              ? <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover"/>
              : (
                <div className="flex flex-col items-center gap-4 z-10">
                  <div className="w-20 h-20 retro-border overflow-hidden bg-border">
                    <img src={partnerPfp} className="w-full h-full object-cover opacity-50" onError={e => e.target.style.display='none'} alt=""/>
                  </div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {type === 'video' ? 'Waiting for video…' : 'Voice Connected'}
                  </p>
                </div>
              )
            }

            {/* PIP – local camera / screen share */}
            {(!isCameraOff || isScreenSharing) && localStream && (
              <div className="absolute bottom-14 right-3 w-36 aspect-video bg-black retro-border overflow-hidden z-20 shadow-lg group-hover:scale-105 transition-transform duration-200">
                <video ref={localVideoRef} autoPlay playsInline muted
                       className={`w-full h-full object-cover ${isScreenSharing ? '' : 'scale-x-[-1]'}`}/>
                <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 text-[8px] text-white font-black uppercase tracking-tight">
                  {isScreenSharing ? 'Screen' : 'You'}
                </div>
              </div>
            )}

            {/* Mute / deafen badges */}
            <div className="absolute top-2 left-2 flex gap-1.5 z-30">
              {isMuted    && <div className="p-1.5 bg-red-600/90 text-white rounded-full retro-border"><MicOff  size={12}/></div>}
              {isDeafened && <div className="p-1.5 bg-red-600/90 text-white rounded-full retro-border"><VolumeX size={12}/></div>}
              {isCameraOff && type === 'video' && <div className="p-1.5 bg-red-600/90 text-white rounded-full retro-border"><VideoOff size={12}/></div>}
            </div>

            {/* Live badge */}
            {!isRinging && !isReconnecting && (
              <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 retro-border text-[9px] text-white font-black tracking-widest uppercase z-30">
                LIVE
              </div>
            )}
          </>
        )}

        {/* ── Discord-style hover controls ── */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-window/90 backdrop-blur-sm px-3 py-2 retro-border opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
          <button onClick={onMicToggle}    className={`p-2 retro-border transition-all hover:scale-110 ${isMuted    ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Mute">
            {isMuted    ? <MicOff   size={17}/> : <Mic    size={17}/>}
          </button>
          <button onClick={onDeafenToggle} className={`p-2 retro-border transition-all hover:scale-110 ${isDeafened ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Deafen">
            {isDeafened ? <VolumeX  size={17}/> : <Volume2 size={17}/>}
          </button>
          <button onClick={onCameraToggle} className={`p-2 retro-border transition-all hover:scale-110 ${isCameraOff ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Camera">
            {isCameraOff ? <VideoOff size={17}/> : <Camera  size={17}/>}
          </button>
          <button onClick={() => isScreenSharing ? onStopScreenShare?.() : onScreenShare?.()}
                  className={`p-2 retro-border transition-all hover:scale-110 ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-window hover:bg-border'}`} title="Screen Share">
            {isScreenSharing ? <MonitorOff size={17}/> : <Monitor size={17}/>}
          </button>
          <div className="w-px h-5 bg-border mx-0.5"/>
          <button onClick={onEndCall} className="p-2 retro-border bg-red-600 text-white hover:bg-red-700 hover:scale-110 transition-all" title="End Call">
            <PhoneOff size={17} className="rotate-[135deg]"/>
          </button>
        </div>
      </div>
    </div>
  );
}
