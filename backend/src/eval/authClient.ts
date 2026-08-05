import supabase from '../lib/supabaseClient';

const EVAL_EMAIL = 'eval-service@docquery.local';
// no hardcoded fallback: Supabase's password-grant endpoint is reachable directly with the
// public anon key, independent of this backend entirely, so a known default here would let
// anyone sign in as this account against a live project — it has to be a real secret
const rawPassword = process.env.EVAL_SERVICE_PASSWORD;
if (!rawPassword) {
  throw new Error('EVAL_SERVICE_PASSWORD must be set — see README.md for the eval setup');
}
const EVAL_PASSWORD: string = rawPassword;

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
