import { cn } from "@/lib/core/utils";

/**
 * GitInsight logomark: two branches (representing code + project-management
 * activity) converging into a single node — the "project intelligence"
 * concept the whole product is built around. Used in the navbar, sidebar,
 * and footer.
 */
export function GitInsightMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
    >
      <path
        d="M9 24C9 24 9 15 9 12C9 8.5 12 7 12 7"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M23 24C23 24 23 15 23 12C23 8.5 20 7 20 7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="9" cy="24" r="3" fill="white" fillOpacity="0.55" />
      <circle cx="23" cy="24" r="3" fill="white" />
      <circle cx="16" cy="6" r="3.5" fill="white" />
      <path d="M16 6L16 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function GitInsightLogo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 p-1.5 shadow-sm",
          markClassName
        )}
      >
        <GitInsightMark />
      </div>
      {showWordmark && (
        <span className="text-[15px] font-extrabold tracking-tight text-foreground">
          GitInsight
        </span>
      )}
    </div>
  );
}
