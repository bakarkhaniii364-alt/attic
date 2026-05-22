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
   LANDING PAGE — desktop workspace preview
   ═══════════════════════════════════════════════════════ */

const PREVIEW_THEMES = [
  { id: 'default',    label: 'Default'    },
  { id: 'matcha',     label: 'Matcha'     },
  { id: 'midnight',   label: 'Midnight'   },
  { id: 'vaporwave',  label: 'Vaporwave'  },
  { id: 'nord',       label: 'Nord'       },
  { id: 'cyberpunk',  label: 'Cyberpunk'  },
  { id: 'rose',       label: 'Rose'       },
  { id: 'batman',     label: 'Batman'     },
];

export function LandingView() {
  const navigate = useNavigate();
  const [previewTheme, setPreviewTheme] = useState('matcha');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', previewTheme);
  }, [previewTheme]);

  const onTryAttic = () => navigate('/signin');
  const onSignIn  = () => navigate('/signup');

  return (
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden text-main-text selection:bg-primary selection:text-white">

      {/* ── Topbar ── */}
      <nav className="relative z-20 flex items-center justify-between px-5 py-2.5 sm:px-8 sm:py-3 shrink-0 border-b-2 border-border/30" style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
        <span className="font-black text-[11px] tracking-widest uppercase opacity-80 select-none">attic</span>
        <div className="flex gap-2">
          <RetroButton variant="white" onClick={onTryAttic} className="py-1.5 px-4 text-[10px]">Sign In</RetroButton>
          <RetroButton onClick={onSignIn} className="py-1.5 px-4 text-[10px]">Get Started</RetroButton>
        </div>
      </nav>

      {/* ── Desktop Workspace ── */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center gap-6 px-4 sm:px-8 py-6 overflow-hidden">

        {/* Floating ambiance */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[8%] left-[3%] text-primary opacity-[0.07] animate-float"><Heart size={60} fill="currentColor" /></div>
          <div className="absolute top-[65%] right-[4%] text-primary opacity-[0.05] animate-float-delayed"><Heart size={40} fill="currentColor" /></div>
          <div className="absolute bottom-[12%] left-[40%] text-primary opacity-[0.04] animate-float"><Heart size={30} fill="currentColor" /></div>
        </div>

        {/* ── Left: Logotype + CTA ── */}
        <div className="relative z-10 flex flex-col items-center lg:items-start gap-6 shrink-0 max-w-xs w-full text-center lg:text-left">
          <div className="relative flex items-center justify-center lg:justify-start">
            <div className="absolute -inset-8 bg-primary/10 blur-[50px] rounded-full animate-pulse pointer-events-none" />
            <img src="/assets/attic.svg" alt="Attic Logo" className="w-48 sm:w-56 relative z-10 drop-shadow-[0_10px_40px_rgba(233,69,96,0.25)] animate-float" />
          </div>
          <p className="text-[12px] font-mono leading-relaxed opacity-70">
            A corner of the internet,<br/><span className="text-primary font-bold opacity-100">just for two.</span>
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <RetroButton onClick={onTryAttic} className="py-3 text-sm w-full shadow-[4px_4px_0_var(--border)]">enter attic</RetroButton>
            <RetroButton variant="white" onClick={onSignIn} className="py-3 text-sm w-full shadow-[4px_4px_0_var(--border)] opacity-80 hover:opacity-100">start new journey</RetroButton>
          </div>
        </div>

        {/* ── Right: Workspace windows ── */}
        <div className="relative z-10 flex-1 min-w-0 w-full hidden md:flex flex-col gap-3 max-w-2xl">

          {/* Top row: Chat + Scrapbook */}
          <div className="flex gap-3 items-start">
            {/* Chat mockup */}
            <div className="flex-1 glass-window retro-border-thick retro-shadow-dark flex flex-col min-w-0" style={{ boxShadow: '4px 4px 0 var(--border)' }}>
              <div className="retro-border border-t-0 border-l-0 border-r-0 border-b-[2px] flex justify-between items-center px-2.5 py-1.5 flex-shrink-0" style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-[3px] w-4"><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/></div>
                  <span className="text-[10px] font-black">chat.exe</span>
                  <div className="flex-1 h-px bg-current opacity-30 ml-1 w-12" />
                </div>
                <div className="w-3.5 h-3.5 bg-red-500 retro-border flex items-center justify-center"><span className="text-[6px] text-white font-black leading-none">✕</span></div>
              </div>
              <div className="bg-window p-3 flex flex-col gap-2 text-main-text">
                <div className="flex gap-2 items-end justify-start">
                  <div className="w-6 h-6 retro-border bg-secondary/20 shrink-0 flex items-center justify-center text-[10px]">🐱</div>
                  <div className="bg-secondary/10 retro-border px-2.5 py-1.5 max-w-[70%]"><p className="text-[10px] font-bold">thinking of you 🌸</p></div>
                </div>
                <div className="flex gap-2 items-end justify-end">
                  <div className="bg-primary/15 retro-border px-2.5 py-1.5 max-w-[70%]"><p className="text-[10px] font-bold text-primary">always ❤️</p></div>
                  <div className="w-6 h-6 retro-border bg-primary/20 shrink-0 flex items-center justify-center text-[10px]">🌙</div>
                </div>
                <div className="flex gap-2 items-end justify-start">
                  <div className="w-6 h-6 retro-border bg-secondary/20 shrink-0 flex items-center justify-center text-[10px]">🐱</div>
                  <div className="bg-secondary/10 retro-border px-2.5 py-1.5 max-w-[70%]"><p className="text-[10px] font-bold">can't wait to see you 🏠</p></div>
                </div>
                <div className="flex items-center gap-2 mt-1 border-t border-border pt-2">
                  <div className="flex-1 retro-border bg-secondary/5 px-2 py-1 text-[9px] opacity-40">send a message...</div>
                  <div className="retro-border bg-primary px-2 py-1 text-[9px] font-black text-white">↑</div>
                </div>
              </div>
            </div>

            {/* Scrapbook mockup */}
            <div className="w-44 glass-window retro-border-thick flex flex-col shrink-0" style={{ boxShadow: '4px 4px 0 var(--border)' }}>
              <div className="retro-border border-t-0 border-l-0 border-r-0 border-b-[2px] flex justify-between items-center px-2.5 py-1.5" style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col gap-[3px] w-4"><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/></div>
                  <span className="text-[10px] font-black">scrapbook</span>
                </div>
              </div>
              <div className="bg-window p-2 grid grid-cols-2 gap-1.5">
                {['🌸','🌙','☀️','🎸','🌿','🍵'].map((emoji, i) => (
                  <div key={i} className="retro-border bg-border/10 aspect-square flex items-center justify-center text-xl hover:scale-105 transition-transform cursor-pointer">{emoji}</div>
                ))}
                <div className="col-span-2 retro-border border-dashed bg-transparent flex items-center justify-center py-2 opacity-30 text-[9px] font-black uppercase">+ add memory</div>
              </div>
            </div>
          </div>

          {/* Bottom row: Lists + Theme Switcher */}
          <div className="flex gap-3 items-start">
            {/* Lists mockup */}
            <div className="flex-1 glass-window retro-border-thick flex flex-col min-w-0" style={{ boxShadow: '4px 4px 0 var(--border)' }}>
              <div className="retro-border border-t-0 border-l-0 border-r-0 border-b-[2px] flex items-center px-2.5 py-1.5 gap-2" style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
                <div className="flex flex-col gap-[3px] w-4"><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/></div>
                <span className="text-[10px] font-black">our lists</span>
              </div>
              <div className="bg-window p-3 flex flex-col gap-1.5">
                {[{t:'☕ morning coffee run', done: true},{t:'📦 move apartments', done: false},{t:'🎬 movie marathon', done: false},{t:'🌿 get a plant together', done: true}].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <div className={`w-3.5 h-3.5 retro-border flex-shrink-0 flex items-center justify-center ${item.done ? 'bg-primary' : ''}`}>
                      {item.done && <span className="text-white text-[8px] font-black leading-none">✓</span>}
                    </div>
                    <span className={item.done ? 'line-through opacity-40' : 'font-bold'}>{item.t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Theme switcher */}
            <div className="w-44 glass-window retro-border-thick flex flex-col shrink-0" style={{ boxShadow: '4px 4px 0 var(--border)' }}>
              <div className="retro-border border-t-0 border-l-0 border-r-0 border-b-[2px] flex items-center px-2.5 py-1.5 gap-2" style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
                <div className="flex flex-col gap-[3px] w-4"><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/><div className="h-[2px] bg-current opacity-50 w-full"/></div>
                <span className="text-[10px] font-black">live theme</span>
              </div>
              <div className="bg-window p-2 flex flex-col gap-1">
                {PREVIEW_THEMES.map(t => (
                  <button
                    key={t.id}
                    data-theme={t.id}
                    onClick={() => setPreviewTheme(t.id)}
                    className={`text-left px-2 py-1 retro-border text-[9px] font-black uppercase tracking-widest transition-all hover:opacity-100 ${
                      previewTheme === t.id ? 'opacity-100' : 'opacity-50 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: previewTheme === t.id ? 'var(--primary)' : 'var(--bg-window)',
                      color: previewTheme === t.id ? 'var(--text-on-primary)' : 'var(--text-main)',
                    }}
                  >
                    {previewTheme === t.id ? '▶ ' : '  '}{t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-20 py-2.5 text-center shrink-0 border-t-2 border-border/20">
        <button
          onClick={() => navigate('/legal')}
          className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 hover:opacity-80 transition-opacity"
        >
          Terms &amp; Conditions / Legal
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
  const addToast = useToast();

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
  const [fetchError, setFetchError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const addToast = useToast();

  const pairingTriggeredRef = useRef(false);

  useEffect(() => {
    if (!user?.id || pairingTriggeredRef.current) return;

    let myRoomId = null;
    let subscription = null;

    const listenForPartner = (roomId) => {
      subscription = supabase.channel(`waiting_room_${roomId}`)
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

    const fetchMyCode = async () => {
      setFetchError(false);
      setPairingCode('LOADING...');
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
        } else {
          // If no room is returned, let's create a new room!
          let insertedRoom = null;
          let attempts = 0;
          while (!insertedRoom && attempts < 5) {
            attempts++;
            const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { data: newRoom, error: createError } = await supabase
              .from('rooms')
              .insert({ invite_code: inviteCode, creator_id: user.id })
              .select()
              .single();
            if (!createError && newRoom) {
              insertedRoom = newRoom;
            } else if (createError && !createError.message.includes('unique_code')) {
              throw createError;
            }
          }
          if (insertedRoom) {
            setPairingCode(insertedRoom.invite_code);
            myRoomId = insertedRoom.id;
            listenForPartner(insertedRoom.id);
          } else {
            throw new Error("Could not generate a unique room code.");
          }
        }
      } catch (err) {
        console.error("Failed to fetch or create code", err);
        setFetchError(true);
        setPairingCode("ERROR");
      }
    };

    fetchMyCode();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user, onPaired, retryTrigger]);

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
             {fetchError ? (
                <div className="space-y-1">
                  <button 
                    type="button" 
                    onClick={() => setRetryTrigger(prev => prev + 1)} 
                    className="text-[9px] font-black uppercase text-red-500 hover:opacity-70 flex items-center justify-center gap-1 mx-auto border-b border-current"
                  >
                    Retry Fetching Code
                  </button>
                </div>
              ) : (
                <button onClick={() => { navigator.clipboard.writeText(pairingCode); addToast("Code copied!", "success"); }} className="text-[9px] font-black uppercase text-primary hover:opacity-70 flex items-center justify-center gap-1 mx-auto border-b border-current">
                   <Copy size={10} /> copy code
                </button>
              )}
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
