import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * useUserContext
 * Provides current user ID and partner ID for personalized data tracking
 * Used to track individual scores, achievements, streaks per user
 */
export function useUserContext() {
  const [userId, setUserId] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          
          // Get partner ID from rooms table via get_my_room RPC
          const { data: room } = await supabase.rpc('get_my_room');
          
          if (room && room.is_paired) {
            const partner = room.creator_id === user.id ? room.partner_id : room.creator_id;
            setPartnerId(partner);
          }
        }
      } catch (err) {
        console.error('Failed to get user context:', err);
      } finally {
        setLoading(false);
      }
    };

    getCurrentUser();
  }, []);

  return { userId, partnerId, loading };
}
