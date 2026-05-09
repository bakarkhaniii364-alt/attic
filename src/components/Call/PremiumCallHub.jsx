import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PhoneOff, MicOff, Mic, Volume2, VolumeX,
         Maximize2, Minimize2, VideoOff, Camera, Monitor, MonitorOff,
         Phone, Video, WifiOff, Settings, Loader, MessageSquare,
         RefreshCw, ChevronDown } from 'lucide-react';
import { playAudio } from '../../utils/audio.js';

// ── Quality Badge ─────────────────────────────────────────────────────────────
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

// ── Device Selector Popover ───────────────────────────────────────────────────
function DeviceSelector({ onChangeDevice, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({ audioinput: '', videoinput: '' });

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(list => {
        setDevices(list.filter(d => d.kind === 'audioinput' || d.kind === 'videoinput'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const audioDevices = devices.filter(d => d.kind === 'audioinput');
  const videoDevices = devices.filter(d => d.kind === 'videoinput');

  const handleChange = (kind, deviceId) => {
    setSelected(prev => ({ ...prev, [kind]: deviceId }));
    onChangeDevice?.(kind, deviceId);
  };

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 bg-window retro-border-thick z-[60] shadow-[4px_4px_0px_var(--border)] animate-in fade-in zoom-in-95 duration-150">
      <div className="px-3 py-2 border-b-2 border-border flex items-center justify-between"
           style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <Settings size={11} /> Device Settings
        </span>
        <button onClick={onClose} className="p-0.5 hover:bg-white/10 transition-colors text-xs font-black">✕</button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        {loading ? (
          <p className="text-[10px] font-bold opacity-50 text-center py-2">Scanning devices...</p>
        ) : (
          <>
            {audioDevices.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1.5 flex items-center gap-1">
                  <Mic size={9} /> Microphone
                </p>
                <div className="flex flex-col gap-1">
                  {audioDevices.map(d => (
                    <button key={d.deviceId}
                      onClick={() => handleChange('audioinput', d.deviceId)}
                      className={`text-left text-[10px] font-bold px-2 py-1.5 retro-border transition-colors ${selected.audioinput === d.deviceId ? 'bg-primary text-white' : 'bg-window hover:bg-border/20'}`}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {videoDevices.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1.5 flex items-center gap-1">
                  <Camera size={9} /> Camera
                </p>
                <div className="flex flex-col gap-1">
                  {videoDevices.map(d => (
                    <button key={d.deviceId}
                      onClick={() => handleChange('videoinput', d.deviceId)}
                      className={`text-left text-[10px] font-bold px-2 py-1.5 retro-border transition-colors ${selected.videoinput === d.deviceId ? 'bg-primary text-white' : 'bg-window hover:bg-border/20'}`}>
                      {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {devices.length === 0 && (
              <p className="text-[10px] font-bold opacity-40 text-center py-2">No devices found</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function PremiumCallHub({
  calling, callDuration, callStatus, callQuality = 'good',
  isMuted, isDeafened, isCameraOff, isScreenSharing,
  onMicToggle, onDeafenToggle, onCameraToggle, onEndCall,
  onScreenShare, onStopScreenShare,
  onRestartIce, onChangeDevice,
  partnerName, partnerPfp, sfx, remoteStream, localStream, isRinging, type,
  isPartnerTyping, isPartnerCameraOff
}) {
  const remoteVideoRef = useRef(null);

  // Get user profile for "You" fallback
  const myProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const myPfp = myProfile?.pfp;

  // Window State
  const [pos,  setPos]  = useState(() => ({ x: Math.max(20, window.innerWidth - 520), y: 60 }));
  const [size, setSize] = useState({ w: 480, h: 340 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [isCameraChanging, setIsCameraChanging] = useState(false);

  // ICE Reconnect Countdown
  const [iceCountdown, setIceCountdown] = useState(null);
  const iceTimerRef = useRef(null);

  useEffect(() => {
    if (callStatus === 'reconnecting' && iceCountdown === null) {
      setIceCountdown(15);
    } else if (callStatus !== 'reconnecting') {
      setIceCountdown(null);
      if (iceTimerRef.current) clearInterval(iceTimerRef.current);
    }
  }, [callStatus]);

  useEffect(() => {
    if (iceCountdown === null) return;
    if (iceCountdown <= 0) { if (iceTimerRef.current) clearInterval(iceTimerRef.current); return; }
    iceTimerRef.current = setInterval(() => setIceCountdown(c => c - 1), 1000);
    return () => { if (iceTimerRef.current) clearInterval(iceTimerRef.current); };
  }, [iceCountdown]);

  // Drag + Resize via refs
  const drag   = useRef(null);
  const resize = useRef(null);

  // Remote stream binding
  useEffect(() => {
    const v = remoteVideoRef.current;
    if (v && remoteStream && !isPartnerCameraOff) { 
      v.srcObject = remoteStream; 
      v.play().catch(() => {}); 
    }
  }, [remoteStream, isMinimized, isPartnerCameraOff]);

  // Local PIP using callback ref
  const localVideoCallbackRef = useCallback((node) => {
    if (node && localStream && !isCameraOff) {
      node.srcObject = localStream;
      node.play().catch(() => {});
    }
  }, [localStream, isCameraOff]);

  // Camera toggle with spinner
  const handleCameraToggle = () => {
    setIsCameraChanging(true);
    onCameraToggle?.();
    setTimeout(() => setIsCameraChanging(false), 1200);
  };

  // Pointer move
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

  const onPointerUp = useCallback(() => { drag.current = null; resize.current = null; }, []);

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

  const mins  = Math.floor(callDuration / 60);
  const secs  = callDuration % 60;
  const timer = `${mins}:${String(secs).padStart(2, '0')}`;
  const isReconnecting = callStatus === 'reconnecting';

  // ── MINIMIZED DOCK ──────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-[950] w-72 bg-window retro-border-thick overflow-hidden"
           style={{ boxShadow: '4px 4px 0 var(--border)' }}>
        <div className="p-3 flex items-center gap-3">
          <div className="w-12 h-12 retro-border overflow-hidden bg-black flex-shrink-0">
            {type === 'video' && remoteStream && !isPartnerCameraOff
              ? <video ref={remoteVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              : <img src={partnerPfp} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} alt="" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary truncate">{partnerName}</p>
            <p className="text-[9px] font-bold opacity-50 uppercase">
              {isRinging ? 'Ringing...' : isReconnecting ? '⚠ Reconnecting' : timer}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={onMicToggle}
                    className={`p-1.5 retro-border retro-shadow-dark active:translate-y-[1px] active:shadow-none ${isMuted ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'} transition-all`}>
              {isMuted ? <MicOff size={14}/> : <Mic size={14}/>}
            </button>
            <button onClick={() => setIsMinimized(false)}
                    className="p-1.5 retro-border retro-shadow-dark active:translate-y-[1px] active:shadow-none bg-primary text-white hover:opacity-80 transition-all"
                    style={{ color: 'var(--text-on-primary)' }}>
              <Maximize2 size={14}/>
            </button>
            <button onClick={onEndCall}
                    className="p-1.5 retro-border retro-shadow-dark active:translate-y-[1px] active:shadow-none bg-red-600 text-white hover:bg-red-700 transition-all">
              <PhoneOff size={14} className="rotate-[135deg]"/>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FULL WINDOW ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed z-[900] flex flex-col bg-window retro-border-thick"
      style={{
        left: `${pos.x}px`, top: `${pos.y}px`,
        width: `${size.w}px`, height: `${size.h}px`,
        boxShadow: '4px 4px 0 var(--border)',
      }}
    >
      {/* Resize handles */}
      <div className="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize z-50"   onMouseDown={e => startResize('n', e)} />
      <div className="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize z-50" onMouseDown={e => startResize('s', e)} />
      <div className="absolute left-0 top-2 bottom-2 w-1.5 cursor-w-resize z-50"   onMouseDown={e => startResize('w', e)} />
      <div className="absolute right-0 top-2 bottom-2 w-1.5 cursor-e-resize z-50"  onMouseDown={e => startResize('e', e)} />
      <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50"  onMouseDown={e => startResize('nw', e)} />
      <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" onMouseDown={e => startResize('ne', e)} />
      <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" onMouseDown={e => startResize('sw', e)} />
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" onMouseDown={e => startResize('se', e)} />

      {/* Title Bar */}
      <div
        className="shrink-0 px-3 py-2 flex items-center justify-between border-b-2 border-border cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <div className={`w-2 h-2 shrink-0 rounded-full ${isReconnecting ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          {type === 'video' ? <Video size={13} className="shrink-0 text-pink-300"/> : <Phone size={13} className="shrink-0 text-cyan-300"/>}
          <span className="text-[11px] font-black uppercase tracking-widest truncate">{partnerName}</span>
          <span className="opacity-40 text-xs shrink-0">|</span>
          <span className="text-[11px] font-bold opacity-70 shrink-0">{isRinging ? '···' : isReconnecting ? '⚠' : timer}</span>
          {/* Typing in call badge */}
          {isPartnerTyping && !isRinging && (
            <div className="flex items-center gap-1 bg-primary/20 px-2 py-0.5 rounded text-[9px] font-black animate-in fade-in">
              <MessageSquare size={9} />
              <span className="hidden sm:inline">typing...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!isRinging && <QualityBadge quality={callQuality} />}
          <button onClick={() => { playAudio('click', sfx); setIsMinimized(true); }} className="p-1.5 hover:bg-white/10 transition-colors" title="Minimize">
            <Minimize2 size={13}/>
          </button>
          <button onClick={onEndCall} className="p-1.5 retro-border retro-shadow-dark active:translate-y-[1px] active:shadow-none bg-red-600 text-white hover:bg-red-700 transition-all" title="End Call">
            <PhoneOff size={13}/>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 bg-black overflow-hidden group flex items-center justify-center">

        {/* ICE Reconnect Overlay */}
        {isReconnecting && (
          <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center gap-4">
            <WifiOff size={36} className="text-yellow-400 animate-bounce"/>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
              Reconnecting{iceCountdown !== null && iceCountdown > 0 ? `… ${iceCountdown}s` : ''}
            </p>
            {iceCountdown !== null && iceCountdown <= 0 && (
              <div className="flex gap-3 mt-2 animate-in fade-in">
                <button onClick={() => { onRestartIce?.(); setIceCountdown(15); }}
                        className="flex items-center gap-2 px-4 py-2 retro-border retro-shadow-dark bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                  <RefreshCw size={12}/> Retry
                </button>
                <button onClick={onEndCall}
                        className="flex items-center gap-2 px-4 py-2 retro-border retro-shadow-dark bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                  <PhoneOff size={12}/> End
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ringing */}
        {isRinging ? (
          <div className="flex flex-col items-center gap-5 z-10">
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
            {/* Remote video or avatar fallback */}
            {remoteStream && !isPartnerCameraOff
              ? <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover"/>
              : (
                <div className="flex flex-col items-center gap-4 z-10 animate-in fade-in duration-500">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 retro-border overflow-hidden bg-border/20 backdrop-blur-sm relative">
                    <img src={partnerPfp} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} alt=""/>
                    <div className="absolute inset-0 bg-primary/10 mix-blend-overlay"></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-[12px] font-black text-white uppercase tracking-[0.3em] mb-1">{partnerName}</p>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                       {type === 'video' ? <><VideoOff size={10}/> Camera Off</> : <><Volume2 size={10}/> Voice Only</>}
                    </p>
                  </div>
                </div>
              )
            }

            {/* PIP – local camera or PFP fallback */}
            {localStream && (
              <div className="absolute bottom-16 right-4 w-32 sm:w-40 aspect-video bg-black/80 retro-border overflow-hidden z-20 shadow-xl group-hover:scale-105 transition-all duration-300">
                {!isCameraOff || isScreenSharing ? (
                   <video ref={localVideoCallbackRef} autoPlay playsInline muted
                          className={`w-full h-full object-cover ${isScreenSharing ? '' : 'scale-x-[-1]'}`}/>
                ) : (
                   <div className="w-full h-full flex items-center justify-center bg-window/10 relative overflow-hidden">
                      <img src={myPfp} className="w-12 h-12 retro-border object-cover opacity-50" onError={e => e.target.style.display='none'} alt=""/>
                      <div className="absolute bottom-1 right-1 bg-black/50 px-1 text-[7px] text-white font-black uppercase tracking-tighter">Cam Off</div>
                   </div>
                )}
                <div className="absolute top-1 left-1 bg-black/70 px-1.5 py-0.5 text-[8px] text-white font-black uppercase tracking-tight z-10">
                  {isScreenSharing ? 'Screen' : 'You'}
                </div>
              </div>
            )}

            {/* Status badges */}
            <div className="absolute top-2 left-2 flex gap-1.5 z-30">
              {isMuted    && <div className="p-1.5 bg-red-600/90 text-white rounded-full retro-border"><MicOff  size={12}/></div>}
              {isDeafened && <div className="p-1.5 bg-red-600/90 text-white rounded-full retro-border"><VolumeX size={12}/></div>}
              {isCameraOff && type === 'video' && <div className="p-1.5 bg-red-600/90 text-white rounded-full retro-border"><VideoOff size={12}/></div>}
            </div>

            {/* Live badge */}
            {!isReconnecting && (
              <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 retro-border text-[9px] text-white font-black tracking-widest uppercase z-30">LIVE</div>
            )}
          </>
        )}

        {/* Hover Controls (Retro Styled) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-window/95 backdrop-blur-md px-4 py-3 retro-border-thick opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 shadow-[6px_6px_0px_rgba(0,0,0,0.3)]">
          <button onClick={onMicToggle} 
                  className={`p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${isMuted ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Mute (Shift+M)">
            {isMuted ? <MicOff size={20}/> : <Mic size={20}/>}
          </button>
          <button onClick={onDeafenToggle} 
                  className={`p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${isDeafened ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Deafen (Shift+D)">
            {isDeafened ? <VolumeX size={20}/> : <Volume2 size={20}/>}
          </button>
          <button onClick={handleCameraToggle} 
                  className={`p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 relative ${isCameraOff ? 'bg-red-500 text-white' : 'bg-window hover:bg-border'}`} title="Camera (Shift+V)">
            {isCameraChanging
              ? <Loader size={20} className="animate-spin"/>
              : isCameraOff ? <VideoOff size={20}/> : <Camera size={20}/>
            }
          </button>
          <button onClick={() => isScreenSharing ? onStopScreenShare?.() : onScreenShare?.()}
                  className={`p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-window hover:bg-border'}`} title="Screen Share (Shift+S)">
            {isScreenSharing ? <MonitorOff size={20}/> : <Monitor size={20}/>}
          </button>
          
          <div className="w-px h-8 bg-border mx-1 opacity-20"/>
          
          {/* Device Selector */}
          <div className="relative">
            <button onClick={() => setShowDevices(p => !p)}
                    className={`p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${showDevices ? 'bg-accent text-accent-text' : 'bg-window hover:bg-border'}`} title="Device Settings">
              <Settings size={20}/>
            </button>
            {showDevices && (
              <DeviceSelector onChangeDevice={onChangeDevice} onClose={() => setShowDevices(false)} />
            )}
          </div>

          <div className="w-px h-8 bg-border mx-1 opacity-20"/>

          <button onClick={onEndCall} 
                  className="p-3 retro-border-thick shadow-[4px_4px_0_var(--border)] active:translate-y-[2px] active:shadow-none bg-red-600 text-white hover:bg-red-700 hover:scale-110 transition-all" title="End Call (Shift+E)">
            <PhoneOff size={22} className="rotate-[135deg]"/>
          </button>
        </div>
      </div>
    </div>
  );
}
"Device Settings">
              <Settings size={18}/>
            </button>
            {showDevices && (
              <DeviceSelector onChangeDevice={onChangeDevice} onClose={() => setShowDevices(false)} />
            )}
          </div>

          <div className="w-px h-6 bg-border mx-1 opacity-20"/>

          <button onClick={onEndCall} className="p-2.5 retro-border bg-red-600 text-white hover:bg-red-700 hover:scale-110 active:scale-95 transition-all" title="End Call (Shift+E)">
            <PhoneOff size={18} className="rotate-[135deg]"/>
          </button>
        </div>
      </div>
    </div>
  );
}

