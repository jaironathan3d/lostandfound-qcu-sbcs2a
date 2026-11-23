import { Router } from 'express';
import { ItemMediaType, ItemReviewStatus, ItemStatus, LostItemStatus, Prisma, ReportType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';

export const itemsRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

const imageDataUrlPattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const videoDataUrlPattern = /^data:video\/(?:mp4|webm);base64,[A-Za-z0-9+/]+={0,2}$/;

const getValidatedMedia = (body: Record<string, unknown>): Array<{ dataUrl: string; mediaType: ItemMediaType; fileName: string | null }> | null => {
  const media = body.media;
  if (media === undefined) {
    if (typeof body.imageDataUrl === 'string' && body.imageDataUrl) {
      if (body.imageDataUrl.length > 1_400_000 || !imageDataUrlPattern.test(body.imageDataUrl)) return null;
      return [{ dataUrl: body.imageDataUrl, mediaType: ItemMediaType.IMAGE, fileName: null }];
    }
    return [];
  }
  if (!Array.isArray(media) || media.length > 4) return null;
  const validated: Array<{ dataUrl: string; mediaType: ItemMediaType; fileName: string | null }> = [];
  for (const entry of media) {
    if (!isRecord(entry) || typeof entry.dataUrl !== 'string' || typeof entry.type !== 'string') return null;
    if (entry.type === 'IMAGE') {
      if (entry.dataUrl.length > 1_400_000 || !imageDataUrlPattern.test(entry.dataUrl)) return null;
    } else if (entry.type === 'VIDEO') {
      if (entry.dataUrl.length > 7_000_000 || !videoDataUrlPattern.test(entry.dataUrl)) return null;
    } else {
      return null;
    }
    validated.push({
      dataUrl: entry.dataUrl,
      mediaType: entry.type === 'VIDEO' ? ItemMediaType.VIDEO : ItemMediaType.IMAGE,
      fileName: typeof entry.fileName === 'string' && entry.fileName.length <= 180 ? entry.fileName : null,
    });
  }
  return validated;
};

itemsRouter.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(categories.map((category) => category.name));
});

