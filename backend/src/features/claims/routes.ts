import { Router } from 'express';
import { ClaimStatus, ItemStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { requireAuth, AuthRequest } from '../../middlewares/requireAuth';
import { requireRole } from '../../middlewares/requireRole';
import { logAudit, notify } from '../../utils/records';

export const claimsRouter = Router();

const REVIEWERS = [UserRole.SECURITY_GUARD, UserRole.ADMIN, UserRole.SUPERADMIN];

claimsRouter.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { itemId, hiddenDetailAnswer } = req.body;
  const proofUrls: string[] = Array.isArray(req.body.proofImageUrls) ? req.body.proofImageUrls : [];

  if (!itemId || !hiddenDetailAnswer) {
    res.status(400).json({ error: 'itemId and hiddenDetailAnswer are required' });
    return;
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  if (item.reporterId === req.userId) {
    res.status(400).json({ error: 'You cannot claim an item you reported' });
    return;
  }
  if (item.status !== ItemStatus.IN_VAULT && item.status !== ItemStatus.CLAIM_PENDING) {
    res.status(409).json({ error: 'This item is not open for claims' });
    return;
  }

  const already = await prisma.claim.findFirst({
    where: { itemId, claimerId: req.userId!, status: ClaimStatus.PENDING },
  });
  if (already) {
    res.status(409).json({ error: 'You already have a pending claim on this item' });
    return;
  }

  const [claim] = await prisma.$transaction([
    prisma.claim.create({
      data: {
        itemId,
        claimerId: req.userId!,
        hiddenDetailAnswer,
        proofImages: { create: proofUrls.map((imageUrl) => ({ imageUrl })) },
      },
      select: { id: true, status: true, createdAt: true },
    }),
    prisma.item.update({ where: { id: itemId }, data: { status: ItemStatus.CLAIM_PENDING } }),
  ]);

  await notify(item.reporterId, 'Someone submitted a claim on the item you reported.');
  await logAudit(req.userId!, 'CLAIM_SUBMITTED', 'Claim', claim.id);
  res.status(201).json(claim);
});

claimsRouter.get('/mine', requireAuth, async (req: AuthRequest, res) => {
  const claims = await prisma.claim.findMany({
    where: { claimerId: req.userId! },
    select: {
      id: true,
      status: true,
      createdAt: true,
      item: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(claims);
});

claimsRouter.get('/', requireAuth, requireRole(...REVIEWERS), async (req, res) => {
  const status = req.query.status;
  const claims = await prisma.claim.findMany({
    where: typeof status === 'string' && status in ClaimStatus ? { status: status as ClaimStatus } : {},
    include: {
      item: true, // reviewers are allowed to see the secret detail
      claimer: { select: { id: true, fullName: true, email: true } },
      proofImages: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(claims);
});

claimsRouter.patch('/:id/review', requireAuth, requireRole(...REVIEWERS), async (req: AuthRequest, res) => {
  const { status } = req.body;
  if (status !== ClaimStatus.VERIFIED && status !== ClaimStatus.REJECTED) {
    res.status(400).json({ error: 'status must be VERIFIED or REJECTED' });
    return;
  }

  const claim = await prisma.claim.findUnique({ where: { id: String(req.params.id) } });
  if (!claim) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  if (claim.status !== ClaimStatus.PENDING) {
    res.status(409).json({ error: 'This claim was already reviewed' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.claim.update({ where: { id: claim.id }, data: { status } });

    if (status === ClaimStatus.VERIFIED) {
      // one winner: the other pending claims on this item are rejected
      await tx.claim.updateMany({
        where: { itemId: claim.itemId, id: { not: claim.id }, status: ClaimStatus.PENDING },
        data: { status: ClaimStatus.REJECTED },
      });
      await tx.item.update({ where: { id: claim.itemId }, data: { status: ItemStatus.VERIFIED } });
    } else {
      const stillPending = await tx.claim.count({
        where: { itemId: claim.itemId, status: ClaimStatus.PENDING },
      });
      if (stillPending === 0) {
        await tx.item.update({ where: { id: claim.itemId }, data: { status: ItemStatus.IN_VAULT } });
      }
    }
  });

  if (status === ClaimStatus.VERIFIED) {
    const vault = await prisma.vaultEntry.findUnique({ where: { itemId: claim.itemId } });
    await notify(
      claim.claimerId,
      `Your claim was verified. Show reference code ${vault?.referenceCode ?? ''} at the vault to collect your item.`,
    );
  } else {
    await notify(claim.claimerId, 'Your claim was not verified.');
  }

  await logAudit(req.userId!, `CLAIM_${status}`, 'Claim', claim.id);
  res.json({ id: claim.id, status });
});