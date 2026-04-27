import React, { useState } from 'react';
import { Moon, Send, Trash2 } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

export function DreamJournal({ onClose, sfx, userId, roomProfiles = {} }) {
  const [entries, setEntries] = useGlobalSync('dream_journal', []);
  const [newDream, setNewDream] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [tab, setTab] = useState('write');

  const addDream = () => {
    if (!newDream.trim()) return;
    playAudio('send', sfx);
    setEntries([{ id: Date.now(), text: newDream, interpretation, date: new Date().toLocaleDateString(), mood: '🌙', authorId: userId }, ...entries]);
    setNewDream(''); setInterpretation(''); setTab('journal');
  };

  const deleteDream = (id) => { playAudio('click', sfx); setEntries(entries.filter(e => e.id !== id)); };

  const getUserName = (id) => {
    if (id === userId) return 'You';
    return roomProfiles[id]?.name || 'Partner';
  };

  return (
    <RetroWindow title="dream_journal.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]" confirmOnClose hasUnsavedChanges={() => newDream.trim() !== '' || interpretation.trim() !== ''} onSaveBeforeClose={() => { addDream(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="flex border-b-2 retro-border shrink-0">
        <button onClick={() => setTab('write')} className={`flex-1 py-3 font-bold ${tab === 'write' ? 'retro-bg-primary text-[var(--bg-window)]' : 'retro-bg-window opacity-70'}`}><Moon size={14} className="inline mr-1"/> Write Dream</button>
        <button onClick={() => setTab('journal')} className={`flex-1 py-3 font-bold border-l-2 retro-border ${tab === 'journal' ? 'retro-bg-secondary text-[var(--bg-window)]' : 'retro-bg-window opacity-70'}`}>📖 Journal ({entries.length})</button>
      </div>
      {tab === 'write' ? (
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
          <h3 className="font-bold text-lg">What did you dream about?</h3>
          <textarea value={newDream} onChange={e => setNewDream(e.target.value)} placeholder="Describe your dream..." className="min-h-[150px] p-4 retro-border retro-bg-window focus:outline-none resize-none font-serif text-base leading-relaxed" />
          <textarea value={interpretation} onChange={e => setInterpretation(e.target.value)} placeholder="Your interpretation (optional)..." className="min-h-[60px] p-3 retro-border retro-bg-window focus:outline-none resize-none text-sm" />
          <RetroButton onClick={addDream} className="py-3 flex items-center justify-center gap-2"><Send size={16}/> Save Dream</RetroButton>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 && <p className="text-center opacity-50 mt-10 font-bold">No dreams yet. Start journaling!</p>}
          {entries.map(e => (
            <div key={e.id} className="retro-border retro-bg-window p-4 mb-3 retro-shadow-dark">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase opacity-40">By {getUserName(e.authorId)} • {e.date}</span>
                <button onClick={() => deleteDream(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
              </div>
              <p className="font-serif leading-relaxed text-[var(--text-main)] break-words whitespace-pre-wrap max-w-full-break">{e.text}</p>
              {e.interpretation && <p className="text-sm italic opacity-60 mt-2 border-t border-dashed pt-2 border-[var(--border)] break-words whitespace-pre-wrap max-w-full-break">💭 {e.interpretation}</p>}
            </div>
          ))}
        </div>
      )}
    </RetroWindow>
  );
}
