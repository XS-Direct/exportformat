-- CreateTable
CREATE TABLE "export_models" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'download',
    "outputFormat" TEXT NOT NULL DEFAULT 'custom',
    "codeBefore" TEXT NOT NULL,
    "repeatingCode" TEXT NOT NULL,
    "codeAfter" TEXT,
    "mockFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
