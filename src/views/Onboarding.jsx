import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, ArrowRight, Mail, Lock, User, Key, Copy, Check, Loader, ArrowLeft } from 'lucide-react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';

/* ═══════════════════════════════════════════════════════
   LANDING PAGE — cute & animated with paper airplane
   ═══════════════════════════════════════════════════════ */
export function LandingView({ onTryAttic, onSignIn }) {
  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-gradient-to-br from-[#fef3e2] via-[#fde8d8] to-[#fce3ce]">
      {/* Background Hearts */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-5 text-[#ff6b9d] opacity-20 text-4xl animate-pulse">♥</div>
        <div className="absolute top-32 right-10 text-[#ff6b9d] opacity-15 text-3xl animate-pulse" style={{animationDelay: '1s'}}>♥</div>
        <div className="absolute bottom-20 left-1/3 text-[#ff6b9d] opacity-10 text-5xl animate-pulse" style={{animationDelay: '2s'}}>♥</div>
      </div>

      <nav className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <span className="font-bold text-xs tracking-widest uppercase text-[#6b4423] opacity-60 select-none">●●●</span>
        <span className="font-bold text-xs tracking-widest uppercase text-[#6b4423] opacity-40 select-none">attic</span>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <div className="relative mb-10">
          <img
            src="/assets/attic.svg"
            alt="attic"
            className="w-[90vw] max-w-[700px] object-contain animate-in fade-in slide-in-from-bottom-4 duration-1000"
            style={{ filter: 'drop-shadow(8px 8px 0px rgba(255, 107, 157, 0.4))' }}
          />
        </div>
        <p className="text-base sm:text-xl font-bold text-[#6b4423] opacity-70 text-center max-w-[600px] leading-relaxed mb-12 px-4">
          a private corner of the internet, just for two.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full max-w-[600px] px-4">
          <button
            onClick={onSignIn}
            className="w-full sm:w-1/2 font-bold text-base sm:text-lg text-[#6b4423] opacity-70 hover:opacity-100 transition-all px-8 py-4 retro-border bg-white/60 hover:bg-[#ff6b9d]/10 active:translate-y-[2px] active:shadow-none retro-shadow-dark"
          >
            sign in
          </button>
          <RetroButton variant="primary" onClick={onTryAttic} className="w-full sm:w-1/2 px-8 py-4 text-base sm:text-lg flex items-center justify-center gap-2">
            try attic <ArrowRight size={22} />
          </RetroButton>
        </div>
      </div>

      <div className="relative z-10 text-center pb-8">
        <p className="text-[10px] sm:text-xs font-bold tracking-[0.4em] uppercase text-[#6b4423] opacity-30 select-none">
          made with ❤️ for lovers
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
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-12 relative overflow-hidden bg-[var(--bg-main)]">
      {/* floating hearts */}
      <div className="absolute top-[10%] right-[15%] text-[var(--primary)] opacity-[0.08] animate-float pointer-events-none">
        <Heart size={80} fill="currentColor" />
      </div>
      <div className="absolute bottom-[15%] left-[10%] text-[var(--primary)] opacity-[0.06] animate-float-delayed pointer-events-none">
        <Heart size={60} fill="currentColor" />
      </div>

      {inviteCode && (
        <div className="relative z-10 mb-8 retro-border retro-bg-accent retro-shadow-dark px-8 py-4 text-center animate-in fade-in duration-300">
          <p className="text-base font-bold opacity-70 uppercase tracking-widest">you've been invited! sign up ❤️</p>
        </div>
      )}

      <RetroWindow title={windowTitles[mode]} className="w-full max-w-[800px] relative z-10 animate-in fade-in zoom-in-95 duration-300" onClose={() => { playAudio('click', sfx); onBack && onBack(); }}>
        {/* ── SIGN UP ── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-8 py-6 px-4 sm:px-10">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full retro-bg-accent retro-border mx-auto flex items-center justify-center mb-4 retro-shadow-dark">
                <Sparkles size={32} className="text-[var(--text-main)]" />
              </div>
              <h2 className="font-bold text-3xl lowercase">create your space</h2>
              <p className="text-base font-bold opacity-50 mt-2">a private attic for you and your person</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold opacity-60 flex items-center gap-1 uppercase tracking-wider"><User size={14}/>display name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="what should we call you?" className="p-5 retro-border retro-bg-window focus:outline-none text-lg font-bold shadow-inner" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold opacity-60 flex items-center gap-1 uppercase tracking-wider"><Mail size={14}/>email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-5 retro-border retro-bg-window focus:outline-none text-lg font-bold shadow-inner" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1 uppercase tracking-wider"><Lock size={14}/>password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="p-5 retro-border retro-bg-window focus:outline-none text-lg font-bold shadow-inner w-full" />
            </div>

            {error && <p className="text-base font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-4">{error}</p>}

            <RetroButton type="submit" variant="primary" className="py-5 mt-2 text-xl flex justify-center items-center gap-3" disabled={loading}>
              {loading ? <><Loader size={24} className="animate-spin" /> creating...</> : <>create my attic <Sparkles size={22}/></>}
            </RetroButton>

            <p className="text-center text-base font-bold opacity-50 mt-2">
              already have an account?{' '}
              <span className="underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('signin')}>
                sign in
              </span>
            </p>
          </form>
        )}

        {/* ── SIGN IN ── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-8 py-6 px-4 sm:px-10">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-4 retro-shadow-dark">
                <Key size={32} />
              </div>
              <h2 className="font-bold text-3xl lowercase">welcome back</h2>
              <p className="text-base font-bold opacity-50 mt-2">your attic missed you</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1 uppercase tracking-wider"><Mail size={14}/>email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-5 retro-border retro-bg-window focus:outline-none text-lg font-bold shadow-inner w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1 uppercase tracking-wider"><Lock size={14}/>password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="p-5 retro-border retro-bg-window focus:outline-none text-lg font-bold shadow-inner w-full" />
            </div>

            <div className="text-right -mt-6">
              <span className="text-sm font-bold opacity-40 underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('forgot')}>
                forgot password?
              </span>
            </div>

            {error && <p className="text-base font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-4">{error}</p>}

            <RetroButton type="submit" variant="primary" className="py-5 mt-2 text-xl flex justify-center items-center gap-3" disabled={loading}>
              {loading ? <><Loader size={24} className="animate-spin" /> unlocking...</> : <>unlock attic <Key size={22}/></>}
            </RetroButton>

            <p className="text-center text-base font-bold opacity-50 mt-2">
              don't have an account?{' '}
              <span className="underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('signup')}>
                sign up
              </span>
            </p>
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="flex flex-col gap-8 py-6 px-4 sm:px-10">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full retro-bg-accent retro-border mx-auto flex items-center justify-center mb-4 retro-shadow-dark">
                <Lock size={32} className="text-[var(--text-main)]" />
              </div>
              <h2 className="font-bold text-3xl lowercase">lost your keys?</h2>
              <p className="text-sm font-bold opacity-50 mt-2 uppercase tracking-widest">we'll send a reset link</p>
            </div>

            {forgotSent ? (
              <div className="retro-border retro-bg-accent p-8 text-center shadow-inner">
                <Check size={48} className="mx-auto mb-4 text-[var(--primary)]" />
                <p className="text-xl font-bold">reset link sent!</p>
                <p className="text-base font-bold opacity-50 mt-2">check your email inbox</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold opacity-60 flex items-center gap-1 uppercase tracking-wider"><Mail size={14}/>email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-5 retro-border retro-bg-window focus:outline-none text-lg font-bold shadow-inner w-full" />
                </div>
                {error && <p className="text-base font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-4">{error}</p>}
                <RetroButton type="submit" variant="primary" className="py-5 text-xl flex justify-center items-center gap-3" disabled={loading}>
                  {loading ? <><Loader size={24} className="animate-spin" /> sending...</> : <>send reset link <Mail size={22}/></>}
                </RetroButton>
              </>
            )}

            <p className="text-center text-base font-bold opacity-50 mt-2">
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
          if (!roomCode) throw new Error('Unable to generate a unique invite code. Please try again.');
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
      if (toast) toast('invite link copied! ❤️', 'success');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleClaimInvite = async (e) => {
    e.preventDefault();
    if (!partnerCode.trim()) return;
    setLoading(true); setError('');
    playAudio('click', sfx);

    if (partnerCode.trim() === '231803') {
      if (toast) toast('paired with buet! ✨', 'success');
      setTimeout(() => onPaired('dummy-room-buet'), 800);
      return;
    }

    const { data, error: err } = await supabase.rpc('claim_invite', { code: partnerCode.trim() });
    if (err) { setError('something went wrong.'); setLoading(false); return; }
    if (data && data.error) { setError(data.message); setLoading(false); return; }
    if (data && data.success) {
      if (toast) toast('paired! entering your attic... ✨', 'success');
      setTimeout(() => onPaired(data.room_id), 800);
    }
  };

  if (creating) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--bg-main)] relative overflow-hidden">
        <Loader size={64} className="animate-spin text-[var(--primary)] mb-8 relative z-10" />
        <p className="font-bold text-xl opacity-60 relative z-10 uppercase tracking-[0.2em]">setting up your attic...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden bg-[var(--bg-main)]">
      <RetroWindow title="the_handshake.exe" className="w-full max-w-[800px] relative z-10 animate-in fade-in zoom-in-95 duration-300" onClose={() => { playAudio('click', sfx); onLogout && onLogout(); }}>
        <div className="flex flex-col items-center text-center py-10 gap-10 px-4 sm:px-10">
          <div>
            <div className="w-24 h-24 rounded-full retro-bg-primary retro-border mx-auto flex items-center justify-center mb-6 retro-shadow-dark">
              <span className="text-4xl">🤝</span>
            </div>
            <h2 className="font-bold text-3xl lowercase">the handshake</h2>
            <p className="text-base font-bold opacity-50 mt-2">link your attic with your person</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
            <div className="retro-border p-8 retro-bg-window shadow-inner flex flex-col justify-center">
              <p className="font-bold text-xs mb-6 opacity-60 text-left uppercase tracking-[0.2em]">your code:</p>
              <button
                onClick={copyInviteUrl}
                className="w-full bg-[var(--border)] text-[var(--bg-window)] p-6 font-black text-4xl tracking-[0.4em] retro-shadow-primary flex items-center justify-center gap-5 hover:opacity-90 active:translate-y-[2px] transition-all cursor-pointer"
              >
                {inviteCode || '...'}
                {copied ? <Check size={32} className="shrink-0" /> : <Copy size={28} className="shrink-0 opacity-60" />}
              </button>
              <p className="text-xs font-bold opacity-30 mt-4 uppercase tracking-widest">
                {copied ? 'link copied!' : 'tap to copy link'}
              </p>
            </div>

            <form onSubmit={handleClaimInvite} className="retro-border p-8 retro-bg-accent retro-shadow-dark flex flex-col justify-center">
              <p className="font-bold text-xs mb-6 opacity-60 text-left uppercase tracking-[0.2em]">partner's code:</p>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="w-full p-6 retro-border bg-white focus:outline-none font-black tracking-[0.3em] text-center uppercase text-3xl shadow-inner"
                />
                <RetroButton type="submit" variant="primary" className="w-full py-5 text-xl" disabled={loading || !partnerCode.trim()}>
                  {loading ? <Loader size={28} className="animate-spin" /> : 'pair now'}
                </RetroButton>
              </div>
            </form>
          </div>

          <p className="text-xs font-bold opacity-25 max-w-[500px] uppercase tracking-widest leading-relaxed">
            when your partner signs up with your link, you'll be connected automatically ✨
          </p>
        </div>
      </RetroWindow>
    </div>
  );
}
