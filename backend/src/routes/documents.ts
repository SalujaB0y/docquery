import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DocumentRow = {
  id: string;
  filename: string;
  folder_id: string | null;
  created_at: string;
  chunks: { count: number }[];
};

router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('documents')
    .select('id, filename, folder_id, created_at, chunks(count)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`failed to list documents: ${error.message}`);
    res.status(500).json({ error: 'failed to list documents' });
    return;
  }

  const documents = ((data ?? []) as DocumentRow[]).map(doc => ({
    documentId: doc.id,
    filename: doc.filename,
    folderId: doc.folder_id,
    createdAt: doc.created_at,
    chunksIngested: doc.chunks[0]?.count ?? 0,
  }));

  res.json({ documents });
});

export default router;
