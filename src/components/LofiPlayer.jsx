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
function RetroVisualizer({ audioRef, isPlaying, width = 60, height = 20, segments = 6 }) {
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
                analyzer.fftSize = 64;
                
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
                const barWidth = (canvas.width / bufferLength) * 2;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    
                    // Mockup colors: yellow/orange and red for peaks
                    if (i > bufferLength * 0.7) ctx.fillStyle = '#ff5555';
                    else ctx.fillStyle = '#ffcc33';
                    
                    const segHeight = canvas.height / segments;
                    for (let j = 0; j < segments; j++) {
                        if (barHeight > j * segHeight) {
                            ctx.fillRect(x, canvas.height - (j + 1) * segHeight + 1, barWidth - 1, segHeight - 1);
                        } else {
                            ctx.fillStyle = '#111111'; // Dark ghost segments
                            ctx.fillRect(x, canvas.height - (j + 1) * segHeight + 1, barWidth - 1, segHeight - 1);
                            // Reset color for next iterations
                            if (i > bufferLength * 0.7) ctx.fillStyle = '#ff5555';
                            else ctx.fillStyle = '#ffcc33';
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
    }, [isPlaying, audioRef, segments]);

    return (
        <canvas 
            ref={canvasRef} 
            width={width} 
            height={height} 
            className="w-full h-full pixelated"
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
  const audioRef = useRef(null);
  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length, isPlaying: true });
  const prevCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx - 1 + CHANNELS.length) % CHANNELS.length, isPlaying: true });

  const setVolume = (v) => setRadioState({ ...radioState, volume: Math.max(0, Math.min(1, v)) });

  return (
      <div className="flex flex-col h-full bg-window p-4 sm:p-6 relative overflow-hidden min-h-[18rem] select-none">
        <audio ref={audioRef} src={CHANNELS[radioState.channelIdx].url} crossOrigin="anonymous" loop hidden />
        
        {/* Animated Vibe Overlay from user style */}
        <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none ${radioState.isPlaying ? 'opacity-10' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 animate-gradient-slow"></div>
        </div>

        {/* Main Mechanical Row */}
        <div className="flex-1 flex items-start justify-between gap-4 z-10">
          
          {/* Left: Premium Vinyl Disc */}
          <div className="flex flex-col items-center justify-center shrink-0 mt-2">
             <div className={`relative w-24 h-24 rounded-full bg-black border-[6px] border-border/20 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,1),4px 4px 15px rgba(0,0,0,0.2)] ${radioState.isPlaying ? 'animate-spin-slow' : ''}`} style={{animationDuration: '6s'}}>
                <div className="absolute inset-2 rounded-full border border-white/5"></div>
                <div className="absolute inset-6 rounded-full border border-white/5"></div>
                <div className="w-5 h-5 bg-[#111] retro-border rounded-full shadow-inner z-10"></div>
                
                {/* Mechanical status label */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[7px] font-black bg-primary text-white px-2 py-0.5 retro-border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {radioState.isPlaying ? 'SYSTEM_ON' : 'SYSTEM_OFF'}
                </div>
             </div>
          </div>

          {/* Center: Track Info + Mechanical Viz */}
          <div className="flex-1 flex flex-col items-start px-2 mt-2">
             <div className="font-black text-primary uppercase text-[10px] tracking-[0.2em] mb-1 opacity-60">
                ATTIC FM STEREO
             </div>
             <div className="font-black text-3xl leading-none truncate lowercase text-main-text mb-3">{CHANNELS[radioState.channelIdx].name}</div>
             
             <div className="w-full h-14 bg-[#0a0a0a] border-2 border-black p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,1)] relative overflow-hidden">
                <RetroVisualizer audioRef={audioRef} isPlaying={radioState.isPlaying} width={180} height={40} segments={8} />
             </div>
          </div>

          {/* Right: Vertical Volume Tower */}
          <div className="w-12 h-44 flex flex-col items-center bg-border/10 retro-border border-black p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
             <button 
                onClick={() => setVolume(radioState.volume + 0.1)} 
                className="w-full h-8 flex items-center justify-center bg-window border border-black text-main-text hover:bg-black/5 active:translate-y-0.5 active:shadow-none shadow-[0_2px_0px_0px_black] text-xs font-black transition-all mb-1"
             >
                +
             </button>
             
             <div className="flex-1 w-full flex justify-center py-2 relative group cursor-pointer">
                <div className="w-1 h-full bg-black/40 retro-border"></div>
                {/* Mechanical Slide Handle */}
                <div 
                    className="absolute left-1/2 -translate-x-1/2 w-6 h-3 bg-primary border-2 border-black z-10 pointer-events-none shadow-[2px_2px_0px_0px_black]"
                    style={{ bottom: `${radioState.volume * 85 + 5}%` }}
                ></div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={radioState.volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  style={{ appearance: 'slider-vertical', WebkitAppearance: 'slider-vertical' }}
                />
             </div>
             
             <button 
                onClick={() => setVolume(radioState.volume - 0.1)} 
                className="w-full h-8 flex items-center justify-center bg-window border border-black text-main-text hover:bg-black/5 active:translate-y-0.5 active:shadow-none shadow-[0_2px_0px_0px_black] text-xs font-black transition-all mt-1"
             >
                -
             </button>
          </div>
        </div>

        {/* Bottom Mechanical Controls */}
        <div className="mt-8 flex items-center justify-center gap-8 z-10 pr-12">
            <button 
                onClick={prevCh} 
                className="w-16 h-14 bg-window border-2 border-black flex items-center justify-center active:translate-y-1 active:shadow-none transition-all shadow-[0_6px_0px_0px_black] hover:bg-black/5 group"
            >
                <SkipBack size={24} fill="currentColor" className="text-black group-active:scale-95"/>
            </button>
            
            <button 
                onClick={togglePlay} 
                className={`w-20 h-16 border-2 border-black flex items-center justify-center active:translate-y-1 active:shadow-none transition-all shadow-[0_6px_0px_0px_black] group ${radioState.isPlaying ? 'bg-primary text-white' : 'bg-window hover:bg-black/5 text-black'}`}
            >
                {radioState.isPlaying ? 
                    <Pause size={32} fill="currentColor" className="group-active:scale-95"/> : 
                    <Play size={32} fill="currentColor" className="ml-1 group-active:scale-95"/>
                }
            </button>
            
            <button 
                onClick={nextCh} 
                className="w-16 h-14 bg-window border-2 border-black flex items-center justify-center active:translate-y-1 active:shadow-none transition-all shadow-[0_6px_0px_0px_black] hover:bg-black/5 group"
            >
                <SkipForward size={24} fill="currentColor" className="text-black group-active:scale-95"/>
            </button>
        </div>
      </div>
  );
}
