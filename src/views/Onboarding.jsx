import React, { useState, useEffect } from 'react';
import { Heart, Mail, Send, Grid3X3, Sparkles, User, Lock, ArrowLeft, Loader, Check, Copy, Share2 } from 'lucide-react';
import { RetroButton, RetroWindow, useToast } from '../components/UI.jsx';
import { supabase } from '../lib/supabase.js';

/* ═══════════════════════════════════════════════════════
   LANDING PAGE — cute & animated with floating elements
   ═══════════════════════════════════════════════════════ */
export function LandingView({ onTryAttic, onSignIn }) {
  return (
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden mesh-bg scale-up-15">
      <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[5%] text-[var(--primary)] opacity-[0.08] animate-float"><Heart size={70} fill="currentColor" /></div>
        <div className="absolute top-[60%] right-[8%] text-[var(--primary)] opacity-[0.06] animate-float-delayed"><Heart size={45} fill="currentColor" /></div>
        <div className="absolute bottom-[15%] left-[45%] text-[var(--primary)] opacity-[0.04] animate-float"><Heart size={35} fill="currentColor" /></div>
        <div className="absolute top-[25%] right-[15%] text-[var(--secondary)] opacity-[0.1] animate-float-delayed"><Mail size={56} /></div>
        <div className="absolute bottom-[25%] left-[12%] text-[var(--secondary)] opacity-[0.07] animate-float"><Mail size={44} /></div>
        <div className="absolute bottom-[35%] right-[22%] text-[var(--primary)] opacity-[0.12] animate-float-delayed"><Send size={48} /></div>
        <div className="absolute top-[30%] left-[15%] text-[var(--primary)] opacity-[0.08] animate-float"><Send size={38} className="rotate-[-15deg]" /></div>
        <div className="absolute bottom-[10%] right-[35%] text-[var(--accent)] opacity-[0.06] animate-float"><Grid3X3 size={60} /></div>
        <div className="absolute top-[55%] left-[8%] text-[var(--secondary)] opacity-[0.05] animate-float"><Sparkles size={40} /></div>
      </div>

      <nav className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <span className="font-bold text-[10px] tracking-widest uppercase text-[#6b4423] opacity-30 select-none">●●●</span>
        <span className="font-bold text-[10px] tracking-widest uppercase text-[#6b4423] opacity-10 select-none">attic</span>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center pb-20">
        <div className="relative mb-12 sm:mb-16 transform-gpu hover:scale-105 transition-transform duration-500">
          <div className="absolute -inset-8 bg-[var(--primary)]/10 blur-[60px] rounded-full animate-pulse" />
          <img src="/attic-logo.png" alt="Attic Logo" className="w-[20rem] sm:w-[32rem] relative z-10 drop-shadow-[0_20px_50px_rgba(233,69,96,0.3)] animate-float"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          <div className="hidden relative z-10 flex-col items-center">
             <div className="text-8xl sm:text-9xl mb-4 filter drop-shadow-2xl">🏠</div>
             <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-[var(--text-main)] italic">ATTIC</h1>
          </div>
        </div>

        <div className="max-w-xl mx-auto space-y-8 sm:space-y-12">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-main)] leading-none uppercase">
              The Digital Sanctuary <br/> <span className="text-[var(--primary)]">For Distant Hearts</span>
            </h2>
            <p className="text-xs sm:text-sm font-bold opacity-60 max-w-sm mx-auto leading-relaxed">
              Sync your world. Share your silence. <br/> A tactile space built for long-distance lovers.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <RetroButton onClick={onTryAttic} className="w-64 py-4 sm:py-5 text-lg sm:text-xl relative overflow-hidden group shadow-2xl">
              <span className="relative z-10">Start Your Journey</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </RetroButton>
            <RetroButton variant="white" onClick={onSignIn} className="w-64 py-4 sm:py-5 text-lg sm:text-xl border-dashed opacity-80 hover:opacity-100 shadow-xl">
              Welcome Back
            </RetroButton>
          </div>
        </div>
      </main>

      <footer className="relative z-10 p-6 sm:p-10 text-center">
        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] opacity-30">
          Made with love, for the lovers <br/>
          By <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--primary)] transition-colors border-b border-current">bakarkhaniii</a>
        </p>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   AUTH VIEW — Login & Signup with 3D Depth
   ═══════════════════════════════════════════════════════ */
