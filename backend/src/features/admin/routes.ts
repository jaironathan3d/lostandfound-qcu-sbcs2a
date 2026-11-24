import { Router } from 'express';
import {
  ClaimStatus,
  ConversationReportStatus,
  ItemReviewStatus,
  ItemStatus,
  LostItemStatus,
  MatchSuggestionStatus,
  Prisma,
  ReportType,
  UserRole,
  prisma,
} from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';
import { requireRoles } from '../../middlewares/requireRoles';
import { getItemMediaAccessPath } from '../../lib/itemMedia';
import { getClaimDocumentAccessPath, removeStoredClaimDocuments } from '../../lib/claimDocuments';
import { createNotification } from '../../lib/createNotification';
import { createVaultReferenceCode } from '../../lib/vaultReferenceCode';

export const adminRouter = Router();

const requireAdmin = [requireAuth, requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

class ClaimReviewConflict extends Error {}
class ItemMatchConflict extends Error {}

adminRouter.get('/categories', ...requireAdmin, async (_req, res) => {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(categories.map((category) => ({
    id: category.id,
    name: category.name,
    itemCount: category._count.items,
  })));
});

adminRouter.post('/categories', ...requireAdmin, async (req, res) => {
  if (!isRecord(req.body) || typeof req.body.name !== 'string' || req.body.name.trim().length < 1 || req.body.name.trim().length > 60) {
    res.status(400).json({ message: 'Enter a category name between 1 and 60 characters.' });
    return;
  }
  try {
    const category = await prisma.category.create({ data: { name: req.body.name.trim() } });
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'A category with that name already exists.' });
      return;
    }
    throw error;
  }
});

adminRouter.patch('/categories/:categoryId', ...requireAdmin, async (req, res) => {
  if (!isRecord(req.body) || typeof req.body.name !== 'string' || req.body.name.trim().length < 1 || req.body.name.trim().length > 60) {
    res.status(400).json({ message: 'Enter a category name between 1 and 60 characters.' });
    return;
  }
  const categoryId = typeof req.params.categoryId === 'string' ? req.params.categoryId : '';
  try {
    const category = await prisma.category.update({
      where: { id: categoryId },
      data: { name: req.body.name.trim() },
    });
    res.json(category);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'A category with that name already exists.' });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ message: 'Category not found.' });
      return;
    }
    throw error;
  }
});

adminRouter.delete('/categories/:categoryId', ...requireAdmin, async (req, res) => {
  const categoryId = typeof req.params.categoryId === 'string' ? req.params.categoryId : '';
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { items: true } } },
  });
  if (!category) {
    res.status(404).json({ message: 'Category not found.' });
    return;
  }
  if (category._count.items > 0) {
    res.status(409).json({ message: 'Categories used by item reports cannot be deleted.' });
    return;
  }
  await prisma.category.delete({ where: { id: categoryId } });
  res.status(204).end();
});

