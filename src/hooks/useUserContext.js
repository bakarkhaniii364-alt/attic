import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * useUserContext
 * Provides current user ID. Simplified for performance.
 * Pairing and Room data is now managed in App.jsx to prevent waterfalls.
 */
export function useUserContext() {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('attic_user_state') : null;
  const initial = stored ? JSON.parse(stored) : { userId: null };

  const [userId, setUserId] = useState(initial.userId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const syncUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUserId(session?.user?.id || null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to get session in useUserContext', err);
        if (mounted) setLoading(false);
      }
    };

    syncUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUserId(session?.user?.id || null);
        setLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('attic_user_state', JSON.stringify({ userId }));
    } catch (err) { }
  }, [userId]);

  return { userId, loading };
}
