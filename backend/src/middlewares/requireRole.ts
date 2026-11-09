import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AuthRequest } from './requireAuth';

export function requireRole(...roles: UserRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    });

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'You do not have permission' });
      return;
    }

    next();
  };
}

export async function userIsAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN;
}