export function AuthView({ mode, onAuthSuccess, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const addToast = useToast();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ 
            email, password, options: { data: { name } } 
        });
        if (error) throw error;
        addToast("Welcome to Attic! Check your email to verify.", "success");
        onAuthSuccess({ session: data.session, name });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess({ session: data.session });
      }
    } catch (err) { addToast(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 mesh-bg">
      <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />
      <RetroWindow title={`${mode === 'signup' ? 'register' : 'login'}.exe`} className="w-full max-w-[440px] shadow-2xl scale-up-15" onClose={onBack}>
        <form onSubmit={handleAuth} className="flex flex-col gap-6 py-4">
          <div className="text-center mb-4">
            <h2 className="text-3xl font-black italic tracking-tighter text-[var(--primary)]">{mode === 'signup' ? 'JOIN ATTIC' : 'WELCOME BACK'}</h2>
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Authorized Access Only</p>
          </div>

          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase opacity-60 ml-1">Couple Display Name</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                <input required type="text" placeholder="e.g. Romeo & Juliet" value={name} onChange={e => setName(e.target.value)} className="w-full pl-12 pr-4 py-4 retro-border focus:bg-[var(--accent)]/10 outline-none font-bold" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase opacity-60 ml-1">Email Terminal</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
              <input required type="email" placeholder="you@love.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 retro-border focus:bg-[var(--accent)]/10 outline-none font-bold" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase opacity-60 ml-1">Security Key</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
              <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 retro-border focus:bg-[var(--accent)]/10 outline-none font-bold" />
            </div>
          </div>

          <RetroButton type="submit" disabled={loading} className="py-5 text-xl mt-4">
            {loading ? <Loader className="animate-spin" /> : mode === 'signup' ? 'Create Sanctuary' : 'Enter Attic'}
          </RetroButton>

          <button type="button" onClick={onBack} className="text-[10px] font-bold opacity-40 hover:opacity-100 flex items-center justify-center gap-2 uppercase tracking-widest mt-2">
            <ArrowLeft size={12} /> Return to landing
          </button>
        </form>
      </RetroWindow>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HANDSHAKE VIEW — Pairing Couples with Glass Depth
   ═══════════════════════════════════════════════════════ */
export function HandshakeView({ session, onPaired, onLogout }) {
  const [pairingCode, setPairingCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const addToast = useToast();

  useEffect(() => {
    if (session?.user?.id) {
      setPairingCode(session.user.id.slice(0, 8).toUpperCase());
      const checkPairing = setInterval(async () => {
        const { data } = await supabase.rpc('get_my_room');
        if (data && data.is_paired) {
          clearInterval(checkPairing);
          onPaired(data.id);
        }
      }, 3000);
      return () => clearInterval(checkPairing);
    }
  }, [session, onPaired]);

  const handlePair = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.rpc('pair_with_code', { target_code: partnerCode });
      if (error) throw error;
      addToast("Pairing request sent!", "success");
    } catch (err) { addToast(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 mesh-bg">
      <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />
      
      <RetroWindow title="handshake_protocol.exe" className="w-full max-w-[440px] shadow-2xl scale-up-15">
        <div className="flex flex-col gap-8 py-4">
          <div className="text-center">
             <div className="w-16 h-16 bg-[var(--primary)]/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Heart size={32} className="text-[var(--primary)]" fill="currentColor" />
             </div>
             <h2 className="text-2xl font-black italic tracking-tighter">WAITING FOR CONNECTION</h2>
             <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Establishing Secure Couple-Sync</p>
          </div>

          <div className="bg-[var(--accent)]/20 retro-border p-6 text-center space-y-3 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
             <label className="text-[10px] font-black uppercase opacity-60">Your Unique Pairing ID</label>
             <div className="text-4xl font-black tracking-tighter text-[var(--primary)] select-all">{pairingCode}</div>
             <button onClick={() => { navigator.clipboard.writeText(pairingCode); addToast("Code copied!", "success"); }} className="text-[9px] font-black uppercase text-[var(--primary)] hover:opacity-70 flex items-center justify-center gap-1 mx-auto border-b border-current">
                <Copy size={10} /> Copy Code
             </button>
          </div>

          <form onSubmit={handlePair} className="space-y-4">
             <label className="text-[10px] font-black uppercase opacity-60 ml-1">Enter Partner's ID</label>
             <div className="flex gap-2">
                <input required type="text" placeholder="XXXXXXX" value={partnerCode} onChange={e => setPartnerCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-4 retro-border focus:bg-[var(--accent)]/10 outline-none font-black text-xl text-center tracking-widest" />
                <RetroButton type="submit" disabled={loading} className="w-16 h-16 shrink-0">
                   {loading ? <Loader className="animate-spin" /> : <Check />}
                </RetroButton>
             </div>
          </form>

          <div className="border-t-2 border-dashed border-[var(--border)] pt-6 flex flex-col items-center gap-4">
             <p className="text-[10px] font-bold opacity-40 uppercase max-w-[240px] text-center italic">Send your ID to your partner. Once they enter it, the Sanctuary will unlock.</p>
             <RetroButton variant="white" onClick={onLogout} className="py-2 px-8 text-[10px] opacity-60 hover:opacity-100">Terminate Session</RetroButton>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
