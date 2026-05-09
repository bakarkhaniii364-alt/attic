import React, { useRef, useEffect, useState } from 'react';
import { Music, Play, Pause, SkipForward, Volume2, Radio, Disc, BarChart3 } from 'lucide-react';
import { RetroWindow } from './UI.jsx';

export const CHANNELS = [
    { name: "Bliss", url: "/assets/music/Bliss.mp3" },
    { name: "Ivy", url: "/assets/music/Ivy.mp3" },
    { name: "Electronic Chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { name: "Lofi Study Chords", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { name: "Synthwave Drive", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { name: "Cozy Jazz Cafe", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" }
];

// ── RETRO AUDIO VISUALIZER ──
function RetroVisualizer({ audioRef, isPlaying }) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const contextRef = useRef(null);
    const analyzerRef = useRef(null);

    useEffect(() => {
        if (!audioRef.current || !isPlaying) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        try {
            // Initialize context and analyzer only once
            if (!contextRef.current) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                const analyzer = ctx.createAnalyser();
                
                // CRITICAL: createMediaElementSource can ONLY be called once per element
                // We store the source node in a property on the audio element to persist it
                if (!audioRef.current._sourceNode) {
                    audioRef.current._sourceNode = ctx.createMediaElementSource(audioRef.current);
                }
                
                audioRef.current._sourceNode.connect(analyzer);
                analyzer.connect(ctx.destination);
                analyzer.fftSize = 64;
                
                contextRef.current = ctx;
                analyzerRef.current = analyzer;
            }

            // Resume context if it was suspended (browser policy)
            if (contextRef.current.state === 'suspended') {
                contextRef.current.resume();
            }

            const analyzer = analyzerRef.current;
            const bufferLength = analyzer.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            const draw = () => {
                animationRef.current = requestAnimationFrame(draw);
                analyzer.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    const hue = (i / bufferLength) * 120 + 280; 
                    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
                    
                    const segments = 6;
                    const segHeight = canvas.height / segments;
                    for (let j = 0; j < segments; j++) {
                        if (barHeight > j * segHeight) {
                            ctx.fillRect(x, canvas.height - (j + 1) * segHeight + 1, barWidth - 1, segHeight - 1);
                        }
                    }
                    x += barWidth;
                }
            };

            draw();
        } catch (err) {
            console.warn("[Visualizer] Audio setup failed:", err);
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying, audioRef]);

    return (
        <canvas 
            ref={canvasRef} 
            width={60} 
            height={20} 
            className="opacity-80 mix-blend-screen"
        />
    );
}

export function StrayTray({ radioState, setRadioState }) {
  const audioRef = useRef(null);
  const [showVolume, setShowVolume] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
     if (timeoutRef.current) clearTimeout(timeoutRef.current);
     setIsExpanded(true);
  };
  
  const handleMouseLeave = () => {
     timeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
        setShowVolume(false);
     }, 2000);
  };

  useEffect(() => {
     if (audioRef.current) {
        audioRef.current.volume = radioState.volume;
        if (radioState.isPlaying) {
             const playPromise = audioRef.current.play();
             if (playPromise !== undefined) {
                 playPromise.catch(error => console.log("Audio playback prevented:", error));
             }
        }
        else audioRef.current.pause();
     }
  }, [radioState]);

  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length, isPlaying: true });

  return (
      <div 
         className={`fixed bottom-4 right-4 z-[200] flex items-center bg-[var(--bg-window)] p-2 rounded-full retro-border retro-shadow-dark transition-all duration-500 ${isExpanded ? 'gap-2' : 'gap-0'}`}
         onMouseEnter={handleMouseEnter}
         onMouseLeave={handleMouseLeave}
      >
         <audio ref={audioRef} src={CHANNELS[radioState?.channelIdx || 0]?.url} crossOrigin="anonymous" loop />
         
         {/* Always visible icon */}
         <div className={`flex items-center justify-center w-8 h-8 rounded-full cursor-pointer ${radioState?.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_10px_var(--primary)] animate-pulse' : 'bg-[var(--bg-main)] hover:bg-[var(--accent)]'}`} onClick={togglePlay}>
            <Radio size={14} />
         </div>

         {/* Expanded content */}
         <div 
             className="flex items-center transition-all duration-500 overflow-hidden"
             style={{ width: isExpanded ? (showVolume ? '360px' : '260px') : '0px', opacity: isExpanded ? 1 : 0 }}
         >
             <div className="flex bg-[var(--accent)] rounded-full px-3 py-1 items-center gap-2 mr-2 border border-[var(--border)] border-dashed shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest w-[60px] truncate">{CHANNELS[radioState?.channelIdx || 0]?.name}</span>
                <div className="w-8 h-4 overflow-hidden ml-1">
                    <RetroVisualizer audioRef={audioRef} isPlaying={radioState.isPlaying} />
                </div>
             </div>

             <div className="flex items-center gap-1 shrink-0">
                 <button 
                    onClick={() => setShowVolume(!showVolume)}
                    className={`p-2 rounded-full transition-colors ${showVolume ? 'bg-[var(--accent)]' : 'hover:bg-[var(--bg-main)]'}`}
                 >
                    <Volume2 size={14} className="opacity-70" />
                 </button>

                 <div 
                    className="flex items-center gap-2 transition-all duration-300 overflow-hidden"
                    style={{ width: showVolume ? '80px' : '0px', opacity: showVolume ? 1 : 0 }}
                 >
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={radioState?.volume || 0.4} 
                        onChange={(e) => setRadioState({...radioState, volume: parseFloat(e.target.value)})} 
                        className="w-16 h-1 accent-[var(--primary)] cursor-pointer" 
                    />
                 </div>
             </div>

             <div className="flex items-center gap-1 border-l border-border/20 pl-2 shrink-0">
                <button onClick={togglePlay} className={`p-2 rounded-full retro-border active:scale-95 transition-all ${radioState?.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_15px_var(--primary)]' : 'bg-[var(--bg-main)] hover:bg-[var(--accent)]'}`}>
                   {radioState?.isPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                </button>
                <button onClick={nextCh} className="p-2 bg-[var(--bg-main)] hover:bg-[var(--accent)] rounded-full retro-border active:scale-95 transition-transform hover:rotate-12">
                   <SkipForward size={14} fill="currentColor"/>
                </button>
             </div>
         </div>
      </div>
  );
}

