import { useState, useEffect } from 'react';
import localforage from 'localforage';

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const item = await localforage.getItem(key);
        if (mounted && item !== null) {
          setStoredValue(item);
        }
      } catch (e) {}
      if (mounted) setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [key]);

  useEffect(() => {
    if (!loading) {
      localforage.setItem(key, storedValue).catch(e => console.error(e));
    }
  }, [key, storedValue, loading]);

  return [storedValue, setStoredValue, loading];
}
