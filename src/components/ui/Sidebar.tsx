"use client";

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { SimpleTooltip } from "@/components/ui/Tooltip";

export function SidebarContainer({
  collapsed,
  className,
  children,
}: {
  collapsed: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      {children}
    </aside>
  );
}

export interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
}

export function SidebarNavItem({ icon: Icon, label, active, collapsed, onClick, badge }: SidebarNavItemProps) {
  const button = (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary/10 text-primary font-bold"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge}
    </button>
  );

  if (collapsed) {
    return (
      <SimpleTooltip label={label} side="right">
        {button}
      </SimpleTooltip>
    );
  }

  return button;
}

export function SidebarSection({
  title,
  collapsed,
  children,
}: {
  title?: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5 px-2">
      {title && !collapsed && (
        <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
