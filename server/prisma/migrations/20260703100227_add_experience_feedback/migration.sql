-- CreateTable
CREATE TABLE "ExperienceFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "aiComment" TEXT NOT NULL DEFAULT '',
    "techIssues" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperienceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceFeedback_sessionId_key" ON "ExperienceFeedback"("sessionId");

-- AddForeignKey
ALTER TABLE "ExperienceFeedback" ADD CONSTRAINT "ExperienceFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
