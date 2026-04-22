import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

// Global store for the entire room's data
let globalState = {};
let isInitialized = false;
const listeners = new Set();
let currentRoomId = null;
let currentChannel = null;
let updateTimeout = null;

// Notify all React hooks when the global state changes from incoming webhooks
const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

const pushToSupabase = async () => {
  if (!currentRoomId || !isInitialized) return;
  const { error } = await supabase.from('app_state').update({ state: globalState }).eq('room_id', currentRoomId);
  if (error) console.error("[SYNC] Push Error:", error);
};

const debouncedPush = () => {
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = setTimeout(pushToSupabase, 1000);
};

export const initializeRoomSync = async (roomId) => {
  if (currentRoomId === roomId && isInitialized && currentChannel) return;
  
  // 0. Clean up ALL previous channels
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
    if (payload.new && payload.new.state) {
        const newState = payload.new.state;
        const mergedState = { ...globalState };

        Object.keys(newState).forEach(key => {
            if (Array.isArray(newState[key]) && Array.isArray(globalState[key])) {
                const existingItems = globalState[key];
                const newItems = newState[key];
                const hasIds = newItems.length > 0 && newItems[0]?.id;
                
                if (hasIds) {
                    const mergedArray = [...existingItems];
                    newItems.forEach(item => {
                        const idx = mergedArray.findIndex(m => m.id === item.id);
                        if (idx >= 0) {
                            if (JSON.stringify(mergedArray[idx]) !== JSON.stringify(item)) {
                                mergedArray[idx] = item;
                            }
                        }
                        else mergedArray.push(item);
                    });
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
      console.log('[SYNC] Realtime connection established');
    }
  });
};

export function useGlobalSync(key, initialValue) {
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

  useEffect(() => {
    const handleSync = () => {
      const globalValue = globalState[key];
      if (globalValue !== undefined && JSON.stringify(globalValue) !== JSON.stringify(state)) {
        setState(globalValue);
        try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(globalValue)); } catch (e) {}
      }
    };
    listeners.add(handleSync);
    if (isInitialized) handleSync();
    return () => { listeners.delete(handleSync); };
  }, [key, state]);

  const updateState = useCallback((value) => {
    let valueToStore = value instanceof Function ? value(state) : value;
    
    // Merge if array
    if (Array.isArray(valueToStore) && Array.isArray(globalState[key])) {
        const hasIds = valueToStore.length > 0 && (valueToStore[valueToStore.length - 1]?.id);
        if (hasIds) {
            const merged = [...globalState[key]];
            valueToStore.forEach(item => {
                const idx = merged.findIndex(m => m.id === item.id);
                if (idx >= 0) merged[idx] = item;
                else merged.push(item);
            });
            valueToStore = merged;
        }
    }

    // Only update if actually different
    if (JSON.stringify(globalState[key]) === JSON.stringify(valueToStore)) return;

    globalState[key] = valueToStore;
    setState(valueToStore);
    try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    
    debouncedPush();
  }, [key, state]);

  return [state, updateState];
}

export function useBroadcast(event, callback) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        if (!currentChannel) return;
        const channel = currentChannel.on('broadcast', { event }, (payload) => {
            if (callbackRef.current) callbackRef.current(payload.payload);
        });
    }, [event]);

    return useCallback((payload) => {
        if (currentChannel) {
            currentChannel.send({ type: 'broadcast', event, payload });
        }
    }, []);
}
