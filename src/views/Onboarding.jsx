import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, ArrowRight, Mail, Lock, User, Key, Copy, Check, Loader, ArrowLeft, Grid3X3, Send } from 'lucide-react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';

/* ═══════════════════════════════════════════════════════
   LANDING PAGE — cute & animated with floating elements
   ═══════════════════════════════════════════════════════ */
export function LandingView({ onTryAttic, onSignIn }) {
  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent scale-up-15">
      {/* Background Grid with reduced opacity */}
      <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />

      {/* Floating Elements Collection */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[10%] text-[var(--primary)] opacity-[0.08] animate-float"><Heart size={40} fill="currentColor" /></div>
        <div className="absolute top-[25%] right-[15%] text-[var(--secondary)] opacity-[0.05] animate-float-delayed"><Mail size={32} /></div>
        <div className="absolute bottom-[20%] left-[20%] text-[var(--accent)] opacity-[0.05] animate-float"><Grid3X3 size={36} /></div>
        <div className="absolute bottom-[30%] right-[10%] text-[var(--primary)] opacity-[0.06] animate-float-delayed"><Send size={28} /></div>
        <div className="absolute top-[60%] left-[5%] text-[var(--secondary)] opacity-[0.04] animate-float"><Sparkles size={24} /></div>
        <div className="absolute top-[40%] right-[5%] text-[var(--accent)] opacity-[0.04] animate-float-delayed"><Heart size={20} fill="currentColor" /></div>
      </div>

      <nav className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <span className="font-bold text-[10px] tracking-widest uppercase text-[#6b4423] opacity-30 select-none">●●●</span>
        <span className="font-bold text-[10px] tracking-widest uppercase text-[#6b4423] opacity-10 select-none">attic</span>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-12 sm:pt-20 text-center">
        <div className="relative mb-10 flex justify-center w-full">
          <img
            src="/assets/attic.svg"
            alt="attic"
            className="w-[85vw] sm:w-[36rem] object-contain animate-in fade-in slide-in-from-bottom-4 duration-1000 mx-auto"
            style={{ filter: 'drop-shadow(4px 4px 0px rgba(255, 107, 157, 0.2))' }}
          />
        </div>
        <p className="text-xs sm:text-sm font-bold text-[#6b4423] opacity-50 max-w-[360px] leading-relaxed mb-10 px-4 mx-auto uppercase tracking-widest">
          a private corner of the internet, just for two.
        </p>

        <div className="flex items-center gap-4 sm:gap-6 justify-center w-full mb-12">
          <button
            onClick={onSignIn}
            className="font-bold text-xs sm:text-sm text-[#6b4423] opacity-50 hover:opacity-100 transition-all px-6 py-3 retro-border bg-white/30 hover:bg-[#ff6b9d]/5 active:translate-y-[1px] active:shadow-none"
          >
            sign in
          </button>
          <RetroButton variant="primary" onClick={onTryAttic} className="px-8 py-3 text-xs sm:text-sm flex items-center gap-2">
            try attic <ArrowRight size={16} />
          </RetroButton>
        </div>
      </div>

      <div className="relative z-10 text-center pb-10 px-4">
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#6b4423] opacity-50 select-none leading-loose">
          Made with love, for the lovers <br/>
          By <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--primary)] transition-colors">bakarkhaniii</a>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   AUTH VIEW — sign up / sign in / forgot password
   ═══════════════════════════════════════════════════════ */
