import React, { useState } from 'react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { LogIn, Key, Wifi } from 'lucide-react';
import { playAudio } from '../utils/audio.js';

export function Lobby({ onJoin, sfx }) {
  const [code, setCode] = useState('');
  const toast = useToast();

  const handleJoin = (e) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      toast('Room code must be at least 4 characters.', 'error');
      return;
    }
    playAudio('click', sfx);
    onJoin(code.trim().toUpperCase());
  };

  const handleGenerate = () => {
    playAudio('click', sfx);
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCode(newCode);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-matrix-pattern relative overflow-hidden">
      <div className="absolute inset-0 scanlines pointer-events-none z-10"></div>
      
      <div className="mb-12 text-center animate-in slide-in-from-bottom-8 duration-700">
        <h1 className="text-6xl sm:text-8xl font-black mb-4 tracking-tighter text-[var(--text-main)] glitch-text drop-shadow-[0_4px_0_var(--text-main)]">
          ATTIC
        </h1>
        <p className="text-sm sm:text-base font-bold bg-[var(--text-main)] text-[var(--bg-main)] inline-block px-4 py-1 -rotate-2">
          MULTIPLAYER PAIRING LOBBY
        </p>
      </div>

      <RetroWindow title="connect.exe" className="w-full max-w-sm z-20 animate-in fade-in zoom-in duration-500 delay-300">
        <form onSubmit={handleJoin} className="flex flex-col gap-6 p-2">
          <div className="text-center">
            <Wifi size={48} className="mx-auto mb-2 text-[var(--primary)] animate-pulse" />
            <p className="text-sm font-bold opacity-70">Enter your partner's code, or generate a new one to start your private room.</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold flex items-center gap-2"><Key size={14}/> Room Code</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex: 8A4F92"
                className="w-full p-3 retro-border retro-bg-window text-center text-xl font-black tracking-widest focus:outline-none"
                maxLength={8}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <RetroButton type="button" variant="secondary" onClick={handleGenerate} className="py-3 text-xs w-full whitespace-nowrap px-1">
              Generate Code
            </RetroButton>
            <RetroButton type="submit" variant="primary" className="flex items-center justify-center gap-2 py-3 w-full">
              <LogIn size={16}/> Connect
            </RetroButton>
          </div>
        </form>
      </RetroWindow>
      
      <div className="mt-8 text-center opacity-50 text-[10px] sm:text-xs font-bold max-w-sm p-4 bg-white/10 backdrop-blur-sm retro-border border-dashed z-20">
        <p>Your room is end-to-end synced via Supabase WebSockets. Video calls are processed P2P via WebRTC with zero latency.</p>
      </div>
    </div>
  );
}
