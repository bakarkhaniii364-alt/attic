import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

// Namespaced global store
const namespaces = {};
const listeners = new Set();

const notifyListeners = (namespace, key) => {
  listeners.forEach(l => l(namespace, key));
};

const pushToSupabase = async (ns) => {
  const store = namespaces[ns];
  if (!store || !store.roomId || !store.isInitialized) return;
  
  const { error } = await supabase
    .from('app_state')
    .update({ state: store.state })
    .eq('room_id', store.roomId);
    
  if (error) console.error(`[SYNC:${ns}] Push Error:`, error);
};

const debouncedPush = (ns) => {
  const store = namespaces[ns];
  if (!store) return;
  if (store.updateTimeout) clearTimeout(store.updateTimeout);
  store.updateTimeout = setTimeout(() => pushToSupabase(ns), 1000);
};

export const initializeRoomSync = async (roomId, ns = 'main') => {
  const rowId = ns === 'main' ? roomId : `${roomId}:${ns}`;
  
  if (namespaces[ns]?.roomId === rowId && namespaces[ns]?.isInitialized) return;

  // Cleanup old channel for this namespace
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
  
  if (data && data.state) {
    namespaces[ns].state = data.state;
  } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
    await supabase.from('app_state').insert({ room_id: rowId, state: {} });
  }

  namespaces[ns].isInitialized = true;
  notifyListeners(ns, '*');

  // 2. Setup Realtime
  const channelName = `realtime:${ns}:${roomId}`;
  const channel = supabase.channel(channelName);
  
  channel.on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'app_state', 
    filter: `room_id=eq.${rowId}` 
  }, (payload) => {
    if (payload.new && payload.new.state) {
        const newState = payload.new.state;
        const currentNS = namespaces[ns];
        const mergedState = { ...currentNS.state };

        Object.keys(newState).forEach(key => {
            if (Array.isArray(newState[key]) && Array.isArray(currentNS.state[key])) {
                const existingItems = currentNS.state[key];
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
                    if (mergedArray[0]?.timestamp) {
                        mergedArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                    }
                    // LIMIT chat history to last 150 items to prevent payload bloat
                    if (key === 'chat_history' && mergedArray.length > 150) {
                        mergedState[key] = mergedArray.slice(-150);
                    } else {
                        mergedState[key] = mergedArray;
                    }
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

  channel.subscribe();
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
      if (updatedKey !== '*' && updatedKey !== key) return;
      
      const nsStore = namespaces[ns];
      if (!nsStore) return;

      const globalValue = nsStore.state[key];
      if (globalValue !== undefined && JSON.stringify(globalValue) !== JSON.stringify(state)) {
        setState(globalValue);
        try { window.localStorage.setItem(`sync_${ns}_${key}`, JSON.stringify(globalValue)); } catch (e) {}
      }
    };
    listeners.add(handleSync);
    if (namespaces[ns]?.isInitialized) handleSync(ns, '*');
    return () => { listeners.delete(handleSync); };
  }, [ns, key, state]);

  const updateState = useCallback((value) => {
    const nsStore = namespaces[ns];
    if (!nsStore) return;

    let valueToStore = value instanceof Function ? value(state) : value;
    
    // Merge if array
    if (Array.isArray(valueToStore) && Array.isArray(nsStore.state[key])) {
        const hasIds = valueToStore.length > 0 && (valueToStore[valueToStore.length - 1]?.id);
        if (hasIds) {
            const merged = [...nsStore.state[key]];
            valueToStore.forEach(item => {
                const idx = merged.findIndex(m => m.id === item.id);
                if (idx >= 0) merged[idx] = item;
                else merged.push(item);
            });
            valueToStore = merged;
        }
    }

    if (JSON.stringify(nsStore.state[key]) === JSON.stringify(valueToStore)) return;

    nsStore.state[key] = valueToStore;
    setState(valueToStore);
    try { window.localStorage.setItem(`sync_${ns}_${key}`, JSON.stringify(valueToStore)); } catch (e) {}
    
    debouncedPush(ns);
  }, [ns, key, state]);

  return [state, updateState];
}

export function useBroadcast(event, callback) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        const mainChannel = namespaces['main']?.channel;
        if (!mainChannel) return;
        const channel = mainChannel.on('broadcast', { event }, (payload) => {
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
