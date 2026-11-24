import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.authUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: req.authUserId, readAt: null },
    }),
  ]);
  res.json({
    notifications: notifications.map((notification) => ({
      id: notification.id,
      message: notification.message,
      href: notification.href,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    })),
    unreadCount,
  });
});

notificationsRouter.patch('/read-all', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }

  const result = await prisma.notification.updateMany({
    where: { userId: req.authUserId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ updatedCount: result.count });
});

notificationsRouter.patch('/:notificationId/read', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const notificationId = req.params.notificationId;
  if (typeof notificationId !== 'string') {
    res.status(400).json({ message: 'A valid notification ID is required.' });
    return;
  }

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: req.authUserId },
    select: { id: true, readAt: true },
  });
  if (!notification) {
    res.status(404).json({ message: 'That notification could not be found.' });
    return;
  }
  const readAt = notification.readAt ?? new Date();
  if (!notification.readAt) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt },
    });
  }
  res.json({ id: notification.id, readAt: readAt.toISOString() });
});
