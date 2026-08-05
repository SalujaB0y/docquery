import { createClient } from '@supabase/supabase-js';

// service-role key — bypasses RLS, so every query site is responsible for its own
// user_id filtering (see middleware/auth.ts and each route in routes/)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default supabase;
