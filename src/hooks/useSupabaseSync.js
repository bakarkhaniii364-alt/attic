import { useState, useEffect, useCallback, useRef } from 'react';
import { useSync } from '../context/SyncContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isTestMode, onTestStateUpdate, sendTestStateRequest } from '../lib/testMode.js';

/**
 * useGlobalSync
 * Optimized wrapper around SyncContext for individual key synchronization.
 * Migration Note: Previously this had its own Supabase channel; now it uses the centralized SyncContext.
 */
export function useGlobalSync(key, initialValue) {
  const { globalState, updateSyncState, isInitialized } = useSync();
  const { userId } = useAuth();
  
  // localState allows for immediate UI updates before the context cycle completes
  const [localState, setLocalState] = useState(() => {
    if (isTestMode()) {
      const cached = localStorage.getItem(`attic_test_${key}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch(e) {}
      }
    }
    if (globalState && globalState[key] !== undefined) return globalState[key];
    return initialValue;
  });

  const [loading, setLoading] = useState(!isInitialized);

  // Sync localState with globalState
  useEffect(() => {
    if (isTestMode()) {
      const cached = localStorage.getItem(`attic_test_${key}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (JSON.stringify(parsed) !== JSON.stringify(localState)) {
            setLocalState(parsed);
          }
        } catch (e) {}
      }
    }
    if (globalState && globalState[key] !== undefined) {
      if (JSON.stringify(globalState[key]) !== JSON.stringify(localState)) {
        setLocalState(globalState[key]);
      }
      setLoading(false);
    } else if (isInitialized) {
      setLoading(false);
    }
  }, [globalState, key, isInitialized, localState]);

  const updateState = useCallback(async (value) => {
    const valueToStore = value instanceof Function ? value(localState) : value;
    
    // Optimistic local update
    if (JSON.stringify(localState) !== JSON.stringify(valueToStore)) {
      setLocalState(valueToStore);
      if (isTestMode()) {
        localStorage.setItem(`attic_test_${key}`, JSON.stringify(valueToStore));
      }
      updateSyncState(key, valueToStore);
    }
  }, [key, localState, updateSyncState]);

  // Test Mode Support
  useEffect(() => {
    if (isTestMode()) {
        sendTestStateRequest(key);
        const un1 = onTestStateUpdate(key, (val) => {
            setLocalState(val);
        });
        const handleStorage = (e) => {
          if (e.key === `attic_test_${key}` && e.newValue) {
            try {
              setLocalState(JSON.parse(e.newValue));
            } catch (err) {}
          }
        };
        window.addEventListener('storage', handleStorage);
        return () => {
          un1();
          window.removeEventListener('storage', handleStorage);
        };
    }
  }, [key]);

  return [localState, updateState, loading];
}

/**
 * useBroadcast
 * Wrapper around SyncContext broadcast mechanism.
 */
export function useBroadcast(eventName, callback) {
  const { broadcast } = useSync();
  
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);

  useEffect(() => {
    const handler = (e) => {
      const { event, payload } = e.detail;
      if (event === eventName && callbackRef.current) {
        callbackRef.current(payload);
      }
    };
    window.addEventListener('sync_broadcast', handler);
    return () => window.removeEventListener('sync_broadcast', handler);
  }, [eventName]);

  const sendBroadcast = useCallback((payload) => {
    broadcast(eventName, payload);
  }, [eventName, broadcast]);

  return sendBroadcast;
}

// Deprecated, but kept for compatibility with any legacy imports
export const initializeRoomSync = async (roomId) => {
  console.warn('initializeRoomSync is deprecated. SyncProvider handles initialization.');
};
