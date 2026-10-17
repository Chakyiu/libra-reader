import type { Prisma } from "@/lib/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Attaches normalized tag names to documents, creating tags as needed. */
export async function attachTags(tx: Tx, documentIds: string[], names: string[]): Promise<void> {
  for (const name of names) {
    const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
    for (const documentId of documentIds) {
      await tx.documentTag.upsert({
        where: { documentId_tagId: { documentId, tagId: tag.id } },
        update: {},
        create: { documentId, tagId: tag.id },
      });
    }
  }
}

/** Tags with no documents left are removed so the sidebar only lists live ones. */
export async function pruneUnusedTags(tx: Tx): Promise<void> {
  await tx.tag.deleteMany({ where: { documents: { none: {} } } });
}
