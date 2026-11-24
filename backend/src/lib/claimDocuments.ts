import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import multer, { type FileFilterCallback } from 'multer';
import { ClaimDocumentType } from '../generated/prisma/enums';
import { env } from '../config/env';

const documentDirectory = path.resolve(env.CLAIM_DOCUMENT_DIRECTORY);
const temporaryDirectory = path.join(documentDirectory, '.incoming');
const maxBytes = env.CLAIM_DOCUMENT_MAX_BYTES;

const allowedTypes: Record<string, { mimeType: string }> = {
  '.pdf': { mimeType: 'application/pdf' },
  '.jpg': { mimeType: 'image/jpeg' },
  '.jpeg': { mimeType: 'image/jpeg' },
  '.png': { mimeType: 'image/png' },
  '.webp': { mimeType: 'image/webp' },
};

const getDocumentType = (fieldName: string): ClaimDocumentType | null => {
  if (fieldName === 'corDocument') return ClaimDocumentType.COR;
  if (fieldName === 'scheduleDocument') return ClaimDocumentType.CLASS_SCHEDULE;
  return null;
};

const parseMultipart = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, temporaryDirectory),
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: {
    fileSize: maxBytes,
    files: 2,
    fields: 20,
    fieldSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback: FileFilterCallback) => {
    const type = allowedTypes[path.extname(file.originalname).toLowerCase()];
    if (!getDocumentType(file.fieldname) || !type || type.mimeType !== file.mimetype) {
      callback(new Error('Choose a PDF, JPG, PNG, or WebP file for each supporting document.'));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: 'corDocument', maxCount: 1 },
  { name: 'scheduleDocument', maxCount: 1 },
]);

export const getClaimDocumentFiles = (req: Request): Express.Multer.File[] => {
  const files = req.files;
  if (Array.isArray(files)) return files;
  return files ? Object.values(files).flat() : [];
};

export const receiveClaimDocuments: RequestHandler = async (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    next();
    return;
  }
  try {
    await mkdir(temporaryDirectory, { recursive: true });
  } catch (error) {
    next(error);
    return;
  }
  parseMultipart(req, res, (error: unknown) => {
    if (!error) {
      res.once('finish', () => {
        void removeTemporaryClaimDocuments(getClaimDocumentFiles(req));
      });
      next();
      return;
    }
    const files = getClaimDocumentFiles(req);
    void Promise.all(files.map((file) => rm(file.path, { force: true })));
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'A supporting document exceeds the configured upload size limit.' });
      return;
    }
    if (error instanceof multer.MulterError && (
      error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
    )) {
      res.status(400).json({ message: 'Attach no more than one COR and one class schedule.' });
      return;
    }
    res.status(400).json({
      message: error instanceof Error ? error.message : 'The supporting documents could not be uploaded.',
    });
  });
};

export type StoredClaimDocument = {
  documentType: ClaimDocumentType;
  storageKey: string;
  fileName: string;
  mimeType: string;
};

export const validateAndStoreClaimDocuments = async (
  files: Express.Multer.File[],
): Promise<StoredClaimDocument[] | null> => {
  const validated: Array<{
    file: Express.Multer.File;
    documentType: ClaimDocumentType;
    extension: string;
    mimeType: string;
  }> = [];
  for (const file of files) {
    const extension = path.extname(file.originalname).toLowerCase();
    const type = allowedTypes[extension];
    const documentType = getDocumentType(file.fieldname);
    if (!type || !documentType || type.mimeType !== file.mimetype || file.size > maxBytes) return null;

    const handle = await open(file.path, 'r');
    const header = Buffer.alloc(12);
    let bytesRead = 0;
    try {
      ({ bytesRead } = await handle.read(header, 0, header.length, 0));
    } finally {
      await handle.close();
    }
    const signature = header.subarray(0, bytesRead);
    const validContent = extension === '.pdf'
      ? signature.length >= 5 && signature.toString('ascii', 0, 5) === '%PDF-'
      : extension === '.jpg' || extension === '.jpeg'
        ? signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
        : extension === '.png'
          ? signature.length >= 8 && signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : signature.length >= 12 && signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP';
    if (!validContent) return null;
    validated.push({ file, documentType, extension, mimeType: type.mimeType });
  }

  const stored: StoredClaimDocument[] = [];
  try {
    await mkdir(documentDirectory, { recursive: true });
    for (const entry of validated) {
      const storageName = `${randomUUID()}${entry.extension}`;
      await rename(entry.file.path, path.join(documentDirectory, storageName));
      stored.push({
        documentType: entry.documentType,
        storageKey: `storage:${storageName}`,
        fileName: path.basename(entry.file.originalname).slice(0, 180),
        mimeType: entry.mimeType,
      });
    }
    return stored;
  } catch (error) {
    await removeStoredClaimDocuments(stored);
    throw error;
  }
};

export const removeTemporaryClaimDocuments = async (files: Express.Multer.File[]): Promise<void> => {
  await Promise.all(files.map((file) => rm(file.path, { force: true })));
};

export const removeStoredClaimDocuments = async (
  documents: Array<Pick<StoredClaimDocument, 'storageKey'>>,
): Promise<void> => {
  await Promise.all(documents.map((document) => {
    const filename = getStorageFilename(document.storageKey);
    return filename ? rm(path.join(documentDirectory, filename), { force: true }) : Promise.resolve();
  }));
};

const getStorageFilename = (storageKey: string): string | null => {
  if (!storageKey.startsWith('storage:')) return null;
  const filename = storageKey.slice('storage:'.length);
  return path.basename(filename) === filename ? filename : null;
};

export const openClaimDocumentFile = async (storageKey: string) => {
  const filename = getStorageFilename(storageKey);
  if (!filename) return null;
  try {
    return await open(path.join(documentDirectory, filename), 'r');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
};

export const getClaimDocumentAccessPath = (
  claimId: string,
  document: { id: string },
  userId: string,
): string => {
  const accessToken = jwt.sign(
    { claimId, documentId: document.id, purpose: 'claim-document' },
    env.JWT_SECRET,
    { subject: userId, expiresIn: '10m' },
  );
  return `/claims/${encodeURIComponent(claimId)}/documents/${encodeURIComponent(document.id)}?access=${encodeURIComponent(accessToken)}`;
};
