import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { ShieldCheck, FileText, ExternalLink, Heart, Trash2, Lock, PenTool, Sparkle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LegalView({ onClose, onAccept, isOverlay = false }) {
  const navigate = useNavigate();
  const [signed, setSigned] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [userName, setUserName] = useState('Guest');
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
    if (profile.name) setUserName(profile.name);
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Use a small buffer for rounding issues
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setHasScrolled(true);
    }
  };

  return (
    <div className={`w-full flex items-center justify-center p-4 ${isOverlay ? 'fixed inset-0 z-[var(--z-modal)] bg-black/40 backdrop-blur-sm' : 'min-h-[100dvh] bg-[#f0f0f0] pattern-dots'}`}>
      <RetroWindow 
        title="sanctuary_promise.pdf" 
        onClose={onClose || (() => navigate(-1))} 
        className="w-full max-w-4xl h-[calc(100dvh-2rem)] max-h-[900px] flex flex-col shadow-2xl scale-up-15"
        noPadding
      >
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Sidebar / Table of Contents */}
          <div className="w-full md:w-64 bg-main border-b-2 md:border-b-0 md:border-r-2 border-border p-6 space-y-6 shrink-0 hidden md:block">
            <div className="aspect-square bg-window retro-border flex items-center justify-center mb-8 relative group">
                <ShieldCheck size={64} className="text-primary group-hover:scale-110 transition-transform" />
                <Sparkle size={24} className="absolute -top-2 -right-2 text-accent animate-pulse" />
            </div>
            <nav className="space-y-4 text-[10px] font-black uppercase tracking-widest opacity-60">
                <p className="text-primary opacity-100">01. THE PROMISE</p>
                <p>02. DATA OWNERSHIP</p>
                <p>03. THE PURGE</p>
                <p>04. CONDUCT</p>
                <p>05. LIMITATIONS</p>
            </nav>
          </div>

          {/* Main Document Body */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 bg-window p-6 sm:p-12 relative flex flex-col overflow-y-auto"
          >
            {/* Stamp / Seal */}
            <div className="absolute top-12 right-12 w-24 h-24 border-4 border-primary/20 rounded-full flex items-center justify-center rotate-12 pointer-events-none select-none">
                <p className="text-[10px] font-black uppercase text-primary/40 text-center">Verified<br/>Sanctuary</p>
            </div>

            <div className="max-w-2xl mx-auto space-y-12 mb-20">
              <header className="border-b-4 border-border pb-8">
                <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 text-main-text">The Sanctuary Promise</h1>
                <p className="font-bold opacity-40 text-xs uppercase tracking-[0.3em]">A Private Digital Harbor for Two</p>
              </header>

              <section className="space-y-4">
                <h2 className="text-xl font-black uppercase flex items-center gap-3 border-b-2 border-border pb-2 text-primary">
                    <Heart size={20} fill="currentColor" /> 01. The Mission
                </h2>
                <p className="text-base leading-loose text-main-text opacity-90 italic">
                  "Attic is not a social network. It is a social sanctuary."
                </p>
                <p className="text-sm leading-relaxed font-medium opacity-80 text-main-text">
                  We promise to never sell your data, never display advertisements, and never allow public algorithms to touch your private space. Our only objective is to provide a reliable, beautiful container for your connection.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-black uppercase flex items-center gap-3 border-b-2 border-border pb-2 text-secondary">
                    <Lock size={20} fill="currentColor" /> 02. Sovereign Data
                </h2>
                <p className="text-sm leading-relaxed font-medium opacity-80 text-main-text">
                  You retain 100% ownership of your media. We use end-to-end signaled WebRTC for real-time games and high-frequency data, meaning much of your interaction never even touches our persistent database. Your voice notes and images are stored in private, signed buckets accessible only to your room's participants.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-black uppercase flex items-center gap-3 border-b-2 border-border pb-2 text-accent">
                    <Trash2 size={20} fill="currentColor" /> 03. The 'Burn it Down' Clause
                </h2>
                <p className="text-sm leading-relaxed font-medium opacity-80 text-main-text">
                  In Attic, deletion is absolute. If you choose to delete your room, we trigger an <span className="font-black underline text-main-text">Atomic Cascade Deletion</span>. This wipes all messages, assets, and metadata for both partners simultaneously. There is no 'trash bin' and no recovery. Your privacy is protected even from us.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-xl font-black uppercase flex items-center gap-3 border-b-2 border-border pb-2 opacity-40">
                    <FileText size={20} fill="currentColor" /> 04. The Handshake
                </h2>
                <div className="bg-main/30 p-6 retro-border border-dashed space-y-6">
                    <div className="flex flex-col sm:flex-row gap-8 justify-between items-center">
                        <div className="space-y-2 flex-1">
                            <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Partner Signature</p>
                            <div className="h-10 border-b-2 border-border flex items-end pb-1 overflow-hidden">
                                <p className="font-cursive text-2xl opacity-30 select-none">Partner Name</p>
                            </div>
                        </div>
                        <div className="w-12 h-12 flex items-center justify-center opacity-20">
                            <PenTool size={32} className="-rotate-45" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">Your Signature</p>
                            <div className="h-10 border-b-2 border-border flex items-end pb-1">
                                {signed ? (
                                    <p className="font-cursive text-2xl text-primary animate-in fade-in slide-in-from-left-4 duration-1000">{userName}</p>
                                ) : (
                                    <button 
                                      onClick={() => setSigned(true)}
                                      disabled={!hasScrolled}
                                      className={`text-[10px] font-black uppercase text-secondary underline hover:text-primary transition-colors cursor-pointer ${!hasScrolled ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
                                    >
                                        {hasScrolled ? 'Click to Sign Agreement' : 'Scroll to Bottom to Sign'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
              </section>

              <footer className="pt-10 border-t-2 border-dashed border-border text-center space-y-6">
                <div className="flex justify-center gap-6">
                  <a href="mailto:support.attic.app@gmail.com" className="text-xs font-black uppercase underline hover:text-primary tracking-widest">Support</a>
                  <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noreferrer" className="text-xs font-black uppercase underline hover:text-secondary inline-flex items-center gap-1 tracking-widest">Developer <ExternalLink size={10} /></a>
                </div>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30 italic">
                  Built with love, for the lovers.
                </p>
              </footer>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-border/20 border-t-2 border-border flex justify-end gap-3 shrink-0">
            <RetroButton variant="white" onClick={onClose || (() => navigate(-1))}>Close</RetroButton>
            <RetroButton 
                disabled={!signed || !hasScrolled} 
                onClick={onAccept || onClose || (() => navigate(-1))}
                className={(signed && hasScrolled) ? 'animate-bounce-short' : 'opacity-50 grayscale'}
            >
                {(signed && hasScrolled) ? 'I Accept the Promise' : !hasScrolled ? 'Please Scroll to Read' : 'Please Sign Above'}
            </RetroButton>
        </div>
      </RetroWindow>
    </div>
  );
}