adminRouter.get('/conversation-reports', ...requireAdmin, async (req, res) => {
  const statusFilter = req.query.status;
  if (
    statusFilter !== undefined
    && (typeof statusFilter !== 'string' || !Object.values(ConversationReportStatus).includes(statusFilter as ConversationReportStatus))
  ) {
    res.status(400).json({ message: 'Choose a valid conversation report status.' });
    return;
  }

  const where = statusFilter ? { status: statusFilter as ConversationReportStatus } : {};
  const [reports, groupedCounts] = await Promise.all([
    prisma.conversationReport.findMany({
      where,
      include: {
        reporter: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { fullName: true } },
        conversation: {
          include: {
            item: { select: { id: true, title: true } },
            poster: { select: { id: true, fullName: true } },
            participant: { select: { id: true, fullName: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 100,
              include: { sender: { select: { id: true, fullName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.conversationReport.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const counts = { PENDING: 0, REVIEWED: 0, DISMISSED: 0 };
  for (const entry of groupedCounts) counts[entry.status] = entry._count._all;

  res.json({
    counts,
    reports: reports.map((report) => ({
      id: report.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      reviewedByName: report.reviewedBy?.fullName ?? null,
      reporter: report.reporter,
      conversation: {
        id: report.conversation.id,
        item: report.conversation.item,
        participants: [report.conversation.poster, report.conversation.participant],
        messages: report.conversation.messages.slice().reverse().map((message) => ({
          id: message.id,
          sender: message.sender,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        })),
      },
    })),
  });
});

adminRouter.patch('/conversation-reports/:reportId', ...requireAdmin, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || (req.body.decision !== 'reviewed' && req.body.decision !== 'dismiss')) {
    res.status(400).json({ message: 'Choose whether to mark this report reviewed or dismiss it.' });
    return;
  }
  const reportId = req.params.reportId;
  if (typeof reportId !== 'string') {
    res.status(400).json({ message: 'A valid conversation report ID is required.' });
    return;
  }

  const status = req.body.decision === 'reviewed'
    ? ConversationReportStatus.REVIEWED
    : ConversationReportStatus.DISMISSED;
  const result = await prisma.$transaction(async (transaction) => {
    const report = await transaction.conversationReport.findUnique({
      where: { id: reportId },
      select: { id: true, reporterId: true, conversationId: true, status: true },
    });
    if (!report) return 'not-found' as const;
    if (report.status !== ConversationReportStatus.PENDING) return 'conflict' as const;

    const changed = await transaction.conversationReport.updateMany({
      where: { id: report.id, status: ConversationReportStatus.PENDING },
      data: { status, reviewedById: req.authUserId!, reviewedAt: new Date() },
    });
    if (changed.count !== 1) return 'conflict' as const;
    await transaction.auditLog.create({
      data: {
        userId: req.authUserId!,
        action: status === ConversationReportStatus.REVIEWED
          ? 'CONVERSATION_REPORT_REVIEWED'
          : 'CONVERSATION_REPORT_DISMISSED',
        entity: 'ConversationReport',
        entityId: report.id,
      },
    });
    await createNotification(
      transaction,
      report.reporterId,
      status === ConversationReportStatus.REVIEWED
        ? 'Your conversation report has been reviewed.'
        : 'Your conversation report was dismissed after review.',
      `/messages?conversation=${report.conversationId}`,
    );
    return 'updated' as const;
  });

  if (result === 'not-found') {
    res.status(404).json({ message: 'That conversation report could not be found.' });
    return;
  }
  if (result === 'conflict') {
    res.status(409).json({ message: 'That conversation report is no longer pending review.' });
    return;
  }
  res.json({ id: reportId, status });
});

adminRouter.get('/items', ...requireAdmin, async (req, res) => {
  const statusFilter = req.query.status;
  if (
    statusFilter !== undefined
    && (typeof statusFilter !== 'string' || !Object.values(ItemReviewStatus).includes(statusFilter as ItemReviewStatus))
  ) {
    res.status(400).json({ message: 'Choose a valid report status.' });
    return;
  }

  const where = statusFilter ? { reviewStatus: statusFilter as ItemReviewStatus } : {};
  const [items, counts] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        category: { select: { name: true } },
        reporter: { select: { id: true, fullName: true, email: true } },
        images: { select: { id: true, imageUrl: true }, take: 1 },
        matchedFoundItem: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.item.groupBy({ by: ['reviewStatus'], _count: { _all: true } }),
  ]);
  const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const count of counts) statusCounts[count.reviewStatus] = count._count._all;

  res.json({
    counts: statusCounts,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.reportType === 'FOUND' ? 'Found' : 'Lost',
      status: item.status,
      reviewStatus: item.reviewStatus,
      lostItemStatus: item.lostItemStatus,
      matchedFoundItemTitle: item.matchedFoundItem?.title,
      resolutionLocation: item.resolutionLocation,
      category: item.category?.name ?? 'Other',
      description: item.description,
      privateDetails: item.hiddenDetail,
      location: item.building,
      occurredAt: item.occurredAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      contactEmail: item.contactEmail,
      custodyLocation: item.custodyLocation,
      reporter: item.reporter,
      imageUrl: item.images[0]
        ? getItemMediaAccessPath(item.id, item.images[0], item.reviewStatus, req.authUserId)
        : undefined,
    })),
  });
});

adminRouter.patch('/items/:itemId', ...requireAdmin, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || (req.body.decision !== 'approve' && req.body.decision !== 'reject')) {
    res.status(400).json({ message: 'Choose whether to approve or reject this report.' });
    return;
  }
  const itemId = req.params.itemId;
  if (typeof itemId !== 'string') {
    res.status(400).json({ message: 'A valid report ID is required.' });
    return;
  }

  const approved = req.body.decision === 'approve';
  const reviewStatus = approved ? ItemReviewStatus.APPROVED : ItemReviewStatus.REJECTED;
  const result = await prisma.$transaction(async (transaction) => {
    const item = await transaction.item.findUnique({
      where: { id: itemId },
      select: { title: true, reporterId: true },
    });
    if (!item) return 'unavailable' as const;
    const changed = await transaction.item.updateMany({
      where: { id: itemId, reviewStatus: ItemReviewStatus.PENDING },
      data: { reviewStatus },
    });
    if (changed.count !== 1) return 'unavailable' as const;
    await transaction.auditLog.create({
      data: {
        userId: req.authUserId!,
        action: approved ? 'ITEM_REPORT_APPROVED' : 'ITEM_REPORT_REJECTED',
        entity: 'Item',
        entityId: itemId,
      },
    });
    await createNotification(
      transaction,
      item.reporterId,
      `Your item report "${item.title}" was ${approved ? 'approved' : 'rejected'}.`,
      '/my-reports',
    );
    return 'updated' as const;
  });

  if (result === 'unavailable') {
    res.status(404).json({ message: 'That report could not be found or is no longer awaiting review.' });
    return;
  }
  res.json({ id: itemId, reviewStatus });
});

adminRouter.patch('/items/:itemId/resolution', ...requireAdmin, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (
    !isRecord(req.body)
    || (req.body.action !== 'mark-found' && req.body.action !== 'mark-returned')
  ) {
    res.status(400).json({ message: 'Choose a valid lost-item resolution.' });
    return;
  }
  const itemId = req.params.itemId;
  if (typeof itemId !== 'string') {
    res.status(400).json({ message: 'A valid report ID is required.' });
    return;
  }

  const markingFound = req.body.action === 'mark-found';
  if (!markingFound) {
    res.status(409).json({ message: 'Record physical returns from the vault dashboard so the handover is audited.' });
    return;
  }
  const resolutionLocation = req.body.resolutionLocation;
  const foundItemId = typeof req.body.foundItemId === 'string' && req.body.foundItemId.trim()
    ? req.body.foundItemId.trim()
    : undefined;
  if (
    (markingFound && (typeof resolutionLocation !== 'string' || resolutionLocation.trim().length < 2 || resolutionLocation.trim().length > 120))
    || (req.body.foundItemId !== undefined && req.body.foundItemId !== null && req.body.foundItemId !== '' && !foundItemId)
  ) {
    res.status(400).json({ message: 'Provide a collection location and a valid optional found-item report.' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const lostItem = await transaction.item.findFirst({
        where: {
          id: itemId,
          reportType: ReportType.LOST,
          reviewStatus: ItemReviewStatus.APPROVED,
          status: ItemStatus.REPORTED,
          lostItemStatus: LostItemStatus.OPEN,
        },
        select: { id: true, title: true, reporterId: true, matchedFoundItemId: true },
      });
      if (!lostItem) return { kind: 'unavailable' as const };

      let foundItem: {
        id: string;
        status: ItemStatus;
        vaultEntry: { id: string; referenceCode: string } | null;
      } | null = null;
      if (markingFound && foundItemId) {
        foundItem = await transaction.item.findFirst({
          where: {
            id: foundItemId,
            reportType: ReportType.FOUND,
            reviewStatus: ItemReviewStatus.APPROVED,
            status: { in: [ItemStatus.REPORTED, ItemStatus.IN_VAULT] },
            matchedLostReport: { is: null },
          },
          select: {
            id: true,
            status: true,
            vaultEntry: { select: { id: true, referenceCode: true } },
          },
        });
        if (!foundItem) return { kind: 'invalid-found-item' as const };
      }

      const nextStatus = LostItemStatus.FOUND;
      const location = (resolutionLocation as string).trim();
      const update = await transaction.item.updateMany({
        where: {
          id: lostItem.id,
          reviewStatus: ItemReviewStatus.APPROVED,
          status: ItemStatus.REPORTED,
          lostItemStatus: LostItemStatus.OPEN,
        },
        data: {
          ...(!foundItem ? { status: ItemStatus.IN_VAULT, custodyLocation: location } : {}),
          lostItemStatus: nextStatus,
          resolutionLocation: location,
          matchedFoundItemId: foundItem?.id,
        },
      });
      if (update.count !== 1) return { kind: 'unavailable' as const };

      if (foundItem) {
        const foundUpdate = await transaction.item.updateMany({
          where: {
            id: foundItem.id,
            reportType: ReportType.FOUND,
            reviewStatus: ItemReviewStatus.APPROVED,
            status: foundItem.status,
          },
          data: { status: ItemStatus.VERIFIED, custodyLocation: location },
        });
        if (foundUpdate.count !== 1) throw new ItemMatchConflict();

        await transaction.claim.create({
          data: {
            itemId: foundItem.id,
            claimerId: lostItem.reporterId,
            hiddenDetailAnswer: 'Administrator-confirmed match to the reporter’s lost-item post.',
            lastSeen: location!,
            status: ClaimStatus.VERIFIED,
          },
        });
        if (!foundItem.vaultEntry) {
          await transaction.vaultEntry.create({
            data: {
              itemId: foundItem.id,
              guardId: req.authUserId!,
              referenceCode: createVaultReferenceCode(),
            },
          });
        }
      } else {
        await transaction.vaultEntry.create({
          data: {
            itemId: lostItem.id,
            guardId: req.authUserId!,
            referenceCode: createVaultReferenceCode(),
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          userId: req.authUserId!,
          action: 'LOST_ITEM_MARKED_FOUND',
          entity: 'Item',
          entityId: lostItem.id,
        },
      });
      if (markingFound) {
        const vaultEntry = await transaction.vaultEntry.findUniqueOrThrow({
          where: { itemId: foundItem?.id ?? lostItem.id },
          select: { referenceCode: true },
        });
        await transaction.notification.create({
          data: {
            userId: lostItem.reporterId,
            message: `Your lost-item report “${lostItem.title}” was marked found at ${location}. Your handover code is ${vaultEntry.referenceCode}.`,
            href: '/my-claims',
          },
        });
      }
      return { kind: 'updated' as const, status: nextStatus, location };
    });

    if (result.kind === 'unavailable') {
      res.status(409).json({ message: 'This lost report is not in a state that can be changed.' });
      return;
    }
    if (result.kind === 'invalid-found-item') {
      res.status(400).json({ message: 'The linked found-item report is unavailable or already matched.' });
      return;
    }
    res.json({ id: itemId, status: result.status, resolutionLocation: result.location });
  } catch (error) {
    if (error instanceof ItemMatchConflict || error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'The found item was matched to another lost report before this update completed.' });
      return;
    }
    throw error;
  }
});

