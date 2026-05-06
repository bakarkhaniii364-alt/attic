import React from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';

export function RelationshipResume({ onClose, sfx, userId, roomProfiles = {} }) {
  const partnerId = Object.keys(roomProfiles).find(id => id !== userId);
  const myProfile = roomProfiles[userId] || {};
  const partnerProfile = roomProfiles[partnerId] || {};

  return (
    <RetroWindow title="our_resume.doc" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
       <div className="flex-1 bg-white p-6 sm:p-10 overflow-y-auto">
          <div className="border-b-4 border-[var(--border)] pb-6 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter">Relationship Resume</h1>
                <p className="font-bold opacity-50 uppercase text-xs tracking-widest mt-1">Status: Fully Synchronized</p>
             </div>
             <div className="flex -space-x-4">
                <div className="w-16 h-16 rounded-full retro-border bg-white overflow-hidden shadow-lg z-10">
                   <img src={myProfile.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} className="w-full h-full object-cover" alt="me" />
                </div>
                <div className="w-16 h-16 rounded-full retro-border bg-white overflow-hidden shadow-lg">
                   <img src={partnerProfile.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId}`} className="w-full h-full object-cover" alt="partner" />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
             <section>
                <h2 className="font-black uppercase text-sm border-b-2 border-dashed border-[var(--border)] mb-4 pb-1">Core Competencies</h2>
                <ul className="space-y-2 font-bold text-sm">
                   <li className="flex items-center gap-2">✨ Infinite Cuddling</li>
                   <li className="flex items-center gap-2">🍕 Pizza Selection</li>
                   <li className="flex items-center gap-2">🎤 Bad Karaoke</li>
                   <li className="flex items-center gap-2">🕒 Late Night Talks</li>
                </ul>
             </section>
             <section>
                <h2 className="font-black uppercase text-sm border-b-2 border-dashed border-[var(--border)] mb-4 pb-1">Shared Projects</h2>
                <div className="space-y-3">
                   <div>
                      <p className="text-[10px] font-black uppercase opacity-40">Project Name</p>
                      <p className="font-bold text-sm">"The Attic LDR Platform"</p>
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase opacity-40">Current Status</p>
                      <p className="font-bold text-sm">Active & Growing ❤️</p>
                   </div>
                </div>
             </section>
          </div>

          <div className="mt-10 p-6 retro-bg-main retro-border border-dashed">
             <h2 className="font-black text-center uppercase text-lg mb-4">Letter of Intent</h2>
             <p className="italic font-serif leading-loose text-center">
                "We hereby certify that our love is 100% authentic, occasionally chaotic, and permanently synchronized across all Attic modules."
             </p>
             <div className="flex justify-around mt-8">
                <div className="text-center">
                   <div className="h-px w-24 bg-[var(--border)] mb-2"></div>
                   <p className="text-[10px] font-black uppercase">{myProfile.name || 'You'}</p>
                </div>
                <div className="text-center">
                   <div className="h-px w-24 bg-[var(--border)] mb-2"></div>
                   <p className="text-[10px] font-black uppercase">{partnerProfile.name || 'Partner'}</p>
                </div>
             </div>
          </div>
       </div>
       <div className="p-4 bg-[var(--bg-main)] retro-border-t flex justify-center">
          <RetroButton variant="primary" onClick={() => window.print()} className="px-8">Export to PDF</RetroButton>
       </div>
    </RetroWindow>
  );
}
