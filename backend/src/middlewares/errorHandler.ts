import type { Request, Response } from 'express';

export const errorHandler = (error: Error, _req: Request, res: Response): void => {
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : error.message,
  });
};
