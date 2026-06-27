import { Router, Request, Response } from 'express';
import { retrieveChunks } from '../services/retriever';
import { generateAnswer } from '../services/generator';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };

  if (!question || question.trim().length === 0) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  const timestamp = new Date().toISOString();
  const truncatedQ = question.slice(0, 80);

  try {
    const chunks = await retrieveChunks(question);

    if (chunks.length === 0) {
      console.log(`[${timestamp}] q="${truncatedQ}" → no chunks above threshold`);
      res.json({
        answer: "I don't have enough information in the uploaded documents to answer this.",
        sources: [],
        tokenCount: 0,
        estimatedCost: 0,
      });
      return;
    }

    const result = await generateAnswer(question, chunks);

    console.log(
      `[${timestamp}] q="${truncatedQ}" chunks=${chunks.length} ` +
      `scores=${chunks.map(c => c.similarity.toFixed(2)).join(',')} ` +
      `tokens=${result.tokenCount} cost=$${result.estimatedCost.toFixed(5)}`
    );

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`[${timestamp}] q="${truncatedQ}" error: ${message}`);
    res.status(500).json({ error: 'query failed' });
  }
});

export default router;
