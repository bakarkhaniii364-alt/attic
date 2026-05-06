import React from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';
import { Heart, Trophy, Star, Calendar } from 'lucide-react';

export function RelationshipResume({ onClose, profile, coupleData = {}, scores, sfx, userId, roomProfiles = {} }) {
  const partnerId = Object.keys(roomProfiles).find(id => id !== userId);
  const partnerProfile = roomProfiles[partnerId] || {};

  const anniversary = coupleData?.anniversary;
  let daysTogether = 0;
  if (anniversary) { daysTogether = Math.floor((new Date() - new Date(anniversary)) / (1000 * 60 * 60 * 24)); }
  
  const handleDownload = async () => {
    playAudio('click', sfx);
    const el = document.getElementById('resume-card');
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `relationship_resume.png`; a.click();
    } catch (e) { console.error(e); }
  };

  return (
    <RetroWindow title="our_resume.doc" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
       <div id="resume-card" className="flex-1 bg-window p-6 sm:p-12 overflow-y-auto text-main-text">
          <div className="border-b-4 border-border pb-8 mb-10 flex flex-col sm:flex-row justify-between items-center gap-6">
             <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">Relationship Resume</h1>
                <p className="font-bold opacity-40 uppercase text-[10px] tracking-[0.3em]">Established {anniversary || 'Day One'}</p>
             </div>
             <div className="flex -space-x-6">
                <div className="w-20 h-20 rounded-full retro-border bg-white overflow-hidden shadow-xl z-10 hover:scale-110 transition-transform">
                   <img src={profile?.pfp} className="w-full h-full object-cover" alt="me" />
                </div>
                <div className="w-20 h-20 rounded-full retro-border bg-white overflow-hidden shadow-xl hover:scale-110 transition-transform">
                   <img src={partnerProfile?.pfp} className="w-full h-full object-cover" alt="partner" />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
             <section className="space-y-6">
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-border mb-4 pb-1 flex items-center gap-2"><Star size={14}/> Core Competencies</h2>
                   <ul className="space-y-2 font-bold text-sm">
                      <li className="flex items-center gap-2">✨ Infinite Cuddling & Emotional Support</li>
                      <li className="flex items-center gap-2">🍕 Advanced Pizza Selection Skills</li>
                      <li className="flex items-center gap-2">🎤 Expert Level Bad Karaoke</li>
                      <li className="flex items-center gap-2">🕒 Professional Late Night Talking</li>
                   </ul>
                </div>
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-border mb-4 pb-1 flex items-center gap-2"><Trophy size={14}/> High Scores</h2>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border-2 border-border bg-main text-center">
                         <p className="text-[9px] font-black uppercase opacity-50">Days Sync'd</p>
                         <p className="text-xl font-black">{daysTogether}</p>
                      </div>
                      <div className="p-3 border-2 border-border bg-main text-center">
                         <p className="text-[9px] font-black uppercase opacity-50">Games Won</p>
                         <p className="text-xl font-black">{Object.values(scores || {}).reduce((a, b) => a + b, 0)}</p>
                      </div>
                   </div>
                </div>
             </section>
             <section className="space-y-6">
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-border mb-4 pb-1 flex items-center gap-2"><Calendar size={14}/> Key Milestones</h2>
                   <div className="space-y-4">
                      <div className="flex justify-between items-end border-b border-border pb-1">
                         <p className="text-[10px] font-black uppercase opacity-40">The Beginning</p>
                         <p className="font-bold text-sm">{anniversary || '---'}</p>
                      </div>
                      <div className="flex justify-between items-end border-b border-border pb-1">
                         <p className="text-[10px] font-black uppercase opacity-40">First Collaborative Art</p>
                         <p className="font-bold text-sm">2026-04-27</p>
                      </div>
                   </div>
                </div>
                <div className="p-4 bg-accent text-accent-text border-2 border-border text-center">
                   <p className="italic font-serif leading-relaxed text-sm">
                      "Certified authentic connection, synchronized across all digital dimensions."
                   </p>
                </div>
             </section>
          </div>

          <div className="mt-12 flex justify-around border-t-2 border-border pt-8">
             <div className="text-center">
                <div className="h-px w-32 bg-border mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">{profile?.name || 'You'}</p>
             </div>
             <div className="text-center">
                <div className="h-px w-32 bg-border mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">{partnerProfile?.name || 'Partner'}</p>
             </div>
          </div>
       </div>
       <div className="p-4 bg-main border-t-2 border-border flex justify-center gap-4">
          <RetroButton variant="primary" onClick={handleDownload} className="px-8">📥 Download PNG</RetroButton>
          <RetroButton variant="white" onClick={() => window.print()} className="px-8">🖨️ Print Resume</RetroButton>
       </div>
    </RetroWindow>
  );
}
