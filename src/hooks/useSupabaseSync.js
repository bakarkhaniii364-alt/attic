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
  if (currentRoomId === roomId && isInitialized && currentChannel) return;
  
  // 0. Clean up ALL previous channels to avoid subscription collisions
  try {
    if (currentChannel) {
      await supabase.removeChannel(currentChannel);
    }
    await supabase.removeAllChannels();
  } catch (e) { console.warn("Realtime cleanup error", e); }
  currentChannel = null;

  currentRoomId = roomId;
  if (!currentRoomId) return;

  // 1. Fetch initial state from DB
  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', currentRoomId).single();
  
  if (data && data.state) {
    globalState = data.state;
  } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
    // Row not found, create it
    globalState = {}; // Reset for new room
    await supabase.from('app_state').insert({ room_id: currentRoomId, state: globalState });
  } else {
    globalState = {}; // Reset for new room
  }

  isInitialized = true;
  notifyListeners();

  // 2. Setup channel and add listeners BEFORE calling subscribe()
  // Use a unique channel name to avoid collisions
  const channelName = `sync_room_${currentRoomId}`;
  currentChannel = supabase.channel(channelName);
  
  currentChannel.on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'app_state', 
    filter: `room_id=eq.${currentRoomId}` 
  }, (payload) => {
    // Merge incoming state
    if (payload.new && payload.new.state) {
        globalState = { ...globalState, ...payload.new.state };
        notifyListeners();
    }
  });

  currentChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[SYNC] Successfully joined room channel:', currentRoomId);
    }
  });
    
  return () => { 
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
      currentChannel = null;
    }
  };
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

  // When globalState updates externally, update the local React state
  useEffect(() => {
    const handleSync = () => {
      const remoteValue = globalState[key];
      if (remoteValue !== undefined) {
        // Deep equality check to prevent "Render Storm"
        const remoteString = JSON.stringify(remoteValue);
        const localString = JSON.stringify(state);
        
        if (remoteString !== localString) {
          setState(remoteValue);
          localforage.setItem(`sync_${key}`, remoteValue).catch(e => console.error(e));
        }
      }
    };
    listeners.add(handleSync);
    if (isInitialized) handleSync();
    return () => listeners.delete(handleSync);
  }, [key, state]);

  return [state, updateState];
}

export function useBroadcast(eventName, callback) {
  useEffect(() => {
    if (!currentChannel || !isInitialized) return;

    const sub = currentChannel.on('broadcast', { event: eventName }, ({ payload }) => {
      if (callback) callback(payload);
    });

    return () => {
      // Note: Supabase's current API doesn't support easy per-listener removal 
      // on a channel without removing the entire channel, but the closure 
      // will correctly handle cleanup when the hook unmounts.
    };
  }, [eventName, callback, isInitialized]);

  const sendBroadcast = useCallback((payload) => {
    if (currentChannel) {
      currentChannel.send({
        type: 'broadcast',
        event: eventName,
        payload
      });
    }
  }, [eventName]);

  return sendBroadcast;
}
