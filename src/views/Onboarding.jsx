import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Heart, Mail, Send, Grid3X3, Sparkle, User, Lock, Loader, Check, Copy, Share2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { RetroButton, RetroWindow, RetroInput, useToast } from '../components/UI.jsx';
import { supabase } from '../lib/supabase.js';
import { isTestMode } from '../lib/testMode.js';
import { useAuth } from '../context/instances.js';
import { LegalView } from './LegalView.jsx';

/* ═══════════════════════════════════════════════════════
   LANDING PAGE — cute & animated with floating elements
   ═══════════════════════════════════════════════════════ */
export function LandingView() {
  const navigate = useNavigate();
  const onTryAttic = () => navigate('/signin');
  const onSignIn = () => navigate('/signup');
  return (
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden text-main-text selection:bg-primary selection:text-white">

      <nav className="relative z-10 flex items-center justify-between px-5 py-3 sm:px-10 sm:py-4 shrink-0">
        <span className="font-bold text-[10px] tracking-widest uppercase text-main-text opacity-30 select-none">●●●</span>
        <span className="font-bold text-[10px] tracking-widest uppercase text-main-text opacity-30 select-none">attic</span>
      </nav>

      {/* HERO SECTION — fills remaining height */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center min-h-0">
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

        <div className="relative mb-3 sm:mb-5 transform-gpu hover:scale-105 transition-transform duration-500 flex items-center justify-center">
          <div className="absolute -inset-10 bg-primary/10 blur-[60px] rounded-full animate-pulse" />
          <img src="/assets/attic.svg" alt="Attic Logo" className="w-[16rem] sm:w-[24rem] md:w-[28rem] relative z-10 drop-shadow-[0_20px_50px_rgba(233,69,96,0.3)] animate-float" />
        </div>

        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 z-10">
          <p className="text-xs sm:text-base font-mono text-muted-text max-w-sm mx-auto leading-relaxed">
            A corner of the internet, <br/> <span className="text-primary font-bold">just for two</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <RetroButton onClick={onTryAttic} className="w-52 py-3 text-base sm:text-lg relative overflow-hidden group shadow-[4px_4px_0_var(--border)]">
              <span className="relative z-10 font-bold">enter attic</span>
            </RetroButton>
            <RetroButton variant="white" onClick={onSignIn} className="w-52 py-3 text-base sm:text-lg opacity-80 hover:opacity-100 shadow-[4px_4px_0_var(--border)]">
              <span className="font-bold">start new journey</span>
            </RetroButton>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-3 text-center shrink-0">
        <button 
          onClick={() => navigate('/legal')}
          className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
        >
          Terms & Conditions / Legal
        </button>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   AUTH VIEW — Login & Signup with 3D Depth
   ═══════════════════════════════════════════════════════ */
export function AuthView({ mode }) {
  const navigate = useNavigate();
  const { user, roomId, roomLoading, handleAuthSuccess } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem('attic_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('attic_remembered_email'));
  const [authError, setAuthError] = useState(null);
  const [shake, setShake] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const { toast: addToast } = useToast();

  const onBack = () => navigate('/');

  // Paired users should never land on auth pages — send them straight home
  if (user && roomId) return <Navigate to="/dashboard" replace />;
  // A paired user whose room is still loading — don't flash the form
  if (user && roomLoading) return null;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };


  const startAuthFlow = (e) => {
    e.preventDefault();
    // Terms agreement is only required for new accounts
    if (mode === 'signup' && !termsAgreed) {
        setShowLegal(true);
        return;
    }
    handleAuth();
  };

  const handleAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ 
            email, password, options: { data: { name } } 
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
          addToast("Verification email sent! Please check your inbox before logging in.", "success");
          navigate('/signin');
          return;
        }

        if (rememberMe) localStorage.setItem('attic_remembered_email', email);
        else localStorage.removeItem('attic_remembered_email');

        addToast("Welcome! Attic is ready.", "success");
        handleAuthSuccess(data.session);
        navigate('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
           if (error.message.includes('Email not confirmed')) {
              throw new Error('Please verify your email before logging in. Check your inbox!');
           }
           throw error;
        }
        
        if (rememberMe) localStorage.setItem('attic_remembered_email', email);
        else localStorage.removeItem('attic_remembered_email');

        handleAuthSuccess(data.session);
        navigate('/dashboard');
      }
    } catch (err) { 
      triggerShake();
      setAuthError(err.message);
      addToast(err.message, "error"); 
    }
    finally { setLoading(false); }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message);
      addToast(err.message, "error");
      setLoading(false);
    }
  };

  const handleMagicLinkLogin = async () => {
    if (!email) {
      addToast('Please enter an email address first', 'error');
      return;
    }
    
    setLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });
      
      if (error) throw error;
      
      setLinkSent(true);
      addToast('Magic link sent!', 'success');
    } catch (err) {
      setAuthError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (linkSent) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-4">
        <RetroWindow title="transmission_sent.exe" className="w-full max-w-[440px] shadow-2xl p-6 text-center" onClose={onBack}>
          <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300 py-8">
            <CheckCircle size={48} className="text-primary animate-bounce" />
            <h2 className="text-2xl font-black uppercase tracking-widest text-main-text">Check your inbox</h2>
            <p className="text-sm opacity-70">We sent a magic link to <strong>{email}</strong>.<br/>Click it to instantly enter the Attic.</p>
            <RetroButton variant="secondary" onClick={() => setLinkSent(false)} className="mt-4 text-xs py-2 px-6">
              Try a different email
            </RetroButton>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4">

      <RetroWindow 
        title={`${mode === 'signup' ? 'join attic' : 'welcome back'}.exe`} 
        className={`w-full max-w-[440px] shadow-2xl scale-up-15 ${shake ? 'animate-shake' : ''}`} 
        onClose={onBack}
      >
        <form onSubmit={startAuthFlow} className="flex flex-col gap-4 py-4">
          <div className="flex flex-col items-center gap-1 mb-6 pb-4">
            <h2 className="text-3xl font-black tracking-tighter text-primary lowercase text-center">
              {mode === 'signup' ? 'join attic' : 'welcome back'}
            </h2>
          </div>

          {mode === 'signup' ? (
            <>
              <RetroInput 
                label="display name"
                icon={User}
                placeholder="alex"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                className="focus:ring-2 focus:ring-primary/50"
              />

              <RetroInput 
                label="email"
                icon={Mail}
                type="email"
                placeholder="you@love.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <RetroInput 
                label="password"
                icon={Lock}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <p className="text-[10px] leading-relaxed text-muted-text mt-1">
                By creating an account, you agree to the <button type="button" onClick={() => setShowLegal(true)} className="text-primary underline cursor-pointer">Sanctuary Promise</button> and acknowledge the privacy rules.
              </p>

              <RetroButton type="submit" disabled={loading} className="py-3 text-lg mt-2">
                {loading ? <Loader className="animate-spin" /> : 'create account'}
              </RetroButton>
            </>
          ) : (
            <>
              <RetroInput 
                label="email"
                icon={Mail}
                type="email"
                placeholder="you@love.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />

              <div className="space-y-1">
                <RetroInput 
                  label="password"
                  icon={Lock}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-between items-center mt-1 px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 border-2 border-border accent-primary cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-muted-text group-hover:text-main-text lowercase">remember me</span>
                  </label>
                  <a href="/password-reset" className="text-[10px] font-bold text-muted-text hover:text-primary transition-colors lowercase">forgot password?</a>
                </div>
              </div>

              <RetroButton type="submit" disabled={loading} className="py-3 text-lg mt-4">
                {loading ? <Loader className="animate-spin" /> : 'enter attic'}
              </RetroButton>
            </>
          )}

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border opacity-20"></div>
            <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-muted-text uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-border opacity-20"></div>
          </div>

          <div className="flex gap-3">
            <RetroButton type="button" onClick={handleMagicLinkLogin} className="flex-1 py-3 text-xs flex items-center justify-center gap-2 bg-window hover:bg-accent text-main-text border-2 border-border">
              <Mail className="w-4 h-4" />
              Magic Link
            </RetroButton>
            <RetroButton type="button" onClick={() => handleOAuthLogin('facebook')} className="flex-1 py-3 text-xs flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white border-[#0c4b9e]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/></svg>
              Facebook
            </RetroButton>
          </div>
        </form>
      </RetroWindow>

      {showLegal && (
        <LegalView 
          isOverlay 
          onClose={() => setShowLegal(false)} 
          onAccept={() => {
            setTermsAgreed(true);
            setShowLegal(false);
            // If they are in the middle of a flow, we could trigger auth here but 
            // since it's a form submit, we'll let them click the button again or 
            // handle it automatically.
            // Actually, let's trigger it automatically if they accepted.
            setTimeout(() => handleAuth(), 100);
          }} 
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HANDSHAKE VIEW — Pairing Couples with Glass Depth
   ═══════════════════════════════════════════════════════ */
export function HandshakeView() {
  const { user, roomId, logout, handlePaired, handleAuthSuccess } = useAuth();
  const navigate = useNavigate();
  const onPaired = handlePaired;
  const onLogout = () => { logout(); navigate('/'); };
  const [pairingCode, setPairingCode] = useState('LOADING...');
  const [partnerCode, setPartnerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const addToast = useToast();

  const pairingTriggeredRef = useRef(false);

  useEffect(() => {
    if (!user?.id || pairingTriggeredRef.current) return;

    let myRoomId = null;

    const fetchMyCode = async () => {
      try {
        const { data } = await supabase.rpc('get_my_room');
        if (data) {
          if (data.is_paired) {
            pairingTriggeredRef.current = true;
            onPaired(data.id);
          } else {
            setPairingCode(data.invite_code);
            myRoomId = data.id;
            listenForPartner(data.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch code", err);
      }
    };

    const listenForPartner = (roomId) => {
      supabase.channel(`waiting_room_${roomId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'rooms',
            filter: `id=eq.${roomId}` 
        }, (payload) => {
            if (payload.new.partner_id) {
                pairingTriggeredRef.current = true;
                onPaired(roomId);
            }
        }).subscribe();
    };

    fetchMyCode();

    return () => {
      if (myRoomId) supabase.removeAllChannels();
    };
  }, [user, onPaired]);

  const handlePair = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('pair_with_code', { target_code: partnerCode });
      
      if (error) throw error;
      if (data?.session) {
        handleAuthSuccess(data.session);
        navigate('/handshake');
      }
      addToast("Successfully paired!", "success");
      
      let roomId = data?.room_id;
      
      // Fallback: If data is null but no error, try to fetch the room manually
      if (!roomId) {
          const { data: roomData, error: roomError } = await supabase.rpc('get_my_room');
          if (roomError) throw roomError;
          if (roomData?.id) roomId = roomData.id;
      }

      if (roomId) {
          onPaired(roomId);
      } else {
          throw new Error("Pairing succeeded but couldn't retrieve room ID. Please refresh.");
      }
      
    } catch (err) { 
      addToast(err.message || "Failed to pair", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDebugBypass = () => {
    onPaired('test-room-id');
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4">

      
      <RetroWindow title="handshake_protocol.exe" className="w-full max-w-[440px] shadow-2xl scale-up-15">
        <div className="flex flex-col gap-8 py-4">
          <div className="space-y-4 animate-in zoom-in-95 duration-500 text-center">
             <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <Heart size={32} className="text-primary" fill="currentColor" />
             </div>
             <p className="font-bold text-muted-text text-sm">Send this code to your partner to pair up!</p>
          </div>

          <div className="bg-accent/20 border-2 border-border p-6 text-center space-y-3 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-10 rotate-12"><Share2 size={48} /></div>
             <div className="text-xs font-black uppercase tracking-widest text-muted-text">Your Pairing Code</div>
             <div className="text-4xl font-black tracking-tighter text-primary select-all">{pairingCode}</div>
             <button onClick={() => { navigator.clipboard.writeText(pairingCode); addToast("Code copied!", "success"); }} className="text-[9px] font-black uppercase text-primary hover:opacity-70 flex items-center justify-center gap-1 mx-auto border-b border-current">
                <Copy size={10} /> copy code
             </button>
          </div>

          <form onSubmit={handlePair}>
             <div className="space-y-3">
                <p className="font-bold opacity-60 text-sm text-center">...or enter your partner's code:</p>
                <div className="flex gap-2 justify-center">
                   <input required type="text" placeholder="XXXXXX" value={partnerCode} onChange={e => setPartnerCode(e.target.value.toUpperCase())} className="w-full max-w-[200px] px-4 py-4 border-2 border-border bg-window text-main-text focus:bg-accent/10 outline-none font-black text-xl text-center tracking-widest uppercase" />
                   <RetroButton type="submit" disabled={loading || !partnerCode} className="w-16 h-16 shrink-0">
                      {loading ? <Loader className="animate-spin" /> : <Check />}
                   </RetroButton>
                </div>
             </div>
          </form>

          <div className="flex flex-col items-center gap-4">
            <p className="text-[10px] font-bold opacity-40 uppercase max-w-[240px] text-center mx-auto">Once they enter your code, the Attic will unlock instantly.</p>
            
            <div className="flex flex-col gap-2 w-full">
              <RetroButton variant="white" onClick={onLogout} className="py-2 px-8 text-[10px] opacity-60 hover:opacity-100">Terminate Session</RetroButton>
              
              {isTestMode() && (
                <button 
                  type="button"
                  onClick={handleDebugBypass}
                  className="mt-2 text-[9px] font-bold opacity-30 hover:opacity-100 transition-opacity uppercase tracking-widest"
                >
                  [DEBUG] Bypass Handshake
                </button>
              )}
            </div>
          </div>
          </div>
      </RetroWindow>
    </div>
  );
}
