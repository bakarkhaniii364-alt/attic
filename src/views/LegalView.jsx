import React from 'react';
import { RetroWindow } from '../components/UI.jsx';
import { ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LegalView({ onClose }) {
  const navigate = useNavigate();

  return (
    <RetroWindow title="terms_and_privacy.txt" onClose={onClose || (() => navigate(-1))} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-window text-main-text">
        <div className="max-w-2xl mx-auto space-y-16">
          
          <header className="text-center border-b-4 border-border pb-8">
            <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Terms of Service</h1>
            <p className="font-bold opacity-60">Last Updated: April 26, 2026</p>
          </header>

          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2"><FileText className="text-primary" /> 1. Agreement to Terms</h2>
            <p className="text-sm leading-relaxed font-medium">
              Welcome to <strong>Attic</strong> ("we," "our," or "us"). By creating an account, accessing, or using the Attic application (the "Service"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2">2. Service Description</h2>
            <p className="text-sm leading-relaxed font-medium">
              Attic is a private, digital application designed for couples to communicate, share media, play games, and track relationship milestones in a shared digital room (a "Room").
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2">3. Account & Security</h2>
            <div className="space-y-4 text-sm font-medium leading-relaxed">
              <p><strong>3.1 Eligibility:</strong> You must be at least 13 years old to use the Service.</p>
              <p><strong>3.2 Security:</strong> You are responsible for protecting your login credentials. Notify us immediately of any unauthorized access.</p>
              <p><strong>3.3 Partner Invitation:</strong> You are solely responsible for whom you invite to your Room and share your data with.</p>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2">4. User Content</h2>
            <div className="space-y-4 text-sm font-medium leading-relaxed">
              <p><strong>4.1 Ownership:</strong> You retain ownership of all text, images, and voice notes you submit. You grant us a limited license to host and display this content <strong>only</strong> to you and your partner.</p>
              <p><strong>4.2 Prohibited Conduct:</strong> You agree not to upload content that is unlawful, harassing, discriminatory, or involving the exploitation of minors. Malicious code and hacking attempts are strictly prohibited.</p>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2"><ShieldCheck className="text-secondary" /> 5. Privacy & Deletion</h2>
            <div className="space-y-4 text-sm font-medium leading-relaxed">
              <p><strong>5.1 Policy:</strong> Your use is governed by our Privacy Policy. We store shared data strictly for synchronization between your devices.</p>
              <p><strong>5.2 Right to be Forgotten:</strong> You may delete your account/Room at any time in Settings. <strong>WARNING:</strong> This will result in the immediate and permanent deletion of ALL data for both partners.</p>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-2 border-b-2 border-border pb-2">6. Limitation of Liability</h2>
            <p className="text-xs italic opacity-80 leading-relaxed font-bold">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ATTIC AND ITS DEVELOPERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES RESULTING FROM YOUR USE OR INABILITY TO USE THE SERVICE.
            </p>
          </section>

          <footer className="pt-10 border-t-2 border-dashed border-border text-center space-y-4">
            <div className="flex justify-center gap-4">
              <a href="mailto:support.attic.app@gmail.com" className="text-xs font-black uppercase underline hover:text-primary">Contact Support</a>
              <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noreferrer" className="text-xs font-black uppercase underline hover:text-secondary inline-flex items-center gap-1">Developer <ExternalLink size={10} /></a>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 italic">
              Adapted from Automattic templates under CC Sharealike.
            </p>
          </footer>
        </div>
      </div>
    </RetroWindow>
  );
}
