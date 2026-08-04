import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVAL_EMAIL = 'eval-service@docquery.local';
// a fixed local default is fine — this account only ever owns the disposable eval corpus,
// never real user data, and the service-role key already gates who can reach this codepath
const EVAL_PASSWORD = process.env.EVAL_SERVICE_PASSWORD ?? 'eval-service-account-not-a-real-user';

export type EvalSession = {
  userId: string;
  authHeader: { Authorization: string };
};

// the eval hits the same authenticated API real users do, so it needs a real session rather
// than a bypass — this seeds (once) and signs in a dedicated service account, so reset.ts and
// run.ts always ingest/query as the same fixed identity across runs
export async function getEvalSession(): Promise<EvalSession> {
  let { data, error } = await supabase.auth.signInWithPassword({ email: EVAL_EMAIL, password: EVAL_PASSWORD });

  if (error) {
    const created = await supabase.auth.admin.createUser({
      email: EVAL_EMAIL,
      password: EVAL_PASSWORD,
      email_confirm: true,
    });
    if (created.error) throw new Error(`failed to create eval service account: ${created.error.message}`);

    ({ data, error } = await supabase.auth.signInWithPassword({ email: EVAL_EMAIL, password: EVAL_PASSWORD }));
  }

  if (error || !data.session) throw new Error(`failed to sign in eval service account: ${error?.message}`);

  return {
    userId: data.session.user.id,
    authHeader: { Authorization: `Bearer ${data.session.access_token}` },
  };
}
