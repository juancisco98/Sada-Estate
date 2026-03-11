import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// Note: Anon key cannot execute raw SQL usually. 
// We need Service Role Key or to ask the user to run the exact SQL.
// Let's check if there is a service role key.

console.log('URL:', supabaseUrl ? 'Exists' : 'Missing');
console.log('Anon Key:', supabaseKey ? 'Exists' : 'Missing');
