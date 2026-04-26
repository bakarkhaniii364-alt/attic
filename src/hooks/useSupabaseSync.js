import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { isTestMode, sendTestBroadcast, onTestBroadcast, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';

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
  notifyListeners();
};

export function useGlobalSync(key, initialValue) {
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

    // Debounce the actual database push using a Ref to ensure we always use latest globalState
    if (pendingUpdateRef.current) clearTimeout(pendingUpdateRef.current);
    
    pendingUpdateRef.current = setTimeout(async () => {
      const stateToPush = { ...globalState };
      // Remove metadata before push
      Object.keys(stateToPush).forEach(k => { if (k.startsWith('_')) delete stateToPush[k]; });
      
      const { error } = await supabase.from('app_state').update({ state: stateToPush }).eq('room_id', currentRoomId);
      if (error) console.error("Sync Error:", error);
      else console.log(`[SYNC] Pushed updates for key: ${key}`);
    }, 1000); // 1s debounce
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
  }, [key, state, updateGlobalState]);

  // 2. Realtime Sync (per-hook channel to avoid collisions)
  useEffect(() => {
    if (!currentRoomId || (!isInitialized && !isTestMode())) return;

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channelName = `sync_${key}_${currentRoomId}_${uniqueId}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'app_state', 
        filter: `room_id=eq.${currentRoomId}` 
      }, (payload) => {
        // Solution 6: Strict null-checking
        if (payload.new && payload.new.state && payload.new.state[key] !== undefined) {
            const remoteValue = payload.new.state[key];
            const remoteString = JSON.stringify(remoteValue);
            const localString = JSON.stringify(state);
            if (remoteString !== localString) {
                setState(remoteValue);
                globalState[key] = remoteValue;
                localforage.setItem(`sync_${key}`, remoteValue).catch(e => {});
            }
        }
      })
      .subscribe();
    
    let unspentTest;
    if (isTestMode()) {
        unspentTest = onTestStateUpdate(key, (val) => {
            console.log(`[TEST_SYNC] Received state update for ${key}:`, val);
            setState(val);
            globalState[key] = val;
            notifyListeners();
        });
    }

    return () => {
      supabase.removeChannel(channel);
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

    // Fixed channel name for all users in this room/event
    const channelName = `room_broadcast_${currentRoomId}_${eventName}`;
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
