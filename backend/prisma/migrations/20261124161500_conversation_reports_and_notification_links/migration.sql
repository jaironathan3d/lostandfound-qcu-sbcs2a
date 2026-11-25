CREATE TYPE "ConversationReportReason" AS ENUM (
    'HARASSMENT',
    'SCAM_OR_FRAUD',
    'SHARED_PERSONAL_INFORMATION',
    'OTHER'
);

CREATE TYPE "ConversationReportStatus" AS ENUM (
    'PENDING',
    'REVIEWED',
    'DISMISSED'
);

ALTER TABLE "Notification" ADD COLUMN "href" TEXT;

CREATE TABLE "ConversationReport" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ConversationReportReason" NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "ConversationReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationReport_conversationId_reporterId_key"
ON "ConversationReport"("conversationId", "reporterId");

CREATE INDEX "ConversationReport_status_createdAt_idx"
ON "ConversationReport"("status", "createdAt");

ALTER TABLE "ConversationReport"
ADD CONSTRAINT "ConversationReport_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationReport"
ADD CONSTRAINT "ConversationReport_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConversationReport"
ADD CONSTRAINT "ConversationReport_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
