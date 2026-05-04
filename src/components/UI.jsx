import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { X, MessageSquare, Download, Snowflake, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';

import { playAudio } from '../utils/audio.js';
import html2canvas from 'html2canvas';

// ── Toast System ──
const ToastContext = createContext(null);
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none max-w-sm w-full break-words">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto retro-border retro-shadow-dark p-3 flex items-start gap-2 font-bold text-sm animate-in slide-in-from-right duration-300 ${t.type === 'warn' ? 'bg-yellow-400 text-black' :
            t.type === 'error' ? 'bg-red-500 text-white' :
            t.type === 'success' ? 'bg-primary text-primary-text' :
            'bg-window text-main-text'}`}
            style={{
              backgroundColor: t.type === 'success' ? 'var(--primary)' : t.type === 'accent' ? 'var(--accent)' : undefined,
              color: t.type === 'success' ? 'var(--text-on-primary)' : t.type === 'accent' ? 'var(--text-on-accent)' : undefined
            }}>
            {t.type === 'success' && <Check size={16} className="shrink-0 mt-0.5" />}
            {t.type === 'warn' && <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
            <span>{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-auto shrink-0 opacity-70 hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Weather Overlay ──
export function WeatherOverlay({ weather }) {
  if (weather === 'clear') return null;
  const particles = Array.from({ length: 30 });
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((_, i) => (
        <div key={i} className="absolute" style={{ left: `${Math.random() * 100}%`, top: weather === 'spores' ? '100vh' : `-100px`, animation: `${weather} ${Math.random() * 2 + (weather === 'rain' ? 1 : 3)}s linear infinite`, animationDelay: `${Math.random() * 2}s` }}>
          {weather === 'rain' ? <div className="w-[2px] h-10 bg-blue-400 opacity-50 rounded-full" /> : weather === 'spores' ? <div className="w-1.5 h-1.5 bg-red-500 rounded-full opacity-60" style={{ filter: 'blur(1px)' }} /> : <Snowflake size={16} className="text-white opacity-80" />}
        </div>
      ))}
    </div>
  )
}

export function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }); const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)'];
  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {pieces.map((_, i) => (<div key={i} className="absolute w-3 h-3 animate-float" style={{ left: `${Math.random() * 100}%`, top: '-20px', backgroundColor: colors[Math.floor(Math.random() * colors.length)], animation: `rain ${Math.random() * 2 + 2}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`, animationDelay: `${Math.random() * 0.5}s`, transform: `rotate(${Math.random() * 360}deg)` }} />))}
    </div>
  )
}

// ── RetroWindow ──
export function RetroWindow({ title, onClose, children, className = "", noPadding = false, headerActions, onTitleClick, confirmOnClose = false, hasUnsavedChanges = false, onSaveBeforeClose, sfx }) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [confirmType, setConfirmType] = React.useState('simple');

  const handleCloseClick = () => {
    if (!onClose) return;
    if (confirmOnClose) {
      if (typeof hasUnsavedChanges === 'function' ? hasUnsavedChanges() : hasUnsavedChanges) {
        setConfirmType('unsaved');
        return setShowConfirm(true);
      }
      setConfirmType('simple');
      return setShowConfirm(true);
    }
    playAudio('click', sfx);
    onClose();
  };

  return (
    <>
      <div className={`glass-window retro-border-thick retro-shadow-dark flex flex-col animate-in fade-in zoom-in-95 duration-300 transform-gpu ${className}`}>
        <div className="retro-border border-t-0 border-l-0 border-r-0 border-b-[2px] flex justify-between items-center p-1.5 flex-shrink-0 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
          <div className={`relative z-10 flex gap-2 items-center flex-1 ${onTitleClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`} onClick={onTitleClick}>
            <div className="flex flex-col gap-[3px] w-5 flex-shrink-0">
              <div className="h-[2px] w-full bg-current opacity-50"></div>
              <div className="h-[2px] w-full bg-current opacity-50"></div>
              <div className="h-[2px] w-full bg-current opacity-50"></div>
            </div>
            <h2 className="font-black lowercase text-xs sm:text-sm tracking-tight flex items-center gap-2 flex-shrink-0" role="heading" aria-level="2" aria-label={title}>{title}</h2>
            <div className="flex-1 h-px bg-current opacity-30 ml-2"></div>
          </div>
          <div className="relative z-10 flex items-center gap-2">
            {headerActions}
            {onClose && (
              <button onClick={handleCloseClick} aria-label="Close" className="p-1 ml-2 retro-border hover:brightness-110 transition-all active:brightness-90" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto flex flex-col text-main-text bg-window ${noPadding ? '' : 'p-5 sm:p-6'}`}>{children}</div>
      </div>
      {showConfirm && (
        <ConfirmDialog
          title={confirmType === 'unsaved' ? 'Unsaved Changes' : 'Close'}
          message={confirmType === 'unsaved' ? 'You have unsaved changes. Save before closing?' : 'Close this window? Progress may be lost.'}
          showSave={confirmType === 'unsaved'}
          showCancel={true}
          onSave={() => {
            playAudio('click', sfx);
            if (onSaveBeforeClose) onSaveBeforeClose();
            setShowConfirm(false);
            onClose && onClose();
          }}
          onConfirm={() => { playAudio('click', sfx); setShowConfirm(false); onClose && onClose(); }}
          onCancel={() => setShowConfirm(false)}
          sfx={sfx}
        />
      )}
    </>
  );
}

