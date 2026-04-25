import { useState, useEffect, useCallback } from 'react';
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
  // Read from globalState or local storage fallback
  const getInitial = () => {
    if (globalState[key] !== undefined) return globalState[key];
    try {
      const item = window.localStorage.getItem(`sync_${key}`);
      return item ? JSON.parse(item) : initialValue;
    } catch (e) {
      return initialValue;
    }
  };

  const [state, setState] = useState(getInitial);

  // updateGlobalState with debouncing to prevent spamming the database
  const updateGlobalState = useCallback(async (valueToStore) => {
    if (!currentRoomId || !isInitialized) return;
    
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
      else console.log(`[SYNC] Pushed updates for keys: ${Object.keys(stateToPush).join(', ')}`);
    }, 1000); // 1s debounce
  }, [key]);

  // Update function that pushes to React, LocalStorage, Global Store, and Supabase
  const updateState = useCallback(async (value) => {
    const valueToStore = value instanceof Function ? value(state) : value;
    setState(valueToStore);
    globalState[key] = valueToStore;
    try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    
    updateGlobalState(valueToStore);
  }, [key, state, updateGlobalState]);

  // When globalState updates externally, update the local React state
  useEffect(() => {
    const handleSync = () => {
      const remoteValue = globalState[key];
      if (remoteValue !== undefined && JSON.stringify(remoteValue) !== JSON.stringify(state)) {
        setState(remoteValue);
        try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(remoteValue)); } catch (e) {}
      }
      // REMOVED: Automatic updateGlobalState(state) on undefined - let real changes trigger it
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
