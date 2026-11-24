import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ClaimStatus, ItemReviewStatus, ItemStatus, LostItemStatus, Prisma, ReportType, UserRole, prisma } from '../../lib/prisma';
import { createNotification } from '../../lib/createNotification';
import { createVaultReferenceCode } from '../../lib/vaultReferenceCode';
import { requireAuth } from '../../middlewares/requireAuth';
import { requireRoles } from '../../middlewares/requireRoles';

export const vaultRouter = Router();

const requireVaultAdmin = [requireAuth, requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

class VaultHandoverConflict extends Error {}

const referenceCodesMatch = (submitted: string, expected: string): boolean => {
  const submittedBuffer = Buffer.from(submitted.trim().toUpperCase());
  const expectedBuffer = Buffer.from(expected);
  return submittedBuffer.length === expectedBuffer.length && timingSafeEqual(submittedBuffer, expectedBuffer);
};

const eligibleRecipients = (item: {
  id: string;
  title: string;
  reportType: ReportType;
  lostItemStatus: LostItemStatus;
  reporter: { id: string; fullName: string; email: string };
  matchedLostReport: {
    id: string;
    lostItemStatus: LostItemStatus;
    reporter: { id: string; fullName: string; email: string };
  } | null;
  claims: Array<{
    claimer: { id: string; fullName: string; email: string };
  }>;
}) => {
  const recipients = new Map<string, { id: string; fullName: string; email: string; reason: string }>();
  for (const claim of item.claims) {
    recipients.set(claim.claimer.id, {
      ...claim.claimer,
      reason: 'Verified ownership claim',
    });
  }
  if (item.reportType === ReportType.LOST && item.lostItemStatus === LostItemStatus.FOUND) {
    recipients.set(item.reporter.id, {
      ...item.reporter,
      reason: 'Owner of the confirmed lost-item report',
    });
  }
  if (item.reportType === ReportType.FOUND && item.matchedLostReport?.lostItemStatus === LostItemStatus.FOUND) {
    recipients.set(item.matchedLostReport.reporter.id, {
      ...item.matchedLostReport.reporter,
      reason: 'Owner of the matched lost-item report',
    });
  }
  return [...recipients.values()];
};

type HandoverOutcome =
  | { kind: 'not-found' }
  | { kind: 'already-released' }
  | { kind: 'invalid-code' }
  | { kind: 'recipient-not-eligible' }
  | { kind: 'unavailable' }
  | {
    kind: 'released';
    handoverId: string;
    releasedAt: Date;
    recipient: { id: string; fullName: string };
  };

vaultRouter.get('/', ...requireVaultAdmin, async (req, res) => {
  const statusFilter = req.query.status ?? 'ACTIVE';
  if (typeof statusFilter !== 'string' || !['ACTIVE', 'RELEASED', 'ALL'].includes(statusFilter)) {
    res.status(400).json({ message: 'Choose ACTIVE, RELEASED, or ALL vault entries.' });
    return;
  }

  const where = statusFilter === 'ACTIVE'
    ? { releasedAt: null }
    : statusFilter === 'RELEASED'
      ? { releasedAt: { not: null } }
      : {};
  const [entries, activeCount, releasedCount] = await Promise.all([
    prisma.vaultEntry.findMany({
      where,
      include: {
        item: {
          include: {
            reporter: { select: { id: true, fullName: true, email: true } },
            matchedLostReport: {
              select: {
                id: true,
                lostItemStatus: true,
                reporter: { select: { id: true, fullName: true, email: true } },
              },
            },
            claims: {
              where: { status: ClaimStatus.VERIFIED },
              include: { claimer: { select: { id: true, fullName: true, email: true } } },
            },
          },
        },
        guard: { select: { fullName: true } },
        handovers: {
          include: {
            guard: { select: { fullName: true } },
            releasedTo: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { releasedAt: 'desc' },
        },
      },
      orderBy: [{ releasedAt: 'asc' }, { receivedAt: 'desc' }],
    }),
    prisma.vaultEntry.count({ where: { releasedAt: null } }),
    prisma.vaultEntry.count({ where: { releasedAt: { not: null } } }),
  ]);
  res.json({
    counts: { ACTIVE: activeCount, RELEASED: releasedCount },
    entries: entries.map((entry) => ({
      id: entry.id,
      itemId: entry.item.id,
      itemTitle: entry.item.title,
      reportType: entry.item.reportType,
      itemStatus: entry.item.status,
      lostItemStatus: entry.item.lostItemStatus,
      storageLocation: entry.item.custodyLocation,
      receivedAt: entry.receivedAt.toISOString(),
      releasedAt: entry.releasedAt?.toISOString() ?? null,
      receivedByName: entry.guard.fullName,
      reporter: entry.item.reporter,
      eligibleRecipients: eligibleRecipients(entry.item),
      handovers: entry.handovers.map((handover) => ({
        id: handover.id,
        releasedAt: handover.releasedAt.toISOString(),
        guardName: handover.guard.fullName,
        recipient: handover.releasedTo,
      })),
    })),
  });
});

vaultRouter.post('/', ...requireVaultAdmin, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || !isText(req.body.itemId, 1, 100) || !isText(req.body.storageLocation, 2, 120)) {
    res.status(400).json({ message: 'Choose an approved item and enter its secure storage location.' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.item.findUnique({
        where: { id: req.body.itemId.trim() },
        include: {
          vaultEntry: { select: { id: true } },
          reporter: { select: { id: true, fullName: true, email: true } },
          matchedLostReport: {
            select: {
              lostItemStatus: true,
              reporter: { select: { id: true, fullName: true, email: true } },
            },
          },
          claims: {
            where: { status: ClaimStatus.VERIFIED },
            select: { claimerId: true, claimer: { select: { id: true, fullName: true, email: true } } },
          },
        },
      });
      if (!item || item.reviewStatus !== ItemReviewStatus.APPROVED) return { kind: 'not-found' as const };
      if (item.vaultEntry) return { kind: 'already-stored' as const };

      const isEligibleFoundItem = item.reportType === ReportType.FOUND
        && (item.status === ItemStatus.REPORTED
          || item.status === ItemStatus.IN_VAULT
          || item.status === ItemStatus.CLAIM_PENDING
          || item.status === ItemStatus.VERIFIED);
      const isConfirmedLostItem = item.reportType === ReportType.LOST
        && item.lostItemStatus === LostItemStatus.FOUND
        && (item.status === ItemStatus.REPORTED || item.status === ItemStatus.IN_VAULT);
      if (!isEligibleFoundItem && !isConfirmedLostItem) return { kind: 'unavailable' as const };

      const nextStatus = item.status === ItemStatus.REPORTED ? ItemStatus.IN_VAULT : item.status;
      const changed = await transaction.item.updateMany({
        where: {
          id: item.id,
          reviewStatus: ItemReviewStatus.APPROVED,
          status: item.status,
        },
        data: { status: nextStatus, custodyLocation: req.body.storageLocation.trim() },
      });
      if (changed.count !== 1) return { kind: 'unavailable' as const };

      const entry = await transaction.vaultEntry.create({
        data: {
          itemId: item.id,
          guardId: req.authUserId!,
          referenceCode: createVaultReferenceCode(),
        },
        select: { id: true, receivedAt: true, referenceCode: true },
      });
      await transaction.auditLog.create({
        data: {
          userId: req.authUserId!,
          action: 'VAULT_ITEM_RECEIVED',
          entity: 'VaultEntry',
          entityId: entry.id,
        },
      });

      const notifiedUsers = new Set<string>();
      const notifyRecipient = async (userId: string) => {
        if (notifiedUsers.has(userId)) return;
        notifiedUsers.add(userId);
        await createNotification(
          transaction,
          userId,
          `"${item.title}" is in secure campus storage at ${req.body.storageLocation.trim()}. Your handover code is ${entry.referenceCode}.`,
          '/my-claims',
        );
      };
      for (const claim of item.claims) {
        await notifyRecipient(claim.claimerId);
      }
      if (item.reportType === ReportType.LOST && item.lostItemStatus === LostItemStatus.FOUND) {
        await notifyRecipient(item.reporterId);
      }
      if (item.reportType === ReportType.FOUND && item.matchedLostReport?.lostItemStatus === LostItemStatus.FOUND) {
        await notifyRecipient(item.matchedLostReport.reporter.id);
      }
      return { kind: 'created' as const, entry };
    });
    if (result.kind === 'not-found') {
      res.status(404).json({ message: 'That approved item report could not be found.' });
      return;
    }
    if (result.kind === 'already-stored') {
      res.status(409).json({ message: 'That item already has a vault record.' });
      return;
    }
    if (result.kind === 'unavailable') {
      res.status(409).json({ message: 'That report is not ready to be received into the vault.' });
      return;
    }
    res.status(201).json({
      id: result.entry.id,
      receivedAt: result.entry.receivedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'That item already has a vault record.' });
      return;
    }
    throw error;
  }
});

