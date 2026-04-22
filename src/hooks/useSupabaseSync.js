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
  
  // Clone state to avoid mutation issues during stringification
  const stateToPush = JSON.parse(JSON.stringify(store.state));
  
  const { error } = await supabase
    .from('app_state')
    .update({ state: stateToPush, last_updated: new Date().toISOString() })
    .eq('room_id', store.roomId);
    
  if (error) console.error(`[SYNC:${ns}] Push Error:`, error);
  else console.log(`[SYNC:${ns}] Pushed successfully`);
};

const debouncedPush = (ns, immediate = false) => {
  const store = namespaces[ns];
  if (!store) return;
  if (store.updateTimeout) clearTimeout(store.updateTimeout);
  
  if (immediate) {
    pushToSupabase(ns);
    return;
  }
  
  // Faster debounce for better feel (300ms)
  store.updateTimeout = setTimeout(() => pushToSupabase(ns), 300);
};

export const initializeRoomSync = async (roomId, ns = 'main') => {
  const rowId = ns === 'main' ? roomId : `${roomId}:${ns}`;
  
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

  // 1. Fetch or Create Row
  const { data, error } = await supabase.from('app_state').select('state').eq('room_id', rowId).single();
  
  if (data) {
    namespaces[ns].state = data.state || {};
  } else {
    // Attempt to create if missing
    await supabase.from('app_state').upsert({ room_id: rowId, state: {} }, { onConflict: 'room_id' });
  }

  namespaces[ns].isInitialized = true;
  notifyListeners(ns, '*');

  // 2. Setup Realtime with more robust settings
  const channelName = `room_js_sync_${ns}_${roomId}`;
  const channel = supabase.channel(channelName);
  
  channel.on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'app_state', 
    filter: `room_id=eq.${rowId}` 
  }, (payload) => {
    console.log(`[SYNC:${ns}] Incoming update for ${rowId}`);
    if (payload.new && payload.new.state) {
        const newState = payload.new.state;
        const currentNS = namespaces[ns];
        
        // Deep merge to avoid losing data
        const mergedState = { ...currentNS.state };
        Object.keys(newState).forEach(key => {
            if (Array.isArray(newState[key])) {
                const existingItems = currentNS.state[key] || [];
                const newItems = newState[key];
                
                if (newItems.length > 0 && newItems[0]?.id) {
                    // ID-based merge
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
                    // Cap history
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
      console.log(`[SYNC:${ns}] Subscription status:`, status);
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
        setState(globalValue);
        try { window.localStorage.setItem(`sync_${ns}_${key}`, JSON.stringify(globalValue)); } catch (e) {}
      }
    };
    listeners.add(handleSync);
    // Initial sync check
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
    if (!nsStore) return;

    let valueToStore = value instanceof Function ? value(state) : value;
    
    // Merge if array with IDs
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

    nsStore.state[key] = valueToStore;
    setState(valueToStore);
    try { window.localStorage.setItem(`sync_${ns}_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    
    // Use immediate push for chat to be responsive
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
        const sub = mainChannel.on('broadcast', { event }, (payload) => {
            if (callbackRef.current) callbackRef.current(payload.payload);
        });
        return () => {}; // Channel handles own cleanup
    }, [event]);

    return useCallback((payload) => {
        const mainChannel = namespaces['main']?.channel;
        if (mainChannel) {
            mainChannel.send({ type: 'broadcast', event, payload });
        }
    }, []);
}
