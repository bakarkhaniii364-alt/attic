import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { ShieldCheck, FileText, ExternalLink, Heart, Trash2, Lock, PenTool, Sparkle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LegalView({ onClose, onAccept, isOverlay = false }) {
  const navigate = useNavigate();

  return (
    <div className={`w-full h-[100dvh] flex items-center justify-center p-4 overflow-hidden ${isOverlay ? 'fixed inset-0 z-[var(--z-modal)] bg-black/40 backdrop-blur-sm' : 'bg-[#f0f0f0]'}`}>
      <RetroWindow 
        title="sanctuary_promise.pdf" 
        onClose={onClose || (() => navigate(-1))} 
        className="w-full max-w-2xl h-full max-h-[800px] flex flex-col shadow-2xl scale-up-15"
        noPadding
      >
        <div className="flex-1 overflow-y-auto bg-window p-6 sm:p-10 space-y-12">
            <header className="border-b-4 border-border pb-6">
                <div className="flex items-center gap-4 mb-4">
                    <ShieldCheck size={40} className="text-primary" />
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter text-main-text">Sanctuary Promise</h1>
                        <p className="font-bold opacity-40 text-[9px] uppercase tracking-[0.3em]">Legal Terms & Privacy Agreement</p>
                    </div>
                </div>
            </header>

            <div className="space-y-10">
                <section className="space-y-3">
                    <h2 className="text-lg font-black uppercase flex items-center gap-2 text-primary">
                        <Heart size={18} fill="currentColor" /> 01. The Mission
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-80 text-main-text italic">
                        "Attic is not a social network. It is a social sanctuary."
                    </p>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        We promise to never sell your data, never display advertisements, and never allow public algorithms to touch your private space. Our only objective is to provide a reliable, beautiful container for your connection.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-black uppercase flex items-center gap-2 text-secondary">
                        <Lock size={18} fill="currentColor" /> 02. Sovereign Data
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        You retain 100% ownership of your media. We use end-to-end signaled WebRTC for real-time games and high-frequency data, meaning much of your interaction never even touches our persistent database. Your voice notes and images are stored in private, signed buckets accessible only to your room's participants.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-black uppercase flex items-center gap-2 text-accent">
                        <Trash2 size={18} fill="currentColor" /> 03. The 'Burn it Down' Clause
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        In Attic, deletion is absolute. If you choose to delete your room, we trigger an Atomic Cascade Deletion. This wipes all messages, assets, and metadata for both partners simultaneously. There is no 'trash bin' and no recovery.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-black uppercase flex items-center gap-2 opacity-50">
                        <FileText size={18} fill="currentColor" /> 04. Terms of Conduct
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        By using Attic, you agree to treat the space with respect. We do not monitor your content, but we reserve the right to suspend accounts involved in illegal activities or platform abuse. This is your home; keep it clean.
                    </p>
                </section>
            </div>

            <footer className="pt-8 border-t-2 border-dashed border-border flex flex-col items-center gap-4">
                <div className="flex gap-8">
                    <a href="mailto:support.attic.app@gmail.com" className="text-[10px] font-black uppercase underline hover:text-primary tracking-widest flex items-center gap-1">Contact Support</a>
                    <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase underline hover:text-secondary inline-flex items-center gap-1 tracking-widest">Developer <ExternalLink size={10} /></a>
                </div>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-20 italic">
                    Built with love, for the lovers.
                </p>
            </footer>
        </div>

        {onAccept && (
            <div className="p-4 bg-border/10 border-t-2 border-border flex justify-end gap-3">
                <RetroButton 
                    variant="primary"
                    onClick={onAccept}
                >
                    I Accept the Promise
                </RetroButton>
            </div>
        )}
      </RetroWindow>
    </div>
  );
}
