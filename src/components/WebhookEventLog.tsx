"use client";

import React, { useState, useEffect } from "react";
import { Terminal, ChevronDown, ChevronUp, Loader2, PlayCircle, Eye } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/core/utils";

interface WebhookEvent {
  id: string;
  eventType: string;
  action: string | null;
  payload: string;
  processedAt: string;
}

interface WebhookEventLogProps {
  repositoryId: string;
}

const EVENT_BADGE_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  push: "default",
  pull_request: "info",
  pull_request_review: "info",
  pull_request_review_comment: "info",
  create: "success",
  delete: "danger",
};

export default function WebhookEventLog({ repositoryId }: WebhookEventLogProps) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents(1);
  }, [repositoryId]);

  const fetchEvents = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhook-events?repositoryId=${repositoryId}&page=${p}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      console.error("Error fetching webhook events:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderPayloadJSON = (payloadStr: string) => {
    try {
      const parsed = JSON.parse(payloadStr);
      return (
        <pre className="max-h-[350px] overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-[10px] leading-normal text-slate-300">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <pre className="rounded-xl bg-slate-950 p-4 font-mono text-[10px] text-rose-400">{payloadStr}</pre>;
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-secondary/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Terminal className="h-4.5 w-4.5 animate-pulse text-emerald-500" />
        Real-Time Webhook Event Stream
      </h3>
      <p className="text-xs text-muted-foreground">
        Cryptographically verified incoming payload streams feed directly into the local AI readiness cache.
      </p>

      {events.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title="No events captured yet"
          description="Make a push or trigger a PR event to see webhooks stream live."
        />
      ) : (
        <div className="divide-y divide-border">
          {events.map((ev) => {
            const isExpanded = ev.id === expandedId;

            return (
              <div key={ev.id} className="space-y-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PlayCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                    <Badge variant={EVENT_BADGE_VARIANT[ev.eventType] ?? "secondary"}>{ev.eventType}</Badge>
                    {ev.action && <Badge variant="secondary">{ev.action}</Badge>}
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                      Processed at {new Date(ev.processedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {ev.id.substring(0, 6)}
                    </span>
                    <IconButton
                      aria-label={isExpanded ? "Collapse event" : "Expand event"}
                      variant="solid"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      className={cn(isExpanded && "border-emerald-500 text-emerald-500")}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </IconButton>
                  </div>
                </div>

                {isExpanded && (
                  <div className="animate-in fade-in space-y-3 border-l-2 border-emerald-500/30 pl-6 duration-200">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      <span>Raw Event Log Payload (JSON)</span>
                    </div>
                    {renderPayloadJSON(ev.payload)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={() => fetchEvents(page - 1)} disabled={page === 1 || loading}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => fetchEvents(page + 1)} disabled={page === totalPages || loading}>
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}
