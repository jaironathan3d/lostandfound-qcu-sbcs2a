-- Add a nullable, unique account link to student records.
ALTER TABLE "StudentRecord"
ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "StudentRecord_userId_key" ON "StudentRecord"("userId");

ALTER TABLE "StudentRecord"
ADD CONSTRAINT "StudentRecord_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