export function DashboardRadio({ radioState, setRadioState }) {
  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length, isPlaying: true });

  return (
      <div className="flex flex-col h-full bg-window p-4 relative overflow-hidden">
        <div className="flex items-center gap-5 z-10">
          <div className={`relative w-24 h-24 rounded-full bg-black border-[6px] border-border/20 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,1),0_0_15px_rgba(0,0,0,0.2)] ${radioState.isPlaying ? 'animate-spin-slow' : ''}`} style={{animationDuration: '6s'}}>
             <Disc size={44} className="text-border opacity-20" />
             <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none"></div>
             <div className="absolute w-5 h-5 bg-[#111] retro-border rounded-full shadow-inner"></div>
             {/* Mechanical status label */}
             <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-primary text-white px-2 py-0.5 retro-border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                {radioState.isPlaying ? 'SYSTEM_ON' : 'SYSTEM_OFF'}
             </div>
          </div>
          <div className="flex-1">
             <div className="font-black text-primary uppercase text-[10px] tracking-[0.2em] mb-1">
                ATTIC FM STEREO
             </div>
             <div className="font-black text-3xl leading-none truncate lowercase text-main-text mb-2">{CHANNELS[radioState.channelIdx].name}</div>
             <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 retro-border ${radioState.isPlaying ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-black/20'}`}></div>
                  <div className="text-[10px] font-black opacity-40 uppercase tracking-[0.1em]">{radioState.isPlaying ? 'Live Feed' : 'Standby'}</div>
             </div>
          </div>
        </div>

        <div className="mt-auto z-10">
            {/* Chunky Mechanical Controls */}
            <div className="bg-border/5 p-4 retro-border border-dashed flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={togglePlay} 
                        className={`flex-1 h-14 retro-border border-black font-black text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-all active:translate-y-1 active:shadow-none ${radioState.isPlaying ? 'bg-primary text-white shadow-[0_6px_0px_0px_rgba(0,0,0,1)]' : 'bg-window hover:bg-black/5 shadow-[0_6px_0px_0px_rgba(0,0,0,1)]'}`}
                    >
                        {radioState.isPlaying ? <><Pause size={18} fill="currentColor"/> STOP</> : <><Play size={18} fill="currentColor"/> START</>}
                    </button>
                    <button 
                        onClick={nextCh} 
                        className="w-16 h-14 bg-secondary text-white retro-border border-black flex items-center justify-center transition-all active:translate-y-1 active:shadow-none shadow-[0_6px_0px_0px_rgba(0,0,0,1)]"
                    >
                        <SkipForward size={22} fill="currentColor"/>
                    </button>
                </div>

                <div className="flex items-center gap-4 px-2">
                    <Volume2 size={16} className="opacity-30 shrink-0" />
                    <div className="flex-1 h-4 bg-black/10 retro-border relative flex items-center p-1">
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={radioState?.volume || 0.4} 
                            onChange={(e) => setRadioState({...radioState, volume: parseFloat(e.target.value)})} 
                            className="w-full h-1 accent-primary cursor-pointer opacity-80" 
                        />
                    </div>
                </div>
            </div>
        </div>
        <div className="absolute bottom-4 right-4 w-1/2 opacity-5 pointer-events-none text-9xl -mb-10 text-[var(--border)]"><Radio/></div>
      </div>
  );
}
