import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Turn = {
  question: string;
  answer: string;
  sources: { index: number; content: string; documentId: string }[];
  followUps: string[];
  tokenCount: number;
  estimatedCost: number;
};

router.get('/', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('threads')
    .select('id, title, document_ids, turns, updated_at')
    .eq('user_id', req.userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error(`failed to list threads: ${error.message}`);
    res.status(500).json({ error: 'failed to list threads' });
    return;
  }

  const threads = (data ?? []).map(t => ({
    threadId: t.id,
    title: t.title,
    documentIds: t.document_ids ?? [],
    turnCount: (t.turns as Turn[]).length,
    updatedAt: t.updated_at,
  }));

  res.json({ threads });
});

router.get('/:id', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('threads')
    .select('id, title, document_ids, turns, updated_at')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'thread not found' });
    return;
  }

  res.json({
    threadId: data.id,
    title: data.title,
    documentIds: data.document_ids ?? [],
    turns: data.turns,
    updatedAt: data.updated_at,
  });
});

router.post('/', async (req: Request, res: Response) => {
  const { title, documentIds, turns } = req.body as {
    title?: string;
    documentIds?: string[];
    turns?: Turn[];
  };

  if (!title || !Array.isArray(turns) || turns.length === 0) {
    res.status(400).json({ error: 'title and a non-empty turns array are required' });
    return;
  }

  const { data, error } = await supabase
    .from('threads')
    .insert({ title, document_ids: documentIds ?? null, turns, user_id: req.userId })
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: 'failed to create thread' });
    return;
  }

  res.json({
    threadId: data.id,
    title: data.title,
    documentIds: data.document_ids ?? [],
    turns: data.turns,
    updatedAt: data.updated_at,
  });
});

router.put('/:id', async (req: Request, res: Response) => {
  const { title, documentIds, turns } = req.body as {
    title?: string;
    documentIds?: string[];
    turns?: Turn[];
  };

  if (!title || !Array.isArray(turns) || turns.length === 0) {
    res.status(400).json({ error: 'title and a non-empty turns array are required' });
    return;
  }

  const { data, error } = await supabase
    .from('threads')
    .update({ title, document_ids: documentIds ?? null, turns, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'thread not found' });
    return;
  }

  res.json({
    threadId: data.id,
    title: data.title,
    documentIds: data.document_ids ?? [],
    turns: data.turns,
    updatedAt: data.updated_at,
  });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { error } = await supabase
    .from('threads')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) {
    res.status(500).json({ error: 'failed to delete thread' });
    return;
  }

  res.status(204).end();
});

export default router;
