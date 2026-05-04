import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Mail, Send, Grid3X3, Sparkle, User, Lock, Loader, Check, Copy, Share2, Eye, EyeOff } from 'lucide-react';
import { RetroButton, RetroWindow, RetroInput, useToast } from '../components/UI.jsx';
import { supabase } from '../lib/supabase.js';
import { isTestMode } from '../lib/testMode.js';
import { useAuth } from '../context/AuthContext.jsx';

/* ═══════════════════════════════════════════════════════
   LANDING PAGE — cute & animated with floating elements
   ═══════════════════════════════════════════════════════ */
export function LandingView() {
  const navigate = useNavigate();
  const onTryAttic = () => navigate('/signin');
  const onSignIn = () => navigate('/signup');
  return (
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden scale-up-15">


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
            <RetroButton variant="white" onClick={onSignIn} className="w-56 py-3 sm:py-4 text-base sm:text-lg opacity-80 hover:opacity-100 shadow-xl">
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
export function AuthView({ mode }) {
  const navigate = useNavigate();
  const onBack = () => navigate('/');
  const { handleAuthSuccess } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem('attic_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('attic_remembered_email'));
  const [authError, setAuthError] = useState(null);
  const [shake, setShake] = useState(false);
  const addToast = useToast();

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };


  const handleAuth = async (e) => {
    e.preventDefault();
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

        // read metadata and forward display name for immediate UI update
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


  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4">

      <RetroWindow 
        title={`${mode === 'signup' ? 'join attic' : 'welcome back'}.exe`} 
        className={`w-full max-w-[440px] shadow-2xl scale-up-15 ${shake ? 'animate-shake' : ''}`} 
        onClose={onBack}
      >
        <form onSubmit={handleAuth} className="flex flex-col gap-4 py-4">
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

              <label className="flex items-start gap-3 cursor-pointer group mt-1">
                <input 
                  type="checkbox" 
                  required
                  checked={termsAgreed}
                  onChange={e => setTermsAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 border-2 border-border accent-primary cursor-pointer"
                />
                <span className="text-[10px] leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
                  I agree to the <a href="/legal" target="_blank" className="text-primary underline">Terms of Service</a> and acknowledge that deleting a room permanently deletes all data for both partners.
                </span>
              </label>

              <RetroButton type="submit" disabled={loading || !termsAgreed} className="py-3 text-lg mt-2">
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
                    <span className="text-[10px] font-bold opacity-50 group-hover:opacity-80 lowercase">remember me</span>
                  </label>
                  <a href="/password-reset" className="text-[10px] font-bold opacity-70 hover:text-primary transition-colors lowercase">forgot password?</a>
                </div>
              </div>

              <RetroButton type="submit" disabled={loading} className="py-3 text-lg mt-4">
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
export function HandshakeView() {
  const { user, roomId, logout, handlePaired } = useAuth();
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
