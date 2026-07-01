import React from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';
import { Heart, Trophy, Star, Calendar } from 'lucide-react';
import { DesktopOnly } from '../MobileOnly.jsx';

export function RelationshipResume({ onClose, profile, coupleData = {}, scores = {}, sfx, userId, roomProfiles = {} }) {
  const partnerId = Object.keys(roomProfiles).find(id => id !== userId);
  const partnerProfile = roomProfiles[partnerId] || {};
  const partnerName = partnerProfile.name || 'Partner';

  const anniversary = coupleData?.anniversary;
  let daysTogether = 0;
  if (anniversary) { daysTogether = Math.floor((new Date() - new Date(anniversary)) / (1000 * 60 * 60 * 24)); }
  
  const myWins = Object.values(scores || {}).reduce((acc, game) => acc + (game[userId] || 0), 0);
  const partnerWins = Object.values(scores || {}).reduce((acc, game) => acc + (game[partnerId] || 0), 0);
  const totalGames = myWins + partnerWins;
  const winnerName = myWins > partnerWins ? 'You' : partnerWins > myWins ? partnerName : 'Tied';

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
       <div id="resume-card" className="flex-1 bg-white p-6 sm:p-12 overflow-y-auto text-black font-serif">
          <div className="border-b-4 border-black pb-8 mb-10 flex flex-col sm:flex-row justify-between items-center gap-6">
             <div className="text-center sm:text-left">
                <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2 font-sans">Relationship Resume</h1>
                <p className="font-bold opacity-60 uppercase text-[10px] tracking-[0.3em] font-sans">Established {anniversary || 'The Beginning'}</p>
             </div>
             <div className="flex -space-x-4">
                <div className="w-16 h-16 border-4 border-black bg-white overflow-hidden shadow-lg z-10">
                   <img src={profile?.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} className="w-full h-full object-cover" alt="me" />
                </div>
                <div className="w-16 h-16 border-4 border-black bg-white overflow-hidden shadow-lg">
                   <img src={partnerProfile?.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId}`} className="w-full h-full object-cover" alt="partner" />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
             <section className="space-y-8">
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-black mb-4 pb-1 flex items-center gap-2 font-sans">💕 Our Timeline</h2>
                   <ul className="space-y-3 font-bold text-sm">
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="opacity-60">Days of Magic</span>
                        <span>{daysTogether} ✨</span>
                      </li>
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="opacity-60">Games Shared</span>
                        <span>{totalGames} 🎮</span>
                      </li>
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="opacity-60">Winning Heart</span>
                        <span className="text-primary">{winnerName} 🏆</span>
                      </li>
                   </ul>
                </div>
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-black mb-4 pb-1 flex items-center gap-2 font-sans">🎮 Victory Counter</h2>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border-2 border-black bg-pink-100 text-center">
                         <p className="text-[9px] font-black uppercase opacity-50 font-sans">{profile?.name || 'You'}</p>
                         <p className="text-2xl font-black font-sans">{myWins}</p>
                         <p className="text-[9px] opacity-40 font-sans">💪 Victories</p>
                      </div>
                      <div className="p-3 border-2 border-black bg-purple-100 text-center">
                         <p className="text-[9px] font-black uppercase opacity-50 font-sans">{partnerName}</p>
                         <p className="text-2xl font-black font-sans">{partnerWins}</p>
                         <p className="text-[9px] opacity-40 font-sans">💪 Victories</p>
                      </div>
                   </div>
                </div>
             </section>
             
             <section className="space-y-8">
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-black mb-4 pb-1 flex items-center gap-2 font-sans">⭐ Favorite Games</h2>
                   <div className="space-y-2">
                      {Object.entries(scores || {})
                         .sort(([, a], [, b]) => (Object.values(b).reduce((x, y) => x + y, 0)) - (Object.values(a).reduce((x, y) => x + y, 0)))
                         .slice(0, 3)
                         .map(([game, stats]) => {
                            const total = Object.values(stats).reduce((x, y) => x + y, 0);
                            return (
                               <div key={game} className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                                  <span className="font-bold opacity-70 capitalize">{game.replace(/_/g, ' ')}</span>
                                  <span className="font-sans font-black text-[10px]">{total} SESSIONS</span>
                               </div>
                            );
                         })
                      }
                      {Object.keys(scores || {}).length === 0 && <p className="text-[10px] opacity-40 font-bold uppercase italic">No sessions recorded yet.</p>}
                   </div>
                </div>
                <div>
                   <h2 className="font-black uppercase text-xs border-b-2 border-black mb-4 pb-1 flex items-center gap-2 font-sans">📅 Our Dates</h2>
                   <div className="space-y-4">
                      <div className="flex justify-between items-end border-b border-gray-100 pb-1">
                         <p className="text-[10px] font-black uppercase opacity-40 font-sans">First Connection 💫</p>
                         <p className="font-bold text-sm">{anniversary || 'Once Upon a Time'}</p>
                      </div>
                      <div className="flex justify-between items-end border-b border-gray-100 pb-1">
                         <p className="text-[10px] font-black uppercase opacity-40 font-sans">Resume Created 📝</p>
                         <p className="font-bold text-sm">{new Date().toISOString().split('T')[0]}</p>
                      </div>
                   </div>
                </div>
             </section>
          </div>

          <div className="mt-12 text-center border-t-4 border-black pt-8 pb-4">
             <p className="text-xs font-bold opacity-50 uppercase tracking-widest">Made with 💕 in the Attic</p>
          </div>
       </div>
       <DesktopOnly>
         <div className="p-4 bg-gray-50 border-t-2 border-black flex flex-wrap justify-center gap-4">
            <RetroButton variant="primary" onClick={handleDownload} className="px-8 flex items-center gap-2">📥 Download Document</RetroButton>
            <RetroButton variant="white" onClick={() => window.print()} className="px-8 flex items-center gap-2">🖨️ Print for Filing</RetroButton>
         </div>
       </DesktopOnly>
    </RetroWindow>
  );
}
