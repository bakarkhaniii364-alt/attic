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

  // When globalState updates externally, update the local React state
  useEffect(() => {
    const handleSync = () => {
      if (globalState[key] !== undefined && JSON.stringify(globalState[key]) !== JSON.stringify(state)) {
        setState(globalState[key]);
        try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(globalState[key])); } catch (e) {}
      }
      else if (globalState[key] === undefined && isInitialized) {
        // First initialization might not have the key yet
        updateGlobalState(state);
      }
    };
    listeners.add(handleSync);
    // Initial flush if ready
    if (isInitialized) handleSync();
    
    return () => listeners.delete(handleSync);
  }, [key, state]);

  // Update function that pushes to React, LocalStorage, Global Store, and Supabase
  const updateState = useCallback(async (value) => {
    const valueToStore = value instanceof Function ? value(state) : value;
    setState(valueToStore);
    globalState[key] = valueToStore;
    try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    
    // Throttle / debounce pushing to database?
    updateGlobalState(valueToStore);
  }, [key, state]);

  const updateGlobalState = async (valueToStore) => {
      if (!currentRoomId || !isInitialized) return;
      // Copy current global state to push
      const payload = { ...globalState, [key]: valueToStore };
      globalState = payload; // Update instantly
      
      const { error } = await supabase.from('app_state').update({ state: payload }).eq('room_id', currentRoomId);
      if (error) console.error("Sync Error:", error);
  };

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
