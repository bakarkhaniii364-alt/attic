import React, { useRef, useEffect } from 'react';
import { Music, Play, Pause, SkipForward, Volume2, Radio, Disc } from 'lucide-react';
import { RetroWindow } from './UI.jsx';

export const CHANNELS = [
    { name: "Bliss", url: "/assets/music/Bliss.mp3" },
    { name: "Electronic Chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { name: "Lofi Study Chords", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { name: "Synthwave Drive", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { name: "Cozy Jazz Cafe", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" }
];

export function StrayTray({ radioState, setRadioState }) {
  const audioRef = useRef(null);

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
         <audio ref={audioRef} src={CHANNELS[radioState?.channelIdx || 0]?.url} loop />
         <div className="flex bg-[var(--accent)] rounded-full px-3 py-1 items-center gap-2 mr-2 border border-[var(--border)] border-dashed">
            <Radio size={14} className={radioState?.isPlaying ? 'animate-pulse' : ''}/> 
            <span className="text-[10px] font-bold max-w-[80px] truncate">{CHANNELS[radioState?.channelIdx || 0]?.name}</span>
         </div>
         <div className="group relative">
            <button onClick={togglePlay} className={`p-2 rounded-full retro-border active:scale-95 transition-colors ${radioState?.isPlaying ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-main)] hover:bg-[var(--accent)]'}`}>
               {radioState?.isPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
            </button>
            <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-8 h-24 bg-[var(--bg-window)] retro-border rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity shadow-lg">
                <input type="range" min="0" max="1" step="0.05" value={radioState?.volume || 0.4} onChange={(e) => setRadioState({...radioState, volume: parseFloat(e.target.value)})} className="w-16 h-2 -rotate-90 origin-center absolute top-10 accent-[var(--primary)] cursor-pointer" />
                <Volume2 size={12} className="absolute bottom-2 opacity-50"/>
            </div>
         </div>
         <button onClick={nextCh} className="p-2 bg-[var(--bg-main)] hover:bg-[var(--accent)] rounded-full retro-border active:scale-95">
            <SkipForward size={14} fill="currentColor"/>
         </button>
      </div>
  );
}

export function DashboardRadio({ radioState, setRadioState }) {
  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length, isPlaying: true });

  return (
      <div className="flex flex-col h-full bg-[var(--bg-main)] p-4 relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          {/* Vinyl Disc */}
          <div className={`relative w-20 h-20 rounded-full bg-[var(--accent)] retro-border flex items-center justify-center retro-shadow-dark ${radioState.isPlaying ? 'animate-spin-slow' : ''}`} style={{animationDuration: '4s'}}>
             <Disc size={40} className="opacity-80" />
             <div className="absolute w-4 h-4 bg-[var(--bg-window)] retro-border rounded-full"></div>
             {/* Center hole detail */}
             <div className="absolute w-12 h-12 rounded-full border border-black/10"></div>
          </div>
          
          <div className="flex-1">
             <div className="font-bold text-[var(--primary)] uppercase text-[10px] tracking-widest flex items-center gap-1 opacity-70">
                <Music size={12}/> FM RADIO
             </div>
             <div className="font-black text-lg sm:text-xl leading-tight mt-1 text-[var(--text-main)]">{CHANNELS[radioState.channelIdx].name}</div>
             <div className="text-[10px] font-black opacity-50 uppercase mt-1">
                {radioState.isPlaying ? 'Broadcasting Live' : 'OFF AIR'}
             </div>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 z-10">
           <button onClick={togglePlay} className="flex-1 bg-white hover:bg-gray-50 py-2.5 font-bold retro-border rounded active:scale-95 text-xs flex items-center justify-center gap-2 text-[var(--text-main)] transition-colors">
               {radioState.isPlaying ? <><Pause size={14} fill="currentColor"/> PAUSE</> : <><Play size={14} fill="currentColor"/> PLAY</>}
           </button>
           <button onClick={nextCh} className="w-12 h-10 bg-[var(--secondary)] hover:opacity-90 retro-border rounded flex items-center justify-center active:scale-95 text-white transition-opacity">
               <SkipForward size={18} fill="currentColor"/>
           </button>
        </div>
      </div>
  );
}
