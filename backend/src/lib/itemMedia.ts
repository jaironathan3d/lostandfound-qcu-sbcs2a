import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import multer, { type FileFilterCallback } from 'multer';
import { ItemMediaType, ItemReviewStatus } from '../generated/prisma/enums';
import { env } from '../config/env';

const mediaDirectory = path.resolve(env.ITEM_MEDIA_DIRECTORY);
const temporaryDirectory = path.join(mediaDirectory, '.incoming');
const maxImageBytes = env.ITEM_IMAGE_MAX_BYTES;
const maxVideoBytes = env.ITEM_VIDEO_MAX_BYTES;
const maxFiles = 4;

const allowedTypes: Record<string, { mediaType: ItemMediaType; mimeType: string; maxBytes: number }> = {
  '.jpg': { mediaType: ItemMediaType.IMAGE, mimeType: 'image/jpeg', maxBytes: maxImageBytes },
  '.jpeg': { mediaType: ItemMediaType.IMAGE, mimeType: 'image/jpeg', maxBytes: maxImageBytes },
  '.png': { mediaType: ItemMediaType.IMAGE, mimeType: 'image/png', maxBytes: maxImageBytes },
  '.webp': { mediaType: ItemMediaType.IMAGE, mimeType: 'image/webp', maxBytes: maxImageBytes },
  '.mp4': { mediaType: ItemMediaType.VIDEO, mimeType: 'video/mp4', maxBytes: maxVideoBytes },
  '.webm': { mediaType: ItemMediaType.VIDEO, mimeType: 'video/webm', maxBytes: maxVideoBytes },
};

const parseMultipart = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, temporaryDirectory),
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: {
    fileSize: Math.max(maxImageBytes, maxVideoBytes),
    files: maxFiles,
    fields: 20,
    fieldSize: 64 * 1024,
  },
  fileFilter: (_req, file, callback: FileFilterCallback) => {
    const type = allowedTypes[path.extname(file.originalname).toLowerCase()];
    if (!type || type.mimeType !== file.mimetype) {
      callback(new Error('Choose JPG, PNG, WebP, MP4, or WebM files with matching file types.'));
      return;
    }
    callback(null, true);
  },
}).array('media', maxFiles);

export const receiveItemMedia: RequestHandler = async (req, res, next) => {
  try {
    await mkdir(temporaryDirectory, { recursive: true });
  } catch (error) {
    next(error);
    return;
  }
  parseMultipart(req, res, (error: unknown) => {
    if (!error) {
      res.once('finish', () => {
        void removeTemporaryItemMedia(getUploadedFiles(req));
      });
      next();
      return;
    }
    const files = getUploadedFiles(req);
    void Promise.all(files.map((file) => rm(file.path, { force: true })));
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'An attachment exceeds the upload size limit.' });
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ message: `Attach no more than ${maxFiles} files.` });
      return;
    }
    res.status(400).json({
      message: error instanceof Error ? error.message : 'The attachments could not be uploaded.',
    });
  });
};

export type StoredItemMedia = {
  storedName: string;
  imageUrl: string;
  mediaType: ItemMediaType;
  fileName: string;
};

export const getUploadedFiles = (req: Request): Express.Multer.File[] =>
  Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];

export const validateAndStoreItemMedia = async (
  files: Express.Multer.File[],
): Promise<StoredItemMedia[] | null> => {
  const validated: Array<{ file: Express.Multer.File; mediaType: ItemMediaType; extension: string }> = [];
  for (const file of files) {
    const extension = path.extname(file.originalname).toLowerCase();
    const type = allowedTypes[extension];
    if (!type || file.mimetype !== type.mimeType || file.size > type.maxBytes) {
      return null;
    }

    const handle = await open(file.path, 'r');
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    await handle.close();
    const signature = header.subarray(0, bytesRead);
    const validContent = type.mediaType === ItemMediaType.IMAGE
      ? extension === '.jpg' || extension === '.jpeg'
        ? signature.length >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
        : extension === '.png'
          ? signature.length >= 8 && signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : signature.length >= 12 && signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP'
      : extension === '.mp4'
        ? signature.length >= 8 && signature.toString('ascii', 4, 8) === 'ftyp'
        : signature.length >= 4 && signature.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!validContent) return null;
    validated.push({ file, mediaType: type.mediaType, extension });
  }

  const stored: StoredItemMedia[] = [];
  try {
    await mkdir(mediaDirectory, { recursive: true });
    for (const entry of validated) {
      const storedName = `${randomUUID()}${entry.extension}`;
      await rename(entry.file.path, path.join(mediaDirectory, storedName));
      stored.push({
        storedName,
        imageUrl: `storage:${storedName}`,
        mediaType: entry.mediaType,
        fileName: path.basename(entry.file.originalname).slice(0, 180),
      });
    }
    return stored;
  } catch (error) {
    await removeStoredItemMedia(stored);
    throw error;
  }
};

export const removeTemporaryItemMedia = async (files: Express.Multer.File[]): Promise<void> => {
  await Promise.all(files.map((file) => rm(file.path, { force: true })));
};

export const removeStoredItemMedia = async (files: Pick<StoredItemMedia, 'storedName'>[]): Promise<void> => {
  await Promise.all(files.map((file) => rm(path.join(mediaDirectory, file.storedName), { force: true })));
};

export const removeItemMediaFile = async (imageUrl: string): Promise<void> => {
  if (!imageUrl.startsWith('storage:')) return;
  const filename = imageUrl.slice('storage:'.length);
  if (path.basename(filename) !== filename) return;
  await rm(path.join(mediaDirectory, filename), { force: true });
};

export const openItemMediaFile = async (imageUrl: string) => {
  if (!imageUrl.startsWith('storage:')) return null;
  const filename = imageUrl.slice('storage:'.length);
  if (path.basename(filename) !== filename) return null;
  try {
    return await open(path.join(mediaDirectory, filename), 'r');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
};

export const getItemMediaContentType = (imageUrl: string): string => {
  const extension = path.extname(imageUrl.slice('storage:'.length)).toLowerCase();
  return allowedTypes[extension]?.mimeType ?? 'application/octet-stream';
};

export const getItemMediaAccessPath = (
  itemId: string,
  media: { id: string; imageUrl: string },
  reviewStatus: ItemReviewStatus,
  userId?: string,
): string | undefined => {
  if (!media.imageUrl.startsWith('storage:')) return media.imageUrl;
  const mediaPath = `/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(media.id)}`;
  if (reviewStatus === ItemReviewStatus.APPROVED) return mediaPath;
  if (!userId) return undefined;
  const accessToken = jwt.sign(
    { itemId, mediaId: media.id, purpose: 'item-media' },
    env.JWT_SECRET,
    { subject: userId, expiresIn: '10m' },
  );
  return `${mediaPath}?access=${encodeURIComponent(accessToken)}`;
};
