import React from 'react';
import { RetroWindow } from '../components/UI.jsx';
import { ShieldCheck, FileText, ExternalLink, Heart, Trash2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LegalView({ onClose }) {
  const navigate = useNavigate();

  return (
    <RetroWindow title="sanctuary_promise.txt" onClose={onClose || (() => navigate(-1))} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-window text-main-text">
        <div className="max-w-2xl mx-auto space-y-12">
          
          <header className="text-center border-b-4 border-border pb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-primary border-dashed">
              <ShieldCheck size={32} className="text-primary" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">The Sanctuary Promise</h1>
            <p className="font-bold opacity-60 text-xs uppercase tracking-widest">A corner of the internet, just for the two of you.</p>
          </header>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2"><Heart className="text-primary" size={18} /> 1. The Sanctuary Promise</h2>
            <p className="text-sm leading-relaxed font-bold opacity-80">
              Attic is designed to be a digital sanctuary for you and your partner. We provide the room; you fill it with memories. We do not sell your data, run ads, or let third parties peek into your space. Our goal is to provide a safe, private harbor for your relationship to grow.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2"><Lock className="text-secondary" size={18} /> 2. Your Data, Your Rules</h2>
            <p className="text-sm leading-relaxed font-bold opacity-80">
              You own everything you upload—every doodle, voice note, and photo. Because Attic syncs your data in real-time between you and your partner, we store it securely on our encrypted servers. However, we only serve it back to the two of you. We believe your private moments should stay exactly that—private.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2"><Trash2 className="text-accent" size={18} /> 3. The 'Burn it Down' Clause</h2>
            <p className="text-sm leading-relaxed font-bold opacity-80">
              Breakups happen, and fresh starts are important. If you delete your room, we trigger a cascade deletion. This means every chat, picture, and game score is permanently wiped from our database for both you and your partner. We cannot recover it. Please download anything you wish to keep beforehand.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2"><ShieldCheck className="text-primary" size={18} /> 4. Code of Conduct</h2>
            <p className="text-sm leading-relaxed font-bold opacity-80">
              Keep it kind and keep it legal. While your room is private, using Attic to host illegal content, exploit minors, or distribute malicious code will result in immediate termination of the room. We reserve the right to act on reported violations to keep the platform safe for everyone.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2"><FileText className="opacity-50" size={18} /> 5. Legal Terms</h2>
            <p className="text-[10px] leading-relaxed font-bold opacity-50 italic">
              By using Attic, you agree to these terms. Attic and its developers are not liable for any damages resulting from your use of the service. All content is provided "as is."
            </p>
          </section>

          <footer className="pt-10 border-t-2 border-dashed border-border text-center space-y-4">
            <div className="flex justify-center gap-4">
              <a href="mailto:support.attic.app@gmail.com" className="text-xs font-black uppercase underline hover:text-primary">Contact Support</a>
              <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noreferrer" className="text-xs font-black uppercase underline hover:text-secondary inline-flex items-center gap-1">Developer <ExternalLink size={10} /></a>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">
              Built with love for couples everywhere.
            </p>
          </footer>
        </div>
      </div>
    </RetroWindow>
  );
}
