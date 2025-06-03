-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "imageId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Projects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "Projects_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Members" ADD CONSTRAINT "Members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
