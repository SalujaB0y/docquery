import { Router, Request, Response } from 'express';
import { retrieveChunks } from '../services/retriever';
import { generateAnswer, streamAnswer } from '../services/generator';

const router = Router();

const FALLBACK_ANSWER = "I don't have enough information in the uploaded documents to answer this.";

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/', async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };
  // eval hits this with stream=false so it can read a single JSON body
  const streaming = req.query.stream !== 'false';

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

      if (!streaming) {
        res.json({ answer: FALLBACK_ANSWER, sources: [], tokenCount: 0, estimatedCost: 0 });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      writeEvent(res, 'sources', []);
      writeEvent(res, 'token', { token: FALLBACK_ANSWER });
      writeEvent(res, 'done', { tokenCount: 0, estimatedCost: 0 });
      res.end();
      return;
    }

    if (!streaming) {
      const result = await generateAnswer(question, chunks);

      console.log(
        `[${timestamp}] q="${truncatedQ}" chunks=${chunks.length} ` +
        `scores=${chunks.map(c => c.similarity.toFixed(2)).join(',')} ` +
        `tokens=${result.tokenCount} cost=$${result.estimatedCost.toFixed(5)}`
      );

      res.json(result);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let tokenCount = 0;
    let estimatedCost = 0;

    for await (const event of streamAnswer(question, chunks)) {
      writeEvent(res, event.type, event);
      if (event.type === 'done') {
        tokenCount = event.tokenCount;
        estimatedCost = event.estimatedCost;
      }
    }

    console.log(
      `[${timestamp}] q="${truncatedQ}" chunks=${chunks.length} ` +
      `scores=${chunks.map(c => c.similarity.toFixed(2)).join(',')} ` +
      `tokens=${tokenCount} cost=$${estimatedCost.toFixed(5)}`
    );

    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(`[${timestamp}] q="${truncatedQ}" error: ${message}`);

    if (!res.headersSent) {
      res.status(500).json({ error: 'query failed' });
      return;
    }
    writeEvent(res, 'error', { message: 'query failed' });
    res.end();
  }
});

export default router;