vaultRouter.post('/:vaultEntryId/handovers', ...requireVaultAdmin, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const vaultEntryId = req.params.vaultEntryId;
  if (
    typeof vaultEntryId !== 'string'
    || !isRecord(req.body)
    || !isText(req.body.recipientId, 1, 100)
    || !isText(req.body.referenceCode, 1, 50)
  ) {
    res.status(400).json({ message: 'Choose an eligible recipient and enter their handover code.' });
    return;
  }

  let outcome: HandoverOutcome;
  try {
    outcome = await prisma.$transaction(async (transaction) => {
    const entry = await transaction.vaultEntry.findUnique({
      where: { id: vaultEntryId },
      include: {
        item: {
          include: {
            reporter: { select: { id: true, fullName: true, email: true } },
            matchedLostReport: {
              include: { reporter: { select: { id: true, fullName: true, email: true } } },
            },
            claims: {
              where: { status: ClaimStatus.VERIFIED },
              select: { claimerId: true, claimer: { select: { id: true, fullName: true, email: true } } },
            },
          },
        },
      },
    });
    if (!entry) return { kind: 'not-found' as const };
    if (entry.releasedAt) return { kind: 'already-released' as const };
    if (!referenceCodesMatch(req.body.referenceCode, entry.referenceCode)) return { kind: 'invalid-code' as const };
    if (entry.item.reviewStatus !== ItemReviewStatus.APPROVED) return { kind: 'unavailable' as const };

    const recipients = eligibleRecipients(entry.item);
    const recipient = recipients.find((candidate) => candidate.id === req.body.recipientId);
    if (!recipient) return { kind: 'recipient-not-eligible' as const };
    if (entry.item.status !== ItemStatus.IN_VAULT && entry.item.status !== ItemStatus.VERIFIED) return { kind: 'unavailable' as const };

    const releasedAt = new Date();
    const entryUpdate = await transaction.vaultEntry.updateMany({
      where: { id: entry.id, releasedAt: null },
      data: { releasedAt },
    });
    if (entryUpdate.count !== 1) throw new VaultHandoverConflict();

    const itemUpdate = await transaction.item.updateMany({
      where: { id: entry.item.id, status: entry.item.status },
      data: { status: ItemStatus.RETURNED },
    });
    if (itemUpdate.count !== 1) throw new VaultHandoverConflict();

    const handover = await transaction.handover.create({
      data: {
        vaultEntryId: entry.id,
        guardId: req.authUserId!,
        releasedToId: recipient.id,
        referenceCode: entry.referenceCode,
        releasedAt,
      },
      select: { id: true },
    });
    await transaction.auditLog.create({
      data: {
        userId: req.authUserId!,
        action: 'VAULT_ITEM_HANDED_OVER',
        entity: 'Handover',
        entityId: handover.id,
      },
    });

    const lostReport = entry.item.reportType === ReportType.LOST
      ? entry.item
      : entry.item.matchedLostReport;
    if (lostReport?.lostItemStatus === LostItemStatus.FOUND) {
      const lostUpdate = await transaction.item.updateMany({
        where: { id: lostReport.id, lostItemStatus: LostItemStatus.FOUND },
        data: { lostItemStatus: LostItemStatus.RETURNED, status: ItemStatus.RETURNED },
      });
      if (lostUpdate.count !== 1) throw new VaultHandoverConflict();
    }

    await createNotification(
      transaction,
      recipient.id,
      `"${entry.item.title}" was handed over to you.`,
      '/my-claims',
    );
    if (lostReport && lostReport.reporterId !== recipient.id) {
      await createNotification(
        transaction,
        lostReport.reporterId,
        `The item matched to your lost report "${lostReport.title}" was handed over.`,
        '/my-claims',
      );
    }
    return {
      kind: 'released' as const,
      handoverId: handover.id,
      releasedAt,
      recipient: { id: recipient.id, fullName: recipient.fullName },
    };
    });
  } catch (error) {
    if (error instanceof VaultHandoverConflict) {
      res.status(409).json({ message: 'This item changed while the handover was being recorded. Refresh and try again.' });
      return;
    }
    throw error;
  }

  if (outcome.kind === 'not-found') {
    res.status(404).json({ message: 'That vault record could not be found.' });
    return;
  }
  if (outcome.kind === 'already-released') {
    res.status(409).json({ message: 'That vault item has already been handed over.' });
    return;
  }
  if (outcome.kind === 'invalid-code') {
    res.status(400).json({ message: 'The handover code does not match this vault record.' });
    return;
  }
  if (outcome.kind === 'recipient-not-eligible') {
    res.status(409).json({ message: 'That person does not have an approved ownership record for this item.' });
    return;
  }
  if (outcome.kind === 'unavailable') {
    res.status(409).json({ message: 'This item is not in a state that can be handed over.' });
    return;
  }
  res.json({
    id: outcome.handoverId,
    releasedAt: outcome.releasedAt.toISOString(),
    recipient: outcome.recipient,
  });
});
