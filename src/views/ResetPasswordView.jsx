import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader, Check, ArrowLeft, AlertCircle } from 'lucide-react';
import { RetroWindow, RetroButton, useToast } from '../components/UI.jsx';
import { supabase } from '../lib/supabase.js';
import { playAudio } from '../utils/audio.js';

/**
 * Password Reset Page
 * Displayed when user clicks password reset link from email
 * URL: /password-reset?code=<recovery_code>
 */
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

  // Verify token on mount
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No reset code provided. Invalid or expired link.');
      setValidToken(false);
    }
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
      if (toast) toast('Password reset successfully! Redirecting to login...', 'success');
      setTimeout(() => {
        // Sign out and redirect to auth page
        supabase.auth.signOut().then(() => {
          navigate('/');
        });
      }, 2000);
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
            <p className="text-sm opacity-70">Your password has been successfully reset. You'll be redirected to login...</p>
            <Loader size={20} className="animate-spin text-[var(--primary)]" />
          </div>
        </RetroWindow>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-[var(--bg-main)]">
        <RetroWindow title="error.exe" className="w-full max-w-sm" noPadding>
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold">Invalid Link</h2>
            <p className="text-sm opacity-70">This password reset link is invalid or has expired. Please request a new one.</p>
            <RetroButton onClick={() => navigate('/')} className="mt-4">
              Back to Login
            </RetroButton>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-[var(--bg-main)] relative overflow-hidden">
      <div className="absolute inset-0 bg-pattern-grid opacity-40" />
      <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />

      <RetroWindow title="reset_password.exe" className="w-full max-w-sm relative z-10" onClose={onBack}>
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
            onClick={() => navigate('/')}
            className="text-center text-xs font-bold opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
          >
            <ArrowLeft size={12} /> go back to login
          </button>
        </form>
      </RetroWindow>
    </div>
  );
}
