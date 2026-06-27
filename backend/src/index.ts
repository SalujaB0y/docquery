import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import ingestRouter from './routes/ingest';
import queryRouter from './routes/query';

const app = express();
const port = process.env.PORT ?? 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '20'),
  message: { error: 'Too many requests, please try again later.' },
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : '*',
}));

app.use(express.json());
app.use('/api', limiter);

app.use('/api/ingest', ingestRouter);
app.use('/api/query', queryRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`server running on port ${port}`);
});
