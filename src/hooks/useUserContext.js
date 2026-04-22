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
          
          // Get partner ID from room_members table
          const { data: members } = await supabase
            .from('room_members')
            .select('user_id')
            .neq('user_id', user.id)
            .limit(1);
          
          if (members && members.length > 0) {
            setPartnerId(members[0].user_id);
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
