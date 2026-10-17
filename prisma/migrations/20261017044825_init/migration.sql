-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publication" TEXT,
    "sourceUrl" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INBOX',
    "importStatus" TEXT NOT NULL DEFAULT 'READY',
    "importError" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "contentHtml" TEXT,
    "contentText" TEXT,
    "excerpt" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "pageCount" INTEGER,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "readingMinutes" INTEGER,
    "progress" REAL NOT NULL DEFAULT 0,
    "readingLocation" TEXT,
    "lastOpenedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "context" TEXT NOT NULL DEFAULT '',
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'YELLOW',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Highlight_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'YELLOW',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentCollection" (
    "documentId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("documentId", "collectionId"),
    CONSTRAINT "DocumentCollection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DocumentTag" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("documentId", "tagId"),
    CONSTRAINT "DocumentTag_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
    "font" TEXT NOT NULL DEFAULT 'SERIF',
    "fontSize" INTEGER NOT NULL DEFAULT 19,
    "lineHeight" REAL NOT NULL DEFAULT 1.7,
    "columnWidth" INTEGER NOT NULL DEFAULT 66,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- CreateIndex
CREATE INDEX "Document_sourceUrl_idx" ON "Document"("sourceUrl");

-- CreateIndex
CREATE INDEX "Highlight_documentId_idx" ON "Highlight"("documentId");

-- CreateIndex
CREATE INDEX "Highlight_createdAt_idx" ON "Highlight"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentCollection_collectionId_idx" ON "DocumentCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "DocumentTag_tagId_idx" ON "DocumentTag"("tagId");
