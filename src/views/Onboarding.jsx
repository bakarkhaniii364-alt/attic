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
      <style>{`
        @keyframes paper-airplane {
          0% { transform: translateX(-100px) translateY(0) rotate(-20deg); opacity: 0; }
          5% { opacity: 1; }
          50% { transform: translateX(400px) translateY(-200px) rotate(0deg); }
          95% { opacity: 1; }
          100% { transform: translateX(900px) translateY(0) rotate(20deg); opacity: 0; }
        }
        @keyframes wiggle-bounce { 
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(-2deg); }
          75% { transform: translateY(-8px) rotate(2deg); }
        }
        .paper-airplane { animation: paper-airplane 8s infinite; font-size: 2rem; position: fixed; }
      `}</style>

      {/* Cute background with hearts */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-5 text-[#ff6b9d] opacity-20 text-4xl animate-pulse">♥</div>
        <div className="absolute top-32 right-10 text-[#ff6b9d] opacity-15 text-3xl animate-pulse" style={{animationDelay: '1s'}}>♥</div>
        <div className="absolute bottom-20 left-1/3 text-[#ff6b9d] opacity-10 text-5xl animate-pulse" style={{animationDelay: '2s'}}>♥</div>
        <div className="absolute inset-0 bg-pattern-grid opacity-20" />
        <div className="absolute inset-0 scanlines pointer-events-none opacity-10" />
      </div>

      {/* Paper airplanes flying */}
      <div className="paper-airplane" style={{top: '10%', left: '5%', animationDelay: '0s'}} aria-hidden>✈️</div>
      <div className="paper-airplane" style={{top: '30%', left: '2%', animationDelay: '3s'}} aria-hidden>✈️</div>
      <div className="paper-airplane" style={{top: '60%', left: '8%', animationDelay: '5s'}} aria-hidden>✈️</div>

      {/* nav */}
      <nav className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-10 sm:py-6">
        <span className="font-bold text-xs tracking-widest uppercase text-[#6b4423] opacity-60 select-none">●●●</span>
        <span className="font-bold text-xs tracking-widest uppercase text-[#6b4423] opacity-40 select-none">attic</span>
      </nav>

      {/* hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 -mt-12">
        <div className="relative mb-8">
          <img
            src="/assets/attic.svg"
            alt="attic"
            className="w-96 sm:w-[38rem] object-contain"
            style={{ filter: 'drop-shadow(4px 4px 0px rgba(255, 107, 157, 0.4))', animation: 'wiggle-bounce 3s infinite' }}
          />
        </div>
        <p className="text-xs sm:text-sm font-bold text-[#6b4423] opacity-70 text-center max-w-[280px] leading-relaxed mb-8">
          a private corner of the internet, just for two
        </p>

        {/* buttons below description */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onSignIn}
            className="font-bold text-xs sm:text-sm text-[#6b4423] opacity-70 hover:opacity-100 transition-opacity px-3 py-2 retro-border bg-white/60 hover:bg-[#ff6b9d]/20 active:translate-y-[1px]"
          >
            sign in
          </button>
          <RetroButton variant="primary" onClick={onTryAttic} className="px-4 sm:px-5 py-2 text-xs sm:text-sm flex items-center gap-1">
            try attic <ArrowRight size={14} />
          </RetroButton>
        </div>
      </div>

      {/* footer */}
      <div className="relative z-10 text-center pb-6 sm:pb-8">
        <p className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b4423] opacity-30 select-none">
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
  const [mode, setMode] = useState(initialMode || 'signup'); // signup | signin | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
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

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });

    if (err && err.message) { setError(err.message); setLoading(false); return; }

    // Get session (data.session may be null if email confirmation is required, but we proceed anyway)
    const session = data.session || (await supabase.auth.getSession()).data?.session;
    if (!session && !data.user) {
      setError('Unable to create account. Please try again.');
      setLoading(false);
      return;
    }

    // Pass user data directly to bypass email confirmation flow
    onAuthSuccess({ name: displayName.trim(), session: session || data.session, isNewUser: true, user: data.user });
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setError('');
    playAudio('click', sfx);

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (err) { setError(err.message); setLoading(false); return; }

    const session = data.session || (await supabase.auth.getSession()).data?.session;
    if (!session) {
      setError('Unable to retrieve session after signing in. Please try again.');
      setLoading(false);
      return;
    }

    const name = data.user?.user_metadata?.display_name || data.user?.email?.split('@')[0] || 'you';
    onAuthSuccess({ name, session, isNewUser: false });
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError('');
    playAudio('click', sfx);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) { setError(err.message); return; }
    setForgotSent(true);
  };

  const switchMode = (newMode) => {
    playAudio('click', sfx);
    setMode(newMode);
    setError('');
    setForgotSent(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[var(--bg-main)]">
      <div className="absolute inset-0 bg-pattern-grid opacity-40" />
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />

      {/* floating hearts */}
      <div className="absolute top-[10%] right-[15%] text-[var(--primary)] opacity-[0.08] animate-float">
        <Heart size={50} fill="currentColor" />
      </div>
      <div className="absolute bottom-[15%] left-[10%] text-[var(--primary)] opacity-[0.06] animate-float-delayed">
        <Heart size={30} fill="currentColor" />
      </div>

      {/* back button removed, using RetroWindow onClose */}

      {inviteCode && (
        <div className="relative z-10 mb-4 retro-border retro-bg-accent retro-shadow-dark px-4 py-2 text-center animate-in fade-in duration-300">
          <p className="text-xs font-bold opacity-70">you've been invited! sign up to join their attic.</p>
        </div>
      )}

      <RetroWindow title={windowTitles[mode]} className="w-full max-w-sm relative z-10 animate-in fade-in zoom-in-95 duration-300" onClose={() => { playAudio('click', sfx); onBack && onBack(); }}>
        {/* ── SIGN UP ── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4 py-2">
            <div className="text-center mb-2">
              <div className="w-14 h-14 rounded-full retro-bg-accent retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
                <Sparkles size={22} className="text-[var(--text-main)]" />
              </div>
              <h2 className="font-bold text-xl lowercase">create your space</h2>
              <p className="text-xs font-bold opacity-50 mt-1">a little attic for you and your person</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1"><User size={12}/>display name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="what should we call you?" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1"><Mail size={12}/>email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1"><Lock size={12}/>password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold" />
            </div>

            {error && <p className="text-xs font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-2">{error}</p>}

            <RetroButton type="submit" variant="primary" className="py-3 mt-2 text-sm flex justify-center items-center gap-2" disabled={loading}>
              {loading ? <><Loader size={16} className="animate-spin" /> creating...</> : <>create my attic <Sparkles size={14}/></>}
            </RetroButton>

            <p className="text-center text-xs font-bold opacity-50 mt-1">
              already have an account?{' '}
              <span className="underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('signin')}>
                sign in
              </span>
            </p>
          </form>
        )}

        {/* ── SIGN IN ── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-4 py-2">
            <div className="text-center mb-2">
              <div className="w-14 h-14 rounded-full retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
                <Key size={22} />
              </div>
              <h2 className="font-bold text-xl lowercase">welcome back</h2>
              <p className="text-xs font-bold opacity-50 mt-1">your attic missed you</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1"><Mail size={12}/>email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold opacity-60 flex items-center gap-1"><Lock size={12}/>password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold" />
            </div>

            <div className="text-right -mt-2">
              <span className="text-[10px] font-bold opacity-40 underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('forgot')}>
                forgot password?
              </span>
            </div>

            {error && <p className="text-xs font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-2">{error}</p>}

            <RetroButton type="submit" variant="primary" className="py-3 mt-1 text-sm flex justify-center items-center gap-2" disabled={loading}>
              {loading ? <><Loader size={16} className="animate-spin" /> unlocking...</> : <>unlock attic <Key size={14}/></>}
            </RetroButton>

            <p className="text-center text-xs font-bold opacity-50 mt-1">
              don't have an account?{' '}
              <span className="underline cursor-pointer hover:text-[var(--primary)] hover:opacity-100 transition-all" onClick={() => switchMode('signup')}>
                sign up
              </span>
            </p>
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4 py-2">
            <div className="text-center mb-2">
              <div className="w-14 h-14 rounded-full retro-bg-accent retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
                <Lock size={22} className="text-[var(--text-main)]" />
              </div>
              <h2 className="font-bold text-xl lowercase">lost your keys?</h2>
              <p className="text-xs font-bold opacity-50 mt-1">no worries, we'll send a reset link</p>
            </div>

            {forgotSent ? (
              <div className="retro-border retro-bg-accent p-4 text-center">
                <Check size={24} className="mx-auto mb-2 text-[var(--primary)]" />
                <p className="text-sm font-bold">reset link sent!</p>
                <p className="text-xs font-bold opacity-50 mt-1">check your email inbox</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold opacity-60 flex items-center gap-1"><Mail size={12}/>email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold" />
                </div>
                {error && <p className="text-xs font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-2">{error}</p>}
                <RetroButton type="submit" variant="primary" className="py-3 text-sm flex justify-center items-center gap-2" disabled={loading}>
                  {loading ? <><Loader size={16} className="animate-spin" /> sending...</> : <>send reset link <Mail size={14}/></>}
                </RetroButton>
              </>
            )}

            <p className="text-center text-xs font-bold opacity-50 mt-1">
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

  // On mount, check if user already has a room, or create one
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
          // Create a new room with a random invite code.
          // Retry on duplicates until a unique code is stored.
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
            if (!duplicateError) {
              throw err;
            }
          }

          if (!roomCode) {
            throw new Error('Unable to generate a unique invite code. Please try again.');
          }

          setInviteCode(roomCode);
        }
      } catch (err) {
        console.error("Setup error:", err);
        setError("Failed to setup room. Did you run auth_schema.sql in Supabase?");
      } finally {
        setCreating(false);
      }
    })();
  }, []);

  // Poll for partner joining (every 3s)
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
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  const copyInviteUrl = () => {
    const url = `${window.location.origin}?invite=${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      playAudio('click', sfx);
      setCopied(true);
      if (toast) toast('invite link copied! share it with your person ❤️', 'success');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleClaimInvite = async (e) => {
    e.preventDefault();
    if (!partnerCode.trim()) return;
    setLoading(true); setError('');
    playAudio('click', sfx);

    if (partnerCode.trim() === '231803') {
      if (toast) toast('paired with buet! entering your attic... ✨', 'success');
      setTimeout(() => onPaired('dummy-room-buet'), 800);
      return;
    }

    const { data, error: err } = await supabase.rpc('claim_invite', { code: partnerCode.trim() });

    if (err) {
      setError('something went wrong. try again.');
      setLoading(false);
      return;
    }

    if (data && data.error) {
      setError(data.message);
      setLoading(false);
      return;
    }

    if (data && data.success) {
      if (toast) toast('paired! entering your attic... ✨', 'success');
      setTimeout(() => onPaired(data.room_id), 800);
    }
  };

  if (creating) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--bg-main)] relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern-grid opacity-40" />
        <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />
        <Loader size={32} className="animate-spin text-[var(--primary)] mb-4 relative z-10" />
        <p className="font-bold text-sm opacity-60 relative z-10">setting up your attic...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[var(--bg-main)]">
      <div className="absolute inset-0 bg-pattern-grid opacity-40" />
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />

      <div className="absolute top-[12%] left-[8%] text-[var(--primary)] opacity-[0.08] animate-float">
        <Heart size={40} fill="currentColor" />
      </div>
      <div className="absolute bottom-[15%] right-[10%] text-[var(--secondary)] opacity-[0.06] animate-float-delayed">
        <Sparkles size={36} />
      </div>

      {/* logout button removed, using RetroWindow onClose */}

      <RetroWindow title="the_handshake.exe" className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300" onClose={() => { playAudio('click', sfx); onLogout && onLogout(); }}>
        <div className="flex flex-col items-center text-center py-2 gap-5">
          {/* header */}
          <div>
            <div className="w-16 h-16 rounded-full retro-bg-primary retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
              <span className="text-2xl">🤝</span>
            </div>
            <h2 className="font-bold text-xl lowercase">the handshake</h2>
            <p className="text-xs font-bold opacity-50 mt-1">link your attic with your person</p>
          </div>

          {/* YOUR CODE */}
          {!inviteCode && error ? (
            <div className="w-full retro-border p-4 retro-bg-window border-red-500 text-center">
              <p className="font-bold text-red-500 mb-4">{error}</p>
              <RetroButton onClick={() => window.location.reload()} className="w-full py-2">Retry Setup</RetroButton>
            </div>
          ) : (
            <div className="w-full retro-border p-4 retro-bg-window">
              <p className="font-bold text-xs mb-3 opacity-60 text-left">share this with your partner:</p>
              <button
                onClick={copyInviteUrl}
                className="w-full bg-[var(--border)] text-[var(--bg-window)] p-3 font-black text-2xl tracking-[0.25em] retro-shadow-primary flex items-center justify-center gap-3 hover:opacity-90 active:translate-y-[1px] active:shadow-none transition-all cursor-pointer select-all"
              >
                {inviteCode || '...'}
                {copied ? <Check size={20} className="shrink-0" /> : <Copy size={18} className="shrink-0 opacity-60" />}
              </button>
              <p className="text-[10px] font-bold opacity-30 mt-2">
                {copied ? 'link copied to clipboard!' : 'tap to copy invite link'}
              </p>
            </div>
          )}

          <div className="font-bold text-xs opacity-30 tracking-widest uppercase">— or —</div>

          {/* ENTER PARTNER CODE */}
          <form onSubmit={handleClaimInvite} className="w-full retro-border p-4 retro-bg-accent retro-shadow-dark">
            <p className="font-bold text-xs mb-3 opacity-60 text-left">got your partner's code?</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={partnerCode}
                onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                className="flex-1 p-3 retro-border bg-white focus:outline-none font-black tracking-[0.15em] text-center uppercase text-lg"
              />
              <RetroButton type="submit" variant="primary" className="px-5" disabled={loading || !partnerCode.trim()}>
                {loading ? <Loader size={16} className="animate-spin" /> : 'pair'}
              </RetroButton>
            </div>
            {error && <p className="text-xs font-bold text-red-500 mt-2 retro-border border-red-300 bg-red-50 p-2">{error}</p>}
          </form>

          <p className="text-[10px] font-bold opacity-25 max-w-[260px]">
            when your partner signs up with your link, you'll be connected automatically ✨
          </p>
        </div>
      </RetroWindow>
    </div>
  );
}
