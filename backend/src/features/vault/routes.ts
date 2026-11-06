import { Router } from 'express';
import { randomBytes } from 'crypto';
import { ClaimStatus, ItemStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthRequest } from '../../middlewares/requireAuth';
import { requireRole } from '../../middlewares/requireRole';
import { logAudit, notify } from '../../utils/records';

export const vaultRouter = Router();

vaultRouter.use(
  requireAuth,
  requireRole(UserRole.SECURITY_GUARD, UserRole.ADMIN, UserRole.SUPERADMIN),
);

vaultRouter.get('/', async (req, res) => {
  const released = req.query.released === 'true';
  const entries = await prisma.vaultEntry.findMany({
    where: { releasedAt: released ? { not: null } : null },
    include: { item: { select: { id: true, title: true, building: true, status: true } } },
    orderBy: { receivedAt: 'desc' },
  });
  res.json(entries);
});

vaultRouter.post('/', async (req: AuthRequest, res) => {
  const { itemId } = req.body;
  const item = itemId ? await prisma.item.findUnique({ where: { id: itemId } }) : null;

  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  if (item.status !== ItemStatus.REPORTED) {
    res.status(409).json({ error: 'This item was already received' });
    return;
  }

  const referenceCode = `LF-${randomBytes(3).toString('hex').toUpperCase()}`;

  const [entry] = await prisma.$transaction([
    prisma.vaultEntry.create({ data: { itemId, guardId: req.userId!, referenceCode } }),
    prisma.item.update({ where: { id: itemId }, data: { status: ItemStatus.IN_VAULT } }),
  ]);

  await notify(item.reporterId, `Your reported item is now safe in the vault (ref ${referenceCode}).`);
  await logAudit(req.userId!, 'VAULT_RECEIVED', 'VaultEntry', entry.id);
  res.status(201).json(entry);
});

vaultRouter.post('/:id/handover', async (req: AuthRequest, res) => {
  const entry = await prisma.vaultEntry.findUnique({
    where: { id: String(req.params.id) },
    include: { item: true },
  });

  if (!entry) {
    res.status(404).json({ error: 'Vault entry not found' });
    return;
  }
  if (entry.releasedAt) {
    res.status(409).json({ error: 'Already released' });
    return;
  }
  if (entry.item.status !== ItemStatus.VERIFIED) {
    res.status(409).json({ error: 'This item has no verified claim' });
    return;
  }
  if (req.body.referenceCode !== entry.referenceCode) {
    res.status(400).json({ error: 'Reference code does not match' });
    return;
  }

  const claim = await prisma.claim.findFirst({
    where: { itemId: entry.itemId, status: ClaimStatus.VERIFIED },
  });
  if (!claim) {
    res.status(409).json({ error: 'No verified claim found' });
    return;
  }

  const [handover] = await prisma.$transaction([
    prisma.handover.create({
      data: {
        vaultEntryId: entry.id,
        guardId: req.userId!,
        releasedToId: claim.claimerId,
        referenceCode: entry.referenceCode,
      },
    }),
    prisma.vaultEntry.update({ where: { id: entry.id }, data: { releasedAt: new Date() } }),
    prisma.item.update({ where: { id: entry.itemId }, data: { status: ItemStatus.RETURNED } }),
  ]);

  await notify(entry.item.reporterId, 'The item you reported was returned to its owner. Thank you!');
  await logAudit(req.userId!, 'ITEM_HANDED_OVER', 'Handover', handover.id);
  res.status(201).json(handover);
});