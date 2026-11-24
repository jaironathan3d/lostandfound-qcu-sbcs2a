CREATE TYPE "ClaimDocumentType" AS ENUM ('COR', 'CLASS_SCHEDULE');

CREATE TABLE "ClaimDocument" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "documentType" "ClaimDocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClaimDocument_claimId_documentType_key" ON "ClaimDocument"("claimId", "documentType");

ALTER TABLE "ClaimDocument"
ADD CONSTRAINT "ClaimDocument_claimId_fkey"
FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
