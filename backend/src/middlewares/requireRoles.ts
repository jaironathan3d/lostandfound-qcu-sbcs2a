import { UserRole } from '@prisma/client';
import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';

export const requireRoles = (...allowedRoles: UserRole[]): RequestHandler => async (req, res, next) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.authUserId },
    select: { role: true },
  });
  if (!user) {
    res.status(401).json({ message: 'Your account could not be found. Please log in again.' });
    return;
  }
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ message: 'You do not have permission to perform this action.' });
    return;
  }
  next();
};
