// config/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

// Public client, safe to use in browser
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Admin client, for server-side use only with elevated privileges
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);