import { Router } from 'express';
import { ItemReviewStatus, ItemStatus, LostItemStatus, ReportType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';

export const claimsRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

const imageDataUrlPattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

claimsRouter.get('/mine', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }

  const [claims, foundReports] = await Promise.all([
    prisma.claim.findMany({
      where: { claimerId: req.authUserId },
      include: { item: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.item.findMany({
      where: {
        reporterId: req.authUserId,
        reportType: ReportType.LOST,
        reviewStatus: ItemReviewStatus.APPROVED,
        lostItemStatus: { in: [LostItemStatus.FOUND, LostItemStatus.RETURNED] },
      },
      include: { matchedFoundItem: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
  res.json({
    claims: claims.map((claim) => ({
      id: claim.id,
      itemId: claim.item.id,
      itemTitle: claim.item.title,
      status: claim.status,
      submittedAt: claim.createdAt.toISOString(),
    })),
    foundLostItems: foundReports.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.lostItemStatus,
      foundItemTitle: item.matchedFoundItem?.title ?? null,
      resolutionLocation: item.resolutionLocation,
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
});

claimsRouter.post('/', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Please provide the item and ownership details.' });
    return;
  }

  const { itemId, hiddenDetailAnswer, lastSeen, proofImageDataUrl } = req.body;
  if (
    !isText(itemId, 1, 100)
    || !isText(hiddenDetailAnswer, 8, 1000)
    || !isText(lastSeen, 3, 500)
    || (proofImageDataUrl !== undefined && (
      typeof proofImageDataUrl !== 'string'
      || proofImageDataUrl.length > 1_400_000
      || !imageDataUrlPattern.test(proofImageDataUrl)
    ))
  ) {
    res.status(400).json({ message: 'Please check the claim details and try again.' });
    return;
  }

  const result = await prisma.$transaction(async (transaction) => {
    const item = await transaction.item.findUnique({ where: { id: itemId.trim() } });
    if (!item) return { kind: 'not-found' as const };
    if (item.reporterId === req.authUserId) return { kind: 'self-claim' as const };
    if (
      item.reportType !== ReportType.FOUND
      || item.status !== ItemStatus.REPORTED
      || item.reviewStatus !== ItemReviewStatus.APPROVED
    ) {
      return { kind: 'unavailable' as const };
    }

    const reserved = await transaction.item.updateMany({
      where: {
        id: item.id,
        reportType: ReportType.FOUND,
        status: ItemStatus.REPORTED,
        reviewStatus: ItemReviewStatus.APPROVED,
        reporterId: { not: req.authUserId },
      },
      data: { status: ItemStatus.CLAIM_PENDING },
    });
    if (reserved.count !== 1) return { kind: 'unavailable' as const };

    const claim = await transaction.claim.create({
      data: {
        itemId: item.id,
        claimerId: req.authUserId!,
        hiddenDetailAnswer: hiddenDetailAnswer.trim(),
        lastSeen: lastSeen.trim(),
        proofImages: proofImageDataUrl
          ? { create: { imageUrl: proofImageDataUrl } }
          : undefined,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return { kind: 'created' as const, claim };
  });

  if (result.kind === 'not-found') {
    res.status(404).json({ message: 'That item could not be found.' });
    return;
  }
  if (result.kind === 'self-claim') {
    res.status(400).json({ message: 'You cannot submit a claim for an item you reported.' });
    return;
  }
  if (result.kind === 'unavailable') {
    res.status(409).json({ message: 'This item is no longer available for a claim.' });
    return;
  }
  res.status(201).json({
    id: result.claim.id,
    status: result.claim.status,
    submittedAt: result.claim.createdAt.toISOString(),
  });
});
