import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthRequest } from '../../middlewares/requireAuth';
import { requireRole } from '../../middlewares/requireRole';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.patch('/me', async (req: AuthRequest, res) => {
  const fullName = String(req.body.fullName ?? '').trim();
  if (!fullName) {
    res.status(400).json({ error: 'fullName is required' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: { fullName },
    select: { id: true, email: true, fullName: true, role: true },
  });
  res.json(user);
});

usersRouter.get('/', requireRole(UserRole.ADMIN, UserRole.SUPERADMIN), async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {},
    select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(users);
});