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
      <div className="fixed bottom-4 right-4 z-[200] flex items-center gap-2 bg-[var(--bg-window)] p-2 rounded-full retro-border retro-shadow-dark animate-in slide-in-from-bottom">
         <audio ref={audioRef} src={CHANNELS[radioState?.channelIdx || 0]?.url} crossOrigin="anonymous" loop />
         
         <div className="flex bg-[var(--accent)] rounded-full px-3 py-1 items-center gap-2 mr-1 border border-[var(--border)] border-dashed">
            <Radio size={14} className={radioState?.isPlaying ? 'animate-pulse text-[var(--primary)]' : ''}/> 
            <span className="text-[10px] font-black uppercase tracking-widest max-w-[80px] truncate">{CHANNELS[radioState?.channelIdx || 0]?.name}</span>
            <div className="w-12 h-4 overflow-hidden ml-1">
                <RetroVisualizer audioRef={audioRef} isPlaying={radioState.isPlaying} />
            </div>
         </div>

         <div className="flex items-center gap-2 px-1">
             <div 
                className="flex items-center gap-2 transition-all duration-300 overflow-hidden"
                style={{ width: showVolume ? '100px' : '0px', opacity: showVolume ? 1 : 0 }}
             >
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={radioState?.volume || 0.4} 
                    onChange={(e) => setRadioState({...radioState, volume: parseFloat(e.target.value)})} 
                    className="w-20 h-1 accent-[var(--primary)] cursor-pointer" 
                />
             </div>
             <button 
                onClick={() => setShowVolume(!showVolume)}
                className={`p-2 rounded-full transition-colors ${showVolume ? 'bg-[var(--accent)]' : 'hover:bg-[var(--bg-main)]'}`}
             >
                <Volume2 size={14} className="opacity-70" />
             </button>
         </div>

         <div className="flex items-center gap-1 border-l border-border/20 pl-1">
            <button onClick={togglePlay} className={`p-2 rounded-full retro-border active:scale-95 transition-all ${radioState?.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_15px_var(--primary)]' : 'bg-[var(--bg-main)] hover:bg-[var(--accent)]'}`}>
               {radioState?.isPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
            </button>
            <button onClick={nextCh} className="p-2 bg-[var(--bg-main)] hover:bg-[var(--accent)] rounded-full retro-border active:scale-95 transition-transform hover:rotate-12">
               <SkipForward size={14} fill="currentColor"/>
            </button>
         </div>
      </div>
  );
}

export function DashboardRadio({ radioState, setRadioState }) {
  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length, isPlaying: true });

  return (
      <div className="flex flex-col h-full bg-[var(--bg-main)] p-4 relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className={`absolute inset-0 opacity-10 transition-opacity duration-1000 ${radioState.isPlaying ? 'opacity-20' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 animate-gradient-slow"></div>
        </div>

        <div className="flex items-center gap-4 z-10">
          <div className={`relative w-20 h-20 rounded-full retro-bg-accent retro-border flex items-center justify-center retro-shadow-dark ${radioState.isPlaying ? 'animate-spin-slow' : ''}`} style={{animationDuration: '4s'}}>
             <Disc size={40} className="opacity-80" />
             <div className="absolute w-4 h-4 bg-[var(--bg-window)] retro-border rounded-full"></div>
             {/* Tiny digital numbers effect */}
             <div className="absolute -bottom-1 right-0 text-[8px] font-mono bg-black text-green-400 px-1 border border-border">
                {radioState.isPlaying ? 'PLAY' : 'STOP'}
             </div>
          </div>
          <div className="flex-1">
             <div className="font-black text-[var(--primary)] uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                <BarChart3 size={14} className={radioState.isPlaying ? 'animate-bounce' : ''}/>
                FM RADIO
             </div>
             <div className="font-black text-2xl leading-tight mt-1 truncate lowercase">{CHANNELS[radioState.channelIdx].name}</div>
             <div className="flex items-center gap-2 mt-1">
                 <div className={`w-2 h-2 rounded-full ${radioState.isPlaying ? 'bg-red-500 animate-pulse shadow-[0_0_8px_red]' : 'bg-gray-400'}`}></div>
                 <div className="text-[10px] font-black opacity-60 uppercase tracking-widest">{radioState.isPlaying ? 'Broadcasting' : 'Off Air'}</div>
             </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 z-10">
            <div className="bg-[var(--bg-window)] p-3 retro-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={togglePlay} className={`px-6 py-2 font-black retro-border rounded active:scale-95 text-[10px] tracking-widest uppercase flex items-center gap-2 transition-all ${radioState.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_10px_var(--primary)]' : 'bg-window hover:bg-accent'}`}>
                        {radioState.isPlaying ? <><Pause size={14} fill="currentColor"/> PAUSE</> : <><Play size={14} fill="currentColor"/> PLAY</>}
                    </button>
                    <div className="flex items-center gap-2 group">
                        <Volume2 size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05" 
                            value={radioState?.volume || 0.4} 
                            onChange={(e) => setRadioState({...radioState, volume: parseFloat(e.target.value)})} 
                            className="w-20 h-1 accent-[var(--primary)] cursor-pointer" 
                        />
                    </div>
                </div>
                <button onClick={nextCh} className="w-10 h-10 bg-[var(--secondary)] hover:bg-blue-400 retro-border rounded flex items-center justify-center active:scale-95 text-white transition-all hover:rotate-12 shadow-lg">
                    <SkipForward size={18} fill="currentColor"/>
                </button>
            </div>
        </div>

        <div className="absolute bottom-4 right-4 w-1/2 opacity-5 pointer-events-none text-9xl -mb-10 text-[var(--border)]"><Radio/></div>
      </div>
  );
}
