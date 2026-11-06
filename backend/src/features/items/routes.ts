import { Router } from 'express';
import { ItemStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthRequest } from '../../middlewares/requireAuth';
import { userIsAdmin } from '../../middlewares/requireRole';
import { logAudit } from '../../utils/records';

export const itemsRouter = Router();


const publicSelect = {
  id: true,
  title: true,
  description: true,
  building: true,
  status: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
  images: { select: { id: true, imageUrl: true } },
} as const;

itemsRouter.get('/categories', async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: 'asc' } }));
});

itemsRouter.get('/', async (req, res) => {
  const { status, building, categoryId, q } = req.query;
  const page = Math.max(Number(req.query.page) || 1, 1);

  const items = await prisma.item.findMany({
    where: {
      ...(typeof status === 'string' && status in ItemStatus && { status: status as ItemStatus }),
      ...(typeof building === 'string' && { building }),
      ...(typeof categoryId === 'string' && { categoryId }),
      ...(typeof q === 'string' && { title: { contains: q, mode: 'insensitive' as const } }),
    },
    select: publicSelect,
    orderBy: { createdAt: 'desc' },
    take: 20,
    skip: (page - 1) * 20,
  });

  res.json(items);
});

itemsRouter.get('/mine', requireAuth, async (req: AuthRequest, res) => {
  const items = await prisma.item.findMany({
    where: { reporterId: req.userId! },
    select: { ...publicSelect, hiddenDetail: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
});

itemsRouter.get('/:id', async (req, res) => {
  const item = await prisma.item.findUnique({
    where: { id: String(req.params.id) },
    select: publicSelect,
  });

  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json(item);
});

itemsRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { title, description, hiddenDetail, building, categoryId } = req.body;
  const imageUrls: string[] = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [];

  if (!title || !description || !hiddenDetail || !building) {
    res.status(400).json({ error: 'title, description, hiddenDetail and building are required' });
    return;
  }

  const item = await prisma.item.create({
    data: {
      title,
      description,
      hiddenDetail,
      building,
      categoryId: categoryId || null,
      reporterId: req.userId!,
      images: { create: imageUrls.map((imageUrl) => ({ imageUrl })) },
      thread: { create: {} }, // every item gets its discussion thread
    },
    select: publicSelect,
  });

  await logAudit(req.userId!, 'ITEM_REPORTED', 'Item', item.id);
  res.status(201).json(item);
});

itemsRouter.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  const item = await prisma.item.findUnique({ where: { id: String(req.params.id) } });
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const isOwner = item.reporterId === req.userId && item.status === ItemStatus.REPORTED;
  if (!isOwner && !(await userIsAdmin(req.userId!))) {
    res.status(403).json({ error: 'You cannot edit this item' });
    return;
  }

  const { title, description, building, categoryId } = req.body;
  const updated = await prisma.item.update({
    where: { id: item.id },
    data: { title, description, building, categoryId },
    select: publicSelect,
  });
  res.json(updated);
});