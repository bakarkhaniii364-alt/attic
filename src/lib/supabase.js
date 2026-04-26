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
            // High-level services we want to mock
            if (prop === 'from' || prop === 'rpc' || prop === 'storage' || prop === 'auth' || prop === 'channel') {
                if (isTestMode()) {
                    return (...args) => {
                        let isSingle = false;
                        const chain = () => ({
                            select: chain, insert: chain, update: chain, delete: chain, eq: chain, 
                            order: chain, limit: chain, lt: chain, match: chain,
                            on: chain, subscribe: chain, track: chain, unsubscribe: () => {},
                            single: () => { isSingle = true; return chain(); },
                            upload: async () => ({ data: { path: 'mock' }, error: null }),
                            getPublicUrl: () => ({ data: { publicUrl: 'mock-url' } }),
                            getSession: async () => ({ data: { session: null }, error: null }),
                            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                            // The final execution
                            then: (resolve) => resolve({ data: isSingle ? {} : (prop === 'rpc' ? null : []), error: null }),
                            catch: (reject) => reject(new Error("Mock Fail")),
                        });
                        return chain();
                    };
                }
            }
            const value = obj[prop];
            return typeof value === 'function' ? value.bind(obj) : value;
        }
    });
};

export const supabase = createMockProxy(realClient);
