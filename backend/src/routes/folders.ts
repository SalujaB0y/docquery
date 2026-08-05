import { Router, Request, Response } from 'express';
import supabase from '../lib/supabaseClient';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('folders')
    .select('id, name, parent_folder_id, created_at')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`failed to list folders: ${error.message}`);
    res.status(500).json({ error: 'failed to list folders' });
    return;
  }

  const folders = (data ?? []).map(f => ({
    folderId: f.id,
    name: f.name,
    parentFolderId: f.parent_folder_id,
    createdAt: f.created_at,
  }));

  res.json({ folders });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, parentFolderId } = req.body as { name?: string; parentFolderId?: string };

  if (!name || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const { data, error } = await supabase
    .from('folders')
    .insert({ name: name.trim(), parent_folder_id: parentFolderId ?? null, user_id: req.userId })
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: 'failed to create folder' });
    return;
  }

  res.json({
    folderId: data.id,
    name: data.name,
    parentFolderId: data.parent_folder_id,
    createdAt: data.created_at,
  });
});

export default router;
