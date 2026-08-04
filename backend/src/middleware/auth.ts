import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

// the frontend sends the Supabase Auth session's access token as a bearer token rather than
// a cookie — no SameSite/credentials handling needed across the frontend/backend origins
export default async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'invalid or expired session' });
    return;
  }

  req.userId = data.user.id;
  next();
}
