"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { cn } from "cn";
import { LoaderCircle, Search, X } from "lucide-react";

/** A search box that keeps its value in the URL (debounced, history-replacing). */
export function UrlSearchField({
  label,
  placeholder,
  param = "q",
  autoFocus = false,
  large = false,
  className,
}: {
  label: string;
  placeholder: string;
  param?: string;
  autoFocus?: boolean;
  large?: boolean;
  className?: string;
}) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlValue = params.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const [lastUrlValue, setLastUrlValue] = useState(urlValue);
  const [pending, startTransition] = useTransition();

  if (urlValue !== lastUrlValue) {
    setLastUrlValue(urlValue);
    if (urlValue !== value.trim()) setValue(urlValue);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const trimmed = value.trim();
      if (trimmed) next.set(param, trimmed);
      else next.delete(param);
      const query = next.toString();
      if (query === params.toString()) return;
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [value, params, param, pathname, router]);

  return (
    <div className={cn("field", large && "min-h-[54px] px-[18px] text-base", className)}>
      {pending ? (
        <LoaderCircle className={cn("shrink-0 animate-spin", large ? "size-[18px]" : "size-[15px]")} aria-hidden />
      ) : (
        <Search className={cn("shrink-0", large ? "size-[18px]" : "size-[15px]")} aria-hidden />
      )}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.stopPropagation();
            setValue("");
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className={cn(large && "!text-base")}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="-mr-1.5 grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-[15px]" />
        </button>
      )}
    </div>
  );
}
