import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useArcadeSession(gameId) {
  const { roomId, userId } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial session
  useEffect(() => {
    if (!roomId || !gameId) return;

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('arcade_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('game_id', gameId)
        .single();

      if (data) {
        setSession(data);
      }
      setLoading(false);
    };

    fetchSession();

    // Subscribe to changes
    const channel = supabase
      .channel(`arcade_session_${roomId}_${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'arcade_sessions',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.new && payload.new.game_id === gameId) {
          setSession(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, gameId]);

  const joinSession = useCallback(async () => {
    const { data, error } = await supabase.rpc('join_arcade_session', {
      p_room_id: roomId,
      p_game_id: gameId,
      p_user_id: userId
    });
    if (error) throw error;
    return data;
  }, [roomId, gameId, userId]);

  const setReady = useCallback(async (ready) => {
    const { data, error } = await supabase.rpc('set_arcade_ready', {
      p_room_id: roomId,
      p_game_id: gameId,
      p_user_id: userId,
      p_ready: ready
    });
    if (error) throw error;
    return data;
  }, [roomId, gameId, userId]);

  const updateGameState = useCallback(async (newState) => {
    const { error } = await supabase
      .from('arcade_sessions')
      .update({ game_state: newState, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('game_id', gameId);
    if (error) throw error;
  }, [roomId, gameId]);

  const leaveSession = useCallback(async () => {
    const { error } = await supabase.rpc('leave_arcade_session', {
      p_room_id: roomId,
      p_game_id: gameId,
      p_user_id: userId
    });
    if (error) console.error("[LOBBY] Leave failed:", error);
  }, [roomId, gameId, userId]);

  const resetSession = useCallback(async () => {
    const { error } = await supabase
      .from('arcade_sessions')
      .update({ 
        status: 'idle', 
        player_a_ready: false, 
        player_b_ready: false, 
        game_state: null,
        updated_at: new Date().toISOString() 
      })
      .eq('room_id', roomId)
      .eq('game_id', gameId);
    if (error) console.error("[LOBBY] Reset failed:", error);
  }, [roomId, gameId]);

  return { session, loading, joinSession, setReady, updateGameState, leaveSession, resetSession };
}
