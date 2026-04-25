import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * useUserContext
 * Provides current user ID and partner ID for personalized data tracking
 * Used to track individual scores, achievements, streaks per user
 */
export function useUserContext() {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('attic_user_state') : null;
  const initial = stored ? JSON.parse(stored) : { userId: null, partnerId: null, isPaired: null };

  const [userId, setUserId] = useState(initial.userId);
  const [partnerId, setPartnerId] = useState(initial.partnerId);
  const [isPaired, setIsPaired] = useState(initial.isPaired);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const syncState = async (maybeUser) => {
      try {
        const user = maybeUser || (await supabase.auth.getUser()).data?.user;
        if (user && mounted) {
          setUserId(user.id);
          // fetch room state
          try {
            const { data: room } = await supabase.rpc('get_my_room');
            if (room && room.is_paired) {
              const partner = room.creator_id === user.id ? room.partner_id : room.creator_id;
              setPartnerId(partner);
              setIsPaired(true);
            } else {
              setPartnerId(null);
              setIsPaired(false);
            }
          } catch (err) {
            console.error('get_my_room RPC failed in useUserContext', err);
            setPartnerId(null);
            setIsPaired(false);
          }
        } else if (mounted) {
          setUserId(null); setPartnerId(null); setIsPaired(false);
        }
      } catch (err) {
        console.error('Failed to get user in useUserContext', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // initial sync
    syncState();

    // subscribe to auth changes to keep user context stable across reloads
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      if (session && session.user) syncState(session.user);
      else {
        setUserId(null); setPartnerId(null); setIsPaired(false); setLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // persist a minimal user-state locally so it is "always with" the browser until confirmed by server
  useEffect(() => {
    try {
      const state = { userId, partnerId, isPaired };
      window.localStorage.setItem('attic_user_state', JSON.stringify(state));
    } catch (err) { }
  }, [userId, partnerId, isPaired]);

  return { userId, partnerId, isPaired, loading };
}
