import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader, Check, ArrowLeft } from 'lucide-react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { supabase } from '../lib/supabase.js';
import { playAudio } from '../utils/audio.js';

export function ResetPasswordView({ sfx }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validToken, setValidToken] = useState(true);
  const toast = useToast();

  const [requestEmail, setRequestEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) setValidToken(false);
  }, [searchParams]);

  const validatePassword = () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const redirectTo = `${window.location.origin}/password-reset`;
      const { data, error: err } = await supabase.auth.resetPasswordForEmail(requestEmail, { redirectTo });
      if (err) throw err;
      setRequestSent(true);
      if (toast) toast('Reset link sent. Check your inbox.', 'success');
    } catch (err) {
      setError(err.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;
    setLoading(true);
    setError('');
    playAudio('click', sfx);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message || 'Failed to reset password. Try again.');
        setLoading(false);
        return;
      }
      setSuccess(true);
      if (toast) toast('Password reset successfully!', 'success');
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[var(--bg-main)]">
        <RetroWindow title="success.exe" className="w-full max-w-sm" noPadding>
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full retro-bg-primary flex items-center justify-center">
              <Check size={32} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold">Password Reset!</h2>
            <p className="text-sm opacity-70">Your password has been successfully reset.</p>
            <Loader size={20} className="animate-spin text-[var(--primary)]" />
            <RetroButton onClick={() => navigate('/signin')} className="mt-3">remember password? sign in instead</RetroButton>
          </div>
        </RetroWindow>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[var(--bg-main)]">
        <RetroWindow title="password_reset_request.exe" className="w-full max-w-sm" noPadding onClose={() => navigate('/signin')}>
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-bold">Reset your password</h2>
            <p className="text-sm opacity-70">Enter the email associated with your account to receive a reset link.</p>

            {requestSent ? (
              <div className="p-4 bg-green-50 retro-border text-green-700">Check your inbox for the reset link.</div>
            ) : (
              <form onSubmit={handleRequestReset} className="w-full">
                <input type="email" required placeholder="you@love.com" value={requestEmail} onChange={(e) => setRequestEmail(e.target.value)} className="w-full p-3 retro-border retro-bg-window mb-3" />
                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                <RetroButton type="submit" className="w-full py-3" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</RetroButton>
              </form>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => navigate('/signin')} className="text-xs opacity-60 mt-2">remember password? sign in instead</button>
              <button type="button" onClick={() => navigate('/')} className="text-xs opacity-60 mt-2">back to landing</button>
            </div>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[var(--bg-main)] relative overflow-hidden">
      <div className="absolute inset-0 bg-pattern-grid opacity-40" />
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />

      <RetroWindow title="reset_password.exe" className="w-full max-w-sm relative z-10" onClose={() => navigate('/signin')}>
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
          <div className="text-center mb-2">
            <div className="w-14 h-14 rounded-full retro-bg-secondary retro-border mx-auto flex items-center justify-center mb-3 retro-shadow-dark">
              <Lock size={22} />
            </div>
            <h2 className="font-bold text-xl lowercase">create new password</h2>
            <p className="text-xs font-bold opacity-50 mt-1">enter a strong new password</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold opacity-60 flex items-center gap-1">
              <Lock size={12} />
              new password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold w-full"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold opacity-60 flex items-center gap-1">
              <Lock size={12} />
              confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                className="p-3 retro-border retro-bg-window focus:outline-none text-sm font-bold w-full"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs font-bold text-red-500 text-center retro-border border-red-300 bg-red-50 p-2">
              {error}
            </p>
          )}

          <RetroButton
            type="submit"
            variant="primary"
            className="py-3 mt-2 text-sm flex justify-center items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin" /> resetting...
              </>
            ) : (
              <>reset password <Lock size={14} /></>
            )}
          </RetroButton>

          <button
            type="button"
            onClick={() => navigate('/signin')}
            className="text-center text-xs font-bold opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
          >
            remember password? sign in instead
          </button>
        </form>
      </RetroWindow>
    </div>
  );
}
