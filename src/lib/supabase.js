import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utywhgnxqanetqwmhhie.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0eXdoZ254cWFuZXRxd21oaGllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTEzNjgsImV4cCI6MjA5MjM2NzM2OH0.CdTOhJXkR_PKjxoICBeyP8SCtnB2mvCbg3RgIqkh_pk';

// Detection for test mode to short-circuit network calls
const isTestMode = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('test_mode') === 'true' || localStorage.getItem('attic_test_mode') === 'true';
};

const realClient = createClient(supabaseUrl, supabaseKey);

// A simple mock that returns successful but empty results to silence 400 errors in test mode
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
                        })
                    };
                }
                if (prop === 'from' || prop === 'rpc' || prop === 'channel') {
                    return (...args) => {
                        let isSingle = false;
                        let insertedData = null; // Capture what was inserted
                        const chain = (lastInsert) => ({
                            select: () => chain(lastInsert),
                            insert: (data) => chain(data), // Capture the inserted payload
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
                            single: () => { isSingle = true; return chain(lastInsert); },
                            // Echo back the inserted data so sender_id/content survive
                            then: (resolve) => {
                                if (isSingle && lastInsert) {
                                    const echo = { id: `mock-${Date.now()}`, created_at: new Date().toISOString(), ...lastInsert };
                                    return resolve({ data: echo, error: null });
                                }
                                return resolve({ data: isSingle ? null : (prop === 'rpc' ? null : []), error: null });
                            },
                            catch: (reject) => reject(new Error('Mock Fail')),
                        });
                        return chain(null);
                    };
                }
            }
            const value = obj[prop];
            return typeof value === 'function' ? value.bind(obj) : value;
        }
    });
};

export const supabase = createMockProxy(realClient);
