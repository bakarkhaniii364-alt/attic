import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';

// Global store for the entire room's data
let globalState = {};
let isInitialized = false;
const listeners = new Set();
let currentRoomId = null;

// Notify all React hooks when the global state changes from incoming webhooks
const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

let currentChannel = null;

/* ── E2EE UTILITIES REMOVED (Too buggy for current sync architecture) ── */

export const initializeRoomSync = async (roomId) => {
  if (currentRoomId === roomId && isInitialized) return;
  
  currentRoomId = roomId;
  if (!currentRoomId) return;

  // 1. Fetch initial state from DB
  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', currentRoomId).single();
  
  if (data && data.state) {
    globalState = data.state;
  } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
    globalState = {};
    await supabase.from('app_state').insert({ room_id: currentRoomId, state: globalState });
  } else {
    globalState = {};
  }

  isInitialized = true;
  notifyListeners();
};

export function useGlobalSync(key, initialValue) {
  const [state, setState] = useState(initialValue);
  const [loading, setLoading] = useState(true);

  // Load initial value from globalState or localforage
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      // 1. Check globalState first (fastest)
      if (globalState[key] !== undefined) {
        if (mounted) {
          setState(globalState[key]);
          setLoading(false);
        }
        return;
      }

      // 2. Fallback to localforage
      try {
        const item = await localforage.getItem(`sync_${key}`);
        if (mounted) {
          if (item !== null) {
            setState(item);
            globalState[key] = item; // Hydrate global store
          }
          setLoading(false);
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [key]);

  // updateGlobalState with debouncing to prevent spamming the database
  const updateGlobalState = useCallback(async (valueToStore) => {
    if (!currentRoomId || !isInitialized) return;
    
    // Deep equality check before updating global store and triggering a push
    if (JSON.stringify(globalState[key]) === JSON.stringify(valueToStore)) return;

    // Copy current global state to push
    const payload = { ...globalState, [key]: valueToStore };
    globalState = payload; // Update global store instantly for other hooks

    // Debounce the actual database push
    if (globalState._pendingUpdate) clearTimeout(globalState._pendingUpdate);
    
    globalState._pendingUpdate = setTimeout(async () => {
      const stateToPush = { ...globalState };
      delete stateToPush._pendingUpdate;
      
      const { error } = await supabase.from('app_state').update({ state: stateToPush }).eq('room_id', currentRoomId);
      if (error) console.error("Sync Error:", error);
      else console.log(`[SYNC] Pushed updates for key: ${key}`);
    }, 1000); // 1s debounce
  }, [key]);

  // Update function that pushes to React, LocalStorage, Global Store, and Supabase
  const updateState = useCallback(async (value) => {
    const valueToStore = value instanceof Function ? value(state) : value;
    
    // Optimistic local update
    if (JSON.stringify(state) !== JSON.stringify(valueToStore)) {
      setState(valueToStore);
      globalState[key] = valueToStore;
      localforage.setItem(`sync_${key}`, valueToStore).catch(e => console.error(e));
      updateGlobalState(valueToStore);
    }
  }, [key, state, updateGlobalState]);

  // 2. Realtime Sync (per-hook channel to avoid collisions)
  useEffect(() => {
    if (!currentRoomId || !isInitialized) return;

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channelName = `sync_${key}_${currentRoomId}_${uniqueId}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'app_state', 
        filter: `room_id=eq.${currentRoomId}` 
      }, (payload) => {
        if (payload.new && payload.new.state) {
            const remoteValue = payload.new.state[key];
            if (remoteValue !== undefined) {
                const remoteString = JSON.stringify(remoteValue);
                const localString = JSON.stringify(state);
                if (remoteString !== localString) {
                    setState(remoteValue);
                    globalState[key] = remoteValue;
                    localforage.setItem(`sync_${key}`, remoteValue).catch(e => console.error(e));
                }
            }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [key, state]);

  return [state, updateState];
}

export function useBroadcast(eventName, callback) {
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    if (!currentRoomId || !isInitialized) return;

    // Fixed channel name for all users in this room/event
    const channelName = `room_broadcast_${currentRoomId}_${eventName}`;
    const newChannel = supabase.channel(channelName)
      .on('broadcast', { event: eventName }, ({ payload }) => {
        if (callback) callback(payload);
      })
      .subscribe();

    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [eventName, callback, isInitialized]);

  const sendBroadcast = useCallback((payload) => {
    if (channel) {
        channel.send({
          type: 'broadcast',
          event: eventName,
          payload
        });
    }
  }, [eventName, channel]);

  return sendBroadcast;
}
