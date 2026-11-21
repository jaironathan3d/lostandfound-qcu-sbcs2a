import { Router } from 'express';
import { ItemReviewStatus, ItemStatus, LostItemStatus, ReportType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';

export const itemsRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

const imageDataUrlPattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

itemsRouter.get('/', async (_req, res) => {
  const items = await prisma.item.findMany({
    where: {
      status: ItemStatus.REPORTED,
      reviewStatus: ItemReviewStatus.APPROVED,
      OR: [
        { reportType: ReportType.FOUND },
        { reportType: ReportType.LOST, lostItemStatus: { in: [LostItemStatus.OPEN, LostItemStatus.MATCH_PENDING] } },
      ],
    },
    include: {
      category: { select: { name: true } },
      images: { select: { imageUrl: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category?.name ?? 'Other',
    type: item.reportType === ReportType.FOUND ? 'Found' : 'Lost',
    location: item.building,
    lostItemStatus: item.reportType === ReportType.LOST ? item.lostItemStatus : undefined,
    occurredAt: item.occurredAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    imageUrl: item.images[0]?.imageUrl,
  })));
});

itemsRouter.get('/mine', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const items = await prisma.item.findMany({
    where: { reporterId: req.authUserId },
    include: {
      category: { select: { name: true } },
      images: { select: { imageUrl: true }, take: 1 },
      matchedFoundItem: { select: { title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.reportType === ReportType.FOUND ? 'Found' : 'Lost',
    category: item.category?.name ?? 'Other',
    description: item.description,
    privateDetails: item.hiddenDetail,
    location: item.building,
    occurredAt: item.occurredAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    status: item.status,
    reviewStatus: item.reviewStatus,
    lostItemStatus: item.lostItemStatus,
    matchedFoundItemTitle: item.matchedFoundItem?.title,
    resolutionLocation: item.resolutionLocation,
    imageUrl: item.images[0]?.imageUrl,
  })));
});

itemsRouter.post('/:itemId/matches', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const itemId = req.params.itemId;
  if (typeof itemId !== 'string' || !isRecord(req.body) || !isText(req.body.note, 8, 1000)) {
    res.status(400).json({ message: 'Describe where and when you found the item.' });
    return;
  }
  const foundItemId = typeof req.body.foundItemId === 'string' && req.body.foundItemId.trim()
    ? req.body.foundItemId.trim()
    : undefined;
  if (req.body.foundItemId !== undefined && req.body.foundItemId !== null && req.body.foundItemId !== '' && !foundItemId) {
    res.status(400).json({ message: 'Choose a valid found-item report or leave it blank.' });
    return;
  }

  const result = await prisma.$transaction(async (transaction) => {
    const lostItem = await transaction.item.findUnique({
      where: { id: itemId },
      select: { id: true, reportType: true, status: true, reviewStatus: true, lostItemStatus: true },
    });
    if (!lostItem || lostItem.reportType !== ReportType.LOST) return { kind: 'not-found' as const };
    if (
      lostItem.status !== ItemStatus.REPORTED
      || lostItem.reviewStatus !== ItemReviewStatus.APPROVED
      || lostItem.lostItemStatus !== LostItemStatus.OPEN
    ) return { kind: 'unavailable' as const };

    if (foundItemId) {
      const foundItem = await transaction.item.findUnique({
        where: { id: foundItemId },
        select: { reportType: true, status: true, reviewStatus: true },
      });
      if (
        !foundItem
        || foundItem.reportType !== ReportType.FOUND
        || foundItem.status !== ItemStatus.REPORTED
        || foundItem.reviewStatus !== ItemReviewStatus.APPROVED
      ) return { kind: 'invalid-found-item' as const };
    }

    const reserved = await transaction.item.updateMany({
      where: {
        id: itemId,
        reportType: ReportType.LOST,
        status: ItemStatus.REPORTED,
        reviewStatus: ItemReviewStatus.APPROVED,
        lostItemStatus: LostItemStatus.OPEN,
      },
      data: { lostItemStatus: LostItemStatus.MATCH_PENDING },
    });
    if (reserved.count !== 1) return { kind: 'unavailable' as const };

    const suggestion = await transaction.itemMatchSuggestion.create({
      data: {
        lostItemId: itemId,
        foundItemId,
        proposedById: req.authUserId!,
        note: req.body.note.trim(),
      },
      select: { id: true, status: true, createdAt: true },
    });
    return { kind: 'created' as const, suggestion };
  });

  if (result.kind === 'not-found') {
    res.status(404).json({ message: 'That lost-item report could not be found.' });
    return;
  }
  if (result.kind === 'invalid-found-item') {
    res.status(400).json({ message: 'The linked found-item report is not approved or is no longer available.' });
    return;
  }
  if (result.kind === 'unavailable') {
    res.status(409).json({ message: 'That lost-item report already has a match under review or has been resolved.' });
    return;
  }
  res.status(201).json({
    id: result.suggestion.id,
    status: result.suggestion.status,
    submittedAt: result.suggestion.createdAt.toISOString(),
  });
});

itemsRouter.delete('/:itemId', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const itemId = req.params.itemId;
  if (typeof itemId !== 'string') {
    res.status(400).json({ message: 'A valid item ID is required.' });
    return;
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { reporterId: true, reviewStatus: true },
  });
  if (!item || item.reporterId !== req.authUserId) {
    res.status(404).json({ message: 'That report could not be found.' });
    return;
  }
  if (item.reviewStatus !== ItemReviewStatus.PENDING) {
    res.status(409).json({ message: 'Only reports awaiting review can be deleted.' });
    return;
  }

  const deletion = await prisma.item.deleteMany({
    where: {
      id: itemId,
      reporterId: req.authUserId,
      reviewStatus: ItemReviewStatus.PENDING,
    },
  });
  if (deletion.count !== 1) {
    res.status(409).json({ message: 'This report is no longer awaiting review and could not be deleted.' });
    return;
  }
  res.status(204).end();
});

