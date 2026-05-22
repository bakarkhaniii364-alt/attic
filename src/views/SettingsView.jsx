import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Lucide from 'lucide-react';
const { 
  User, Trophy, Image: ImageIcon, Sun, CloudRain, Snowflake, Trash2, Volume2, 
  LogOut, Heart, Calendar, Sparkle, Lock, Eye, EyeOff, Loader, Check, Hand, Zap, 
  CloudLightning, Save, X, Bell, MessageSquare, Monitor, Brush, Palette, Gamepad2, 
  ShieldCheck, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Search, VolumeX, Info
} = Lucide;
import { useCall } from '../context/instances.js';
import { RetroWindow, RetroButton, ConfirmDialog, useToast } from '../components/UI.jsx';
import { compressImage } from '../utils/helpers.js';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';
import { requestNotificationPermission, sendNativeNotification } from '../utils/notifications.js';

export function SettingsView({ compact = false, onClose, theme, setTheme, profile, setProfile, onLogout, onDelete, sfxEnabled, setSfxEnabled, notificationsEnabled, setNotificationsEnabled, weather, setWeather, scores, userId, partnerId, coupleData, setCoupleData, streaks }) {
  const navigate = useNavigate();
  const toast = useToast();
  
  const { 
    testTurnConfig, endCall, callStatus,
    noiseSuppression, setNoiseSuppression,
    echoCancellation, setEchoCancellation
  } = useCall();

  // Remember initial state for Cancel logic
  const initialTheme = useRef(theme);
  const initialSfx = useRef(sfxEnabled);
  const initialNotifs = useRef(notificationsEnabled);
  const initialWeather = useRef(weather);
  const initialNS = useRef(noiseSuppression);
  const initialEC = useRef(echoCancellation);

  // Local Buffers for Save/Cancel logic
  const [localTheme, setLocalTheme] = useState(theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', localTheme);
  }, [localTheme]);

  const [localProfile, setLocalProfile] = useState(profile || { name: 'You', emoji: '👤' });
  const [localCoupleData, setLocalCoupleData] = useState(coupleData);
  const [localSfxEnabled, setLocalSfxEnabled] = useState(sfxEnabled);
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(notificationsEnabled);
  const [localWeather, setLocalWeather] = useState(weather);
  const [localNoiseSuppression, setLocalNoiseSuppression] = useState(noiseSuppression);
  const [localEchoCancellation, setLocalEchoCancellation] = useState(echoCancellation);
  
  // View management
  const [currentView, setCurrentView] = useState('home'); 
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
    playAudio('notif', localSfxEnabled);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCurrentView(history[historyIndex - 1]);
      playAudio('click', localSfxEnabled);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCurrentView(history[historyIndex + 1]);
      playAudio('click', localSfxEnabled);
    }
  };

  const handleSave = () => {
    // Apply all local state to global state
    setTheme(localTheme);
    setProfile(localProfile);
    setCoupleData(localCoupleData);
    setSfxEnabled(localSfxEnabled);
    setNotificationsEnabled(localNotificationsEnabled);
    setWeather(localWeather);
    setNoiseSuppression(localNoiseSuppression);
    setEchoCancellation(localEchoCancellation);
    
    playAudio('success', localSfxEnabled);
    toast('Settings Saved!', 'success');
    
    // Close the settings view
    if (onClose) {
      setTimeout(onClose, 100);
    }
  };

  const handleCancel = () => {
    document.documentElement.setAttribute('data-theme', initialTheme.current);
    onClose();
  };

  const availableThemes = ['default', 'matcha', 'val-sage', 'lavender', 'rose', 'minimal', 'monochrome', 'nord', 'coffee', 'velvet', 'starlight', 'crayon', 'vaporwave', 'messenger', 'reddit', 'discord', 'spotify', 'github', 'cyberpunk', 'synthwave', 'matrix', 'val-killjoy', 'midnight', 'gameboy', 'superman-2025', 'spiderman', 'batman', 'neon-tokyo'];

  const categories = [
    { id: 'profile', label: 'User Account', icon: <User size={18}/>, desc: 'Name, avatar and pet settings' },
    { id: 'security', label: 'Security', icon: <Lock size={18}/>, desc: 'Password reset and authentication' },
    { id: 'aesthetics', label: 'Aesthetics', icon: <Palette size={18}/>, desc: 'Themes, weather and dashboard patterns' },
    { id: 'relationship', label: 'Relationship', icon: <Heart size={18}/>, desc: 'Partner nicknames and anniversary' },
    { id: 'system', label: 'System & Audio', icon: <Monitor size={18}/>, desc: 'Sounds, notifs and call engine' },
    { id: 'privacy', label: 'Privacy & Data', icon: <ShieldCheck size={18}/>, desc: 'Data export and account deletion' },
    { id: 'about', label: 'About Attic', icon: <Info size={18}/>, desc: 'Technology, privacy and project info' },
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

  const handlePfpUpload = (e) => { 
    const file = e.target.files[0]; 
    if (file) { 
      const reader = new FileReader(); 
      reader.onloadend = async () => { 
        try {
          const compressed = await compressImage(reader.result, 150, 150, 0.6);
          setLocalProfile({...localProfile, pfp: compressed}); 
          playAudio('click', localSfxEnabled); 
          toast('Photo buffered. Click SAVE to apply.', 'info'); 
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
      toast('Password updated immediately!', 'success');
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
            <RetroButton key={c.id} onClick={() => navigateTo(c.id)} variant="white" className="flex items-center gap-4 p-4 text-left group h-auto">
              <div className="p-3 bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-white rounded-md transition-colors">{c.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[11px] uppercase tracking-wider leading-none mb-1">{c.label}</h3>
                <p className="text-[9px] font-bold opacity-40 leading-tight">{c.desc}</p>
              </div>
            </RetroButton>
          ))}
        </div>
      );
    }

    if (currentView === 'profile') {
      return (
        <div className="p-6 space-y-6">
           <div className="flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative group mx-auto sm:mx-0 shrink-0">
                 {localProfile?.pfp ? <img src={localProfile?.pfp} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-border object-cover" /> : <div className="w-20 h-20 rounded-full border-4 border-border bg-primary flex items-center justify-center text-4xl">{localProfile?.emoji}</div>}
                 <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer backdrop-blur-sm transition-opacity"><ImageIcon size={20}/><input type="file" accept="image/*" onChange={handlePfpUpload} className="hidden" /></label>
              </div>
             <div className="flex-1 w-full space-y-3">
               <div><label className="block text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Your Name</label><input type="text" value={localProfile.name || ''} onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})} className="w-full p-1.5 retro-border bg-window focus:outline-none font-bold text-xs" /></div>
               <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Pet Name</label><input type="text" value={localCoupleData.petName || ''} onChange={(e) => setLocalCoupleData({...localCoupleData, petName: e.target.value})} className="w-full p-1.5 retro-border bg-window focus:outline-none text-xs" /></div>
                  <div><label className="block text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Pet Variant</label>
                    <select value={localCoupleData.petSkin || '/assets/cat_1_9'} onChange={(e) => setLocalCoupleData({...localCoupleData, petSkin: e.target.value})} className="w-full p-1.5 retro-border bg-window focus:outline-none font-bold text-xs">
                      <option value="/assets/cat_1">Cat 1</option><option value="/assets/cat_1_6">Cat 2</option><option value="/assets/cat_1_9">Cat 3</option>
                    </select>
                  </div>
               </div>
             </div>
           </div>
           
           <div className="pt-6 border-t border-dashed border-border flex justify-end">
              <RetroButton onClick={() => setShowLogoutConfirm(true)} variant="secondary" className="px-6 py-2 text-[10px]">LOGOUT OF ATTIC</RetroButton>
           </div>
        </div>
      );
    }

    if (currentView === 'security') {
      return (
        <div className="p-6 space-y-6">
           <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60">Security Settings</h4>
           <div className="p-4 retro-border bg-window border-dashed">
              <h5 className="text-[11px] font-black uppercase mb-3">Password Management</h5>
              {!showChangePassword ? (
                <RetroButton onClick={() => setShowChangePassword(true)} variant="primary" className="px-6 py-2 text-[10px]">RESET PASSWORD</RetroButton>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                   <div className="relative"><input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" minLength={6} className="w-full p-2 retro-border bg-window text-xs" /><button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30">{showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>
                   <div className="flex gap-2">
                     <RetroButton type="submit" variant="primary" disabled={passwordLoading} className="flex-1 py-2 text-[10px]">{passwordLoading ? 'UPDATING...' : 'UPDATE'}</RetroButton>
                     <RetroButton type="button" onClick={() => setShowChangePassword(false)} variant="secondary" className="flex-1 py-2 text-[10px]">CANCEL</RetroButton>
                   </div>
                   {passwordError && <p className="text-[9px] text-red-500 font-bold uppercase">{passwordError}</p>}
                </form>
              )}
           </div>
        </div>
      );
    }

    if (currentView === 'aesthetics') {
      return (
        <div className="p-4 space-y-6">
           <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Sun size={12}/> Atmosphere</h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {['clear', 'rain', 'snow', 'thunder', 'storm'].map(w => (
                  <RetroButton key={w} onClick={() => { setLocalWeather(w); playAudio('click', localSfxEnabled); }} variant={localWeather === w ? 'primary' : 'white'} className="py-1.5 text-[9px] uppercase">{w}</RetroButton>
                ))}
              </div>
           </div>

           <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Palette size={12}/> Theme Mode</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {availableThemes.map(t => (
                  <div 
                    key={t} 
                    onClick={() => { setLocalTheme(t); playAudio('click', localSfxEnabled); }} 
                    data-theme={t}
                    className={`retro-border p-3 cursor-pointer transition-all duration-300 relative group h-24 flex flex-col justify-between overflow-hidden
                      ${localTheme === t ? 'ring-2 ring-primary border-primary scale-[1.02] shadow-xl' : 'hover:scale-[1.01] hover:border-primary/30'}`}
                    style={{ backgroundColor: 'var(--bg-main)' }}
                  >
                     {/* Selection Tint Overlay */}
                     {localTheme === t && (
                       <div className="absolute inset-0 pointer-events-none bg-primary/10" />
                     )}

                     <div className="flex justify-between items-center relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-tighter text-main-text drop-shadow-sm">{t}</span>
                        {localTheme === t && (
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center border border-black/10 shadow-sm animate-in zoom-in duration-300">
                            <Check size={10} className="text-primary-text" />
                          </div>
                        )}
                     </div>
                     
                     <div className="border-2 border-dashed border-main-text/20 p-2 h-12 flex flex-col gap-1.5 bg-window/40 backdrop-blur-[1px] relative z-0 transition-colors duration-500">
                        <div className="flex gap-1.5 h-full">
                           <div className="flex-[2] bg-primary border border-black/10 rounded-sm shadow-sm transition-transform duration-500 group-hover:scale-105"></div>
                           <div className="flex-1 bg-secondary border border-black/10 rounded-sm shadow-sm transition-transform duration-500 group-hover:scale-95"></div>
                        </div>
                        <div className="h-2 w-3/4 bg-accent border border-black/10 rounded-sm shadow-sm transition-all duration-500 group-hover:w-full"></div>
                     </div>
                  </div>
                ))}
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-dashed border-border">
              <div>
                 <h4 className="text-[10px] font-black uppercase tracking-widest mb-3">Dashboard Pattern</h4>
                 <div className="flex gap-2">
                     {['grid', 'dots', 'lines', 'none'].map(p => (
                       <RetroButton key={p} onClick={() => setLocalCoupleData({ ...localCoupleData, settings: { ...localCoupleData.settings, bgPattern: p } })} variant={localCoupleData.settings?.bgPattern === p ? 'primary' : 'white'} className="px-3 py-1.5 text-[9px] uppercase">{p}</RetroButton>
                     ))}
                 </div>
              </div>
            </div>
         </div>
      );
    }

    if (currentView === 'relationship') {
      return (
        <div className="p-6 space-y-6">
           <div className="max-w-md space-y-4">
              <div><label className="block text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Partner's Nickname</label><input type="text" value={localCoupleData.nicknames?.[partnerId] || ''} onChange={(e) => setLocalCoupleData({ ...localCoupleData, nicknames: { ...localCoupleData.nicknames, [partnerId]: e.target.value } })} className="w-full p-2 retro-border bg-window focus:outline-none text-xs font-bold" /></div>
              <div><label className="block text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Your Anniversary</label><input type="date" value={localCoupleData?.anniversary || ''} onChange={(e) => setLocalCoupleData(prev => ({ ...prev, anniversary: e.target.value }))} className="w-full p-2 retro-border bg-window focus:outline-none cursor-pointer text-xs font-bold" /></div>
           </div>
        </div>
      );
    }

    if (currentView === 'system') {
      return (
        <div className="p-6 space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-5">
                 <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Volume2 size={12}/> Audio & Alerts</h4>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-[11px] font-bold">Sound Effects</span>
                    <button onClick={() => setLocalSfxEnabled(!localSfxEnabled)} className={`w-12 h-6 rounded-full border-2 border-border relative transition-colors duration-200 focus:outline-none ${localSfxEnabled ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-full bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localSfxEnabled ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-[11px] font-bold">Push Notifications</span>
                    <button onClick={async () => {
                       const nextState = !localNotificationsEnabled;
                       if (nextState) {
                         const granted = await requestNotificationPermission();
                         if (granted) {
                           setLocalNotificationsEnabled(true);
                           toast('Notifications enabled!', 'success');
                         } else {
                           toast('Notification permission denied.', 'error');
                           setLocalNotificationsEnabled(false);
                         }
                       } else {
                         setLocalNotificationsEnabled(false);
                       }
                    }} className={`w-12 h-6 rounded-full border-2 border-border relative transition-colors duration-200 focus:outline-none ${localNotificationsEnabled ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-full bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localNotificationsEnabled ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>
                 {localNotificationsEnabled && (
                    <div className="flex justify-between items-center p-2 retro-border bg-window border-dashed">
                       <span className="text-[11px] font-bold">Test Connection</span>
                       <RetroButton 
                         onClick={() => {
                           sendNativeNotification('Attic Notification Test! 💌', { 
                             body: 'This is a test notification to verify that push notifications are working.',
                             tag: 'test-notification'
                           }, true);
                           toast('Test notification triggered!', 'info');
                         }} 
                         variant="primary" 
                         className="text-[9px] py-1 px-3 uppercase"
                       >
                         Send Test
                       </RetroButton>
                    </div>
                 )}
                 
                 <h4 className="text-[10px] font-black uppercase tracking-widest mt-6 mb-2 flex items-center gap-2"><Monitor size={12}/> WebRTC Advanced</h4>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-[11px] font-bold">Noise Suppression</span>
                    <button onClick={() => setLocalNoiseSuppression(!localNoiseSuppression)} className={`w-12 h-6 rounded-full border-2 border-border relative transition-colors duration-200 focus:outline-none ${localNoiseSuppression ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-full bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localNoiseSuppression ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>
                 <div className="flex items-center justify-between p-2 retro-border bg-window">
                    <span className="text-[11px] font-bold">Echo Cancellation</span>
                    <button onClick={() => setLocalEchoCancellation(!localEchoCancellation)} className={`w-12 h-6 rounded-full border-2 border-border relative transition-colors duration-200 focus:outline-none ${localEchoCancellation ? 'bg-primary' : 'bg-disabled'}`}>
                       <div className={`w-4 h-4 rounded-full bg-window border-2 border-border absolute top-[2px] transition-all duration-200 ${localEchoCancellation ? 'left-[26px]' : 'left-[2px]'}`} />
                     </button>
                 </div>
              </div>
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest mb-2">Diagnostics</h4>
                 <div className="p-3 retro-border bg-window space-y-3 border-dashed">
                    <RetroButton onClick={handleTestTurn} variant="primary" className="w-full text-[9px] py-1.5 uppercase">TEST RELAY ENGINE</RetroButton>
                    <RetroButton onClick={() => { endCall(); toast('Engine reset', 'info'); }} variant="secondary" className="w-full text-[9px] py-1.5 uppercase">HARD RESET CALLS</RetroButton>
                    <p className="text-[8px] font-black uppercase tracking-tighter opacity-40 text-center">Engine: {callStatus}</p>
                 </div>
              </div>
           </div>
        </div>
      );
    }

    if (currentView === 'privacy') {
      return (
        <div className="p-6 space-y-10">
           <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-2">Archive Retrieval</h4>
              <p className="text-[10px] opacity-60 mb-3 font-bold uppercase tracking-tight leading-tight">Download your shared history in local machine readable format.</p>
              <RetroButton onClick={handleExportData} variant="primary" className="px-6 py-2 text-[10px]">EXPORT .JSON DATA</RetroButton>
           </div>

           <div className="p-5 border-2 border-dashed border-danger/30 bg-danger/5">
              <h4 className="text-[11px] font-black uppercase mb-4 text-danger flex items-center gap-2 font-black">🚨 CRITICAL ZONE</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                 <RetroButton onClick={async () => {
                    const ok = window.confirm("Disconnect from partner?");
                    if (ok) {
                      await supabase.rpc('leave_room', { room_uuid: localCoupleData.room_id });
                      navigate('/handshake'); window.location.reload();
                    }
                 }} variant="secondary" className="flex-1 bg-window text-warning border-warning/30 hover:bg-warning/10 text-[10px] py-2">UNPAIR ACCOUNT</RetroButton>
                 <RetroButton onClick={async () => {
                    const ok = window.confirm("DELETE ALL DATA PERMANENTLY?");
                    if (ok) {
                       await supabase.rpc('delete_my_room');
                       await supabase.auth.signOut();
                       window.location.href = '/';
                    }
                 }} variant="primary" className="flex-1 bg-danger text-danger-text border-danger text-[10px] py-2">DESTROY ATTIC DATA</RetroButton>
              </div>
           </div>
        </div>
      );
    }

    if (currentView === 'about') {
      return (
        <div className="p-6 space-y-8 max-w-lg">
           <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">The Architecture</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Attic is built as a peer-to-peer workspace for couples. It leverages <span className="text-primary underline">Supabase</span> for real-time synchronization and database storage, while utilizing <span className="text-primary underline">WebRTC</span> for low-latency voice and video communication.
              </p>
           </div>

           <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Privacy & Security</h4>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Privacy is handled by design. Signaling is conducted via encrypted broadcast channels. Live audio and video streams are routed directly between partners using <span className="text-primary">ICE/TURN</span> relay only when direct connection fails; Attic never stores or records your calls. 
              </p>
           </div>

           <div className="pt-6 border-t border-dashed border-border">
              <p className="text-xs font-bold italic opacity-60">
                Attic was built by <span className="text-main-text not-italic font-black">bakarkhaniii</span> as a fun project to explore digital intimacy and retro-futuristic UI. 
              </p>
              <p className="text-[10px] font-black uppercase mt-4 text-primary tracking-widest">
                Any sort of feedback would always be appreciated.
              </p>
           </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <RetroWindow title="control_panel.exe" onClose={handleCancel} noPadding className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col relative overflow-hidden transition-none">
        {/* Navigation Bar */}
        <div className="shrink-0 bg-border/5 border-b-2 border-border p-2 flex flex-col sm:flex-row gap-3 items-center">
           <div className="flex items-center gap-1.5 shrink-0">
              <RetroButton onClick={goBack} disabled={historyIndex === 0} variant="white" className="p-1.5 !min-w-0 flex items-center justify-center"><ChevronLeft size={16} /></RetroButton>
              <RetroButton onClick={goForward} disabled={historyIndex === history.length - 1} variant="white" className="p-1.5 !min-w-0 flex items-center justify-center"><ChevronRight size={16} /></RetroButton>
              <RetroButton onClick={() => navigateTo('home')} variant="white" className="p-1.5 !min-w-0 flex items-center justify-center"><RefreshCw size={16} /></RetroButton>
           </div>
           
           <div className="flex-1 w-full bg-window retro-border px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold overflow-hidden">
              <span className="opacity-30 flex-shrink-0 font-black">Attic:</span>
              <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
                 <span className="hover:underline cursor-pointer" onClick={() => navigateTo('home')}>Control Panel</span>
                 {currentView !== 'home' && (
                   <>
                     <span className="opacity-30">/</span>
                     <span className="text-primary font-black uppercase tracking-tight">{categories.find(c => c.id === currentView)?.label}</span>
                   </>
                 )}
              </div>
           </div>

           <div className="w-full sm:w-44 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={12} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (currentView !== 'home') setCurrentView('home');
                }}
                className="w-full pl-8 pr-3 py-1.5 retro-border bg-window text-[10px] font-bold focus:outline-none"
              />
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-main/5">
           <div key={localTheme} className="animate-in fade-in zoom-in-95 duration-500">
              {renderContent()}
           </div>
        </div>

        {/* Footer Area */}
        <div className="shrink-0 p-3 bg-window border-t-2 border-border flex justify-between items-center">
           <div className="text-[9px] font-black uppercase tracking-widest opacity-30">Configurator v1.2.1-rigid</div>
           <div className="flex gap-2">
              <RetroButton onClick={handleCancel} variant="secondary" className="px-5 py-1 text-[10px]">CANCEL</RetroButton>
              <RetroButton onClick={handleSave} variant="primary" className="px-6 py-1 text-[10px]">SAVE & APPLY</RetroButton>
           </div>
        </div>
      </RetroWindow>

      {showLogoutConfirm && (
        <ConfirmDialog
          title="logout.exe"
          message="Are you sure you want to log out of the Attic?"
          onConfirm={() => { onLogout && onLogout(); }}
          onCancel={() => setShowLogoutConfirm(false)}
          sfx={localSfxEnabled}
        />
      )}
    </>
  );
}
