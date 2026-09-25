import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { cn } from "@/lib/core/utils";

type StatusVariant = NonNullable<BadgeProps["variant"]>;

/**
 * Maps every status string used across the app (PR state, sync status,
 * module health, insight severity, etc.) to a consistent badge color, so
 * "open"/"active"/"healthy"/"low risk" always mean the same visual thing.
 */
const STATUS_MAP: Record<string, StatusVariant> = {
  open: "success",
  active: "success",
  connected: "success",
  healthy: "success",
  completed: "success",
  success: "success",
  low: "success",
  merged: "info",
  closed: "danger",
  failed: "danger",
  error: "danger",
  disconnected: "danger",
  critical: "danger",
  high: "danger",
  degraded: "warning",
  syncing: "warning",
  running: "warning",
  pending: "warning",
  medium: "warning",
  idle: "secondary",
  archived: "secondary",
  resolved: "secondary",
  ignored: "secondary",
};

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: string;
  /** Renders a small colored dot before the label instead of a filled pill. */
  dot?: boolean;
}

export function StatusBadge({ status, dot = false, className, children, ...props }: StatusBadgeProps) {
  const key = status?.toLowerCase?.() ?? "";
  const variant = STATUS_MAP[key] ?? "secondary";

  if (dot) {
    const dotColor =
      variant === "success"
        ? "bg-emerald-500"
        : variant === "danger"
        ? "bg-rose-500"
        : variant === "warning"
        ? "bg-amber-500"
        : variant === "info"
        ? "bg-violet-500"
        : "bg-muted-foreground";
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-foreground", className)} {...props}>
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
        {children ?? status}
      </span>
    );
  }

  return (
    <Badge variant={variant} className={className} {...props}>
      {children ?? status}
    </Badge>
  );
}
