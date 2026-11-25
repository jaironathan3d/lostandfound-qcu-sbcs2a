import type { Prisma } from '../generated/prisma/client';

export const createNotification = (
  transaction: Prisma.TransactionClient,
  userId: string,
  message: string,
  href?: string,
) => transaction.notification.create({
  data: { userId, message, href },
});
