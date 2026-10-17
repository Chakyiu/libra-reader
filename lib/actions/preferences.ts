"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEFAULT_PREFERENCES, type ActionResult, type Preferences } from "@/lib/types";
import { firstError, preferenceUpdateSchema } from "@/lib/validation";

export async function updatePreferences(raw: z.input<typeof preferenceUpdateSchema>): Promise<ActionResult<Preferences>> {
  const input = preferenceUpdateSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: firstError(input.error) };
  const row = await db.preference.upsert({
    where: { id: 1 },
    update: input.data,
    create: { id: 1, ...DEFAULT_PREFERENCES, ...input.data },
  });
  revalidatePath("/", "layout");
  return {
    ok: true,
    data: {
      theme: row.theme,
      font: row.font,
      fontSize: row.fontSize,
      lineHeight: row.lineHeight,
      columnWidth: row.columnWidth,
    },
  };
}
