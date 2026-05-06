import React, { useState } from 'react';
import { Trash2, Send, Check } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { playAudio } from '../utils/audio.js';

export function ListsApp({ onClose, sfx, userId, roomProfiles = {} }) {
  const [activeTab, setActiveTab] = useState('watchlist'); 
  const [lists, setLists] = useGlobalSync('shared_lists', { 
    watchlist: [], 
    bucketlist: [], 
    groceries: [] 
  }); 
  const [newItem, setNewItem] = useState('');

  const handleAdd = (e) => { 
    e.preventDefault(); 
    if (!newItem.trim()) return; 
    playAudio('click', sfx); 
    const item = { id: Date.now(), text: newItem, done: false, authorId: userId };
    setLists(prev => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] || []), item]
    }));
    setNewItem(''); 
  };

  const toggleDone = (id) => { 
    playAudio('click', sfx); 
    setLists(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).map(i => i.id === id ? {...i, done: !i.done} : i)
    }));
  };

  const deleteItem = (id) => { 
    playAudio('click', sfx); 
    setLists(prev => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter(i => i.id !== id)
    }));
  };

  const currentItems = lists[activeTab] || [];
  const getUserName = (id) => {
    if (id === userId) return 'You';
    return roomProfiles[id]?.name || 'Partner';
  };

  return (
    <RetroWindow title="shared_lists.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
      <div className="flex border-b-2 retro-border shrink-0 overflow-x-auto no-scrollbar">
        <button onClick={() => {playAudio('click', sfx); setActiveTab('watchlist')}} className={`flex-1 min-w-[120px] py-3 font-bold ${activeTab === 'watchlist' ? 'bg-[var(--primary)] text-white' : 'bg-white opacity-70'}`}>Watchlist</button>
        <button onClick={() => {playAudio('click', sfx); setActiveTab('bucketlist')}} className={`flex-1 min-w-[120px] py-3 font-bold border-l-2 retro-border ${activeTab === 'bucketlist' ? 'bg-[var(--secondary)] text-white' : 'bg-white opacity-70'}`}>Bucket List</button>
        <button onClick={() => {playAudio('click', sfx); setActiveTab('groceries')}} className={`flex-1 min-w-[120px] py-3 font-bold border-l-2 retro-border ${activeTab === 'groceries' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-white opacity-70'}`}>Groceries</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg-main)]">
        <div className="space-y-3">
          {currentItems.length === 0 && (
            <div className="text-center py-10 opacity-30 font-bold uppercase tracking-widest text-xs">List is empty</div>
          )}
          {currentItems.map(item => ( 
            <div key={item.id} className="flex items-center gap-3 p-3 bg-white retro-border shadow-[2px_2px_0px_0px_var(--border)] group animate-in slide-in-from-left-2 duration-300">
              <button onClick={() => toggleDone(item.id)} className={`w-6 h-6 retro-border flex items-center justify-center transition-colors ${item.done ? 'bg-green-400' : 'bg-white'}`}>
                {item.done && <Check size={14} className="text-white" />}
              </button>
              <div className="flex-1 flex flex-col min-w-0">
                <span className={`font-bold transition-all break-words whitespace-pre-wrap max-w-full-break flex-1 ${item.done ? 'line-through opacity-40' : ''}`}>{item.text}</span>
                <span className="text-[8px] font-black uppercase opacity-40 tracking-tighter mt-0.5">Added by {getUserName(item.authorId)}</span>
              </div>
              <button onClick={() => deleteItem(item.id)} className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 transition-all">
                <Trash2 size={16}/>
              </button>
            </div> 
          ))}
        </div>
      </div>
      <form onSubmit={handleAdd} className="p-3 bg-white retro-border-t flex gap-2 shrink-0">
        <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder={`Add to ${activeTab}...`} className="flex-1 p-3 retro-border focus:outline-none font-bold text-sm" />
        <RetroButton type="submit" variant="primary" className="px-6"><Send size={18}/></RetroButton>
      </form>
    </RetroWindow>
  );
}
