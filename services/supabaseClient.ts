import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase] ⚠️ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables.');
    console.error('[Supabase] ⚠️ The app will fall back to mock data.');
}

// Create client safely — even with empty strings, createClient won't crash.
// Operations will fail gracefully and usePropertyData will catch the errors and fall back to mock data.
export const supabase: SupabaseClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
);

if (supabaseUrl) {
    console.log(`[Supabase] ✅ Client initialized for: ${supabaseUrl}`);
} else {
    console.warn('[Supabase] ⚠️ Client initialized with placeholder (no real connection).');
}
