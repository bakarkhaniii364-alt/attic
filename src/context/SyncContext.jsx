import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';
import { isTestMode, sendTestBroadcast, onTestBroadcast, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const { roomId, userId } = useAuth();
  const [globalState, setGlobalState] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const channelsRef = useRef({});
  const pendingUpdateRef = useRef(null);
  const isSubscribedRef = useRef(false); // true only after WebSocket SUBSCRIBED

  // Initialize Room Sync
  useEffect(() => {
    if (!roomId || !userId) {
      setIsInitialized(false);
      setGlobalState({});
      return;
    }

    let mounted = true;

    const initSync = async () => {
       if (isTestMode()) {
        const testUser = getTestUser();
        const isA = testUser.startsWith('userA');
        const [_, suffix] = testUser.split('_');
        const partnerId = `${isA ? 'userB' : 'userA'}${suffix ? `_${suffix}` : ''}`;
        setGlobalState(prev => ({
          ...prev,
          room_profiles: {
            [testUser]: { name: isA ? 'User A' : 'User B', emoji: isA ? '🍎' : '🍏', status: 'online' },
            [partnerId]: { name: isA ? 'User B' : 'User A', emoji: isA ? '🍏' : '🍎', status: 'online' }
          },
          couple_data: { petName: 'Buddy', petHappy: 80, petSkin: '/assets/cat_1_9' },
          user_streaks: { [testUser]: { count: 5, best: 10 }, [partnerId]: { count: 5, best: 10 } },
          game_scores: {},
          arcade_lobby: prev.arcade_lobby || { players: [], gameId: null, status: 'idle', config: null }
        }));
        setIsInitialized(true);
        return;
      }

      // Safety timeout: don't hang the app forever if Supabase is slow
      const timeout = setTimeout(() => {
        if (!isInitialized && mounted) {
           console.warn("[SYNC] Initialization timed out, proceeding with local state.");
           setIsInitialized(true);
        }
      }, 5000);

      // 1. Fetch initial state from DB
      try {
        const { data, error } = await supabase.from('app_state').select('state').eq('room_id', roomId).single();
        
        let initialState = {};
        if (data && data.state) {
          initialState = data.state;
        } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
          // Check localforage as a fallback if DB is empty
          try {
            const cached = await localforage.getItem('attic_global_state');
            if (cached) initialState = cached;
          } catch(e) {}
          await supabase.from('app_state').insert({ room_id: roomId, state: initialState });
        }

        if (mounted) {
          setGlobalState(initialState);
          setIsInitialized(true);
        }
      } catch (e) {
        console.error("[SYNC] DB Init failed:", e);
        if (mounted) setIsInitialized(true);
      } finally {
        clearTimeout(timeout);
      }

      // 2. Setup Realtime Channel
      const channelId = `room_sync_${roomId}`;
      if (channelsRef.current[channelId]) supabase.removeChannel(channelsRef.current[channelId]);

      const channel = supabase.channel(channelId, {
        config: { presence: { key: userId } }
      })
        .on('broadcast', { event: 'state_update' }, ({ payload }) => {
          if (payload.key && payload.value !== undefined) {
            setGlobalState(prev => ({ ...prev, [payload.key]: payload.value }));
          }
        })
        .on('broadcast', { event: '*' }, ({ event, payload }) => {
          // Centralized event bus for non-state broadcasts (kisses, doodle alerts)
          if (event !== 'state_update') {
            window.dispatchEvent(new CustomEvent('sync_broadcast', { detail: { event, payload } }));
          }
        })
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'app_state', 
          filter: `room_id=eq.${roomId}` 
        }, (payload) => {
          if (payload.new && payload.new.state) {
            setGlobalState(prev => ({ ...prev, ...payload.new.state }));
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const onlineMap = {};
          Object.keys(state).forEach(id => {
            onlineMap[id] = state[id][0];
          });
          setOnlineUsers(onlineMap);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
            // Debounced Presence Update
            const trackPresence = async () => {
              await channel.track({
                online_at: new Date().toISOString(),
                status: document.hasFocus() ? 'active' : 'idle'
              });
            };
            trackPresence();
            const interval = setInterval(trackPresence, 5000);
            channelsRef.current[channelId + '_presence'] = interval;
          } else {
            isSubscribedRef.current = false;
          }
        });

      channelsRef.current[channelId] = channel;
    };

    initSync();
    
    let unsubs = [];
    if (isTestMode()) {
        unsubs.push(onTestBroadcast('*', (payload, event) => {
            window.dispatchEvent(new CustomEvent('sync_broadcast', { detail: { event, payload } }));
        }));
        unsubs.push(onTestStateUpdate('*', (value, key) => {
            console.log('[SyncContext] onTestStateUpdate received:', key, value);
            setGlobalState(prev => ({ ...prev, [key]: value }));
        }));
    }

    return () => {
      mounted = false;
      unsubs.forEach(u => u());
      Object.entries(channelsRef.current).forEach(([key, val]) => {
        if (key.endsWith('_presence')) clearInterval(val);
        else supabase.removeChannel(val);
      });
      channelsRef.current = {};
      isSubscribedRef.current = false;
    };
  }, [roomId, userId]);

  const updateSyncState = useCallback(async (key, value) => {
    if (!roomId || !isInitialized) return;

    setGlobalState(prev => {
      const newState = { ...prev, [key]: value };
      
      // Instant Broadcast
      const channelId = `room_sync_${roomId}`;
      if (channelsRef.current[channelId] && isSubscribedRef.current) {
        channelsRef.current[channelId].send({
          type: 'broadcast',
          event: 'state_update',
          payload: { key, value, senderId: userId }
        });
      }
      if (isTestMode()) sendTestStateUpdate(key, value);

      // Debounced DB Push
      if (pendingUpdateRef.current) clearTimeout(pendingUpdateRef.current);
      pendingUpdateRef.current = setTimeout(async () => {
        const { error } = await supabase.from('app_state').update({ state: newState }).eq('room_id', roomId);
        if (error) console.error("[SYNC] DB Push Error:", error);
      }, 1000);

      // Cache locally
      localforage.setItem(`sync_${key}`, value).catch(() => {});
      localforage.setItem('attic_global_state', newState).catch(() => {});

      return newState;
    });
  }, [roomId, isInitialized, userId]);

  const broadcast = useCallback((eventName, payload) => {
    const channelId = `room_sync_${roomId}`;
    if (channelsRef.current[channelId] && isSubscribedRef.current) {
      channelsRef.current[channelId].send({
        type: 'broadcast',
        event: eventName,
        payload
      });
    }
    if (isTestMode()) sendTestBroadcast(eventName, payload);
  }, [roomId]);

  const value = {
    globalState,
    isInitialized,
    onlineUsers,
    updateSyncState,
    broadcast,
    roomProfiles: globalState.room_profiles || {}
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
}
