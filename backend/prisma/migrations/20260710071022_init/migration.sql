CREATE EXTENSION vector;
-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('BUG', 'ERROR', 
'DECISION', 'CODE', 'ARTICLE');

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "tags" TEXT[],
    "embedding" vector(3072),
    "createdAt" TIMESTAMP(3) NOT NULL 
    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);
