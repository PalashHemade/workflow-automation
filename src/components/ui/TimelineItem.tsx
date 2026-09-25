import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/core/utils";

export interface TimelineItemProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  timestamp?: string;
  footer?: React.ReactNode;
  /** Hides the connecting line below this item — pass true for the last item in a list. */
  isLast?: boolean;
  className?: string;
}

export function TimelineItem({
  icon: Icon,
  iconClassName,
  title,
  description,
  timestamp,
  footer,
  isLast = false,
  className,
}: TimelineItemProps) {
  return (
    <div className={cn("relative flex gap-4 pb-6", className)}>
      {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-border" />}
      <span
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground",
          iconClassName
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {timestamp && <span className="text-[11px] text-muted-foreground">{timestamp}</span>}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {footer}
      </div>
    </div>
  );
}
