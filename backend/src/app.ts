import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';

export const app = express();

app.use(cors({
  origin: [
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
}));
app.use(express.json({ limit: '20mb' }));
app.use('/api', apiRouter);

app.use(errorHandler);
