import supabase from './supabaseClient';

// every backend call needs the current Supabase session's access token as a bearer header —
// centralized here instead of repeated at every fetch call site across page.tsx and the
// components that hit the API directly (FileUpload, DocumentList's inline folder creation)
export default async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, { ...options, headers });
}
