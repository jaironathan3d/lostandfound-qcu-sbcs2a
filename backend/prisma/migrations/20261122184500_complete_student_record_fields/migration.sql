ALTER TABLE "StudentRecord"
ADD COLUMN "yearLevel" TEXT NOT NULL DEFAULT 'N/A',
ADD COLUMN "universityEmail" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "StudentRecord_universityEmail_key"
ON "StudentRecord"("universityEmail");
