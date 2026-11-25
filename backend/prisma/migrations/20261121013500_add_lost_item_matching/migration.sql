CREATE TYPE "LostItemStatus" AS ENUM ('OPEN', 'MATCH_PENDING', 'FOUND', 'RETURNED');
CREATE TYPE "MatchSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Item"
ADD COLUMN "lostItemStatus" "LostItemStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "matchedFoundItemId" TEXT,
ADD COLUMN "resolutionLocation" TEXT;

CREATE UNIQUE INDEX "Item_matchedFoundItemId_key" ON "Item"("matchedFoundItemId");

CREATE TABLE "ItemMatchSuggestion" (
    "id" TEXT NOT NULL,
    "lostItemId" TEXT NOT NULL,
    "foundItemId" TEXT,
    "proposedById" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "MatchSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemMatchSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemMatchSuggestion_lostItemId_createdAt_idx" ON "ItemMatchSuggestion"("lostItemId", "createdAt");
CREATE INDEX "ItemMatchSuggestion_status_createdAt_idx" ON "ItemMatchSuggestion"("status", "createdAt");

ALTER TABLE "Item" ADD CONSTRAINT "Item_matchedFoundItemId_fkey"
FOREIGN KEY ("matchedFoundItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemMatchSuggestion" ADD CONSTRAINT "ItemMatchSuggestion_lostItemId_fkey"
FOREIGN KEY ("lostItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemMatchSuggestion" ADD CONSTRAINT "ItemMatchSuggestion_foundItemId_fkey"
FOREIGN KEY ("foundItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemMatchSuggestion" ADD CONSTRAINT "ItemMatchSuggestion_proposedById_fkey"
FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemMatchSuggestion" ADD CONSTRAINT "ItemMatchSuggestion_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
