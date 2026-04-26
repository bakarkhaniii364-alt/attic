import React from 'react';
import { RetroWindow } from '../components/UI.jsx';
import { ShieldCheck, FileText, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LegalView({ onClose }) {
  const navigate = useNavigate();

  return (
    <RetroWindow title="legal_notice.txt" onClose={onClose || (() => navigate(-1))} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white/50 text-[var(--text-main)]">
        <div className="max-w-2xl mx-auto space-y-12">
          
          <header className="text-center border-b-2 border-dashed border-[var(--border)] pb-8">
            <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Legal Notices</h1>
            <p className="font-bold opacity-60">Privacy Policy & Terms of Service</p>
          </header>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase flex items-center gap-2"><ShieldCheck className="text-[var(--primary)]" /> Privacy Policy</h2>
            <p className="text-sm leading-relaxed">
              At <strong>Attic</strong>, we care about your privacy. Because this is an app for couples, we store your shared 
              chat messages, photos, and game scores to keep them synced across your devices.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-2 opacity-80 font-bold">
              <li>We do not sell your data to third parties.</li>
              <li>Your messages are stored securely in our Supabase database.</li>
              <li>You have the right to export your data at any time from Settings.</li>
              <li>You have the right to be forgotten (deleting your room wipes all associated data).</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase flex items-center gap-2"><FileText className="text-[var(--secondary)]" /> Terms of Service</h2>
            <p className="text-sm leading-relaxed">
              By using Attic, you agree to treat your partner with respect. Don't use this app for anything illegal.
              We provide this service "as-is" and aren't responsible if you lose your streaks because you forgot to check in!
            </p>
            <div className="bg-[var(--accent)]/20 p-4 retro-border border-dashed text-xs">
              This policy is adapted from the Automattic (WordPress.com) open-source templates, used under a Creative Commons Sharealike license.
            </div>
          </section>

          <footer className="pt-10 text-center opacity-40 text-[10px] font-bold uppercase tracking-widest">
            Last Updated: April 2026
          </footer>
        </div>
      </div>
    </RetroWindow>
  );
}