itemsRouter.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const type = typeof req.query.type === 'string' ? req.query.type : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
  const sort = req.query.sort === 'oldest' ? 'oldest' : 'newest';
  const page = Math.max(1, Number.parseInt(typeof req.query.page === 'string' ? req.query.page : '1', 10) || 1);
  const pageSize = Math.min(24, Math.max(1, Number.parseInt(typeof req.query.pageSize === 'string' ? req.query.pageSize : '12', 10) || 12));

  if (type && type !== 'Lost' && type !== 'Found') {
    res.status(400).json({ message: 'Choose a valid item type.' });
    return;
  }

  const validDateFrom = !dateFrom || /^\d{4}-\d{2}-\d{2}$/.test(dateFrom);
  const validDateTo = !dateTo || /^\d{4}-\d{2}-\d{2}$/.test(dateTo);
  if (!validDateFrom || !validDateTo) {
    res.status(400).json({ message: 'Choose valid date filters.' });
    return;
  }

  const where: Prisma.ItemWhereInput = {
    status: ItemStatus.REPORTED,
    reviewStatus: ItemReviewStatus.APPROVED,
    OR: [
      { reportType: ReportType.FOUND },
      { reportType: ReportType.LOST, lostItemStatus: { in: [LostItemStatus.OPEN, LostItemStatus.MATCH_PENDING] } },
    ],
  };
  if (type) where.reportType = type === 'Found' ? ReportType.FOUND : ReportType.LOST;
  if (category && category !== 'All categories') where.category = { name: category };
  if (location) where.building = { contains: location, mode: 'insensitive' };
  if (q) {
    where.AND = [{
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { building: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ],
    }];
  }
  if (dateFrom || dateTo) {
    where.occurredAt = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        category: { select: { name: true } },
        images: { select: { imageUrl: true, mediaType: true, fileName: true } },
      },
      orderBy: { occurredAt: sort === 'oldest' ? 'asc' : 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  res.json({
    items: items.map((item) => ({
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
    mediaType: item.images[0]?.mediaType === ItemMediaType.VIDEO ? 'VIDEO' : 'IMAGE',
    media: item.images.map((entry) => ({
      url: entry.imageUrl,
      type: entry.mediaType === ItemMediaType.VIDEO ? 'VIDEO' : 'IMAGE',
      fileName: entry.fileName,
    })),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
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
      images: { select: { imageUrl: true, mediaType: true, fileName: true } },
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
    contactEmail: item.contactEmail,
    custodyLocation: item.custodyLocation,
    mediaType: item.images[0]?.mediaType === ItemMediaType.VIDEO ? 'VIDEO' : 'IMAGE',
    media: item.images.map((entry) => ({
      url: entry.imageUrl,
      type: entry.mediaType === ItemMediaType.VIDEO ? 'VIDEO' : 'IMAGE',
      fileName: entry.fileName,
    })),
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

itemsRouter.patch('/:itemId', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || typeof req.params.itemId !== 'string') {
    res.status(400).json({ message: 'Please complete the item report.' });
    return;
  }

  const itemId = req.params.itemId;
  const existing = await prisma.item.findUnique({
    where: { id: itemId },
    select: { reporterId: true, reviewStatus: true },
  });
  if (!existing || existing.reporterId !== req.authUserId) {
    res.status(404).json({ message: 'That report could not be found.' });
    return;
  }
  if (existing.reviewStatus !== ItemReviewStatus.PENDING) {
    res.status(409).json({ message: 'Only reports awaiting review can be edited.' });
    return;
  }

  const { type, title, category, location, occurredAt, description, privateDetails, contactEmail, custodyLocation } = req.body;
  const date = typeof occurredAt === 'string' ? new Date(`${occurredAt}T12:00:00.000Z`) : null;
  const validDate = date !== null && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === occurredAt;
  const validContact = contactEmail === undefined || contactEmail === '' || (typeof contactEmail === 'string' && contactEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail));
  const validCustody = type !== 'Found' || isText(custodyLocation, 1, 120);
  const media = getValidatedMedia(req.body);

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
    || media === null
  ) {
    res.status(400).json({ message: 'Please check the item details or attached media and try again.' });
    return;
  }
  if (!date) {
    res.status(400).json({ message: 'Please provide a valid date for the report.' });
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.item.update({
      where: { id: itemId },
      data: {
        title: title.trim(),
        description: description.trim(),
        hiddenDetail: typeof privateDetails === 'string' ? privateDetails.trim() : '',
        building: location.trim(),
        reportType: type === 'Found' ? ReportType.FOUND : ReportType.LOST,
        occurredAt: date,
        contactEmail: typeof contactEmail === 'string' && contactEmail.trim() ? contactEmail.trim() : null,
        custodyLocation: type === 'Found' && typeof custodyLocation === 'string' ? custodyLocation.trim() : null,
        category: {
          connectOrCreate: {
            where: { name: category.trim() },
            create: { name: category.trim() },
          },
        },
      },
    });
    if (req.body.media !== undefined) {
      await transaction.itemImage.deleteMany({ where: { itemId } });
      if (media.length > 0) {
        await transaction.itemImage.createMany({
          data: media.map((entry) => ({
            itemId,
            imageUrl: entry.dataUrl,
            mediaType: entry.mediaType,
            fileName: entry.fileName,
          })),
        });
      }
    }
  });
  res.json({ id: itemId, message: 'Report updated.' });
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

  const { type, title, category, location, occurredAt, description, privateDetails, contactEmail, custodyLocation } = req.body;
  const media = getValidatedMedia(req.body);
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
    || media === null
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
      images: media && media.length > 0 ? {
        create: media.map((entry) => ({
          imageUrl: entry.dataUrl,
          mediaType: entry.mediaType,
          fileName: entry.fileName,
        })),
      } : undefined,
    },
    include: {
      category: { select: { name: true } },
      images: { select: { imageUrl: true, mediaType: true, fileName: true } },
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
