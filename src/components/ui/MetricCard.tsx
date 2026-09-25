import * as React from "react";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/core/utils";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Positive = up-trend (rendered green), negative = down-trend (rendered red). Omit for no trend. */
  trend?: number;
  trendLabel?: string;
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, trend, trendLabel, className }: MetricCardProps) {
  const hasTrend = typeof trend === "number";
  const isUp = hasTrend && trend! >= 0;

  return (
    <Card className={cn("space-y-1.5 p-5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-primary">{value}</span>
        {hasTrend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-bold",
              isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}
          >
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend!)}%
          </span>
        )}
      </div>
      {trendLabel && <p className="text-[11px] text-muted-foreground">{trendLabel}</p>}
    </Card>
  );
}
