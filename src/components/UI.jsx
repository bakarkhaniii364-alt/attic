import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { X, MessageSquare, Download, Snowflake, Check, AlertTriangle } from 'lucide-react';
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
      <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none max-w-xs">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto retro-border retro-shadow-dark p-3 flex items-start gap-2 font-bold text-sm animate-in slide-in-from-right duration-300 ${t.type === 'success' ? 'bg-[var(--primary)] text-[var(--text-on-primary)]' :
            t.type === 'warn' ? 'bg-yellow-400 text-black' :
              t.type === 'error' ? 'bg-red-500 text-white' :
                'bg-[var(--bg-window)] text-[var(--text-main)]'
            }`}>
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
        <div style={{ backgroundColor: 'var(--bg-header)' }} className="window-header-text retro-border border-t-0 border-l-0 border-r-0 border-b-[1px] flex justify-between items-center p-1.5 flex-shrink-0 relative overflow-hidden">
          {/* Subtle header sheen - Bypassing Gradient Killer with inline style */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.2), transparent)' }} />
          
          <div className={`relative z-10 flex gap-2 items-center ${onTitleClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`} onClick={onTitleClick}>
            <div className="flex flex-col gap-[2px] w-4">
              <div className="h-[2px] w-full opacity-40" style={{ backgroundColor: 'var(--text-on-header)' }}></div>
              <div className="h-[2px] w-full opacity-60" style={{ backgroundColor: 'var(--text-on-header)' }}></div>
              <div className="h-[2px] w-full" style={{ backgroundColor: 'var(--text-on-header)' }}></div>
            </div>
            <span className="font-black lowercase text-xs sm:text-sm tracking-tight flex items-center gap-2">{title}</span>
          </div>
          <div className="relative z-10 flex items-center gap-2">
            {headerActions}
            {onClose && (
              <button onClick={handleCloseClick} aria-label="Close" className="p-1 ml-2 border-2 border-[var(--border)] bg-[var(--primary)] text-white shadow-[1px_1px_0px_0px_var(--border)] hover:translate-y-[2px] hover:shadow-none transition-all active:scale-95">
                <X size={16} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto flex flex-col text-[var(--text-main)] bg-[var(--bg-window)] ${noPadding ? '' : 'p-5 sm:p-6'}`}>{children}</div>
      </div>
      {showConfirm && (
        <ConfirmDialog
          title={confirmType === 'unsaved' ? 'Unsaved Changes' : 'Close'}
          message={confirmType === 'unsaved' ? 'You have unsaved changes. Save before closing?' : 'Close this window? Progress may be lost.'}
          showSave={confirmType === 'unsaved'}
          showCancel={false}
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

// ── RetroButton ──
export function RetroButton({ children, onClick, variant = 'primary', className = "", disabled = false, type = "button" }) {
  const base = "font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none border-2 border-[var(--border)] shadow-[1px_1px_0px_0px_var(--border)] hover:translate-y-[2px] hover:shadow-none lowercase flex items-center justify-center gap-2";
  
  const variants = { 
    primary: "bg-[var(--primary)] text-white", 
    secondary: "bg-[var(--secondary)] text-white", 
    white: "bg-white text-[var(--text-main)] hover:bg-gray-50", 
    accent: "bg-[var(--accent)] text-[var(--text-main)]", 
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 shadow-none border-gray-400" 
  };
  
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled} 
      className={`${base} ${disabled ? variants.disabled : variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Confirm Dialog ──
export function ConfirmDialog({ title, message, onConfirm, onCancel, showSave = false, onSave, sfx, showCancel = true }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
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
export function AppIcon({ icon, label, color, onClick, badge }) {
  const handleKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick(); } };
  return (
    <div role="button" tabIndex={0} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={onClick} onTouchStart={onClick} onKeyDown={handleKey}>
      <div className="w-16 h-16 sm:w-20 sm:h-20 retro-border flex items-center justify-center retro-shadow-dark relative text-[var(--border)]" style={{ backgroundColor: color }}>
        {icon} {badge && <div className="absolute -top-3 -right-3 bg-[var(--border)] text-[var(--bg-window)] w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[var(--bg-window)]">{badge}</div>}
      </div>
      <span className="font-bold retro-bg-window px-2 retro-border text-sm group-hover:bg-[var(--accent)] transition-colors">{label}</span>
    </div>
  );
}

// ── ShareOutcomeOverlay ──
export function ShareOutcomeOverlay({ gameName, stats, resultImage, customElement, onClose, onShareToChat, onSaveToScrapbook, sfx, onRematch, profile, partnerNickname }) {
  const playerName = profile?.name || 'You';
  const partner = partnerNickname || 'Partner';

  const handleChatShare = () => {
    playAudio('send', sfx);
    let statString = Object.entries(stats || {}).map(([k, v]) => `${k}: ${v}`).join(' | ');
    const msg = `🎮 *Played ${gameName}*\n_${statString}_`;
    onShareToChat(msg, resultImage);
  };

  const handleDownload = async () => {
    playAudio('click', sfx);
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

  return (
    <div className="fixed inset-0 z-[150] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-200">
        <RetroWindow
          title={`result_${gameName.toLowerCase().replace(/ /g, '_')}.exe`}
          onClose={onClose}
          className="w-full flex flex-col max-h-[calc(100dvh-2rem)]"
          noPadding
        >
          <div id="outcome-card" className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto bg-[var(--bg-window)]">
            <div className="flex items-center justify-center gap-3 pb-3 border-b-2 border-dashed border-[var(--border)]">
              <div className="flex items-center gap-2">
                {profile?.pfp ? <img src={profile.pfp} alt="" className="w-8 h-8 rounded-full retro-border object-cover" /> : <div className="w-8 h-8 rounded-full retro-border retro-bg-accent flex items-center justify-center text-sm">{profile?.emoji || '😊'}</div>}
                <span className="font-bold text-sm">{playerName}</span>
              </div>
              <span className="text-xs opacity-50 font-bold">&</span>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full retro-border retro-bg-secondary flex items-center justify-center text-sm">💕</div>
                <span className="font-bold text-sm">{partner}</span>
              </div>
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
            {onSaveToScrapbook && <RetroButton variant="accent" onClick={() => { playAudio('click', sfx); onSaveToScrapbook(resultImage); }} className="py-2 flex justify-center items-center gap-2 text-sm"><Download size={16} /> Save to Album</RetroButton>}
            {onRematch && <RetroButton variant="primary" onClick={onRematch} className="py-2 flex justify-center items-center gap-2 text-sm font-bold">⚡ Rematch</RetroButton>}
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}

// ── ScoreboardCountdown ──
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
      <div className="relative w-48 h-64 sm:w-64 sm:h-80 bg-[var(--bg-window)] border-8 border-[var(--border)] retro-shadow-dark flex flex-col items-center justify-center overflow-hidden animate-in zoom-in duration-300">
        <div className="absolute w-full h-1 bg-black/40 top-1/2 -translate-y-1/2 z-20 shadow-lg"></div>
        <div className={`relative text-[12rem] sm:text-[16rem] font-black leading-none select-none transition-all duration-500 transform ${isFlipping ? 'scale-y-0 opacity-0' : 'scale-y-100 opacity-100'}`} style={{ color: '#ff3e3e', textShadow: '0 0 30px rgba(255,62,62,0.4)', fontFamily: 'monospace' }}>
          {current === 0 ? 'GO!' : current}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
}
