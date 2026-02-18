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
export const supabase: SupabaseClient = supabaseInstance || new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (prop === 'from') {
            return () => new Proxy({}, {
                get() {
                    return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
                }
            });
        }
        return () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
    }
});
