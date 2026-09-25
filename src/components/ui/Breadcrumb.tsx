import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/core/utils";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-xs", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </button>
            ) : (
              <span className={cn("font-semibold", isLast ? "text-foreground" : "text-muted-foreground")}>
                {item.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
