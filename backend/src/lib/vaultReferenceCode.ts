import { randomBytes } from 'node:crypto';

export const createVaultReferenceCode = (): string =>
  `QCU-${randomBytes(8).toString('hex').toUpperCase()}`;
