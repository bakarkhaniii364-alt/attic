import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

// Global store for the entire room's data
let globalState = {};
let isInitialized = false;
const listeners = new Set();
let currentRoomId = null;
let currentChannel = null;

// Notify all React hooks when the global state changes from incoming webhooks
const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export const initializeRoomSync = async (roomId) => {
  if (currentRoomId === roomId && isInitialized && currentChannel) return;
  
  // 0. Clean up ALL previous channels to avoid subscription collisions
  try {
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }
    await supabase.removeAllChannels();
  } catch (e) {
    console.warn("[SYNC] Channel cleanup warning:", e);
  }
  currentChannel = null;

  currentRoomId = roomId;
  if (!currentRoomId) return;

  // 1. Fetch initial state from DB
  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', currentRoomId).single();
  
  if (data && data.state) {
    globalState = data.state;
  } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
    // Row not found, create it
    globalState = {}; 
    await supabase.from('app_state').insert({ room_id: currentRoomId, state: globalState });
  } else {
    globalState = {};
  }

  isInitialized = true;
  notifyListeners();

  // 2. Setup channel
  const channelName = `realtime:room:${currentRoomId}`;
  currentChannel = supabase.channel(channelName, {
    config: {
      presence: { key: roomId },
    },
  });
  
  currentChannel.on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'app_state', 
    filter: `room_id=eq.${currentRoomId}` 
  }, (payload) => {
    // Merge incoming state
    if (payload.new && payload.new.state) {
        // Advanced merge for arrays (chat history, etc.)
        const newState = payload.new.state;
        const mergedState = { ...globalState };

        Object.keys(newState).forEach(key => {
            if (Array.isArray(newState[key]) && Array.isArray(globalState[key])) {
                // Merge arrays by 'id' if present, otherwise just take new
                const existingItems = globalState[key];
                const newItems = newState[key];
                const hasIds = newItems.length > 0 && newItems[0]?.id;
                
                if (hasIds) {
                    const mergedArray = [...existingItems];
                    newItems.forEach(item => {
                        const idx = mergedArray.findIndex(m => m.id === item.id);
                        if (idx >= 0) mergedArray[idx] = item;
                        else mergedArray.push(item);
                    });
                    // Keep it sorted by time if it looks like a message log
                    if (mergedArray[0]?.timestamp || mergedArray[0]?.time) {
                        mergedArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    }
                    mergedState[key] = mergedArray;
                } else {
                    mergedState[key] = newItems;
                }
            } else {
                mergedState[key] = newState[key];
            }
        });

        globalState = mergedState;
        notifyListeners();
    }
  });

  currentChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[SYNC] Realtime connection established for room:', currentRoomId);
    }
  });
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
        updateGlobalState(state);
      }
    };
    listeners.add(handleSync);
    if (isInitialized) handleSync();
    return () => listeners.delete(handleSync);
  }, [key, state]);

  // Update function that pushes to React, LocalStorage, Global Store, and Supabase
  const updateState = useCallback(async (value) => {
    let valueToStore = value instanceof Function ? value(state) : value;
    
    // PRE-MERGE: If updating an array, merge with globalState first to avoid overwriting partner's concurrent edits
    if (Array.isArray(valueToStore) && Array.isArray(globalState[key])) {
        const hasIds = valueToStore.length > 0 && (valueToStore[valueToStore.length - 1]?.id);
        if (hasIds) {
            const merged = [...globalState[key]];
            valueToStore.forEach(item => {
                const idx = merged.findIndex(m => m.id === item.id);
                if (idx >= 0) {
                    if (JSON.stringify(merged[idx]) !== JSON.stringify(item)) merged[idx] = item;
                }
                else merged.push(item);
            });
            valueToStore = merged;
        }
    }

    if (JSON.stringify(globalState[key]) === JSON.stringify(valueToStore)) return;

    setState(valueToStore);
    globalState[key] = valueToStore;
    try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    
    debouncedUpdate();
  }, [key, state]);

  // Debounced Supabase update to prevent rapid firing (e.g. while typing)
  const updateTimeoutRef = useRef(null);
  const debouncedUpdate = () => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      pushToSupabase();
    }, 1000); // 1 second debounce
  };

  const pushToSupabase = async () => {
    if (!currentRoomId || !isInitialized) return;
    const { error } = await supabase.from('app_state').update({ state: globalState }).eq('room_id', currentRoomId);
    if (error) console.error("[SYNC] Push Error:", error);
  };


  return [state, updateState];
}

// Hook for transient events like typing indicators
export function useBroadcast(event, callback) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        if (!currentChannel) return;
        
        const channel = currentChannel.on('broadcast', { event }, (payload) => {
            if (callbackRef.current) callbackRef.current(payload.payload);
        });

        return () => {
            // Note: channel.off doesn't exist, but removing channel or just letting GC handle it is usually okay
            // In Attic we keep the channel alive globally.
        };
    }, [event]);

    const send = useCallback((payload) => {
        if (currentChannel) {
            currentChannel.send({
                type: 'broadcast',
                event,
                payload
            });
        }
    }, []);

    return send;
}
