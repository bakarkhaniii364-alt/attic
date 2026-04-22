import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

let globalState = {};
let isInitialized = false;
const listeners = new Set();
let currentRoomId = null;
let currentChannel = null;
let updateTimeout = null;

const notifyListeners = () => {
  listeners.forEach(l => l());
};

const pushToSupabase = async () => {
  if (!currentRoomId || !isInitialized) return;
  
  try {
    const { error } = await supabase
      .from('app_state')
      .upsert({ room_id: currentRoomId, state: globalState, last_updated: new Date().toISOString() }, { onConflict: 'room_id' });
      
    if (error) console.error("[SYNC] PUSH ERROR:", error.message);
  } catch (e) {
    console.error("[SYNC] Serialization error:", e);
  }
};

const debouncedPush = (immediate = false) => {
  if (updateTimeout) clearTimeout(updateTimeout);
  if (immediate) { pushToSupabase(); return; }
  updateTimeout = setTimeout(pushToSupabase, 500);
};

export const initializeRoomSync = async (roomId, ns = 'main') => {
  // Ignore namespace for now to restore stability with existing RLS
  if (currentRoomId === roomId && isInitialized) return;

  if (currentChannel) {
    supabase.removeChannel(currentChannel);
  }

  currentRoomId = roomId;
  console.log(`[SYNC] Initializing room: ${roomId}`);

  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', roomId).single();
  
  if (data && data.state) {
    globalState = data.state;
  } else if (error && error.code !== 'PGRST116') {
    console.error(`[SYNC] FETCH ERROR:`, error.message);
  }

  isInitialized = true;
  notifyListeners();

  const channel = supabase.channel(`room_sync_${roomId.slice(0,8)}`);
  channel.on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'app_state', 
    filter: `room_id=eq.${roomId}` 
  }, (payload) => {
    if (payload.new && payload.new.state) {
        const newState = payload.new.state;
        const mergedState = { ...globalState };

        Object.keys(newState).forEach(key => {
            if (Array.isArray(newState[key]) && Array.isArray(globalState[key])) {
                const existingItems = globalState[key];
                const newItems = newState[key];
                if (newItems.length > 0 && newItems[0]?.id) {
                    const itemMap = new Map(existingItems.map(item => [item.id, item]));
                    newItems.forEach(item => itemMap.set(item.id, item));
                    const mergedArray = Array.from(itemMap.values());
                    if (mergedArray[0]?.timestamp) mergedArray.sort((a, b) => a.timestamp - b.timestamp);
                    // AGGRESSIVE PRUNING to stay under 1MB Realtime limit
                    mergedState[key] = key.includes('history') ? mergedArray.slice(-50) : mergedArray;
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
  }).subscribe();
  
  currentChannel = channel;
};

export function useGlobalSync(key, initialValue, ns = 'main') {
  const getInitial = () => {
    if (globalState[key] !== undefined) return globalState[key];
    try {
      // Check both new and old storage keys for migration
      const item = window.localStorage.getItem(`sync_${ns}_${key}`) || window.localStorage.getItem(`sync_${key}`);
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
    if (!isInitialized) return;

    let valueToStore = value instanceof Function ? value(state) : value;
    
    if (Array.isArray(valueToStore) && Array.isArray(globalState[key])) {
        if (valueToStore.length > 0 && valueToStore[0]?.id) {
            const itemMap = new Map(globalState[key].map(i => [i.id, i]));
            valueToStore.forEach(item => itemMap.set(item.id, item));
            valueToStore = Array.from(itemMap.values());
            if (valueToStore[0]?.timestamp) valueToStore.sort((a, b) => a.timestamp - b.timestamp);
            // AGGRESSIVE PRUNING on save
            if (key.includes('history')) valueToStore = valueToStore.slice(-50);
        }
    }

    if (JSON.stringify(globalState[key]) === JSON.stringify(valueToStore)) return;

    globalState[key] = valueToStore;
    setState(valueToStore);
    try { window.localStorage.setItem(`sync_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    debouncedPush(key.includes('history') || key.includes('call'));
  }, [key, state]);

  return [state, updateState];
}

export function useBroadcast(event, callback) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useEffect(() => {
        if (currentChannel) currentChannel.on('broadcast', { event }, (p) => callbackRef.current?.(p.payload));
    }, [event]);
    return useCallback((payload) => {
        currentChannel?.send({ type: 'broadcast', event, payload });
    }, []);
}
