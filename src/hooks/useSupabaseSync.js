import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

const namespaces = {};
const listeners = new Set();

const notifyListeners = (ns, key) => {
  listeners.forEach(l => l(ns, key));
};

const pushToSupabase = async (ns) => {
  const store = namespaces[ns];
  if (!store || !store.roomId || !store.isInitialized) return;
  
  try {
    const stateToPush = JSON.parse(JSON.stringify(store.state));
    const { error } = await supabase
      .from('app_state')
      .upsert({ room_id: store.roomId, state: stateToPush, last_updated: new Date().toISOString() }, { onConflict: 'room_id' });
      
    if (error) {
        console.error(`[SYNC:${ns}] PUSH ERROR:`, error.message);
        if (error.code === '42501') {
            console.error(`[SYNC:${ns}] ACTION REQUIRED: Your database is blocking this namespace. Run the SQL fix provided in sync_fix.sql!`);
        }
    } else {
        console.log(`[SYNC:${ns}] PUSH OK`);
    }
  } catch (e) {
    console.error(`[SYNC:${ns}] Serialization error:`, e);
  }
};

const debouncedPush = (ns, immediate = false) => {
  const store = namespaces[ns];
  if (!store) return;
  if (store.updateTimeout) clearTimeout(store.updateTimeout);
  if (immediate) { pushToSupabase(ns); return; }
  store.updateTimeout = setTimeout(() => pushToSupabase(ns), 500);
};

export const initializeRoomSync = async (roomId, ns = 'main') => {
  if (!roomId) return;
  const rowId = ns === 'main' ? roomId : `${roomId}:${ns}`;
  
  // Prevent redundant initialization
  if (namespaces[ns]?.roomId === rowId && namespaces[ns]?.isInitialized) return;

  if (namespaces[ns]?.channel) {
    supabase.removeChannel(namespaces[ns].channel);
  }

  namespaces[ns] = {
    state: namespaces[ns]?.state || {}, // Preserve existing state if possible
    isInitialized: false,
    roomId: rowId,
    channel: null,
    updateTimeout: null
  };

  console.log(`[SYNC:${ns}] Initializing ${rowId}...`);

  // 1. Fetch initial state
  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', rowId).single();
  
  if (data && data.state) {
    console.log(`[SYNC:${ns}] Data fetched`);
    namespaces[ns].state = data.state;
  } else if (error && error.code !== 'PGRST116') {
    console.error(`[SYNC:${ns}] FETCH ERROR:`, error.message);
  }

  namespaces[ns].isInitialized = true;
  notifyListeners(ns, '*');

  // 2. Setup Realtime
  const channel = supabase.channel(`sync_${ns}_${roomId.slice(0,8)}`);
  channel.on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'app_state', 
    filter: `room_id=eq.${rowId}` 
  }, (payload) => {
    if (payload.new && payload.new.state) {
        console.log(`[SYNC:${ns}] Incoming Update`);
        const newState = payload.new.state;
        const currentNS = namespaces[ns];
        const mergedState = { ...currentNS.state };

        Object.keys(newState).forEach(key => {
            if (Array.isArray(newState[key]) && Array.isArray(currentNS.state[key])) {
                const existingItems = currentNS.state[key];
                const newItems = newState[key];
                if (newItems.length > 0 && newItems[0]?.id) {
                    const itemMap = new Map(existingItems.map(item => [item.id, item]));
                    newItems.forEach(item => itemMap.set(item.id, item));
                    const mergedArray = Array.from(itemMap.values());
                    if (mergedArray[0]?.timestamp) mergedArray.sort((a, b) => a.timestamp - b.timestamp);
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
  }).subscribe();
  
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
        setState(globalValue);
        try { window.localStorage.setItem(`sync_${ns}_${key}`, JSON.stringify(globalValue)); } catch (e) {}
      }
    };
    listeners.add(handleSync);
    // Initial check
    if (namespaces[ns]?.isInitialized) {
        const val = namespaces[ns].state[key];
        if (val !== undefined && JSON.stringify(val) !== JSON.stringify(state)) setState(val);
    }
    return () => { listeners.delete(handleSync); };
  }, [ns, key, state]);

  const updateState = useCallback((value) => {
    const nsStore = namespaces[ns];
    if (!nsStore) return;

    let valueToStore = value instanceof Function ? value(state) : value;
    
    if (Array.isArray(valueToStore) && Array.isArray(nsStore.state[key])) {
        if (valueToStore.length > 0 && valueToStore[0]?.id) {
            const itemMap = new Map(nsStore.state[key].map(i => [i.id, i]));
            valueToStore.forEach(item => itemMap.set(item.id, item));
            valueToStore = Array.from(itemMap.values());
            if (valueToStore[0]?.timestamp) valueToStore.sort((a, b) => a.timestamp - b.timestamp);
        }
    }

    if (JSON.stringify(nsStore.state[key]) === JSON.stringify(valueToStore)) return;

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
        const channel = namespaces['main']?.channel;
        if (channel) channel.on('broadcast', { event }, (p) => callbackRef.current?.(p.payload));
    }, [event]);
    return useCallback((payload) => {
        namespaces['main']?.channel?.send({ type: 'broadcast', event, payload });
    }, []);
}
