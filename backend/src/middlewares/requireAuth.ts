import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';

declare module 'express-serve-static-core' {
  interface Request {
    authUserId?: string;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (env.JWT_SECRET.length < 32) {
    res.status(503).json({ message: 'Authentication is not configured on the server.' });
    return;
  }

  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || !(payload as JwtPayload).sub) {
      res.status(401).json({ message: 'Your session is invalid. Please log in again.' });
      return;
    }
    req.authUserId = (payload as JwtPayload).sub;
    next();
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
};
