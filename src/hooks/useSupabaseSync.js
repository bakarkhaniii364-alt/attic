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

export const initializeRoomSync = async (roomId) => {
  currentRoomId = roomId;
  if (!currentRoomId) return;

  // 1. Fetch initial state from DB
  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', currentRoomId).single();
  
  if (data && data.state) {
    globalState = data.state;
  } else if (error && error.code === 'PGRST116') {
    // Row not found, create it
    await supabase.from('app_state').insert({ room_id: currentRoomId, state: globalState });
  }

  isInitialized = true;
  notifyListeners();

  // 2. Subscribe to realtime updates
  const channel = supabase.channel(`room:${currentRoomId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state', filter: `room_id=eq.${currentRoomId}` }, (payload) => {
      // Merge incoming state
      if (payload.new && payload.new.state) {
          globalState = { ...globalState, ...payload.new.state };
          notifyListeners();
      }
    })
    .subscribe();
    
    return () => { supabase.removeChannel(channel); };
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