// ── RetroInput ──
export function RetroInput({ label, icon: Icon, type = 'text', error, className = "", ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`space-y-1 w-full ${error ? 'animate-shake' : ''} ${className}`}>
      {label && <label className="text-[10px] sm:text-[11px] font-mono opacity-60 ml-1 lowercase tracking-widest">{label}</label>}
      <div className="relative group">
        {Icon && <Icon size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${error ? 'text-red-500' : 'opacity-30 group-focus-within:opacity-100 group-focus-within:text-primary'}`} />}
        <input 
          type={inputType}
          className={`w-full ${Icon ? 'pl-12' : 'px-4'} ${isPassword ? 'pr-12' : 'pr-4'} py-3 retro-border bg-window focus:bg-accent/5 outline-none font-bold transition-all placeholder:opacity-30 ${error ? 'border-red-500 text-red-600 bg-red-50' : 'focus:ring-1 focus:ring-primary/20'}`} 
          {...props} 
        />
        {isPassword && (
          <button 
            type="button" 
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity"
            tabIndex="-1"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="text-[9px] font-bold text-red-600 ml-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
    </div>
  );
}

// ── RetroButton ──
export function RetroButton({ children, onClick, variant = 'primary', className = "", disabled = false, style = {}, type = "button", ...props }) {
  const base = "font-bold transition-all active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none retro-border retro-shadow-dark lowercase flex items-center justify-center gap-2";
  
  const variants = { 
    primary: { backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }, 
    secondary: { backgroundColor: 'var(--secondary)', color: 'var(--text-on-secondary)' }, 
    white: { backgroundColor: 'var(--bg-window)', color: 'var(--text-main)' }, 
    accent: { backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)' }, 
    disabled: { backgroundColor: '#e5e7eb', color: '#9ca3af', opacity: 0.5, border: '1px solid #94a3b8' } 
  };
  
  const currentVariant = disabled ? variants.disabled : (variants[variant] || variants.primary);

  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled} 
      className={`${base} ${className}`}
      style={{ ...currentVariant, ...style }}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Confirm Dialog ──
export function ConfirmDialog({ title, message, onConfirm, onCancel, showSave = false, onSave, sfx, showCancel = true }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/35 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <RetroWindow title={title || "confirm.exe"} onClose={onCancel} className="w-full max-w-sm" confirmOnClose={false}>
        <p className="font-bold text-sm mb-6">{message}</p>
        <div className="flex gap-2">
          {showSave ? (
            <>
              <RetroButton className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onSave && onSave(); }}>Save & Close</RetroButton>
              <RetroButton variant="white" className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onConfirm && onConfirm(); }}>Discard</RetroButton>
              {showCancel && <RetroButton variant="secondary" className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onCancel && onCancel(); }}>Cancel</RetroButton>}
            </>
          ) : (
            <>
              {showCancel && <RetroButton variant="white" className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onCancel && onCancel(); }}>Cancel</RetroButton>}
              <RetroButton className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onConfirm && onConfirm(); }}>Confirm</RetroButton>
            </>
          )}
        </div>
      </RetroWindow>
    </div>
  );
}

// ── AppIcon ──
export function AppIcon({ icon, label, color, hue, onClick, badge }) {
  const bgColor = color || (hue != null ? `hsl(${hue}, 72%, 50%)` : 'var(--primary)');

  const handleKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick(); } };
  return (
    <div
      role="button" tabIndex={0}
      data-testid={`app-icon-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className="flex flex-col items-center gap-2 group cursor-pointer select-none"
      onClick={onClick} onTouchStart={onClick} onKeyDown={handleKey}
    >
      {/* Outer shell: retro-border gives the retro border+shadow only */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 retro-border retro-shadow-dark relative transition-all group-hover:-translate-y-1 group-active:translate-y-0.5 group-active:shadow-none overflow-hidden">
        {/* Dedicated color layer — lives inside, can't be overridden by parent classes */}
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center z-10 text-white">
          {React.cloneElement(icon, { size: 30, strokeWidth: 2 })}
        </div>
        {badge && (
          <div className="absolute top-0 right-0 bg-red-600 text-white min-w-[20px] h-5 px-1 flex items-center justify-center font-black text-[10px] border-2 border-white shadow-[1px_1px_0px_0px_black] z-20 select-none">
            {badge}
          </div>
        )}
      </div>
      <span className="font-black uppercase tracking-tighter text-[10px] px-2 py-0.5 retro-border shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] text-main-text bg-window group-hover:bg-accent group-hover:text-accent-text transition-colors">
        {label}
      </span>
    </div>
  );
}

// ── ShareOutcomeOverlay ──
export function ShareOutcomeOverlay({ gameName, stats, resultImage, customElement, onClose, onShareToChat, onSaveToScrapbook, sfx, onRematch, profile, partnerNickname, isSolo }) {
  const localProfile = profile || (() => {
    try {
      return JSON.parse(localStorage.getItem('user_profile') || '{}');
    } catch(e) { return {}; }
  })();
  const playerName = localProfile?.name || 'You';
  const partner = partnerNickname || (() => {
    try {
      const couple = JSON.parse(localStorage.getItem('couple_data') || '{}');
      if (couple.partnerNickname) return couple.partnerNickname;
    } catch(e) {}
    return 'Partner';
  })();

  const handleChatShare = () => {
    playAudio('send', sfx);
    let statString = Object.entries(stats || {}).map(([k, v]) => `${k}: ${v}`).join(' | ');
    const msg = `🎮 *Played ${gameName}*\n_${statString}_`;
    onShareToChat(msg, resultImage);
  };

  const handleDownload = async () => {
    playAudio('click', sfx);
    if (typeof html2canvas === 'undefined') {
      alert('Unable to generate image because the screenshot library is currently unavailable.');
      return;
    }
    const card = document.getElementById('outcome-card');
    if (card) {
      const canvas = await html2canvas(card, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-window').trim() || '#fffdf9',
        scale: 2,
        useCORS: true
      });
      const img = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = img; a.download = `${gameName.replace(/ /g, '_')}_Result_${Date.now()}.png`;
      a.click();
    }
  };

  const handleSaveToAlbum = async () => {
    playAudio('click', sfx);
    if (!onSaveToScrapbook) return;
    let imgToSave = resultImage;
    if (!imgToSave) {
      if (typeof html2canvas === 'undefined') {
        alert('Unable to generate image because the screenshot library is currently unavailable.');
        return;
      }
      const card = document.getElementById('outcome-card');
      if (card) {
        const canvas = await html2canvas(card, {
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-window').trim() || '#fffdf9',
          scale: 2,
          useCORS: true
        });
        imgToSave = canvas.toDataURL('image/png');
      }
    }
    if (imgToSave) {
      onSaveToScrapbook(imgToSave);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-200">
        <RetroWindow
          title={`result_${gameName.toLowerCase().replace(/ /g, '_')}.exe`}
          onClose={onClose}
          className="w-full flex flex-col max-h-[calc(100dvh-2rem)]"
          noPadding
        >
          <div id="outcome-card" className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto bg-window text-main-text">
            <div className="flex items-center justify-center gap-3 pb-3 border-b-2 border-dashed border-border">
              {isSolo ? (
                 <div className="flex items-center gap-2">
                    {localProfile?.pfp ? <img src={localProfile.pfp} alt="" className="w-8 h-8 rounded-full border-2 border-border object-cover bg-white shrink-0" /> : <div className="w-8 h-8 rounded-full border-2 border-border bg-accent text-accent-text flex items-center justify-center text-sm shrink-0">{localProfile?.emoji || '😊'}</div>}
                    <span className="font-bold text-sm truncate max-w-[100px]">{playerName} <span className="opacity-50">(Solo)</span></span>
                 </div>
              ) : (
                 <>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      {localProfile?.pfp ? <img src={localProfile.pfp} alt="" className="w-8 h-8 rounded-full border-2 border-border object-cover bg-white shrink-0" /> : <div className="w-8 h-8 rounded-full border-2 border-border bg-accent text-accent-text flex items-center justify-center text-sm shrink-0">{localProfile?.emoji || '😊'}</div>}
                      <span className="font-bold text-sm truncate max-w-[100px]">{playerName}</span>
                    </div>
                    <span className="text-xs opacity-50 font-black uppercase tracking-widest px-2 py-1 bg-border text-window shrink-0 border-2 border-border">VS</span>
                    <div className="flex items-center gap-2 flex-1 justify-start">
                      <span className="font-bold text-sm truncate max-w-[100px] text-right">{partner}</span>
                      <div className="w-8 h-8 rounded-full retro-border retro-bg-secondary flex items-center justify-center text-sm shrink-0">💕</div>
                    </div>
                 </>
              )}
            </div>

            <h2 className="font-bold text-xl sm:text-2xl text-center text-[var(--primary)] uppercase tracking-widest">{gameName}</h2>

            {customElement ? (
              <div className="flex justify-center w-full">{customElement}</div>
            ) : resultImage ? (
              <div className="bg-[var(--bg-main)] p-2 retro-border shadow-inner">
                <img src={resultImage} alt="Game Result" className="w-full aspect-square object-cover" />
              </div>
            ) : null}

            <div className="space-y-2">
              {stats && Object.entries(stats).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center font-bold border-b border-dashed border-[var(--border)]/30 pb-1">
                  <span className="uppercase opacity-60 tracking-wide text-xs">{String(key)}</span>
                  <span className="text-[var(--primary)] text-base">{String(val)}</span>
                </div>
              ))}
            </div>

            <div className="text-[9px] font-bold text-[var(--primary)]/50 border border-[var(--primary)]/30 rounded px-1 self-end -rotate-[10deg] uppercase tracking-widest">Attic Verified</div>
          </div>

          <div className="flex flex-col gap-2 p-4 border-t-2 border-dashed border-[var(--border)] bg-[var(--bg-main)] shrink-0">
            <div className="flex gap-2">
              <RetroButton onClick={handleChatShare} className="flex-1 py-2 flex justify-center items-center gap-2 text-sm"><MessageSquare size={16} /> Share</RetroButton>
              <RetroButton variant="secondary" onClick={handleDownload} className="flex-1 py-2 flex justify-center items-center gap-2 text-sm"><Download size={16} /> Save</RetroButton>
            </div>
            {onSaveToScrapbook && <RetroButton variant="accent" onClick={handleSaveToAlbum} className="py-2 flex justify-center items-center gap-2 text-sm"><Download size={16} /> Save to Album</RetroButton>}
            {onRematch && <RetroButton variant="primary" onClick={onRematch} className="py-2 flex justify-center items-center gap-2 text-sm font-bold">⚡ Rematch</RetroButton>}
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}

