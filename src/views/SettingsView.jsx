import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Trophy, Image as ImageIcon, Sun, CloudRain, Snowflake, Trash2, Volume2, LogOut, Heart, Calendar, Sparkles, Lock, Eye, EyeOff, Loader, Check, Hand } from 'lucide-react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { getScore } from '../utils/helpers.js';
import { getScoreForUser } from '../utils/userDataHelpers.js';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';

export function SettingsView({ compact = false, onClose, theme, setTheme, profile, setProfile, onLogout, onDelete, sfxEnabled, setSfxEnabled, weather, setWeather, scores, userId, coupleData, setCoupleData }) {
  const navigate = useNavigate();
  const toast = useToast();
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
  const handlePfpUpload = (e) => { 
    const file = e.target.files[0]; 
    if (file) { 
      const reader = new FileReader(); 
      reader.onloadend = () => { 
        setProfile({...profile, pfp: reader.result}); 
        playAudio('click', sfxEnabled); 
        toast('Profile photo updated!', 'success'); 
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
      
      if (error) {
        setPasswordError(error.message || 'Failed to change password');
        setPasswordLoading(false);
        return;
      }

      setPasswordSuccess(true);
      toast('Password changed successfully!', 'success');
      setTimeout(() => {
        setShowChangePassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err.message || 'Something went wrong');
      setPasswordLoading(false);
    }
  };

  const handleUnpair = async () => {
    try {
      const { data: roomData, error: rdErr } = await supabase.rpc('get_my_room');
      if (rdErr || !roomData) {
        toast('No paired room found', 'error');
        return;
      }
      const roomId = roomData.id || roomData?.id;
      if (!roomId) {
        toast('Could not determine room', 'error');
        return;
      }

      const { data: leaveResult, error: leaveErr } = await supabase.rpc('leave_room', { room_uuid: roomId });
      if (leaveErr) {
        console.error('leave_room rpc failed', leaveErr);
        toast('Could not disconnect right now. Try again later.', 'error');
        return;
      }

      if (leaveResult && leaveResult.error) {
        toast(leaveResult.message || 'Could not disconnect.', 'error');
        return;
      }

      try { window.localStorage.removeItem('attic_room_id'); } catch (e) {}
      toast('Unpaired. Returning to handshake...', 'success');
      setTimeout(() => {
        navigate('/handshake');
        window.location.reload(); // Still reload to clear all states, but navigate first
      }, 500);
    } catch (err) {
      console.error(err);
      toast('Failed to unpair. Please contact support.', 'error');
    }
  };

  const inner = (
    <div className="space-y-6">
      {/* Profile Section */}
      <section className="p-4 retro-bg-window retro-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><User size={20}/> user profile</h2>
          <div className="flex gap-4 items-center mb-4">
             <div className="relative group cursor-pointer">
                {profile.pfp ? <img src={profile.pfp} alt="Avatar" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full retro-border retro-shadow-dark object-cover" /> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full retro-border retro-bg-accent flex items-center justify-center text-3xl sm:text-4xl">{profile.emoji}</div>}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm"><ImageIcon size={20}/><input type="file" accept="image/*" onChange={handlePfpUpload} className="hidden" /></label>
             </div>
             <div className="flex-1 space-y-2">
               <div><label className="block text-sm font-bold mb-1">display name</label><input type="text" value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} className="w-full p-2 retro-border retro-bg-window focus:outline-none" /></div>
               <div><label className="block text-sm font-bold mb-1">pet's name</label><input type="text" value={coupleData.petName || ''} onChange={(e) => setCoupleData({...coupleData, petName: e.target.value})} className="w-full p-2 retro-border retro-bg-window focus:outline-none" /></div>
               <div>
                  <label className="block text-sm font-bold mb-1">pet skin</label>
                  <select value={coupleData.petSkin || '/assets/Cat Sprite Sheet.png'} onChange={(e) => setCoupleData({...coupleData, petSkin: e.target.value})} className="w-full p-2 retro-border retro-bg-window focus:outline-none font-bold">
                    <option value="/assets/Cat Sprite Sheet.png">Default (Cat Sprite Sheet)</option>
                    <option value="/assets/cat 1.png">Variant 1 (cat 1)</option>
                    <option value="/assets/cat 1.6.png">Variant 2 (cat 1.6)</option>
                    <option value="/assets/cat 1.9.png">Variant 3 (cat 1.9)</option>
                  </select>
               </div>
             </div>
          </div>
          <div className="flex justify-between pt-4 border-t border-dashed border-[var(--border)] items-center">
             <div className="flex items-center gap-2"><button onClick={() => {playAudio('click', true); setSfxEnabled(!sfxEnabled)}} className={`w-12 h-6 rounded-full retro-border relative transition-colors ${sfxEnabled ? 'retro-bg-primary' : 'bg-gray-300'}`}><div className={`w-5 h-5 bg-white retro-border rounded-full absolute top-0 transition-transform ${sfxEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div></button><span className="font-bold text-sm"><Volume2 size={16} className="inline mr-1"/> UI Sounds</span></div>
             <RetroButton onClick={onLogout} variant="secondary" className="px-6 py-2 flex items-center gap-2"><LogOut size={16}/> Log Out</RetroButton>
          </div>
        </section>

        {/* Relationship Section */}
        <section className="p-4 retro-bg-window retro-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><Heart size={20} className="text-[var(--primary)]"/> relationship</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold mb-1">partner's nickname</label>
              <input type="text" value={coupleData.partnerNickname || ''} onChange={(e) => setCoupleData({...coupleData, partnerNickname: e.target.value})} placeholder="e.g. Fiona" className="w-full p-2 retro-border retro-bg-window focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Calendar size={14}/> anniversary / started dating</label>
              <input type="date" value={coupleData.anniversary || ''} onChange={(e) => { setCoupleData({...coupleData, anniversary: e.target.value}); toast('Anniversary date saved!', 'success'); }} className="w-full p-2 retro-border retro-bg-window focus:outline-none cursor-pointer font-bold" />
            </div>
            {coupleData.anniversary && (
              <p className="text-xs font-bold opacity-50 text-center">Timer visible on dashboard ❤️</p>
            )}
          </div>
        </section>

        {/* Security & Password */}
        <section className="p-4 retro-bg-window retro-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><Lock size={20}/> security</h2>
          
          {!showChangePassword ? (
            <RetroButton onClick={() => { setShowChangePassword(true); setPasswordError(''); setPasswordSuccess(false); }} variant="secondary" className="flex items-center gap-2">
              <Lock size={16}/> change password
            </RetroButton>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {passwordSuccess ? (
                <div className="flex items-center justify-center gap-2 p-4 bg-green-100 retro-border border-green-500 rounded">
                  <Check size={20} className="text-green-600" />
                  <span className="font-bold text-green-700">Password changed successfully!</span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Lock size={12}/> current password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full p-2 retro-border retro-bg-window focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                      >
                        {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Lock size={12}/> new password</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        className="w-full p-2 retro-border retro-bg-window focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                      >
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-1 flex items-center gap-1"><Lock size={12}/> confirm password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        className="w-full p-2 retro-border retro-bg-window focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                      >
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="text-xs font-bold text-red-600 bg-red-50 retro-border border-red-300 p-2 text-center">
                      {passwordError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <RetroButton
                      type="submit"
                      variant="primary"
                      disabled={passwordLoading}
                      className="flex-1 flex justify-center items-center gap-2 py-2"
                    >
                      {passwordLoading ? (
                        <>
                          <Loader size={14} className="animate-spin" /> updating...
                        </>
                      ) : (
                        <>update password</>
                      )}
                    </RetroButton>
                    <RetroButton
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowChangePassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setPasswordError('');
                      }}
                      className="flex-1 py-2"
                    >
                      cancel
                    </RetroButton>
                  </div>
                </>
              )}
            </form>
          )}
        </section>

        {/* Achievements */}
        <section className="p-4 retro-bg-window retro-border border-dashed">
           <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><Trophy size={20}/> local achievements</h2>
           <div className="grid grid-cols-2 gap-2 text-sm">
              <div className={`p-2 retro-border ${getScoreForUser(scores, userId, 'tictactoe') > 0 ? 'retro-bg-primary' : 'bg-[var(--bg-main)] opacity-50'}`}>⭐ First Win</div>
              <div className={`p-2 retro-border ${getScoreForUser(scores, userId, 'pictionary') > 0 ? 'retro-bg-secondary' : 'bg-[var(--bg-main)] opacity-50'}`}>🎨 Artist</div>
              <div className={`p-2 retro-border ${getScoreForUser(scores, userId, 'wordle') > 0 ? 'retro-bg-accent' : 'bg-[var(--bg-main)] opacity-50'}`}>📚 Wordsmith</div>
              <div className={`p-2 retro-border ${getScoreForUser(scores, userId, 'sudoku') > 0 ? 'retro-bg-primary' : 'bg-[var(--bg-main)] opacity-50'}`}>🧩 Puzzler</div>
           </div>
        </section>

        {/* Aesthetics & Weather */}
        <section className="p-4 retro-bg-window retro-border border-dashed">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><ImageIcon size={20}/> aesthetics & weather</h2>
          <div className="flex gap-2 mb-4">{['clear', 'rain', 'snow', 'spores'].map(w => ( <button key={w} onClick={() => {playAudio('click', sfxEnabled); setWeather(w)}} className={`flex-1 p-2 retro-border font-bold lowercase text-sm flex justify-center items-center gap-1 ${weather === w ? 'retro-bg-accent retro-shadow-dark' : 'bg-[var(--bg-window)]'}`}>{w === 'clear' ? <Sun size={14}/> : w === 'rain' ? <CloudRain size={14}/> : w === 'spores' ? <Sparkles size={14}/> : <Snowflake size={14}/>} {w}</button> ))}</div>
          <p className="font-bold text-sm mb-2 opacity-70">Theme Mode</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{['default', 'matcha', 'midnight', 'cyberpunk', 'synthwave', 'minimal', 'monochrome', 'hawkins'].map(t => ( <button key={t} onClick={() => {playAudio('click', sfxEnabled); setTheme(t); toast(`Theme: ${t}`, 'info', 1500);}} className={`p-3 retro-border text-center lowercase font-bold text-sm sm:text-base ${theme === t ? 'retro-shadow-dark bg-[var(--accent)]' : 'bg-[var(--bg-window)] opacity-70'}`}>{t}</button> ))}</div>
        </section>

      {/* Danger Zone */}
      <section className="p-4 bg-red-500/10 retro-border border-red-500/40 mt-auto">
        <h2 className="font-bold text-xl text-red-500 mb-2 flex items-center gap-2"><Trash2 size={20}/> danger zone</h2>
        <p className="text-sm opacity-70 mb-4">Two separate actions: <strong>Unpair</strong> returns you to handshake (keeps shared history). <strong>Delete</strong> clears local data.</p>
        <div className="flex gap-2">
          <button onClick={handleUnpair} className="bg-yellow-500 text-white font-bold py-2 px-4 retro-border border-yellow-700 hover:-translate-y-1 transition-transform flex items-center gap-2"><Hand size={16}/> Unpair (disconnect)</button>
          <button onClick={onDelete} className="bg-red-600 text-white font-bold py-2 px-4 retro-border border-red-800 retro-shadow-dark hover:-translate-y-1 transition-transform flex items-center gap-2"><Trash2 size={16}/> Disconnect & delete</button>
        </div>
      </section>
    </div>
  );

  if (compact) return inner;

  return (
    <RetroWindow title="control_panel.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
      {inner}
    </RetroWindow>
  );

}
