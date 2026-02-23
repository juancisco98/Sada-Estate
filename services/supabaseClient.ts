import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log(`[Supabase] ✅ Client initialized for: ${supabaseUrl}`);
} else {
    console.warn('[Supabase] ⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    console.warn('[Supabase] ⚠️ Running in offline mode with mock data.');
}

// Export a proxy that won't crash when supabase is null.
// All .from() calls will return errors caught by data hooks' try/catch → fallback to mock data.
// Export a proxy that won't crash when supabase is null.
// All .from() calls will return errors caught by data hooks' try/catch → fallback to mock data.
export const supabase: SupabaseClient = supabaseInstance || new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (prop === 'from') {
            return () => new Proxy({}, {
                get(_t, method) {
                    // Return empty data for select/insert/update/delete prevents crashes
                    if (['select', 'insert', 'update', 'delete', 'upsert'].includes(method as string)) {
                        console.error(`[Supabase Proxy] Attempted ${String(method)} on missing client.`);
                        return () => Promise.resolve({ data: [], error: { message: 'Supabase not configured (Missing Envs)' } });
                    }
                    return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
                }
            });
        }
        if (prop === 'auth') {
            return {
                signInWithOAuth: () => Promise.resolve({ error: { message: 'Supabase Auth not configured' } }),
                signOut: () => Promise.resolve({ error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            }
        }
        return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
    }
});

export const signInWithGoogle = async () => {
    if (!supabaseInstance) return { error: { message: 'Supabase not configured' } };
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        },
    });
    return { data, error };
};

export const signOut = async () => {
    if (!supabaseInstance) return { error: { message: 'Supabase not configured' } };
    const { error } = await supabase.auth.signOut();
    return { error };
};
