import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthRequest } from '../../middlewares/requireAuth';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req: AuthRequest, res) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: req.userId!, readAt: null } }),
  ]);
  res.json({ unread, items });
});

notificationsRouter.patch('/read-all', async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId!, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

notificationsRouter.patch('/:id/read', async (req: AuthRequest, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: req.userId! },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json({ ok: true });
});