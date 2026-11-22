import cors from 'cors';
import express from 'express';
import { apiRouter } from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';

export const app = express();

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());
app.use('/api', apiRouter);

app.use(errorHandler);