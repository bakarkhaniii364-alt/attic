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

  const [userId, setUserId] = useState(() => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const isTestMode = params.get('test_mode') === 'true' || window.localStorage.getItem('attic_test_mode') === 'true';
        if (isTestMode) {
            const testUser = params.get('user') || window.localStorage.getItem('attic_test_user') || 'userA';
            // If the user string contains a suffix (e.g. userA_123), use it to make the ID unique
            // This prevents PeerJS ID collisions when multiple tests run in parallel.
            const [base, suffix] = testUser.split('_');
            const idSuffix = suffix ? `-${suffix}` : '';
            return base === 'userA' ? `00000000-0000-0000-0000-000000000001${idSuffix}` : `00000000-0000-0000-0000-000000000002${idSuffix}`;
        }
    }
    return initial.userId;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Skip real sync in test mode to avoid overwriting mock ID
    const isTestMode = typeof window !== 'undefined' && 
      (new URLSearchParams(window.location.search).get('test_mode') === 'true' || 
       window.localStorage.getItem('attic_test_mode') === 'true');

    if (isTestMode) {
        setLoading(false);
        return;
    }

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
