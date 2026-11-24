import { PrismaClient, Prisma } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before the Prisma Client can start.');
}

export { Prisma };
export {
  ClaimDocumentType,
  ClaimStatus,
  ConversationReportReason,
  ConversationReportStatus,
  ItemMediaType,
  ItemReviewStatus,
  ItemStatus,
  LostItemStatus,
  MatchSuggestionStatus,
  ReportType,
  UserRole,
} from '../generated/prisma/enums';

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
