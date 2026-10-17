import { cn } from "cn";
import type { DocumentType, ImportStatus } from "@/lib/generated/prisma/enums";
import { monogram, TYPE_LABEL } from "@/lib/format";

/**
 * The letterpress spine label that stands in for a thumbnail: a publication
 * monogram on a stone field tinted by content type.
 */
export function Bookplate({
  type,
  publication,
  title,
  importStatus,
  size = "row",
  className,
}: {
  type: DocumentType;
  publication: string | null;
  title: string;
  importStatus?: ImportStatus;
  size?: "row" | "card" | "feature" | "preview";
  className?: string;
}) {
  const mono = monogram(publication, title);
  return (
    <span
      aria-hidden="true"
      data-type={type}
      data-link-only={importStatus === "LINK_ONLY" ? "true" : undefined}
      className={cn(
        "plate",
        size === "row" && "size-[60px] p-2.5",
        size === "card" && "aspect-[4/3] w-full rounded-sm p-3.5",
        size === "feature" && "h-[154px] w-[124px] p-3.5 max-sm:h-24 max-sm:w-[78px]",
        size === "preview" && "size-[90px] p-3 max-sm:size-[72px]",
        className,
      )}
    >
      <span className="plate-frame" />
      <b
        className={cn(
          "plate-mono",
          size === "row" && "text-[18px]",
          size === "card" && "text-[30px]",
          size === "feature" && "text-[34px] max-sm:text-[24px]",
          size === "preview" && "text-[24px]",
        )}
      >
        {mono}
      </b>
      {size !== "row" && <i className="plate-type not-italic">{TYPE_LABEL[type]}</i>}
    </span>
  );
}
