import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

// Namespaced global store
const namespaces = {};
const listeners = new Set();

const notifyListeners = (ns, key) => {
  listeners.forEach(l => l(ns, key));
};

const pushToSupabase = async (ns) => {
  const store = namespaces[ns];
  if (!store || !store.roomId || !store.isInitialized) return;
  
  console.log(`[SYNC:${ns}] Attempting push to ${store.roomId}...`);
  const stateToPush = JSON.parse(JSON.stringify(store.state));
  
  const { data, error } = await supabase
    .from('app_state')
    .upsert({ room_id: store.roomId, state: stateToPush, last_updated: new Date().toISOString() }, { onConflict: 'room_id' });
    
  if (error) {
    console.error(`[SYNC:${ns}] PUSH FAILED!`, error);
    if (error.code === '42501') {
      console.error(`[SYNC:${ns}] SECURITY ERROR: RLS is blocking access to room_id: "${store.roomId}". Please run the SQL fix for namespaced rooms!`);
    }
  } else {
    console.log(`[SYNC:${ns}] PUSH SUCCESS for ${store.roomId}`);
  }
};

const debouncedPush = (ns, immediate = false) => {
  const store = namespaces[ns];
  if (!store) return;
  if (store.updateTimeout) clearTimeout(store.updateTimeout);
  
  if (immediate) {
    pushToSupabase(ns);
    return;
  }
  
  store.updateTimeout = setTimeout(() => pushToSupabase(ns), 300);
};

export const initializeRoomSync = async (roomId, ns = 'main') => {
  const rowId = ns === 'main' ? roomId : `${roomId}:${ns}`;
  console.log(`[SYNC:${ns}] Initializing with rowId: ${rowId}`);
  
  if (namespaces[ns]?.roomId === rowId && namespaces[ns]?.isInitialized) return;

  if (namespaces[ns]?.channel) {
    supabase.removeChannel(namespaces[ns].channel);
  }

  namespaces[ns] = {
    state: {},
    isInitialized: false,
    roomId: rowId,
    channel: null,
    updateTimeout: null
  };

  // 1. Fetch initial state
  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', rowId).single();
  
  if (data) {
    console.log(`[SYNC:${ns}] Initial data loaded`);
    namespaces[ns].state = data.state || {};
  } else if (error) {
    console.warn(`[SYNC:${ns}] Row fetch failed or missing. RowId: ${rowId}`, error);
    // Silent upsert to ensure row exists
    await supabase.from('app_state').upsert({ room_id: rowId, state: {} }, { onConflict: 'room_id' });
  }

  namespaces[ns].isInitialized = true;
  notifyListeners(ns, '*');

  // 2. Setup Realtime
  const channelName = `realtime_v2_${ns}_${roomId}`;
  console.log(`[SYNC:${ns}] Connecting to channel: ${channelName}`);
  const channel = supabase.channel(channelName);
  
  channel.on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'app_state', 
    filter: `room_id=eq.${rowId}` 
  }, (payload) => {
    console.log(`[SYNC:${ns}] RECEIVE from DB:`, payload.new.state);
    if (payload.new && payload.new.state) {
        const newState = payload.new.state;
        const currentNS = namespaces[ns];
        const mergedState = { ...currentNS.state };

        Object.keys(newState).forEach(key => {
            if (Array.isArray(newState[key])) {
                const existingItems = currentNS.state[key] || [];
                const newItems = newState[key];
                
                if (newItems.length > 0 && newItems[0]?.id) {
                    const itemMap = new Map(existingItems.map(item => [item.id, item]));
                    newItems.forEach(item => {
                        const existing = itemMap.get(item.id);
                        if (!existing || JSON.stringify(existing) !== JSON.stringify(item)) {
                            itemMap.set(item.id, item);
                        }
                    });
                    const mergedArray = Array.from(itemMap.values());
                    if (mergedArray[0]?.timestamp) {
                        mergedArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    }
                    mergedState[key] = key.includes('history') ? mergedArray.slice(-150) : mergedArray;
                } else {
                    mergedState[key] = newItems;
                }
            } else {
                mergedState[key] = newState[key];
            }
        });

        currentNS.state = mergedState;
        notifyListeners(ns, '*');
    }
  });

  channel.subscribe((status) => {
      console.log(`[SYNC:${ns}] SUBSCRIPTION: ${status}`);
  });
  namespaces[ns].channel = channel;
};

export function useGlobalSync(key, initialValue, ns = 'main') {
  const getInitial = () => {
    const nsStore = namespaces[ns];
    if (nsStore && nsStore.state[key] !== undefined) return nsStore.state[key];
    try {
      const item = window.localStorage.getItem(`sync_${ns}_${key}`);
      return item ? JSON.parse(item) : initialValue;
    } catch (e) {
      return initialValue;
    }
  };

  const [state, setState] = useState(getInitial);

  useEffect(() => {
    const handleSync = (updatedNS, updatedKey) => {
      if (updatedNS !== ns) return;
      const nsStore = namespaces[ns];
      if (!nsStore) return;

      const globalValue = nsStore.state[key];
      if (globalValue !== undefined && JSON.stringify(globalValue) !== JSON.stringify(state)) {
        console.log(`[SYNC:${ns}] Hook updating state for ${key}`);
        setState(globalValue);
        try { window.localStorage.setItem(`sync_${ns}_${key}`, JSON.stringify(globalValue)); } catch (e) {}
      }
    };
    listeners.add(handleSync);
    if (namespaces[ns]?.isInitialized) {
        const val = namespaces[ns].state[key];
        if (val !== undefined && JSON.stringify(val) !== JSON.stringify(state)) {
            setState(val);
        }
    }
    return () => { listeners.delete(handleSync); };
  }, [ns, key, state]);

  const updateState = useCallback((value) => {
    const nsStore = namespaces[ns];
    if (!nsStore) {
        console.error(`[SYNC:${ns}] Attempted to update ${key} before initialization!`);
        return;
    }

    let valueToStore = value instanceof Function ? value(state) : value;
    
    if (Array.isArray(valueToStore) && Array.isArray(nsStore.state[key])) {
        if (valueToStore.length > 0 && valueToStore[0]?.id) {
            const itemMap = new Map(nsStore.state[key].map(i => [i.id, i]));
            valueToStore.forEach(item => itemMap.set(item.id, item));
            valueToStore = Array.from(itemMap.values());
            if (valueToStore[0]?.timestamp) {
                valueToStore.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            }
        }
    }

    if (JSON.stringify(nsStore.state[key]) === JSON.stringify(valueToStore)) return;

    console.log(`[SYNC:${ns}] Local update for ${key}`);
    nsStore.state[key] = valueToStore;
    setState(valueToStore);
    try { window.localStorage.setItem(`sync_${ns}_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    
    debouncedPush(ns, ns === 'chat');
  }, [ns, key, state]);

  return [state, updateState];
}

export function useBroadcast(event, callback) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        const mainChannel = namespaces['main']?.channel;
        if (!mainChannel) return;
        mainChannel.on('broadcast', { event }, (payload) => {
            if (callbackRef.current) callbackRef.current(payload.payload);
        });
    }, [event]);

    return useCallback((payload) => {
        const mainChannel = namespaces['main']?.channel;
        if (mainChannel) {
            mainChannel.send({ type: 'broadcast', event, payload });
        }
    }, []);
}
