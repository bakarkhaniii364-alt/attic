import React, { useRef, useEffect, useState } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, Radio, Disc, BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
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
function RetroVisualizer({ audioRef, isPlaying, height = 20, width = 60, segments = 6 }) {
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
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    const hue = (i / bufferLength) * 120 + 280; 
                    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
                    
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
    }, [isPlaying, audioRef, segments]);

    return (
        <canvas 
            ref={canvasRef} 
            width={width} 
            height={height} 
            className="opacity-80 mix-blend-screen w-full h-full"
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
      <div className="flex flex-col h-full bg-window p-4 relative overflow-hidden min-h-[14rem]">
        {/* Invisible audio element for the visualizer to tap into */}
        <audio ref={audioRef} src={CHANNELS[radioState.channelIdx].url} crossOrigin="anonymous" loop hidden />
        
        <div className={`absolute inset-0 transition-opacity duration-1000 ${radioState.isPlaying ? 'opacity-20' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 animate-gradient-slow"></div>
        </div>

        <div className="flex items-start justify-between z-10">
          <div className="flex items-center gap-4">
             <div className={`relative w-16 h-16 rounded-full retro-bg-accent retro-border flex items-center justify-center retro-shadow-dark ${radioState.isPlaying ? 'animate-spin-slow' : ''}`} style={{animationDuration: '6s'}}>
                <Disc size={32} className="opacity-80" />
                <div className="absolute w-3 h-3 bg-window retro-border rounded-full"></div>
             </div>
             <div>
                <div className="font-black text-[var(--primary)] uppercase text-[9px] tracking-[0.2em] flex items-center gap-1.5">
                   <BarChart3 size={12} className={radioState.isPlaying ? 'animate-bounce' : ''}/>
                   FM TUNER
                </div>
                <div className="font-black text-xl leading-tight mt-0.5 truncate lowercase max-w-[120px]">{CHANNELS[radioState.channelIdx].name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                     <div className={`w-1.5 h-1.5 rounded-full ${radioState.isPlaying ? 'bg-red-500 animate-pulse shadow-[0_0_6px_red]' : 'bg-gray-400'}`}></div>
                     <div className="text-[9px] font-black opacity-60 uppercase tracking-widest">{radioState.isPlaying ? 'Active' : 'Standby'}</div>
                </div>
             </div>
          </div>

          {/* Volume Stack on the Right */}
          <div className="flex flex-col items-center gap-2 bg-black/5 p-2 retro-border border-dashed">
             <button onClick={() => setVolume(radioState.volume + 0.1)} className="p-1 hover:bg-primary/20 rounded transition-colors"><ChevronUp size={14}/></button>
             <div className="h-20 w-4 flex justify-center py-1">
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={radioState.volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="h-full w-1 accent-primary cursor-pointer orientation-vertical"
                  style={{ appearance: 'slider-vertical', WebkitAppearance: 'slider-vertical' }}
                />
             </div>
             <button onClick={() => setVolume(radioState.volume - 0.1)} className="p-1 hover:bg-primary/20 rounded transition-colors"><ChevronDown size={14}/></button>
             <Volume2 size={12} className="opacity-40" />
          </div>
        </div>

        {/* Visualizer in the Center */}
        <div className="flex-1 my-3 bg-black/10 retro-border border-dashed p-2 overflow-hidden flex items-center justify-center">
            <RetroVisualizer audioRef={audioRef} isPlaying={radioState.isPlaying} height={40} width={200} segments={10} />
        </div>

        {/* Bottom Controls Lineup */}
        <div className="flex items-center justify-center gap-4 z-10 pt-2 border-t border-dashed border-border/20">
            <button onClick={prevCh} className="p-3 bg-window hover:bg-accent retro-border rounded active:scale-95 transition-all shadow-sm">
                <SkipBack size={18} fill="currentColor"/>
            </button>
            <button onClick={togglePlay} className={`p-4 font-black retro-border rounded-full active:scale-95 transition-all ${radioState.isPlaying ? 'bg-primary text-white shadow-[0_0_15px_var(--primary)]' : 'bg-window hover:bg-accent'}`}>
                {radioState.isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor" className="ml-1"/>}
            </button>
            <button onClick={nextCh} className="p-3 bg-window hover:bg-accent retro-border rounded active:scale-95 transition-all shadow-sm">
                <SkipForward size={18} fill="currentColor"/>
            </button>
        </div>
      </div>
  );
}
