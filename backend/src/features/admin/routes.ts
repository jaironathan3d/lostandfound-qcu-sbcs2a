import { Router } from 'express';
import { ClaimStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthRequest } from '../../middlewares/requireAuth';
import { requireRole } from '../../middlewares/requireRole';
import { logAudit } from '../../utils/records';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.SUPERADMIN));

adminRouter.get('/stats', async (_req, res) => {
  const [itemsByStatus, usersByRole, pendingClaims] = await Promise.all([
    prisma.item.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.claim.count({ where: { status: ClaimStatus.PENDING } }),
  ]);
  res.json({ itemsByStatus, usersByRole, pendingClaims });
});

adminRouter.get('/audit-logs', async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    skip: (page - 1) * 50,
  });
  res.json(logs);
});

adminRouter.patch('/users/:id/role', async (req: AuthRequest, res) => {
  const { role } = req.body;
  if (typeof role !== 'string' || !(role in UserRole)) {
    res.status(400).json({ error: 'A valid role is required' });
    return;
  }
  if (req.params.id === req.userId) {
    res.status(400).json({ error: 'You cannot change your own role' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
  const isHigh = (r: UserRole) => r === UserRole.ADMIN || r === UserRole.SUPERADMIN;

  // only a SUPERADMIN may grant or remove admin-level roles
  if ((isHigh(role as UserRole) || isHigh(target.role)) && me?.role !== UserRole.SUPERADMIN) {
    res.status(403).json({ error: 'Only a SUPERADMIN can change admin-level roles' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { role: role as UserRole },
    select: { id: true, email: true, fullName: true, role: true },
  });

  await logAudit(req.userId!, `ROLE_CHANGED_TO_${role}`, 'User', target.id);
  res.json(updated);
});

adminRouter.post('/categories', async (req: AuthRequest, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) {
    res.status(409).json({ error: 'Category already exists' });
    return;
  }

  const category = await prisma.category.create({ data: { name } });
  await logAudit(req.userId!, 'CATEGORY_CREATED', 'Category', category.id);
  res.status(201).json(category);
});