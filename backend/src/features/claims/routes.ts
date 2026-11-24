import { Router } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { ClaimStatus, ItemReviewStatus, ItemStatus, LostItemStatus, ReportType, UserRole, prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import {
  getClaimDocumentAccessPath,
  getClaimDocumentFiles,
  openClaimDocumentFile,
  receiveClaimDocuments,
  removeStoredClaimDocuments,
  validateAndStoreClaimDocuments,
} from '../../lib/claimDocuments';
import { streamFileHandle } from '../../lib/streamFile';
import { requireAuth } from '../../middlewares/requireAuth';

export const claimsRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

type ClaimSubmissionResult =
  | { kind: 'not-found' }
  | { kind: 'self-claim' }
  | { kind: 'unavailable' }
  | { kind: 'created'; claim: { id: string; status: ClaimStatus; createdAt: Date } };

const imageDataUrlPattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

claimsRouter.get('/mine', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }

  const [claims, foundReports] = await Promise.all([
    prisma.claim.findMany({
      where: { claimerId: req.authUserId },
      include: {
        item: {
          select: {
            id: true,
            title: true,
            custodyLocation: true,
            vaultEntry: { select: { referenceCode: true, releasedAt: true } },
          },
        },
        documents: { select: { id: true, documentType: true, fileName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.item.findMany({
      where: {
        reporterId: req.authUserId,
        reportType: ReportType.LOST,
        reviewStatus: ItemReviewStatus.APPROVED,
        lostItemStatus: { in: [LostItemStatus.FOUND, LostItemStatus.RETURNED] },
      },
      include: {
        vaultEntry: { select: { referenceCode: true, releasedAt: true } },
        matchedFoundItem: {
          select: {
            title: true,
            custodyLocation: true,
            vaultEntry: { select: { referenceCode: true, releasedAt: true } },
          },
        },
      },
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
      handover: claim.status === ClaimStatus.VERIFIED
        && claim.item.vaultEntry
        && !claim.item.vaultEntry.releasedAt
        ? {
          code: claim.item.vaultEntry.referenceCode,
          storageLocation: claim.item.custodyLocation,
        }
        : null,
      handoverCompleted: claim.status === ClaimStatus.VERIFIED
        && Boolean(claim.item.vaultEntry?.releasedAt),
      documents: claim.status === ClaimStatus.PENDING
        ? claim.documents.map((document) => ({
          id: document.id,
          documentType: document.documentType,
          fileName: document.fileName,
          url: getClaimDocumentAccessPath(claim.id, document, req.authUserId!),
        }))
        : [],
    })),
    foundLostItems: foundReports.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.lostItemStatus,
      foundItemTitle: item.matchedFoundItem?.title ?? null,
      resolutionLocation: item.resolutionLocation,
      handover: item.lostItemStatus === LostItemStatus.FOUND
        ? item.vaultEntry && !item.vaultEntry.releasedAt
          ? {
            code: item.vaultEntry.referenceCode,
            storageLocation: item.custodyLocation,
          }
          : item.matchedFoundItem?.vaultEntry && !item.matchedFoundItem.vaultEntry.releasedAt
            ? {
              code: item.matchedFoundItem.vaultEntry.referenceCode,
              storageLocation: item.matchedFoundItem.custodyLocation,
            }
            : null
        : null,
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
});

claimsRouter.get('/:claimId/documents/:documentId', async (req, res, next) => {
  const { claimId, documentId } = req.params;
  if (typeof claimId !== 'string' || typeof documentId !== 'string') {
    res.status(404).end();
    return;
  }
  const document = await prisma.claimDocument.findFirst({
    where: { id: documentId, claimId },
    include: { claim: { select: { claimerId: true, status: true } } },
  });
  if (!document || document.claim.status !== ClaimStatus.PENDING) {
    res.status(404).end();
    return;
  }

  const access = typeof req.query.access === 'string' ? req.query.access : '';
  let payload: JwtPayload;
  try {
    const verified = jwt.verify(access, env.JWT_SECRET);
    if (
      typeof verified === 'string'
      || verified.purpose !== 'claim-document'
      || verified.claimId !== claimId
      || verified.documentId !== documentId
      || typeof verified.sub !== 'string'
    ) {
      res.status(404).end();
      return;
    }
    payload = verified;
  } catch {
    res.status(404).end();
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true },
  });
  if (
    !user
    || (user.id !== document.claim.claimerId && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN)
  ) {
    res.status(404).end();
    return;
  }

  const file = await openClaimDocumentFile(document.storageKey);
  if (!file) {
    res.status(404).end();
    return;
  }
  const safeName = `claim-${document.documentType.toLowerCase()}${document.fileName.match(/\.[a-z0-9]+$/i)?.[0] ?? ''}`;
  let size: number;
  try {
    ({ size } = await file.stat());
  } catch (error) {
    await file.close();
    throw error;
  }
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Length', size);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  streamFileHandle(file, res, next);
});

claimsRouter.post('/', requireAuth, receiveClaimDocuments, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Please provide the item and ownership details.' });
    return;
  }

  const { itemId, hiddenDetailAnswer, lastSeen, proofImageDataUrl } = req.body;
  const uploadedFiles = getClaimDocumentFiles(req);
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

  const storedDocuments = await validateAndStoreClaimDocuments(uploadedFiles);
  if (!storedDocuments) {
    res.status(400).json({ message: 'One or more supporting documents have an invalid type or content signature.' });
    return;
  }

  let result: ClaimSubmissionResult;
  try {
    result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.item.findUnique({ where: { id: itemId.trim() } });
      if (!item) return { kind: 'not-found' as const };
      if (item.reporterId === req.authUserId) return { kind: 'self-claim' as const };
      if (
        item.reportType !== ReportType.FOUND
        || (item.status !== ItemStatus.REPORTED && item.status !== ItemStatus.IN_VAULT)
        || item.reviewStatus !== ItemReviewStatus.APPROVED
      ) {
        return { kind: 'unavailable' as const };
      }

      const reserved = await transaction.item.updateMany({
        where: {
          id: item.id,
          reportType: ReportType.FOUND,
          status: item.status,
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
          documents: storedDocuments.length > 0
            ? {
              create: storedDocuments.map((document) => ({
                documentType: document.documentType,
                storageKey: document.storageKey,
                fileName: document.fileName,
                mimeType: document.mimeType,
              })),
            }
            : undefined,
        },
        select: { id: true, status: true, createdAt: true },
      });
      return { kind: 'created' as const, claim };
    });
  } catch (error) {
    await removeStoredClaimDocuments(storedDocuments);
    throw error;
  }

  if (result.kind === 'not-found') {
    await removeStoredClaimDocuments(storedDocuments);
    res.status(404).json({ message: 'That item could not be found.' });
    return;
  }
  if (result.kind === 'self-claim') {
    await removeStoredClaimDocuments(storedDocuments);
    res.status(400).json({ message: 'You cannot submit a claim for an item you reported.' });
    return;
  }
  if (result.kind === 'unavailable') {
    await removeStoredClaimDocuments(storedDocuments);
    res.status(409).json({ message: 'This item is no longer available for a claim.' });
    return;
  }
  res.status(201).json({
    id: result.claim.id,
    status: result.claim.status,
    submittedAt: result.claim.createdAt.toISOString(),
  });
});