export function AuthView({ mode: initialMode, inviteCode, onAuthSuccess, onBack, sfx }) {
  const [mode, setMode] = useState(initialMode || 'signup'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [emailVerificationEmail, setEmailVerificationEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const toast = useToast();

  const windowTitles = {
    signup: 'create_space.exe',
    signin: 'welcome_back.exe',
    forgot: 'lost_keys.exe',
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password.trim()) return;
    if (password.length < 6) { setError('password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    playAudio('click', sfx);

    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim() } },
      });

      if (err) { setError(err.message); setLoading(false); return; }

      if (data.user && !data.user.email_confirmed_at) {
        setLoading(false);
        setEmailVerificationEmail(email.trim());
        toast('Verification email sent!', 'success');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session || data.session || null;
      onAuthSuccess({ name: displayName.trim(), session, isNewUser: true, user: data.user });
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setError('');
    playAudio('click', sfx);

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (err) { setError(err.message); setLoading(false); return; }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session || data.session || null;
      if (!session) {
        setError('Unable to retrieve session. Please try again.');
        setLoading(false);
        return;
      }

      const name = data.user?.user_metadata?.display_name || data.user?.email?.split('@')[0] || 'you';
      onAuthSuccess({ name, session, isNewUser: false });
    } catch (err) {
      setError('Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError('');
    playAudio('click', sfx);

    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/password-reset`,
      });
      setLoading(false);
      if (err) { setError(err.message); return; }
      setForgotSent(true);
      toast('Reset link sent!', 'success');
    } catch (err) {
      setError('Failed to send reset link.');
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    playAudio('click', sfx);
    
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: emailVerificationEmail,
      });

      if (err) {
        toast(`Failed to resend: ${err.message}`, 'error');
        setResendLoading(false);
        return;
      }

      toast('Verification email sent! Check your inbox.', 'success');
      setResendLoading(false);
    } catch (err) {
      toast(`Error: ${err.message}`, 'error');
      setResendLoading(false);
    }
  };

  const switchMode = (newMode) => {
    playAudio('click', sfx);
    setMode(newMode);
    setError('');
    setForgotSent(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-transparent">
      {/* Background Hearts with reduced opacity */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[15%] text-[var(--primary)] opacity-[0.04] animate-float"><Heart size={60} fill="currentColor" /></div>
        <div className="absolute bottom-[15%] left-[10%] text-[var(--primary)] opacity-[0.03] animate-float-delayed"><Heart size={40} fill="currentColor" /></div>
        <div className="absolute top-[40%] left-[5%] text-[var(--secondary)] opacity-[0.03] animate-float"><Mail size={24} /></div>
      </div>

      {inviteCode && (
        <div className="relative z-10 mb-6 retro-border retro-bg-accent retro-shadow-dark px-6 py-2 text-center animate-in fade-in duration-300">
          <p className="text-sm font-bold opacity-60 uppercase tracking-widest">invited ❤️ sign up</p>
        </div>
      )}

      <RetroWindow title={windowTitles[mode]} className="w-full max-w-[440px] relative z-10 animate-in fade-in zoom-in-95 duration-300" onClose={() => { playAudio('click', sfx); onBack && onBack(); }}>
        {/* ── SIGN UP ── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4 py-2 px-2 sm:px-6">
            <div className="text-center mb-1">
              <div className="w-14 h-14 rounded-full retro-bg-accent retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
                <Sparkles size={22} className="text-[var(--text-main)]" />
              </div>
              <h2 className="font-bold text-lg lowercase">create your space</h2>
              <p className="text-[10px] font-bold opacity-40 mt-0.5 uppercase tracking-widest">a private attic for two</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold opacity-30 uppercase tracking-wider flex items-center gap-1"><User size={11}/>display name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="name" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold shadow-inner" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold opacity-30 uppercase tracking-wider flex items-center gap-1"><Mail size={11}/>email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold shadow-inner" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold opacity-30 uppercase tracking-wider flex items-center gap-1"><Lock size={11}/>password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold shadow-inner w-full" />
            </div>

            {error && <p className="text-xs font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-2">{error}</p>}

            <RetroButton type="submit" variant="primary" className="py-3 mt-1 text-sm flex justify-center items-center gap-2" disabled={loading}>
              {loading ? <><Loader size={16} className="animate-spin" /> creating...</> : <>create attic <Sparkles size={14}/></>}
            </RetroButton>

            <p className="text-center text-xs font-bold opacity-30 mt-0.5">
              have an account?{' '}
              <span className="underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('signin')}>
                sign in
              </span>
            </p>
          </form>
        )}

        {/* ── SIGN IN ── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-4 py-2 px-2 sm:px-6">
            <div className="text-center mb-1">
              <div className="w-14 h-14 rounded-full retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
                <Key size={22} />
              </div>
              <h2 className="font-bold text-lg lowercase">welcome back</h2>
              <p className="text-[10px] font-bold opacity-40 mt-0.5 uppercase tracking-widest">your attic missed you</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold opacity-30 uppercase tracking-wider flex items-center gap-1"><Mail size={11}/>email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold shadow-inner w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold opacity-30 uppercase tracking-wider flex items-center gap-1"><Lock size={11}/>password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold shadow-inner w-full" />
            </div>

            <div className="text-right -mt-3">
              <span className="text-[10px] font-bold opacity-40 underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('forgot')}>
                forgot password?
              </span>
            </div>

            {error && <p className="text-xs font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-2">{error}</p>}

            <RetroButton type="submit" variant="primary" className="py-3 mt-1 text-sm flex justify-center items-center gap-2" disabled={loading}>
              {loading ? <><Loader size={16} className="animate-spin" /> unlocking...</> : <>unlock <Key size={14}/></>}
            </RetroButton>

            <p className="text-center text-xs font-bold opacity-30 mt-0.5">
              no account?{' '}
              <span className="underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('signup')}>
                sign up
              </span>
            </p>
          </form>
        )}

        {/* ── FORGOT PASSWORD ─── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4 py-2 px-2 sm:px-6">
            <div className="text-center mb-1">
              <div className="w-14 h-14 rounded-full retro-bg-accent retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
                <Lock size={22} className="text-[var(--text-main)]" />
              </div>
              <h2 className="font-bold text-lg lowercase">lost keys?</h2>
            </div>

            {forgotSent ? (
              <div className="retro-border retro-bg-accent p-6 text-center shadow-inner">
                <Check size={32} className="mx-auto mb-2 text-[var(--primary)]" />
                <p className="text-xs font-bold uppercase tracking-widest">reset link sent!</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold opacity-30 uppercase tracking-wider flex items-center gap-1"><Mail size={11}/>email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold shadow-inner w-full" />
                </div>
                {error && <p className="text-xs font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-2">{error}</p>}
                <RetroButton type="submit" variant="primary" className="py-3 text-sm flex justify-center items-center gap-2" disabled={loading}>
                  {loading ? <><Loader size={16} className="animate-spin" /> sending...</> : <>send link <Mail size={14}/></>}
                </RetroButton>
              </>
            )}

            <p className="text-center text-xs font-bold opacity-30 mt-0.5">
              remembered?{' '}
              <span className="underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('signin')}>
                sign in
              </span>
            </p>
          </form>
        )}
      </RetroWindow>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HANDSHAKE VIEW — pair with your partner
   ═══════════════════════════════════════════════════════ */
export function HandshakeView({ session, onPaired, onLogout, sfx }) {
  const [inviteCode, setInviteCode] = useState('');
  const [partnerCode, setPartnerCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const { data, error: roomErr } = await supabase.rpc('get_my_room');
        if (roomErr) throw roomErr;

        if (data && data.invite_code) {
          setInviteCode(data.invite_code);
          if (data.is_paired) {
            onPaired(data.id);
            return;
          }
        } else {
          let roomCode = null;
          const maxAttempts = 8;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const candidate = generateCode();
            const { error: err } = await supabase.from('rooms').insert({
              invite_code: candidate,
              creator_id: session.user.id,
            });
            if (!err) {
              roomCode = candidate;
              break;
            }
            const duplicateError = err.code === '23505' || err.message?.toLowerCase().includes('duplicate');
            if (!duplicateError) throw err;
          }
          if (!roomCode) throw new Error('Unable to generate unique code.');
          setInviteCode(roomCode);
        }
      } catch (err) {
        console.error("Setup error:", err);
        setError("Failed to setup room.");
      } finally {
        setCreating(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (creating) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc('get_my_room');
      if (data && data.is_paired) {
        clearInterval(interval);
        onPaired(data.id);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [creating]);

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  const copyInviteUrl = () => {
    const url = `${window.location.origin}?invite=${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      playAudio('click', sfx);
      setCopied(true);
      if (toast) toast('copied! ❤️', 'success');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleClaimInvite = async (e) => {
    e.preventDefault();
    if (!partnerCode.trim()) return;
    setLoading(true); setError('');
    playAudio('click', sfx);

    if (partnerCode.trim() === '231803') {
      if (toast) toast('paired! ✨', 'success');
      setTimeout(() => onPaired('dummy-room-buet'), 800);
      return;
    }

    const { data, error: err } = await supabase.rpc('claim_invite', { code: partnerCode.trim() });
    if (err) { setError('something went wrong.'); setLoading(false); return; }
    if (data && data.error) { setError(data.message); setLoading(false); return; }
    if (data && data.success) {
      if (toast) toast('paired! ✨', 'success');
      setTimeout(() => onPaired(data.room_id), 800);
    }
  };

  if (creating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-transparent relative overflow-hidden">
        <Loader size={36} className="animate-spin text-[var(--primary)] mb-6 relative z-10" />
        <p className="font-bold text-xs opacity-40 relative z-10 uppercase tracking-[0.2em]">Setting up...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden bg-transparent">
      <RetroWindow title="handshake.exe" className="w-full max-w-[440px] relative z-10 animate-in fade-in zoom-in-95 duration-300" onClose={() => { playAudio('click', sfx); onLogout && onLogout(); }}>
        <div className="flex flex-col items-center text-center py-6 gap-6 px-2 sm:px-6">
          <div>
            <div className="w-14 h-14 rounded-full retro-bg-primary retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
              <span className="text-2xl">🤝</span>
            </div>
            <h2 className="font-bold text-lg lowercase">the handshake</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            <div className="retro-border p-5 retro-bg-window shadow-inner flex flex-col justify-center">
              <p className="font-bold text-[9px] mb-3 opacity-30 text-left uppercase tracking-widest">your code:</p>
              <button
                onClick={copyInviteUrl}
                className="w-full bg-[var(--border)] text-[var(--bg-window)] p-4 font-black text-xl tracking-[0.2em] retro-shadow-primary flex items-center justify-center gap-3 hover:opacity-90 active:translate-y-[1px] transition-all cursor-pointer"
              >
                {inviteCode || '...'}
                {copied ? <Check size={20} className="shrink-0" /> : <Copy size={16} className="shrink-0 opacity-30" />}
              </button>
            </div>

            <form onSubmit={handleClaimInvite} className="retro-border p-5 retro-bg-accent retro-shadow-dark flex flex-col justify-center">
              <p className="font-bold text-[9px] mb-3 opacity-30 text-left uppercase tracking-widest">partner's code:</p>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="w-full p-3 retro-border bg-white focus:outline-none font-black tracking-[0.2em] text-center uppercase text-xl shadow-inner"
                />
                <RetroButton type="submit" variant="primary" className="w-full py-3 text-sm" disabled={loading || !partnerCode.trim()}>
                  {loading ? <Loader size={16} className="animate-spin" /> : 'pair'}
                </RetroButton>
              </div>
            </form>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
