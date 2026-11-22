import type { UserRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing token' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    res.locals.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (_req: Request, res: Response, next: NextFunction): void => {
    if (!roles.includes(res.locals.user?.role)) {
      res.status(403).json({ message: 'You do not have permission to do this' });
      return;
    }
    next();
  };