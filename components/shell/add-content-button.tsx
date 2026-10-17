"use client";

import type { ComponentProps } from "react";
import { Plus } from "lucide-react";
import type { AddTab } from "@/components/add-content/add-content-dialog";
import { useAddContent } from "@/components/shell/add-content-context";
import { Button } from "@/components/ui/button";

/** Opens the Add content dialog from server-rendered pages. */
export function AddContentButton({
  tab,
  collectionId,
  children = "Add content",
  ...props
}: { tab?: AddTab; collectionId?: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const { openAddContent } = useAddContent();
  return (
    <Button onClick={() => openAddContent({ tab, collectionId })} {...props}>
      <Plus />
      {children}
    </Button>
  );
}
