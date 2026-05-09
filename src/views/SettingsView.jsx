import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Trophy, Image as ImageIcon, Sun, CloudRain, Snowflake, Trash2, Volume2, 
  LogOut, Heart, Calendar, Sparkle, Lock, Eye, EyeOff, Loader, Check, Hand, Zap, 
  CloudLightning, Save, X, Bell, MessageSquare, Monitor, Brush, Palette, Gamepad2, 
  ShieldCheck, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Search 
} from 'lucide-react';
import { useCall } from '../context/instances.js';
import { RetroWindow, RetroButton, ConfirmDialog, useToast } from '../components/UI.jsx';
import { compressImage } from '../utils/helpers.js';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';

export function SettingsView({ compact = false, onClose, theme, setTheme, profile, setProfile, onLogout, onDelete, sfxEnabled, setSfxEnabled, notificationsEnabled, setNotificationsEnabled, weather, setWeather, scores, userId, partnerId, coupleData, setCoupleData, streaks }) {
  const navigate = useNavigate();
  const toast = useToast();
  
  const safeProfile = profile || { name: 'You', emoji: '👤' };
  const { testTurnConfig, endCall, callStatus } = useCall();
  
  // View management
  const [currentView, setCurrentView] = useState('home'); // home, profile, aesthetics, relationship, system, privacy
  const [searchQuery, setSearchQuery] = useState('');
  const [history, setHistory] = useState(['home']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const navigateTo = (view) => {
    if (view === currentView) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(view);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentView(view);
    playAudio('notif', sfxEnabled);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentView(history[historyIndex - 1]);
      playAudio('click', sfxEnabled);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentView(history[historyIndex + 1]);
      playAudio('click', sfxEnabled);
    }
  };

  const availableThemes = ['default', 'matcha', 'val-sage', 'lavender', 'rose', 'minimal', 'monochrome', 'nord', 'coffee', 'velvet', 'starlight', 'crayon', 'vaporwave', 'messenger', 'reddit', 'discord', 'spotify', 'github', 'cyberpunk', 'synthwave', 'matrix', 'val-killjoy', 'midnight', 'gameboy', 'superman-2025', 'spiderman', 'batman', 'neon-tokyo'];

  const categories = [
    { id: 'profile', label: 'User Account', icon: <User size={24}/>, desc: 'Manage your avatar, name and password' },
    { id: 'aesthetics', label: 'Aesthetics', icon: <Palette size={24}/>, desc: 'Change themes, weather and patterns' },
    { id: 'relationship', label: 'Relationship', icon: <Heart size={24}/>, desc: 'Nicknames and anniversary settings' },
    { id: 'system', label: 'System & Audio', icon: <Monitor size={24}/>, desc: 'Sounds, notifications and call debugger' },
    { id: 'privacy', label: 'Privacy & Data', icon: <ShieldCheck size={24}/>, desc: 'Export data and account management' },
  ];

  const filteredCategories = categories.filter(c => 
    c.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handlePfpUpload = (e) => { 
    const file = e.target.files[0]; 
    if (file) { 
      const reader = new FileReader(); 
      reader.onloadend = async () => { 
        try {
          const compressed = await compressImage(reader.result, 150, 150, 0.6);
          setProfile({...profile, pfp: compressed}); 
          playAudio('click', sfxEnabled); 
          toast('Profile photo updated!', 'success'); 
        } catch (err) {
          toast('Failed to update photo.', 'error');
        }
      }; 
      reader.readAsDataURL(file); 
    } 
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      toast('Password updated!', 'success');
      setTimeout(() => setShowChangePassword(false), 2000);
    } catch (err) { setPasswordError(err.message); }
    finally { setPasswordLoading(false); }
  };

  const handleTestTurn = async () => {
    toast('Testing TURN...', 'info');
    await testTurnConfig();
    window.addEventListener('turn_test_result', (e) => {
      if (e.detail.hasRelay) toast('TURN relay OK!', 'success');
      else toast('TURN failed.', 'error');
    }, { once: true });
  };

  const handleExportData = async () => {
    toast('Compiling export...', 'info');
    const { data: roomData } = await supabase.rpc('get_my_room');
    const roomId = roomData?.id;
    if (!roomId) return;
    const { data: messages } = await supabase.from('chat_messages').select('*').eq('room_id', roomId);
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'attic_data.json'; link.click();
  };

  const renderContent = () => {
    if (currentView === 'home') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          {filteredCategories.map(c => (
            <button key={c.id} onClick={() => navigateTo(c.id)} className="flex items-center gap-4 p-4 retro-border bg-window hover:bg-border/10 transition-all text-left group">
              <div className="p-3 bg-primary/10 text-primary group-hover:scale-110 transition-transform">{c.icon}</div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">{c.label}</h3>
                <p className="text-[10px] font-bold opacity-40">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (currentView === 'profile') {
      return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div className="flex flex-col sm:flex-row gap-6 items-start">
             <div className="relative group mx-auto sm:mx-0">
                {safeProfile?.pfp ? <img src={safeProfile?.pfp} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-black object-cover" /> : <div className="w-24 h-24 rounded-full border-4 border-black bg-primary flex items-center justify-center text-5xl">{safeProfile?.emoji}</div>}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm"><ImageIcon size={24}/><input type="file" accept="image/*" onChange={handlePfpUpload} className="hidden" /></label>
             </div>
             <div className="flex-1 w-full space-y-4">
               <div><label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Your Name</label><input type="text" value={safeProfile.name || ''} onChange={(e) => setProfile({...safeProfile, name: e.target.value})} className="w-full p-3 retro-border bg-gray-50 focus:outline-none font-bold" /></div>
               <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Pet Name</label><input type="text" value={coupleData.petName || ''} onChange={(e) => setCoupleData({...coupleData, petName: e.target.value})} className="w-full p-2 retro-border bg-gray-50 focus:outline-none" /></div>
                  <div><label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Pet Variant</label>
                    <select value={coupleData.petSkin || '/assets/cat_1_9'} onChange={(e) => setCoupleData({...coupleData, petSkin: e.target.value})} className="w-full p-2 retro-border bg-gray-50 focus:outline-none font-bold">
                      <option value="/assets/cat_1">Cat 1</option><option value="/assets/cat_1_6">Cat 2</option><option value="/assets/cat_1_9">Cat 3</option>
                    </select>
                  </div>
               </div>
             </div>
           </div>

           <div className="pt-6 border-t border-dashed border-border">
              <h4 className="text-xs font-black uppercase tracking-widest mb-4">Account Security</h4>
              {!showChangePassword ? (
                <RetroButton onClick={() => setShowChangePassword(true)} variant="secondary" className="px-6 py-2">Change Password</RetroButton>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                   <div className="relative"><input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" minLength={6} className="w-full p-2 retro-border" /><button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30">{showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                   <div className="flex gap-2">
                     <RetroButton type="submit" variant="primary" disabled={passwordLoading} className="flex-1">{passwordLoading ? 'Updating...' : 'Update'}</RetroButton>
                     <RetroButton type="button" onClick={() => setShowChangePassword(false)} className="flex-1">Cancel</RetroButton>
                   </div>
                </form>
              )}
           </div>
           
           <div className="pt-6 border-t border-dashed border-border flex justify-end">
              <RetroButton onClick={() => setShowLogoutConfirm(true)} variant="secondary" className="bg-red-50 text-red-600 border-red-200">Logout of Attic</RetroButton>
           </div>
        </div>
      );
    }

    if (currentView === 'aesthetics') {
      return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Sun size={14}/> Atmosphere</h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {['clear', 'rain', 'snow', 'thunder', 'storm', 'spores'].map(w => (
                  <button key={w} onClick={() => { setWeather(w); playAudio('click', sfxEnabled); }} className={`p-3 retro-border font-bold text-[10px] uppercase transition-all ${weather === w ? 'bg-primary text-white scale-105' : 'bg-window hover:bg-black/5'}`}>{w}</button>
                ))}
              </div>
           </div>

           <div>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Palette size={14}/> Visual Themes</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {availableThemes.map(t => (
                  <div key={t} onClick={() => { setTheme(t); playAudio('click', sfxEnabled); }} className={`p-2 retro-border cursor-pointer transition-all ${theme === t ? 'ring-2 ring-primary scale-105' : 'opacity-70 hover:opacity-100'} bg-gray-50`}>
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black uppercase truncate pr-1">{t}</span>
                        {theme === t && <Check size={12} className="text-primary" />}
                     </div>
                     <div data-theme={t} className="h-6 w-full flex gap-1">
                        <div className="flex-1 bg-primary border border-black/10"></div><div className="flex-1 bg-secondary border border-black/10"></div><div className="flex-1 bg-accent border border-black/10"></div>
                     </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                 <h4 className="text-xs font-black uppercase tracking-widest mb-3">Dashboard Pattern</h4>
                 <div className="flex gap-2">
                    {['grid', 'dots', 'lines', 'none'].map(p => (
                      <button key={p} onClick={() => setCoupleData({ ...coupleData, settings: { ...coupleData.settings, bgPattern: p } })} className={`px-3 py-1.5 retro-border text-[9px] font-black uppercase ${coupleData.settings?.bgPattern === p ? 'bg-primary text-white' : 'bg-window'}`}>{p}</button>
                    ))}
                 </div>
              </div>
              <div>
                 <h4 className="text-xs font-black uppercase tracking-widest mb-3">Chat Wallpaper</h4>
                 <div className="flex gap-2">
                    {['none', 'pixel-garden', 'pixel-stars', 'pixel-clouds'].map(p => (
                      <button key={p} onClick={() => setCoupleData({ ...coupleData, settings: { ...coupleData.settings, chatWallpaper: p } })} className={`w-10 h-10 retro-border ${coupleData.settings?.chatWallpaper === p ? 'ring-2 ring-primary' : 'opacity-60'}`} style={{ backgroundColor: p==='pixel-garden'?'#90be6d':p==='pixel-stars'?'#2b2d42':p==='pixel-clouds'?'#a2d2ff':'transparent' }} />
                    ))}
                 </div>
              </div>
           </div>
        </div>
      );
    }

    if (currentView === 'relationship') {
      return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div className="max-w-md space-y-6">
              <div><label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Partner's Nickname</label><input type="text" value={coupleData.nicknames?.[partnerId] || ''} onChange={(e) => setCoupleData({ ...coupleData, nicknames: { ...coupleData.nicknames, [partnerId]: e.target.value } })} className="w-full p-3 retro-border bg-gray-50 focus:outline-none" /></div>
              <div><label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Your Anniversary</label><input type="date" value={coupleData?.anniversary || ''} onChange={(e) => setCoupleData(prev => ({ ...prev, anniversary: e.target.value }))} className="w-full p-3 retro-border bg-gray-50 focus:outline-none cursor-pointer" /></div>
           </div>
        </div>
      );
    }

    if (currentView === 'system') {
      return (
        <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                 <h4 className="text-xs font-black uppercase tracking-widest mb-4">Audio & Notifications</h4>
                 <div className="flex items-center justify-between p-3 retro-border bg-gray-50">
                    <span className="text-xs font-bold">UI Sound Effects</span>
                    <button onClick={() => setSfxEnabled(!sfxEnabled)} className={`w-12 h-6 rounded-full retro-border relative transition-colors ${sfxEnabled ? 'bg-primary' : 'bg-gray-300'}`}><div className={`w-5 h-5 bg-white border-2 border-black rounded-full absolute top-[-2px] transition-transform ${sfxEnabled ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                 </div>
                 <div className="flex items-center justify-between p-3 retro-border bg-gray-50">
                    <span className="text-xs font-bold">Browser Notifications</span>
                    <button onClick={() => setNotificationsEnabled(!notificationsEnabled)} className={`w-12 h-6 rounded-full retro-border relative transition-colors ${notificationsEnabled ? 'bg-primary' : 'bg-gray-300'}`}><div className={`w-5 h-5 bg-white border-2 border-black rounded-full absolute top-[-2px] transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                 </div>
              </div>
              <div className="space-y-4">
                 <h4 className="text-xs font-black uppercase tracking-widest mb-4">Call Debugger</h4>
                 <div className="p-4 retro-border bg-black/5 space-y-4">
                    <p className="text-[10px] font-bold opacity-60 uppercase">Manual Network Tests</p>
                    <RetroButton onClick={handleTestTurn} className="w-full text-[10px] py-2">Test TURN Servers</RetroButton>
                    <RetroButton onClick={() => { endCall(); toast('Engine reset', 'info'); }} variant="secondary" className="w-full text-[10px] py-2">Reset Call Engine</RetroButton>
                    <p className="text-[8px] font-black uppercase opacity-40">Status: {callStatus}</p>
                 </div>
              </div>
           </div>
        </div>
      );
    }

    if (currentView === 'privacy') {
      return (
        <div className="p-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div>
              <h4 className="text-xs font-black uppercase tracking-widest mb-4">Data Sovereignty</h4>
              <p className="text-xs opacity-60 mb-4">Download a portable backup of your history.</p>
              <RetroButton onClick={handleExportData} className="px-8 py-3">Export Data (.json)</RetroButton>
           </div>

           <div className="p-6 border-2 border-dashed border-red-200 bg-red-50/30">
              <h4 className="text-xs font-black uppercase tracking-widest mb-4 text-red-600 flex items-center gap-2"><Trash2 size={14}/> Danger Zone</h4>
              <div className="flex flex-col sm:flex-row gap-4">
                 <RetroButton onClick={async () => {
                    const ok = window.confirm("Disconnect from partner?");
                    if (ok) {
                      await supabase.rpc('leave_room', { room_uuid: coupleData.room_id });
                      navigate('/handshake'); window.location.reload();
                    }
                 }} className="flex-1 bg-white text-orange-600 border-orange-300">Unpair Handshake</RetroButton>
                 <RetroButton onClick={async () => {
                    const ok = window.confirm("DELETE ALL DATA?");
                    if (ok) {
                       await supabase.rpc('delete_my_room');
                       await supabase.auth.signOut();
                       window.location.href = '/';
                    }
                 }} className="flex-1 bg-red-600 text-white border-red-800">Destroy My Attic</RetroButton>
              </div>
           </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <RetroWindow title="control_panel.exe" onClose={onClose} noPadding className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col relative overflow-hidden">
        {/* Navigation Bar */}
        <div className="shrink-0 bg-border/10 border-b-2 border-border p-2 flex flex-col sm:flex-row gap-3 items-center">
           <div className="flex items-center gap-1 shrink-0">
              <button onClick={goBack} disabled={historyIndex === 0} className={`p-1.5 retro-border bg-window hover:bg-black/5 disabled:opacity-30 transition-all`}><ChevronLeft size={16} /></button>
              <button onClick={goForward} disabled={historyIndex === history.length - 1} className={`p-1.5 retro-border bg-window hover:bg-black/5 disabled:opacity-30 transition-all`}><ChevronRight size={16} /></button>
              <button onClick={() => navigateTo('home')} className="p-1.5 retro-border bg-window hover:bg-black/5 transition-all"><RefreshCw size={16} /></button>
           </div>
           
           <div className="flex-1 w-full bg-window retro-border px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold overflow-hidden">
              <span className="opacity-30 flex-shrink-0">Attic:</span>
              <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
                 <span className="hover:underline cursor-pointer" onClick={() => navigateTo('home')}>Control Panel</span>
                 {currentView !== 'home' && (
                   <>
                     <span className="opacity-30">/</span>
                     <span className="text-primary">{categories.find(c => c.id === currentView)?.label}</span>
                   </>
                 )}
              </div>
           </div>

           <div className="w-full sm:w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
              <input 
                type="text" 
                placeholder="Search settings..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (currentView !== 'home') setCurrentView('home');
                }}
                className="w-full pl-9 pr-3 py-1.5 retro-border bg-window text-[11px] font-bold focus:outline-none"
              />
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-main/20">
           {renderContent()}
        </div>

        {/* Footer Area */}
        <div className="shrink-0 p-4 bg-window border-t-2 border-border flex justify-between items-center">
           <div className="text-[9px] font-black uppercase tracking-widest opacity-30">Attic Configuration Manager v1.2</div>
           <div className="flex gap-2">
              <RetroButton onClick={onClose} variant="secondary" className="px-6 py-1.5 text-xs">Close</RetroButton>
              <RetroButton onClick={() => { playAudio('click', sfxEnabled); toast('Settings Saved!', 'success'); onClose(); }} variant="primary" className="px-8 py-1.5 text-xs">Save & Exit</RetroButton>
           </div>
        </div>
      </RetroWindow>

      {showLogoutConfirm && (
        <ConfirmDialog
          title="logout.exe"
          message="Are you sure you want to log out of the Attic?"
          onConfirm={() => { onLogout && onLogout(); }}
          onCancel={() => setShowLogoutConfirm(false)}
          sfx={sfxEnabled}
        />
      )}
    </>
  );
}
