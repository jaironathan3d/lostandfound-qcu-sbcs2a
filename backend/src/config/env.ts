export type AppEnv = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  FRONTEND_URL: string;
  JWT_SECRET: string;
  ITEM_MEDIA_DIRECTORY: string;
  ITEM_IMAGE_MAX_BYTES: number;
  ITEM_VIDEO_MAX_BYTES: number;
  CLAIM_DOCUMENT_DIRECTORY: string;
  CLAIM_DOCUMENT_MAX_BYTES: number;
};

const parsePort = (value: string | undefined): number => {
  const parsed = Number(value ?? '4000');
  return Number.isNaN(parsed) ? 4000 : parsed;
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const env: AppEnv = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parsePort(process.env.PORT),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  ITEM_MEDIA_DIRECTORY: process.env.ITEM_MEDIA_DIRECTORY ?? 'storage/item-media',
  ITEM_IMAGE_MAX_BYTES: parsePositiveInteger(process.env.ITEM_IMAGE_MAX_BYTES, 10 * 1024 * 1024),
  ITEM_VIDEO_MAX_BYTES: parsePositiveInteger(process.env.ITEM_VIDEO_MAX_BYTES, 25 * 1024 * 1024),
  CLAIM_DOCUMENT_DIRECTORY: process.env.CLAIM_DOCUMENT_DIRECTORY ?? 'storage/claim-documents',
  CLAIM_DOCUMENT_MAX_BYTES: parsePositiveInteger(process.env.CLAIM_DOCUMENT_MAX_BYTES, 10 * 1024 * 1024),
};