export function ScoreboardCountdown({ count = 3, onComplete, sfx }) {
  const [current, setCurrent] = useState(count);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (current > 0) {
      const timer = setTimeout(() => {
        setIsFlipping(true);
        setTimeout(() => {
          setCurrent(prev => prev - 1);
          setIsFlipping(false);
          playAudio('click', sfx);
        }, 500);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (current === 0) {
      const finish = setTimeout(() => onComplete && onComplete(), 500);
      return () => clearTimeout(finish);
    }
  }, [current, onComplete, sfx]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none animate-in fade-in">
      <div className="relative w-80 h-80 bg-window retro-border-thick retro-shadow-dark flex flex-col items-center justify-between p-6 overflow-hidden animate-in zoom-in duration-300 select-none" style={{ backgroundColor: 'var(--bg-window)' }}>
        <div className="font-black text-xs sm:text-sm uppercase tracking-[0.3em] text-center text-main-text select-none animate-pulse opacity-70">
          🎮 Game will start in
        </div>
        <div className="flex-1 flex items-center justify-center select-none w-full">
          <div className={`relative text-8xl sm:text-9xl font-black leading-none select-none transition-all duration-300 transform-gpu ${isFlipping ? 'scale-0 rotate-12 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} style={{ color: 'var(--primary)', textShadow: '4px 4px 0px var(--border)' }}>
            {current === 0 ? 'GO!' : current}
          </div>
        </div>
        <div className="w-full bg-[var(--bg-main)] p-2 retro-border text-center text-[10px] font-black uppercase tracking-widest text-main-text" style={{ backgroundColor: 'var(--bg-main)' }}>
          Get Ready! ⚡
        </div>
      </div>
    </div>
  );
}
