import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import ingestRouter from './routes/ingest';
import queryRouter from './routes/query';

dotenv.config();

const app = express();
const port = process.env.PORT ?? 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
