CREATE TYPE "ItemMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "ItemImage"
ADD COLUMN "mediaType" "ItemMediaType" NOT NULL DEFAULT 'IMAGE',
ADD COLUMN "fileName" TEXT;
