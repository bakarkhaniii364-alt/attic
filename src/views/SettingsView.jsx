import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Trophy, Image as ImageIcon, Sun, CloudRain, Snowflake, Trash2, Volume2, LogOut, Heart, Calendar, Sparkle, Lock, Eye, EyeOff, Loader, Check, Hand, Zap, CloudLightning, Save, X, Bell, MessageSquare, Monitor, Brush, Palette, Gamepad2 } from 'lucide-react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { getScore, compressImage } from '../utils/helpers.js';
import { getScoreForUser } from '../utils/userDataHelpers.js';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';

export function SettingsView({ compact = false, onClose, theme, setTheme, profile, setProfile, onLogout, onDelete, sfxEnabled, setSfxEnabled, notificationsEnabled, setNotificationsEnabled, weather, setWeather, scores, userId, partnerId, coupleData, setCoupleData, streaks }) {
  const navigate = useNavigate();
  const toast = useToast();
  
  // Cache the initial state so we can revert if "Cancel" is clicked
  const [initialState] = useState({
    theme, weather, profile, coupleData, sfxEnabled, notificationsEnabled
  });

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const availableThemes = ['default', 'matcha', 'midnight', 'cyberpunk', 'synthwave', 'minimal', 'monochrome', 'hawkins', 'lavender', 'coffee', 'nord'];

  const handleCancel = () => {
    setTheme(initialState.theme);
    setWeather(initialState.weather);
    setProfile(initialState.profile);
    setCoupleData(initialState.coupleData);
    setSfxEnabled(initialState.sfxEnabled);
    setNotificationsEnabled(initialState.notificationsEnabled);
    onClose();
  };

  const handleSave = () => {
    playAudio('click', sfxEnabled);
    toast('Settings Saved!', 'success');
    onClose();
  };

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
          console.error("PFP Error:", err);
          toast('Failed to update photo. Try a different one.', 'error');
        }
      }; 
      reader.readAsDataURL(file); 
    } 
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    playAudio('click', sfxEnabled);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPasswordError(error.message || 'Failed to change password'); setPasswordLoading(false); return; }
      setPasswordSuccess(true);
      toast('Password changed successfully!', 'success');
      setTimeout(() => {
        setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err.message || 'Something went wrong');
      setPasswordLoading(false);
    }
  };

  const handleUnpair = async () => {
    try {
      const { data: roomData, error: rdErr } = await supabase.rpc('get_my_room');
      if (rdErr || !roomData) return toast('No paired room found', 'error');
      const roomId = roomData.id || roomData?.id;
      if (!roomId) return toast('Could not determine room', 'error');

      await supabase.rpc('leave_room', { room_uuid: roomId });
      try { window.localStorage.removeItem('attic_room_id'); } catch (e) {}
      toast('Unpaired. Returning to handshake...', 'success');
      setTimeout(() => { navigate('/handshake'); window.location.reload(); }, 500);
    } catch (err) { console.error(err); toast('Failed to unpair.', 'error'); }
  };

  const handleExportData = async () => {
    toast('Compiling your data...', 'info');
    try {
      const { data: roomData } = await supabase.rpc('get_my_room');
      const roomId = roomData?.id;
      if (!roomId) throw new Error("No room found");

      const { data: messages, error } = await supabase.from('chat_messages').select('sender_id, content, type, created_at, metadata').eq('room_id', roomId).order('created_at', { ascending: true });
      if (error) throw error;

      const dataBlob = new Blob([JSON.stringify({ export_date: new Date().toISOString(), user_id: userId, room_id: roomId, messages: messages }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a'); link.href = url; link.download = `attic_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast('Export complete!', 'success');
    } catch (err) { console.error(err); toast('Export failed', 'error'); }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("🚨 PERMANENT ACTION: This will delete your shared Room and ALL data. Proceed?");
    if (confirmDelete) {
      toast('Deleting everything...', 'info');
      try {
        const { error } = await supabase.rpc('delete_my_room');
        if (error) throw error;
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = '/';
      } catch (err) { console.error(err); toast('Deletion failed', 'error'); }
    }
  };

  const contentArea = (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6">
      {/* Profile Section */}
      <section className="p-4 retro-bg-window retro-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><User size={20}/> user profile</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
             <div className="relative group cursor-pointer">
                {profile.pfp ? <img src={profile.pfp} alt="Avatar" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full retro-border retro-shadow-dark object-cover" /> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full retro-border retro-bg-accent flex items-center justify-center text-3xl sm:text-4xl">{profile.emoji}</div>}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm"><ImageIcon size={20}/><input type="file" accept="image/*" onChange={handlePfpUpload} className="hidden" /></label>
             </div>
             <div className="flex-1 w-full space-y-2">
               <div><label className="block text-sm font-bold mb-1">display name</label><input type="text" value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} className="w-full p-2 retro-border retro-bg-window focus:outline-none" /></div>
               <div><label className="block text-sm font-bold mb-1">pet's name</label><input type="text" value={coupleData.petName || ''} onChange={(e) => setCoupleData({...coupleData, petName: e.target.value})} className="w-full p-2 retro-border retro-bg-window focus:outline-none" /></div>
               <div>
                  <label className="block text-sm font-bold mb-1">pet skin</label>
                  <select value={coupleData.petSkin || '/assets/cat_1_9'} onChange={(e) => setCoupleData({...coupleData, petSkin: e.target.value})} className="w-full p-2 retro-border retro-bg-window focus:outline-none font-bold">
                    <option value="/assets/cat_1">Variant 1 (cat 1)</option>
                    <option value="/assets/cat_1_6">Variant 2 (cat 1.6)</option>
                    <option value="/assets/cat_1_9">Variant 3 (cat 1.9)</option>
                  </select>
               </div>
             </div>
          </div>
          <div className="flex justify-between pt-4 border-t border-dashed border-border items-end">
             <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => {playAudio('click', true); setSfxEnabled(!sfxEnabled)}} className={`w-12 h-6 rounded-full border-2 border-border relative transition-colors ${sfxEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white border-2 border-border rounded-full absolute top-0 transition-transform ${sfxEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                  <span className="font-bold text-sm"><Volume2 size={16} className="inline mr-1"/> UI Sounds</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => {playAudio('click', sfxEnabled); setNotificationsEnabled(!notificationsEnabled)}} className={`w-12 h-6 rounded-full border-2 border-border relative transition-colors ${notificationsEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white border-2 border-border rounded-full absolute top-0 transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                  <span className="font-bold text-sm"><Bell size={16} className="inline mr-1"/> Global Notifs</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCoupleData({ ...coupleData, settings: { ...coupleData.settings, notifyDoodles: !coupleData.settings?.notifyDoodles } })} 
                    className={`w-10 h-5 rounded-full border-2 border-border relative transition-colors ${coupleData.settings?.notifyDoodles !== false ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white border-2 border-border rounded-full absolute top-0 transition-transform ${coupleData.settings?.notifyDoodles !== false ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </button>
                  <span className="font-bold text-[10px]"><Brush size={12} className="inline mr-1"/> Doodle Alerts</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCoupleData({ ...coupleData, settings: { ...coupleData.settings, notifyGames: !coupleData.settings?.notifyGames } })} 
                    className={`w-10 h-5 rounded-full border-2 border-border relative transition-colors ${coupleData.settings?.notifyGames !== false ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white border-2 border-border rounded-full absolute top-0 transition-transform ${coupleData.settings?.notifyGames !== false ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </button>
                  <span className="font-bold text-[10px]"><Gamepad2 size={12} className="inline mr-1"/> Game Invites</span>
                </div>
             </div>
             <RetroButton onClick={onLogout} variant="secondary" className="px-6 py-2 flex items-center gap-2"><LogOut size={16}/> Log Out</RetroButton>
          </div>
        </section>

        <section className="p-4 bg-window border-2 border-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2 text-main-text"><Heart size={20} className="text-primary"/> relationship</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold mb-1">partner's nickname</label>
              <input type="text" value={coupleData.nicknames?.[partnerId] || coupleData.partnerNickname || ''} onChange={(e) => { const newNicknames = { ...coupleData.nicknames, [partnerId]: e.target.value }; setCoupleData({ ...coupleData, nicknames: newNicknames, partnerNickname: e.target.value }); }} placeholder="e.g. Fiona" className="w-full p-2 border-2 border-border bg-main focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Calendar size={14}/> anniversary / started dating</label>
              <input type="date" value={coupleData?.anniversary || ''} onChange={(e) => { setCoupleData(prev => ({ ...prev, anniversary: e.target.value })); toast('Anniversary date updated!', 'success'); }} className="w-full p-2 border-2 border-border bg-main focus:outline-none cursor-pointer font-bold" />
            </div>
          </div>
        </section>

        <section className="p-4 bg-window border-2 border-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><Lock size={20}/> security</h2>
          {!showChangePassword ? (
            <RetroButton onClick={() => { setShowChangePassword(true); setPasswordError(''); setPasswordSuccess(false); }} variant="secondary" className="flex items-center gap-2">
              <Lock size={16}/> change password
            </RetroButton>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {passwordSuccess ? (
                <div className="flex items-center justify-center gap-2 p-4 bg-green-100 border-2 border-green-500 rounded"><Check size={20} className="text-green-600" /><span className="font-bold text-green-700">Password changed successfully!</span></div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Lock size={12}/> current password</label>
                    <div className="relative"><input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="w-full p-2 border-2 border-border bg-main focus:outline-none" /><button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">{showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Lock size={12}/> new password</label>
                    <div className="relative"><input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} className="w-full p-2 border-2 border-border bg-main focus:outline-none" /><button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">{showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Lock size={12}/> confirm password</label>
                    <div className="relative"><input type={showConfirmPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" minLength={6} className="w-full p-2 border-2 border-border bg-main focus:outline-none" /><button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">{showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                  </div>
                  {passwordError && <p className="text-xs font-bold text-red-600 bg-red-50 border-2 border-red-300 p-2 text-center">{passwordError}</p>}
                  <div className="flex gap-2">
                    <RetroButton type="submit" variant="primary" disabled={passwordLoading} className="flex-1 flex justify-center items-center gap-2 py-2">
                      {passwordLoading ? <><Loader size={14} className="animate-spin" /> updating...</> : <>update password</>}
                    </RetroButton>
                    <RetroButton type="button" variant="secondary" onClick={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); }} className="flex-1 py-2">cancel</RetroButton>
                  </div>
                </>
              )}
            </form>
          )}
        </section>

        <section className="p-4 bg-window border-2 border-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><ImageIcon size={20}/> aesthetics & weather</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: 'clear', icon: <Sun size={14}/> },
              { id: 'rain', icon: <CloudRain size={14}/> },
              { id: 'snow', icon: <Snowflake size={14}/> },
              { id: 'thunder', icon: <Zap size={14}/> },
              { id: 'storm', icon: <CloudLightning size={14}/> },
              { id: 'spores', icon: <Sparkle size={14}/> }
            ].map(w => ( 
              <button 
                key={w.id} 
                onClick={() => { playAudio('click', sfxEnabled); setWeather(w.id); }} 
                className={`flex-1 min-w-[30%] p-2 border-2 border-border font-bold lowercase text-[11px] sm:text-xs flex justify-center items-center gap-1.5 transition-all ${weather === w.id ? 'bg-accent text-accent-text shadow-md scale-105' : 'bg-window text-main-text opacity-70 hover:opacity-100 hover:bg-black/5'}`}
              >
                {w.icon} {w.id}
              </button> 
            ))}
          </div>
          
          <p className="font-bold text-sm mb-3 opacity-70">Theme Mode</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            {availableThemes.map(t => {
              const isLocked = !['default', 'matcha'].includes(t) && (scores?.totalStreak || 0) < 5;
              return (
                <div 
                  key={t} 
                  data-theme={t}
                  onClick={() => { 
                    if (isLocked) {
                      toast(`Locked! Complete 5 day streak to unlock ${t}.`, 'warning');
                      return;
                    }
                    playAudio('click', sfxEnabled); setTheme(t); toast(`Theme: ${t}`, 'info', 1500); 
                  }} 
                  className={`flex flex-col p-2 border-2 border-border cursor-pointer transition-transform hover:scale-105 ${theme === t ? 'ring-2 ring-offset-2 ring-primary' : 'opacity-80 hover:opacity-100'} bg-main text-main-text relative overflow-hidden`}
                >
                  {isLocked && <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10"><Lock size={16} className="text-white"/></div>}
                  <div className="flex justify-between items-center mb-2 px-1">
                     <span className="text-[10px] font-black uppercase tracking-tighter">{t}</span>
                     {theme === t && <Check size={14} className="text-primary" />}
                  </div>
                  <div className="flex flex-col gap-1 bg-window p-1.5 border-2 border-border border-dashed h-12">
                     <div className="flex gap-1 h-3 shrink-0">
                        <div className="flex-[2] bg-primary border-2 border-border"></div>
                        <div className="flex-[1] bg-secondary border-2 border-border"></div>
                     </div>
                     <div className="h-1/2 w-3/4 bg-accent border-2 border-border"></div>
                  </div>
                </div> 
              );
            })}
          </div>

          <div className="space-y-4">
             <div>
                <label className="block text-xs font-bold mb-2 flex items-center gap-1"><Monitor size={14}/> Background Pattern</label>
                <div className="flex flex-wrap gap-2">
                   {['grid', 'dots', 'lines', 'none'].map(p => (
                      <button key={p} onClick={() => setCoupleData({ ...coupleData, settings: { ...coupleData.settings, bgPattern: p } })} className={`px-3 py-1.5 retro-border text-[10px] font-bold uppercase tracking-wider transition-all ${coupleData.settings?.bgPattern === p ? 'bg-primary text-white' : 'bg-window hover:bg-black/5'}`}>
                         {p}
                      </button>
                   ))}
                </div>
             </div>

             <div>
                <label className="block text-xs font-bold mb-2 flex items-center gap-1"><MessageSquare size={14}/> Chat Wallpaper</label>
                <div className="grid grid-cols-4 gap-2">
                   {[
                     { id: 'none', label: 'None', color: 'transparent' },
                     { id: 'pixel-garden', label: 'Garden', color: '#90be6d' },
                     { id: 'pixel-stars', label: 'Stars', color: '#2b2d42' },
                     { id: 'pixel-clouds', label: 'Clouds', color: '#a2d2ff' }
                   ].map(w => (
                      <button key={w.id} onClick={() => setCoupleData({ ...coupleData, settings: { ...coupleData.settings, chatWallpaper: w.id } })} className={`aspect-video retro-border flex flex-col items-center justify-center p-1 gap-1 transition-all ${coupleData.settings?.chatWallpaper === w.id ? 'ring-2 ring-primary scale-105' : 'opacity-70 hover:opacity-100'}`}>
                         <div className="w-full h-full border border-border border-dashed" style={{ backgroundColor: w.color }}></div>
                         <span className="text-[8px] font-bold uppercase">{w.label}</span>
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </section>

        <section className="p-4 bg-window border-2 border-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><Lock size={20}/> privacy & data</h2>
          <div className="flex flex-col gap-4">
             <div className="flex justify-between items-center">
                <div>
                   <p className="font-bold text-sm">Download My Data</p>
                   <p className="text-[10px] opacity-60">Export a JSON copy of all your chat logs.</p>
                </div>
                <RetroButton onClick={handleExportData} className="px-4 py-2 text-xs">Export .json</RetroButton>
             </div>
          </div>
        </section>

      <section className="p-4 bg-red-500/10 border-2 border-red-500/40">
        <h2 className="font-bold text-xl text-red-500 mb-2 flex items-center gap-2"><Trash2 size={20}/> danger zone</h2>
        <p className="text-sm opacity-70 mb-4"><strong>Unpair</strong> disconnects you (keeps data). <strong>Delete Room</strong> wipes EVERYTHING permanently.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleUnpair} className="bg-yellow-500 text-white font-bold py-2 px-4 border-2 border-yellow-700 hover:-translate-y-1 transition-transform flex items-center gap-2 text-xs sm:text-sm"><Hand size={16}/> Unpair (disconnect)</button>
          <button onClick={handleDeleteAccount} className="bg-red-600 text-white font-bold py-2 px-4 border-2 border-red-800 shadow-md hover:-translate-y-1 transition-transform flex items-center gap-2 text-xs sm:text-sm"><Trash2 size={16}/> Delete Room & Data</button>
        </div>
      </section>
    </div>
  );

  const footerArea = (
    <div className="shrink-0 p-4 bg-window border-t-2 border-border shadow-[0_-4px_10px_rgba(0,0,0,0.1)] flex justify-end gap-3 z-50">
       <RetroButton onClick={handleCancel} variant="secondary" className="px-6 py-2 flex items-center gap-2">
          <X size={16} /> Cancel
       </RetroButton>
       <RetroButton onClick={handleSave} variant="primary" className="px-8 py-2 flex items-center gap-2">
          <Save size={16} /> Save Settings
       </RetroButton>
    </div>
  );

  if (compact) return (
    <div className="flex flex-col h-full overflow-hidden bg-window text-main-text">
       {contentArea}
       {footerArea}
    </div>
  );

  return (
    <RetroWindow title="control_panel.exe" onClose={handleCancel} noPadding className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col relative overflow-hidden">
       {contentArea}
       {footerArea}
    </RetroWindow>
  );
}

