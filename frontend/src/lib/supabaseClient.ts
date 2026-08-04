import { createClient } from '@supabase/supabase-js';

// anon key only — safe to expose client-side, distinct from the backend's service-role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default supabase;
