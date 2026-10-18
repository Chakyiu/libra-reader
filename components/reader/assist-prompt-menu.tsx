"use client";

import Link from "next/link";
import { TextQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AssistPromptItem } from "@/lib/types";

/** Picks a saved prompt. The toolbar variant stays inside the selection toolbar; the field variant sits with other note actions. */
export function AssistPromptMenu({
  prompts,
  onSelect,
  disabled,
  variant,
  align = "start",
}: {
  prompts: AssistPromptItem[];
  onSelect: (promptId: string) => void;
  disabled?: boolean;
  variant: "toolbar" | "field";
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu modal={false}>
      {variant === "field" ? (
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            Prompt
          </Button>
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          disabled={disabled}
          aria-label="Choose a prompt"
          className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-[12.5px] font-medium hover:bg-background/20 focus-visible:outline-2 focus-visible:outline-background disabled:opacity-50 sm:px-3.5 pointer-coarse:min-h-11"
        >
          <TextQuote className="size-[15px] sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Prompt</span>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent data-selection-toolbar="" data-assist-prompt-menu="" align={align} className="z-[60] w-[min(16rem,calc(100vw-24px))]">
        {prompts.length === 0 ? (
          <DropdownMenuItem asChild>
            <Link href="/settings/assist">Add a prompt in Settings</Link>
          </DropdownMenuItem>
        ) : (
          prompts.map((prompt) => (
            <DropdownMenuItem key={prompt.id} onSelect={() => onSelect(prompt.id)}>
              <span className="truncate">{prompt.name}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
