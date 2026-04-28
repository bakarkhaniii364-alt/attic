import React, { useState, useEffect } from 'react';
import { Heart, Mail, Send, Grid3X3, Sparkle, User, Lock, ArrowLeft, Loader, Check, Copy, Share2 } from 'lucide-react';
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
        <div className="absolute top-[10%] left-[5%] text-primary opacity-[0.08] animate-float"><Heart size={70} fill="currentColor" /></div>
        <div className="absolute top-[60%] right-[8%] text-primary opacity-[0.06] animate-float-delayed"><Heart size={45} fill="currentColor" /></div>
        <div className="absolute bottom-[15%] left-[45%] text-primary opacity-[0.04] animate-float"><Heart size={35} fill="currentColor" /></div>
        <div className="absolute top-[25%] right-[15%] text-secondary opacity-[0.1] animate-float-delayed"><Mail size={56} /></div>
        <div className="absolute bottom-[25%] left-[12%] text-secondary opacity-[0.07] animate-float"><Mail size={44} /></div>
        <div className="absolute bottom-[35%] right-[22%] text-primary opacity-[0.12] animate-float-delayed"><Send size={48} /></div>
        <div className="absolute top-[30%] left-[15%] text-primary opacity-[0.08] animate-float"><Send size={38} className="rotate-[-15deg]" /></div>
        <div className="absolute bottom-[10%] right-[35%] text-accent opacity-[0.06] animate-float"><Grid3X3 size={60} /></div>
        <div className="absolute top-[55%] left-[8%] text-secondary opacity-[0.05] animate-float"><Sparkle size={40} /></div>
      </div>

      <nav className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <span className="font-bold text-[10px] tracking-widest uppercase text-[#6b4423] opacity-30 select-none">●●●</span>
        <span className="font-bold text-[10px] tracking-widest uppercase text-[#6b4423] opacity-10 select-none">attic</span>
      </nav>

      <main style={{ transform: 'translateY(-6.25vh)' }} className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center overflow-hidden">
        <div className="relative mb-4 sm:mb-6 transform-gpu hover:scale-105 transition-transform duration-500 flex items-center justify-center">
          <div className="absolute -inset-10 bg-primary/10 blur-[60px] rounded-full animate-pulse" />
          <img src="/assets/attic.svg" alt="Attic Logo" className="w-[22rem] sm:w-[30rem] relative z-10 drop-shadow-[0_20px_50px_rgba(233,69,96,0.3)] animate-float" />
        </div>

        <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
          <div className="space-y-2 -mt-2">
            <p className="text-xs sm:text-base font-mono opacity-60 max-w-sm mx-auto leading-relaxed">
              A corner of the internet, <br/> <span className="text-primary font-bold">just for two</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <RetroButton onClick={onTryAttic} className="w-56 py-3 sm:py-4 text-base sm:text-lg relative overflow-hidden group shadow-2xl">
              <span className="relative z-10">enter attic</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </RetroButton>
            <RetroButton variant="white" onClick={onSignIn} className="w-56 py-3 sm:py-4 text-base sm:text-lg border-dashed opacity-80 hover:opacity-100 shadow-xl">
              start new journey
            </RetroButton>
          </div>
        </div>
      </main>

      <footer className="absolute bottom-4 left-0 right-0 z-10 text-center">
        <p className="text-[10px] sm:text-xs font-black tracking-[0.2em] opacity-30">
          Made with love, for the lovers by <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors border-b border-current">bakarkhaniii</a>
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
  const [termsAgreed, setTermsAgreed] = useState(false);
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
        // Ensure user metadata persisted (best-effort) and reflect in UI
        try { await supabase.auth.updateUser({ data: { name } }); } catch(e) { /* ignore */ }
        addToast("Welcome to Attic! Check your email to verify.", "success");
        onAuthSuccess({ session: data.session, name, mode: 'signup' });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // read metadata and forward display name for immediate UI update
        const metaName = data?.user?.user_metadata?.name;
        onAuthSuccess({ session: data.session, name: metaName, mode: 'signin' });
      }
    } catch (err) { addToast(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 mesh-bg">
      <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />
      <RetroWindow title={`${mode === 'signup' ? 'join attic' : 'welcome back'}.exe`} className="w-full max-w-[440px] shadow-2xl scale-up-15" onClose={onBack}>
        <form onSubmit={handleAuth} className="flex flex-col gap-4 py-4">
          <div className="flex items-center gap-3 mb-6 border-b-2 border-dashed border-border pb-4">
            <RetroButton variant="white" onClick={onBack} className="p-2 rounded-full border-none shadow-none hover:bg-black/5"><ArrowLeft size={20} /></RetroButton>
            <h2 className="text-2xl font-black tracking-tight text-primary lowercase">{mode === 'signup' ? 'join attic' : 'welcome back'}</h2>
          </div>

          {mode === 'signup' ? (
            <>
              <div className="space-y-1">
                <label className="text-[12px] font-mono opacity-60 ml-1 lowercase">display name</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                  <input required type="text" placeholder="alex" value={name} onChange={e => setName(e.target.value)} className="w-full pl-12 pr-4 py-3 retro-border focus:bg-accent/10 outline-none font-bold" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-mono opacity-60 ml-1 lowercase">email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                  <input required type="email" placeholder="you@love.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3 retro-border focus:bg-accent/10 outline-none font-bold" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-mono opacity-60 ml-1 lowercase">password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                  <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3 retro-border focus:bg-accent/10 outline-none font-bold" />
                </div>
                {mode === 'signup' && (
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      required
                      checked={termsAgreed}
                      onChange={e => setTermsAgreed(e.target.checked)}
                      className="mt-1 w-4 h-4 border-2 border-border accent-primary"
                    />
                    <span className="text-[10px] leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                      I agree to the <a href="/legal" target="_blank" className="text-primary underline">Terms of Service</a> and acknowledge that deleting a room permanently deletes all data for both partners.
                    </span>
                  </label>
                )}
              </div>

              <RetroButton type="submit" disabled={loading || !termsAgreed} className="py-3 text-lg mt-2">
                {loading ? <Loader className="animate-spin" /> : 'create account'}
              </RetroButton>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[12px] font-mono opacity-60 ml-1 lowercase">email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                  <input required type="email" placeholder="you@love.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3 retro-border focus:bg-accent/10 outline-none font-bold" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-mono opacity-60 ml-1 lowercase">password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                  <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3 retro-border focus:bg-accent/10 outline-none font-bold" />
                </div>
                <div className="text-left mt-1">
                  <a href="/password-reset" className="text-xs opacity-70 lowercase">forgot password?</a>
                </div>
              </div>

              <RetroButton type="submit" disabled={loading} className="py-3 text-lg mt-2">
                {loading ? <Loader className="animate-spin" /> : 'enter attic'}
              </RetroButton>
            </>
          )}
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
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
             <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Heart size={32} className="text-primary" fill="currentColor" />
             </div>
             <p className="font-bold opacity-60 text-sm">Send this code to your partner to pair up!</p>
          </div>

          <div className="bg-accent/20 border-2 border-border p-6 text-center space-y-3 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-10 rotate-12"><Share2 size={48} /></div>
             <div className="text-xs font-black uppercase tracking-widest opacity-40">Your Pairing Code</div>
             <div className="text-4xl font-black tracking-tighter text-primary select-all">{pairingCode}</div>
             <button onClick={() => { navigator.clipboard.writeText(pairingCode); addToast("Code copied!", "success"); }} className="text-[9px] font-black uppercase text-primary hover:opacity-70 flex items-center justify-center gap-1 mx-auto border-b border-current">
                <Copy size={10} /> copy code
             </button>
          </div>

          <form onSubmit={handlePair}>
             <div className="space-y-3">
                <p className="font-bold opacity-60 text-sm">...or enter your partner's code:</p>
                <div className="flex gap-2">
                   <input required type="text" placeholder="XXXXXXX" value={partnerCode} onChange={e => setPartnerCode(e.target.value.toUpperCase())} className="flex-1 px-4 py-4 border-2 border-border bg-window text-main-text focus:bg-accent/10 outline-none font-black text-xl text-center tracking-widest" />
                   <RetroButton type="submit" disabled={loading} className="w-16 h-16 shrink-0">
                      {loading ? <Loader className="animate-spin" /> : <Check />}
                   </RetroButton>
                </div>
             </div>
          </form>

             <p className="text-[10px] font-bold opacity-40 uppercase max-w-[240px] text-center">Send your ID to your partner. Once they enter it, the Sanctuary will unlock.</p>
             <RetroButton variant="white" onClick={onLogout} className="py-2 px-8 text-[10px] opacity-60 hover:opacity-100">Terminate Session</RetroButton>
          </div>
      </RetroWindow>
    </div>
  );
}
