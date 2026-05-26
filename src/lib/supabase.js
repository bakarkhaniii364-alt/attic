import { createClient } from '@supabase/supabase-js';
import { isTestMode } from './testMode.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // In production we prefer to warn rather than throw so the site can still
  // render (with degraded functionality) if env vars are not present.
  if (import.meta.env.PROD) {
    console.error(
      '[Attic] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and set your Supabase credentials.'
    );
  } else {
    console.warn(
      '[Attic] Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).'
    );
  }
}

const realClient = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: { 
      persistSession: true, 
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);

const createMockProxy = (target) => {
  return new Proxy(target, {
    get(obj, prop) {
      if (isTestMode()) {
        if (prop === 'auth') {
          return {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithPassword: async () => ({ data: { user: { id: 'mock' }, session: { access_token: 'mock' } }, error: null }),
            signUp: async () => ({ data: { user: { id: 'mock' }, session: { access_token: 'mock' } }, error: null }),
            signOut: async () => ({ error: null }),
            updateUser: async () => ({ data: { user: {} }, error: null }),
          };
        }
        if (prop === 'storage') {
          return {
            from: () => ({
              upload: async () => ({ data: { path: 'mock' }, error: null }),
              getPublicUrl: () => ({ data: { publicUrl: 'mock-url' } }),
              download: async () => ({ data: new Blob(), error: null }),
            }),
          };
        }
        if (prop === 'from' || prop === 'rpc' || prop === 'channel') {
          return (...args) => {
            let isSingle = false;
            let insertedData = null;
            const chain = (lastInsert) => ({
              select: () => chain(lastInsert),
              insert: (data) => chain(data),
              update: (data) => chain(data),
              delete: () => chain(lastInsert),
              eq: () => chain(lastInsert),
              order: () => chain(lastInsert),
              limit: () => chain(lastInsert),
              lt: () => chain(lastInsert),
              match: () => chain(lastInsert),
              on: () => chain(lastInsert),
              subscribe: () => chain(lastInsert),
              track: () => chain(lastInsert),
              unsubscribe: () => {},
              send: () => Promise.resolve({ error: null }),
              single: () => { isSingle = true; return chain(lastInsert); },
              then(resolve, reject) {
                const result = isSingle && lastInsert
                  ? { id: `mock-${Date.now()}`, created_at: new Date().toISOString(), ...lastInsert }
                  : (isSingle ? null : (prop === 'rpc' ? null : []));
                return Promise.resolve({ data: result, error: null }).then(resolve, reject);
              },
            });
            return chain(null);
          };
        }
      }
      const value = obj[prop];
      return typeof value === 'function' ? value.bind(obj) : value;
    },
  });
};

export const supabase = createMockProxy(realClient);
