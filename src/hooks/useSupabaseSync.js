import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { isTestMode, sendTestBroadcast, onTestBroadcast, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';
import { useUserContext } from './useUserContext.js';

// Global store for the entire room's data
let globalState = {};
let isInitialized = false;
const listeners = new Set();
let currentRoomId = null;

// Notify all React hooks when the global state changes from incoming webhooks
const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

let currentChannel = null; // Broadcast channel
let dbChannel = null;      // Postgres changes channel

/* ── E2EE UTILITIES REMOVED (Too buggy for current sync architecture) ── */

export const initializeRoomSync = async (roomId) => {
  if (currentRoomId === roomId && isInitialized) return;
  
  currentRoomId = roomId;
  if (!currentRoomId) return;

  if (isTestMode()) {
    isInitialized = true;
    notifyListeners();
    return;
  }

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
  
  // Initialize dedicated sync channel for broadcasts
  if (currentChannel) supabase.removeChannel(currentChannel);
  currentChannel = supabase.channel(`broadcast_${currentRoomId}`)
    .on('broadcast', { event: 'state_update' }, ({ payload }) => {
        // This will be handled by individual hooks via notifyListeners
        if (payload.key && payload.value !== undefined) {
            globalState[payload.key] = payload.value;
            notifyListeners();
        }
    })
    .subscribe();

  // Initialize DB listener channel
  if (dbChannel) supabase.removeChannel(dbChannel);
  dbChannel = supabase.channel(`db_sync_${currentRoomId}`)
    .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'app_state', 
        filter: `room_id=eq.${currentRoomId}` 
    }, (payload) => {
        if (payload.new && payload.new.state) {
            globalState = { ...globalState, ...payload.new.state };
            notifyListeners();
        }
    })
    .subscribe();

  notifyListeners();
};

export function useGlobalSync(key, initialValue) {
  const { userId } = useUserContext();
  const [state, setState] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  // Load initial value from globalState or localforage
  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      // 1. Check globalState first (fastest)
      if (globalState[key] !== undefined) {
        if (mounted) {
          setState(globalState[key]);
          setLoading(false);
        }
        return;
      }

      // 2. Fallback to localforage
      try {
        const item = await localforage.getItem(`sync_${key}`);
        if (mounted) {
          if (item !== null) {
            setState(item);
            globalState[key] = item; // Hydrate global store
          }
          setLoading(false);
        }
      } catch (e) {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [key]);

  const pendingUpdateRef = useRef(null);

  // updateGlobalState with debouncing to prevent spamming the database
  const updateGlobalState = useCallback(async (valueToStore) => {
    if (!currentRoomId || (!isInitialized && !isTestMode())) return;
    
    // Deep equality check before updating global store and triggering a push
    if (JSON.stringify(globalState[key]) === JSON.stringify(valueToStore)) return;

    // Copy current global state to push
    const payload = { ...globalState, [key]: valueToStore };
    globalState = payload; // Update global store instantly for other hooks

    // Solution: Instant Broadcast for true real-time feel
    if (currentChannel) {
        currentChannel.send({
            type: 'broadcast',
            event: 'state_update',
            payload: { key, value: valueToStore, senderId: userId }
        });
    }

    // Debounce the actual database push using a Ref to ensure we always use latest globalState
    if (pendingUpdateRef.current) clearTimeout(pendingUpdateRef.current);
    
    pendingUpdateRef.current = setTimeout(async () => {
      const stateToPush = { ...globalState };
      // Remove metadata before push
      Object.keys(stateToPush).forEach(k => { if (k.startsWith('_')) delete stateToPush[k]; });
      
      const { error } = await supabase.from('app_state').update({ state: stateToPush }).eq('room_id', currentRoomId);
      if (error) console.error("Sync Error:", error);
    }, 500); // Reduced to 500ms for snappier feel
  }, [key]);

  // Update function that pushes to React, LocalStorage, Global Store, and Supabase
  const updateState = useCallback(async (value) => {
    const valueToStore = value instanceof Function ? value(state) : value;
    
    // Optimistic local update
    if (JSON.stringify(state) !== JSON.stringify(valueToStore)) {
      setState(valueToStore);
      globalState[key] = valueToStore;
      
      // Solution 7 & 28: Robust LocalForage handling
      localforage.setItem(`sync_${key}`, valueToStore).catch(e => {
          if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
              console.warn('[STORAGE] Quota exceeded, skipping local cache for', key);
          } else {
              console.error('[STORAGE] LocalForage error:', e);
          }
      });

      if (isTestMode()) {
        sendTestStateUpdate(key, valueToStore);
        notifyListeners();
      }
      updateGlobalState(valueToStore);
    }
  }, [key, state, userId, updateGlobalState]);

  // 2. Realtime Sync (Handled by global channels, we just listen to tick)
  useEffect(() => {
    if (!currentRoomId || (!isInitialized && !isTestMode())) return;

    // Load latest value from global store on every tick
    if (globalState[key] !== undefined) {
        if (JSON.stringify(globalState[key]) !== JSON.stringify(state)) {
            setState(globalState[key]);
            localforage.setItem(`sync_${key}`, globalState[key]).catch(e => {});
        }
    }

    let unspentTest;
    if (isTestMode()) {
        unspentTest = onTestStateUpdate(key, (val) => {
            setState(val);
            globalState[key] = val;
            notifyListeners();
        });
    }

    return () => {
      if (unspentTest) unspentTest();
    };
  }, [key, tick]);

  return [state, updateState];
}
export function useBroadcast(eventName, callback) {
  const [channel, setChannel] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);

  useEffect(() => {
    if (!currentRoomId || (!isInitialized && !isTestMode())) return;

    // Unique channel name for this specific hook instance to prevent subscribe() crashes
    const uniqueId = Math.random().toString(36).substring(7);
    const channelName = `room_broadcast_${currentRoomId}_${eventName}_${uniqueId}`;
    const newChannel = supabase.channel(channelName)
      .on('broadcast', { event: eventName }, ({ payload }) => {
        if (callbackRef.current) callbackRef.current(payload);
      })
      .subscribe();

    setChannel(newChannel);

    let unspentTest;
    if (isTestMode()) {
        unspentTest = onTestBroadcast(eventName, (payload) => {
            if (callbackRef.current) callbackRef.current(payload);
        });
    }

    return () => {
      supabase.removeChannel(newChannel);
      if (unspentTest) unspentTest();
    };
  }, [eventName, tick]); // Re-subscribe if eventName OR initialization state changes

  const sendBroadcast = useCallback((payload) => {
    if (isTestMode()) sendTestBroadcast(eventName, payload);
    if (channel) {
        channel.send({
          type: 'broadcast',
          event: eventName,
          payload
        });
    }
  }, [eventName, channel]);

  return sendBroadcast;
}
