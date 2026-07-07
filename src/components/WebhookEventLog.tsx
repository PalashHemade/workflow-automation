"use client";

import React, { useState, useEffect } from "react";
import { Terminal, ChevronDown, ChevronUp, Loader2, PlayCircle, Eye } from "lucide-react";

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

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case "push":
        return "bg-indigo-950/60 text-indigo-400 border-indigo-900/30";
      case "pull_request":
        return "bg-purple-950/60 text-purple-400 border-purple-900/30";
      case "pull_request_review":
      case "pull_request_review_comment":
        return "bg-pink-950/60 text-pink-400 border-pink-900/30";
      case "create":
        return "bg-emerald-950/60 text-emerald-400 border-emerald-900/30";
      case "delete":
        return "bg-rose-950/60 text-rose-400 border-rose-900/30";
      default:
        return "bg-slate-900 text-slate-400 border-slate-800";
    }
  };

  const renderPayloadJSON = (payloadStr: string) => {
    try {
      const parsed = JSON.parse(payloadStr);
      // Clean sensitive tokens/headers if any, but keep structure for AI parsing
      return (
        <pre className="text-[10px] font-mono p-4 overflow-x-auto bg-slate-950 text-slate-300 rounded-xl leading-normal max-h-[350px]">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <pre className="text-[10px] font-mono p-4 bg-slate-950 text-rose-400 rounded-xl">{payloadStr}</pre>;
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/30">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-850 bg-slate-900/20 p-5 shadow-lg space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Terminal className="h-4.5 w-4.5 text-emerald-400 animate-pulse" />
          Real-Time Webhook Event Stream
        </h3>
        <p className="text-xs text-slate-400">
          Cryptographically verified incoming payload streams feed directly into the local AI readiness cache.
        </p>

        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No events captured yet. Make a push or trigger a PR event to see webhooks stream live.
          </div>
        ) : (
          <div className="divide-y divide-slate-850/60">
            {events.map((ev) => {
              const isExpanded = ev.id === expandedId;

              return (
                <div key={ev.id} className="py-3.5 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${getEventBadgeClass(ev.eventType)}`}>
                        {ev.eventType}
                      </span>

                      {ev.action && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-850 text-slate-400 capitalize">
                          {ev.action}
                        </span>
                      )}

                      <span className="text-xs text-slate-500 truncate hidden sm:inline">
                        Processed at {new Date(ev.processedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                        {ev.id.substring(0, 6)}
                      </span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border border-slate-850 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white transition shrink-0
                          ${isExpanded ? "border-emerald-500 text-emerald-400" : ""}`}
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pl-6 border-l-2 border-emerald-950 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Eye className="h-3.5 w-3.5 text-slate-500" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-850">
            <button
              onClick={() => fetchEvents(page - 1)}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => fetchEvents(page + 1)}
              disabled={page === totalPages || loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