itemsRouter.post('/', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Please complete the item report.' });
    return;
  }

  const { type, title, category, location, occurredAt, description, privateDetails, contactEmail, custodyLocation, imageDataUrl } = req.body;
  const date = typeof occurredAt === 'string' ? new Date(`${occurredAt}T12:00:00.000Z`) : null;
  const validDate = date !== null
    && !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === occurredAt;
  const validContact = contactEmail === undefined
    || contactEmail === ''
    || (typeof contactEmail === 'string' && contactEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail));
  const validCustody = type !== 'Found' || isText(custodyLocation, 1, 120);

  if (
    (type !== 'Lost' && type !== 'Found')
    || !isText(title, 1, 100)
    || !isText(category, 1, 60)
    || !isText(location, 1, 120)
    || !validDate
    || !isText(description, 8, 600)
    || (privateDetails !== undefined && !isText(privateDetails, 0, 1000))
    || (type === 'Found' && !isText(privateDetails, 5, 1000))
    || !validContact
    || !validCustody
    || (imageDataUrl !== undefined && (
      typeof imageDataUrl !== 'string'
      || imageDataUrl.length > 1_400_000
      || !imageDataUrlPattern.test(imageDataUrl)
    ))
  ) {
    res.status(400).json({ message: 'Please check the item details and try again.' });
    return;
  }
  if (!date) {
    res.status(400).json({ message: 'Please provide a valid date for the report.' });
    return;
  }

  const reportType = type === 'Found' ? ReportType.FOUND : ReportType.LOST;
  const item = await prisma.item.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      hiddenDetail: typeof privateDetails === 'string' ? privateDetails.trim() : '',
      building: location.trim(),
      reportType,
      occurredAt: date,
      contactEmail: typeof contactEmail === 'string' && contactEmail.trim() ? contactEmail.trim() : null,
      custodyLocation: type === 'Found' && typeof custodyLocation === 'string' ? custodyLocation.trim() : null,
      reporter: { connect: { id: req.authUserId } },
      category: {
        connectOrCreate: {
          where: { name: category.trim() },
          create: { name: category.trim() },
        },
      },
      images: imageDataUrl ? { create: { imageUrl: imageDataUrl } } : undefined,
    },
    include: {
      category: { select: { name: true } },
      images: { select: { imageUrl: true }, take: 1 },
    },
  });

  res.status(201).json({
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category?.name ?? 'Other',
    type: item.reportType === ReportType.FOUND ? 'Found' : 'Lost',
    location: item.building,
    occurredAt: item.occurredAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    reviewStatus: item.reviewStatus,
    imageUrl: item.images[0]?.imageUrl,
  });
});
