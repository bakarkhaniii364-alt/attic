import React, { useState } from 'react';
import { Sparkles, User, Heart, MonitorPlay, Tv, Gamepad2, Key } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';

export function LandingView({ setProfile, onComplete, sfx }) {
  const [name, setName] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    playAudio('click', sfx);
    setProfile({ name: name.trim(), emoji: '😊', petName: 'Peanut', partnerName: '', anniversary: '' });
    onComplete();
  };

  const hr = new Date().getHours(); const greeting = hr < 12 ? "good morning! ☀️" : hr < 18 ? "good afternoon! ☁️" : "late night vibes 🌙";
  
  return (
    <div className="flex flex-col items-center justify-center relative w-full h-full min-h-[100dvh] overflow-hidden bg-matrix-pattern">
      <div className="fixed inset-0 scanlines pointer-events-none" />
      <div className="absolute top-10 left-[10%] text-[var(--primary)] animate-float"><Gamepad2 size={80} fill="currentColor" opacity={0.5}/></div>
      <div className="absolute top-20 right-[15%] text-[var(--secondary)] animate-float-delayed"><MonitorPlay size={90} opacity={0.5}/></div>
      <div className="absolute bottom-20 left-[15%] text-[var(--accent)] animate-float"><Tv size={70} opacity={0.5} /></div>
      <div className="absolute bottom-32 right-[10%] text-[var(--primary)] animate-float-delayed"><Heart size={50} fill="currentColor" opacity={0.5}/></div>
      
      <RetroWindow title="profile_setup.exe" className="w-full max-w-lg text-center z-10 relative glass-panel mb-8 mt-12 mx-4">
        <div className="p-8 flex flex-col items-center leading-none">
          <div className="w-24 h-24 rounded-full retro-bg-accent retro-border flex items-center justify-center mb-6 retro-shadow-dark hover:scale-110 transition-transform"><Heart size={40} className="text-[var(--text-main)] animate-pulse-slow" fill="currentColor" /></div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2 lowercase tracking-tighter glitch-text">attic</h1>
          <div className="mb-8 font-bold opacity-80 h-10 flex items-center justify-center"><p className="typing-effect overflow-hidden whitespace-nowrap border-r-2 border-[var(--border)] pr-2 text-sm sm:text-lg">{greeting}</p></div>
          
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
             <div className="flex flex-col gap-2 text-left">
                <label className="text-sm font-bold opacity-70 flex items-center gap-2"><User size={14}/> Display Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="What should we call you?" className="p-4 retro-border retro-bg-window focus:outline-none text-lg font-bold" />
             </div>
             <RetroButton type="submit" variant="primary" className="py-4 mt-4 text-xl flex justify-center items-center gap-2 w-full">Enter Attic <Sparkles size={18}/></RetroButton>
          </form>
        </div>
        <style>{` .typing-effect { animation: typing 3s steps(30, end) infinite alternate, blink .75s step-end infinite; } @keyframes typing { 0%, 20% { width: 0 } 80%, 100% { width: 100% } } @keyframes blink { 50% { border-color: transparent } } `}</style>
      </RetroWindow>
    </div>
  )
}

export function AuthView({ type, setType, setProfile, onBack, onComplete, sfx }) {
  const [name, setName] = useState('');
  const handleSubmit = (e) => { e.preventDefault(); playAudio('click', sfx); setProfile({ name: name || (type === 'login' ? 'ExistingUser' : 'NewUser'), emoji: '😊', petName: 'Peanut' }); onComplete(type === 'signup'); };
  return (
    <RetroWindow title={type === 'login' ? "secure_login.sys" : "new_account.sys"} onClose={onBack} className="w-full max-w-sm relative z-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
        <div className="text-center mb-4"><div className="w-16 h-16 rounded-full retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-2 retro-shadow-dark"><User size={24} /></div><h2 className="font-bold text-xl">{type === 'login' ? 'Welcome Back!' : 'Hello there!'}</h2></div>
        <div className="flex flex-col gap-1"><label className="text-sm font-bold opacity-70">display name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="What should we call you?" className="p-3 retro-border retro-bg-window focus:outline-none" /></div>
        <div className="flex flex-col gap-1"><label className="text-sm font-bold opacity-70">password</label><input type="password" required placeholder="••••••••" className="p-3 retro-border retro-bg-window focus:outline-none" /></div>
        <RetroButton type="submit" variant="primary" className="py-3 mt-4 text-lg">{type === 'login' ? 'access space' : 'continue'}</RetroButton>
        <p className="text-center text-xs mt-4 opacity-70">{type === 'login' ? "Don't have a space? " : "Already coupled up? "} <span className="font-bold underline cursor-pointer hover:text-[var(--primary)]" onClick={() => { playAudio('click', sfx); setType(type === 'login' ? 'signup' : 'login'); }}>{type === 'login' ? 'Sign up' : 'Log in'}</span></p>
      </form>
    </RetroWindow>
  );
}

export function HandshakeView({ partnerCode, onComplete, onBack, sfx }) {
  const [inputCode, setInputCode] = useState(''); const [connecting, setConnecting] = useState(false);
  const handleConnect = (e) => { e.preventDefault(); if(!inputCode) return; playAudio('click', sfx); setConnecting(true); setTimeout(() => { setConnecting(false); onComplete(); }, 2000); };
  if (connecting) return <RetroWindow title="pairing_protocol.exe" className="w-full max-w-md z-10 flex flex-col items-center justify-center p-8 text-center h-64" onClose={onBack}><div className="w-16 h-16 retro-bg-primary retro-border retro-shadow-dark flex items-center justify-center animate-spin mb-4"><Sparkles size={24} /></div><h2 className="text-xl font-bold mb-2">verifying connection...</h2></RetroWindow>;
  return (
    <RetroWindow title="partner_pairing.exe" onClose={onBack} className="w-full max-w-md z-10">
      <div className="flex flex-col items-center text-center py-4 gap-6">
        <div><h2 className="font-bold text-2xl mb-2">The Handshake 🤝</h2><p className="opacity-80 text-sm">To create a private space, link your accounts.</p></div>
        <div className="w-full retro-border p-4 retro-bg-window border-dashed"><p className="font-bold text-sm mb-2 opacity-70">1. send partner this code:</p><div className="bg-[var(--border)] text-[var(--bg-window)] p-3 font-bold text-2xl tracking-[0.2em] retro-shadow-primary select-all">{partnerCode}</div></div>
        <div className="font-bold opacity-50">- OR -</div>
        <form onSubmit={handleConnect} className="w-full retro-border p-4 retro-bg-accent retro-shadow-dark flex flex-col gap-3"><p className="font-bold text-sm opacity-70 text-left">2. enter partner's code:</p><div className="flex gap-2"><input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} placeholder="XXXX-XXX" className="flex-1 p-3 retro-border bg-white focus:outline-none font-bold tracking-widest uppercase" /><RetroButton type="submit" variant="white" className="px-6" disabled={!inputCode}>connect</RetroButton></div></form>
      </div>
    </RetroWindow>
  );
}
