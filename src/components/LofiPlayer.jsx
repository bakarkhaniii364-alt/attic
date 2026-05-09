import React, { useRef, useEffect, useState } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, Radio, Disc, BarChart3, ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react';
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
function RetroVisualizer({ audioRef, isPlaying, height = 40, width = 120, segments = 6 }) {
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
            if (!contextRef.current) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                const analyzer = ctx.createAnalyser();
                
                if (!audioRef.current._sourceNode) {
                    audioRef.current._sourceNode = ctx.createMediaElementSource(audioRef.current);
                }
                
                audioRef.current._sourceNode.connect(analyzer);
                analyzer.connect(ctx.destination);
                analyzer.fftSize = 32; // Smaller for more "chunky" bars
                
                contextRef.current = ctx;
                analyzerRef.current = analyzer;
            }

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
                const barWidth = canvas.width / bufferLength;
                
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    
                    // Mockup style colors: yellow for low, red for high frequencies
                    if (i > bufferLength * 0.7) ctx.fillStyle = '#ff5555';
                    else ctx.fillStyle = '#ffcc33';
                    
                    const segHeight = canvas.height / segments;
                    for (let j = 0; j < segments; j++) {
                        if (barHeight > j * segHeight) {
                            ctx.fillRect(i * barWidth + 1, canvas.height - (j + 1) * segHeight + 1, barWidth - 2, segHeight - 1);
                        }
                    }
                }
            };

            draw();
        } catch (err) {
            console.warn("[Visualizer] Audio setup failed:", err);
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying, audioRef, segments]);

    return (
        <canvas 
            ref={canvasRef} 
            width={width} 
            height={height} 
            className="w-full h-full pixelated"
            style={{ imageRendering: 'pixelated' }}
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
         
         <div className={`flex items-center justify-center w-8 h-8 rounded-full cursor-pointer ${radioState?.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_10px_var(--primary)] animate-pulse' : 'bg-[var(--bg-main)] hover:bg-[var(--accent)]'}`} onClick={togglePlay}>
            <Radio size={14} />
         </div>

         <div 
             className="flex items-center transition-all duration-500 overflow-hidden"
             style={{ width: isExpanded ? (showVolume ? '360px' : '260px') : '0px', opacity: isExpanded ? 1 : 0 }}
         >
             <div className="flex bg-[var(--accent)] rounded-full px-3 py-1 items-center gap-2 mr-2 border border-[var(--border)] border-dashed shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest w-[60px] truncate">{CHANNELS[radioState?.channelIdx || 0]?.name}</span>
                <div className="w-8 h-4 overflow-hidden ml-1">
                    <RetroVisualizer audioRef={audioRef} isPlaying={radioState.isPlaying} height={16} width={40} segments={4} />
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
                        min="0" max="1" step="0.05" 
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
                <button onClick={nextCh} className="p-2 bg-[var(--bg-main)] hover:bg-[var(--accent)] rounded-full retro-border active:scale-95 transition-transform">
                   <SkipForward size={14} fill="currentColor"/>
                </button>
             </div>
         </div>
      </div>
  );
}

export function DashboardRadio({ radioState, setRadioState }) {
  const audioRef = useRef(null);
  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length, isPlaying: true });
  const prevCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx - 1 + CHANNELS.length) % CHANNELS.length, isPlaying: true });

  const setVolume = (v) => setRadioState({ ...radioState, volume: Math.max(0, Math.min(1, v)) });

  return (
      <div className="flex flex-col h-full bg-window p-6 relative overflow-hidden min-h-[16rem]">
        <audio ref={audioRef} src={CHANNELS[radioState.channelIdx].url} crossOrigin="anonymous" loop hidden />
        
        <div className={`absolute inset-0 transition-opacity duration-1000 ${radioState.isPlaying ? 'opacity-10' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary animate-pulse"></div>
        </div>

        <div className="flex-1 flex gap-6 z-10">
          {/* Left Side: Disc */}
          <div className="flex flex-col items-center justify-center">
             <div className={`relative w-24 h-24 rounded-full bg-yellow-400 border-4 border-black/20 flex items-center justify-center shadow-lg ${radioState.isPlaying ? 'animate-spin-slow' : ''}`} style={{animationDuration: '8s'}}>
                <div className="absolute inset-2 rounded-full border-2 border-black/10"></div>
                <div className="absolute inset-6 rounded-full border-2 border-black/10"></div>
                <div className="w-6 h-6 bg-window border-4 border-black/20 rounded-full z-10"></div>
             </div>
          </div>

          {/* Center Side: Name + Visualizer */}
          <div className="flex-1 flex flex-col justify-center pt-2">
             <div className="font-black text-2xl lowercase tracking-tight mb-3 px-1">{CHANNELS[radioState.channelIdx].name}</div>
             <div className="h-16 w-full bg-black/90 retro-border p-2 overflow-hidden shadow-inner">
                <RetroVisualizer audioRef={audioRef} isPlaying={radioState.isPlaying} height={40} width={160} segments={8} />
             </div>
          </div>

          {/* Right Side: Volume Frame */}
          <div className="w-12 flex flex-col items-center bg-[#e0e0e0] retro-border p-1 shadow-sm">
             <button onClick={() => setVolume(radioState.volume + 0.1)} className="w-full aspect-square flex items-center justify-center bg-window retro-border text-main-text hover:bg-black/5 active:bg-black/10 mb-2">
                <Plus size={14} />
             </button>
             <div className="flex-1 w-full flex justify-center py-2 relative">
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-black/20 rounded-full"></div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={radioState.volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="h-full w-2 accent-primary cursor-pointer relative z-10"
                  style={{ appearance: 'slider-vertical', WebkitAppearance: 'slider-vertical' }}
                />
             </div>
             <button onClick={() => setVolume(radioState.volume - 0.1)} className="w-full aspect-square flex items-center justify-center bg-window retro-border text-main-text hover:bg-black/5 active:bg-black/10 mt-2">
                <Minus size={14} />
             </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="mt-6 flex items-center justify-center gap-6 z-10 pr-12">
            <button onClick={prevCh} className="w-14 h-14 bg-window hover:bg-black/5 retro-border flex items-center justify-center active:scale-95 transition-all shadow-md">
                <SkipBack size={24} fill="currentColor"/>
            </button>
            <button onClick={togglePlay} className="w-16 h-16 bg-window hover:bg-black/5 retro-border flex items-center justify-center active:scale-95 transition-all shadow-md">
                {radioState.isPlaying ? <Pause size={32} fill="currentColor"/> : <Play size={32} fill="currentColor" className="ml-1"/>}
            </button>
            <button onClick={nextCh} className="w-14 h-14 bg-window hover:bg-black/5 retro-border flex items-center justify-center active:scale-95 transition-all shadow-md">
                <SkipForward size={24} fill="currentColor"/>
            </button>
        </div>
      </div>
  );
}