adminRouter.get('/matches', ...requireAdmin, async (req, res) => {
  const statusFilter = req.query.status;
  if (
    statusFilter !== undefined
    && (typeof statusFilter !== 'string' || !Object.values(MatchSuggestionStatus).includes(statusFilter as MatchSuggestionStatus))
  ) {
    res.status(400).json({ message: 'Choose a valid match status.' });
    return;
  }
  const where = statusFilter ? { status: statusFilter as MatchSuggestionStatus } : {};
  const [suggestions, counts] = await Promise.all([
    prisma.itemMatchSuggestion.findMany({
      where,
      include: {
        proposedBy: { select: { fullName: true, email: true } },
        lostItem: {
          include: {
            category: { select: { name: true } },
            reporter: { select: { fullName: true, email: true } },
            images: { select: { id: true, imageUrl: true }, take: 1 },
          },
        },
        foundItem: {
          include: {
            category: { select: { name: true } },
            reporter: { select: { fullName: true, email: true } },
            images: { select: { id: true, imageUrl: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.itemMatchSuggestion.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const count of counts) statusCounts[count.status] = count._count._all;
  res.json({
    counts: statusCounts,
    matches: suggestions.map((suggestion) => ({
      id: suggestion.id,
      status: suggestion.status,
      note: suggestion.note,
      submittedAt: suggestion.createdAt.toISOString(),
      suggestedBy: suggestion.proposedBy,
      resolutionLocation: suggestion.resolutionLocation,
      lostItem: {
        id: suggestion.lostItem.id,
        title: suggestion.lostItem.title,
        description: suggestion.lostItem.description,
        privateDetails: suggestion.lostItem.hiddenDetail,
        category: suggestion.lostItem.category?.name ?? 'Other',
        location: suggestion.lostItem.building,
        reporter: suggestion.lostItem.reporter,
        imageUrl: suggestion.lostItem.images[0]
          ? getItemMediaAccessPath(
            suggestion.lostItem.id,
            suggestion.lostItem.images[0],
            suggestion.lostItem.reviewStatus,
            req.authUserId,
          )
          : undefined,
      },
      foundItem: suggestion.foundItem
        ? {
          id: suggestion.foundItem.id,
          title: suggestion.foundItem.title,
          description: suggestion.foundItem.description,
          privateDetails: suggestion.foundItem.hiddenDetail,
          category: suggestion.foundItem.category?.name ?? 'Other',
          location: suggestion.foundItem.building,
          custodyLocation: suggestion.foundItem.custodyLocation,
          reporter: suggestion.foundItem.reporter,
          imageUrl: suggestion.foundItem.images[0]
            ? getItemMediaAccessPath(
              suggestion.foundItem.id,
              suggestion.foundItem.images[0],
              suggestion.foundItem.reviewStatus,
              req.authUserId,
            )
            : undefined,
        }
        : null,
    })),
  });
});

adminRouter.patch('/matches/:matchId', ...requireAdmin, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || (req.body.decision !== 'approve' && req.body.decision !== 'reject')) {
    res.status(400).json({ message: 'Choose whether to approve or reject this match.' });
    return;
  }
  const matchId = req.params.matchId;
  if (typeof matchId !== 'string') {
    res.status(400).json({ message: 'A valid match ID is required.' });
    return;
  }

  const approve = req.body.decision === 'approve';
  const submittedLocation = req.body.resolutionLocation;
  if (submittedLocation !== undefined && (typeof submittedLocation !== 'string' || submittedLocation.trim().length > 120)) {
    res.status(400).json({ message: 'Enter a valid collection location.' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const suggestion = await transaction.itemMatchSuggestion.findUnique({
        where: { id: matchId },
        include: {
          lostItem: { select: { id: true, title: true, reporterId: true, lostItemStatus: true } },
          foundItem: {
            select: {
              id: true,
              title: true,
              building: true,
              custodyLocation: true,
              status: true,
              reviewStatus: true,
              reportType: true,
              vaultEntry: { select: { referenceCode: true } },
            },
          },
        },
      });
      if (!suggestion) return { kind: 'not-found' as const };
      if (suggestion.status !== MatchSuggestionStatus.PENDING || suggestion.lostItem.lostItemStatus !== LostItemStatus.MATCH_PENDING) {
        return { kind: 'unavailable' as const };
      }

      const location = typeof submittedLocation === 'string' && submittedLocation.trim()
        ? submittedLocation.trim()
        : suggestion.foundItem?.custodyLocation || suggestion.foundItem?.building || '';
      if (approve && !location) return { kind: 'location-required' as const };

      const resolution = await transaction.item.updateMany({
        where: {
          id: suggestion.lostItem.id,
          reviewStatus: ItemReviewStatus.APPROVED,
          status: ItemStatus.REPORTED,
          lostItemStatus: LostItemStatus.MATCH_PENDING,
        },
        data: {
          lostItemStatus: approve ? LostItemStatus.FOUND : LostItemStatus.OPEN,
          resolutionLocation: approve ? location : null,
          matchedFoundItemId: approve ? suggestion.foundItem?.id : null,
        },
      });
      if (resolution.count !== 1) return { kind: 'unavailable' as const };

      if (approve && suggestion.foundItem) {
        if (
          suggestion.foundItem.reportType !== ReportType.FOUND
          || suggestion.foundItem.reviewStatus !== ItemReviewStatus.APPROVED
          || (suggestion.foundItem.status !== ItemStatus.REPORTED && suggestion.foundItem.status !== ItemStatus.IN_VAULT)
        ) throw new ItemMatchConflict();

        const foundUpdate = await transaction.item.updateMany({
          where: {
            id: suggestion.foundItem.id,
            reportType: ReportType.FOUND,
            reviewStatus: ItemReviewStatus.APPROVED,
            status: suggestion.foundItem.status,
          },
          data: { status: ItemStatus.VERIFIED },
        });
        if (foundUpdate.count !== 1) throw new ItemMatchConflict();

        await transaction.claim.create({
          data: {
            itemId: suggestion.foundItem.id,
            claimerId: suggestion.lostItem.reporterId,
            hiddenDetailAnswer: suggestion.note,
            lastSeen: location,
            status: ClaimStatus.VERIFIED,
          },
        });
      }

      const suggestionUpdate = await transaction.itemMatchSuggestion.updateMany({
        where: { id: suggestion.id, status: MatchSuggestionStatus.PENDING },
        data: {
          status: approve ? MatchSuggestionStatus.APPROVED : MatchSuggestionStatus.REJECTED,
          reviewedById: req.authUserId!,
          reviewedAt: new Date(),
          resolutionLocation: approve ? location : null,
        },
      });
      if (suggestionUpdate.count !== 1) throw new ItemMatchConflict();

      await transaction.auditLog.create({
        data: {
          userId: req.authUserId!,
          action: approve ? 'ITEM_MATCH_APPROVED' : 'ITEM_MATCH_REJECTED',
          entity: 'ItemMatchSuggestion',
          entityId: suggestion.id,
        },
      });
      if (approve) {
        const code = suggestion.foundItem?.vaultEntry?.referenceCode;
        await transaction.notification.create({
          data: {
            userId: suggestion.lostItem.reporterId,
            message: code
              ? `Your lost item “${suggestion.lostItem.title}” was confirmed found at ${location}. Your handover code is ${code}.`
              : `Your lost item “${suggestion.lostItem.title}” was confirmed found. Collection location: ${location}`,
            href: '/my-claims',
          },
        });
      }
      return { kind: 'updated' as const, status: approve ? MatchSuggestionStatus.APPROVED : MatchSuggestionStatus.REJECTED, location };
    });

    if (result.kind === 'not-found') {
      res.status(404).json({ message: 'That match suggestion could not be found.' });
      return;
    }
    if (result.kind === 'unavailable') {
      res.status(409).json({ message: 'That match suggestion is no longer pending review.' });
      return;
    }
    if (result.kind === 'location-required') {
      res.status(400).json({ message: 'Add the location where the item can be collected before approving this match.' });
      return;
    }
    res.json({ id: matchId, status: result.status, resolutionLocation: result.location });
  } catch (error) {
    if (error instanceof ItemMatchConflict || error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'The found item was matched to another lost report before this decision completed.' });
      return;
    }
    throw error;
  }
});

adminRouter.get('/claims', ...requireAdmin, async (req, res) => {
  const statusFilter = req.query.status;
  if (
    statusFilter !== undefined
    && (typeof statusFilter !== 'string' || !Object.values(ClaimStatus).includes(statusFilter as ClaimStatus))
  ) {
    res.status(400).json({ message: 'Choose a valid claim status.' });
    return;
  }

  const where = statusFilter ? { status: statusFilter as ClaimStatus } : {};
  const [claims, counts] = await Promise.all([
    prisma.claim.findMany({
      where,
      include: {
        claimer: { select: { fullName: true, email: true } },
        item: {
          include: {
            category: { select: { name: true } },
            reporter: { select: { fullName: true, email: true } },
            images: { select: { id: true, imageUrl: true }, take: 1 },
          },
        },
        proofImages: { select: { imageUrl: true } },
        documents: { select: { id: true, documentType: true, fileName: true, storageKey: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.claim.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  const statusCounts = { PENDING: 0, VERIFIED: 0, REJECTED: 0 };
  for (const count of counts) statusCounts[count.status] = count._count._all;

  res.json({
    counts: statusCounts,
    claims: claims.map((claim) => ({
      id: claim.id,
      status: claim.status,
      submittedAt: claim.createdAt.toISOString(),
      ownershipDetails: claim.hiddenDetailAnswer,
      lastSeen: claim.lastSeen,
      proofImages: claim.proofImages.map((image) => image.imageUrl),
      documents: claim.status === ClaimStatus.PENDING
        ? claim.documents.map((document) => ({
          id: document.id,
          documentType: document.documentType,
          fileName: document.fileName,
          url: getClaimDocumentAccessPath(claim.id, document, req.authUserId!),
        }))
        : [],
      claimant: claim.claimer,
      item: {
        id: claim.item.id,
        title: claim.item.title,
        type: claim.item.reportType === 'FOUND' ? 'Found' : 'Lost',
        status: claim.item.status,
        category: claim.item.category?.name ?? 'Other',
        description: claim.item.description,
        privateDetails: claim.item.hiddenDetail,
        location: claim.item.building,
        contactEmail: claim.item.contactEmail,
        custodyLocation: claim.item.custodyLocation,
        reporter: claim.item.reporter,
        imageUrl: claim.item.images[0]
          ? getItemMediaAccessPath(
            claim.item.id,
            claim.item.images[0],
            claim.item.reviewStatus,
            req.authUserId,
          )
          : undefined,
      },
    })),
  });
});

adminRouter.patch('/claims/:claimId', ...requireAdmin, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || (req.body.decision !== 'approve' && req.body.decision !== 'reject')) {
    res.status(400).json({ message: 'Choose whether to approve or reject this claim.' });
    return;
  }

  const approved = req.body.decision === 'approve';
  const nextStatus = approved ? ClaimStatus.VERIFIED : ClaimStatus.REJECTED;
  const claimId = req.params.claimId;
  if (typeof claimId !== 'string') {
    res.status(400).json({ message: 'A valid claim ID is required.' });
    return;
  }
  let outcome: 'not-found' | 'conflict' | 'updated';
  try {
    outcome = await prisma.$transaction(async (transaction) => {
      const claim = await transaction.claim.findUnique({
        where: { id: claimId },
        select: {
          id: true,
          itemId: true,
          status: true,
          claimerId: true,
          item: {
            select: {
              title: true,
              custodyLocation: true,
              vaultEntry: { select: { referenceCode: true, releasedAt: true } },
            },
          },
        },
      });
      if (!claim) return 'not-found';
      if (claim.status !== ClaimStatus.PENDING) return 'conflict';

      const itemUpdate = await transaction.item.updateMany({
        where: { id: claim.itemId, status: ItemStatus.CLAIM_PENDING },
        data: {
          status: approved
            ? ItemStatus.VERIFIED
            : claim.item.vaultEntry && !claim.item.vaultEntry.releasedAt
              ? ItemStatus.IN_VAULT
              : ItemStatus.REPORTED,
        },
      });
      if (itemUpdate.count !== 1) throw new ClaimReviewConflict();

      const claimUpdate = await transaction.claim.updateMany({
        where: { id: claim.id, status: ClaimStatus.PENDING },
        data: { status: nextStatus },
      });
      if (claimUpdate.count !== 1) throw new ClaimReviewConflict();

      await transaction.auditLog.create({
        data: {
          userId: req.authUserId!,
          action: approved ? 'CLAIM_APPROVED' : 'CLAIM_REJECTED',
          entity: 'Claim',
          entityId: claim.id,
        },
      });
      await createNotification(
        transaction,
        claim.claimerId,
        approved && claim.item.vaultEntry && !claim.item.vaultEntry.releasedAt
          ? `Your claim for "${claim.item.title}" was approved. Collect it at ${claim.item.custodyLocation || 'the campus vault'} using handover code ${claim.item.vaultEntry.referenceCode}.`
          : `Your claim for "${claim.item.title}" was ${approved ? 'approved' : 'rejected'}.`,
        '/my-claims',
      );
      return 'updated';
    });
  } catch (error) {
    if (error instanceof ClaimReviewConflict || error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      outcome = 'conflict';
    } else {
      throw error;
    }
  }

  if (outcome === 'not-found') {
    res.status(404).json({ message: 'That claim could not be found.' });
    return;
  }
  if (outcome === 'conflict') {
    res.status(409).json({ message: 'This claim has already been reviewed or its item is no longer pending.' });
    return;
  }
  const supportingDocuments = await prisma.claimDocument.findMany({
    where: { claimId },
    select: { id: true, storageKey: true },
  });
  await removeStoredClaimDocuments(supportingDocuments);
  await prisma.claimDocument.deleteMany({ where: { claimId } });
  res.json({ id: claimId, status: nextStatus });
});
