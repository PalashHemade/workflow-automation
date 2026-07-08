"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  GitBranch,
  RefreshCw,
  Terminal,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  User,
  ExternalLink,
  SlidersHorizontal,
  Calendar,
  XCircle,
} from "lucide-react";

interface ProjectEvent {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  parentEventId: string | null;
  actorName: string;
  title: string;
  description: string | null;
  importance: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  source: "WEBHOOK" | "SYNC" | "MANUAL" | "SYSTEM";
  metadata: any;
  createdAt: string;
}

interface RepoTimelineProps {
  repositoryId: string;
}

export default function RepoTimeline({ repositoryId }: RepoTimelineProps) {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  
  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedImportance, setSelectedImportance] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<string>("all"); // all | today | 24h | 7d | 30d

  // Expanded cards state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Trigger search/filter fetch
  useEffect(() => {
    fetchEvents(true);
  }, [repositoryId, selectedTypes, selectedImportance, timeRange, search]);

  const fetchEvents = async (reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Calculate date filters
      let startDate = "";
      if (timeRange !== "all") {
        const date = new Date();
        if (timeRange === "today") {
          date.setHours(0, 0, 0, 0);
        } else if (timeRange === "24h") {
          date.setHours(date.getHours() - 24);
        } else if (timeRange === "7d") {
          date.setDate(date.getDate() - 7);
        } else if (timeRange === "30d") {
          date.setDate(date.getDate() - 30);
        }
        startDate = date.toISOString();
      }

      // Build query params
      const params = new URLSearchParams();
      params.append("repositoryId", repositoryId);
      params.append("limit", "15");
      
      if (!reset && nextCursor) {
        params.append("cursor", nextCursor);
      }
      if (selectedTypes.length > 0) {
        params.append("eventTypes", selectedTypes.join(","));
      }
      if (selectedImportance.length > 0) {
        params.append("importance", selectedImportance.join(","));
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (search) {
        params.append("search", search);
      }

      const res = await fetch(`/api/timeline?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          setEvents(data.events || []);
        } else {
          setEvents((prev) => [...prev, ...(data.events || [])]);
        }
        setNextCursor(data.pagination?.nextCursor || null);
      }
    } catch (err) {
      console.error("Error loading timeline events:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleImportanceFilter = (importance: string) => {
    setSelectedImportance((prev) =>
      prev.includes(importance) ? prev.filter((i) => i !== importance) : [...prev, importance]
    );
  };

  // Icon mapping helper
  const getEventIcon = (type: string) => {
    switch (type) {
      case "COMMIT_CREATED":
        return <GitCommit className="h-4 w-4 text-emerald-450" />;
      case "PR_OPENED":
        return <GitPullRequest className="h-4 w-4 text-emerald-450" />;
      case "PR_UPDATED":
        return <GitPullRequest className="h-4 w-4 text-sky-400" />;
      case "PR_CLOSED":
        return <GitPullRequest className="h-4 w-4 text-rose-500" />;
      case "PR_MERGED":
        return <GitPullRequest className="h-4 w-4 text-indigo-400" />;
      case "REVIEW_APPROVED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "CHANGES_REQUESTED":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "REVIEW_SUBMITTED":
        return <CheckCircle2 className="h-4 w-4 text-slate-400" />;
      case "REVIEW_COMMENT":
        return <MessageSquare className="h-4 w-4 text-sky-400" />;
      case "BRANCH_CREATED":
      case "BRANCH_DELETED":
        return <GitBranch className="h-4 w-4 text-blue-400" />;
      case "REPOSITORY_SYNCED":
        return <RefreshCw className="h-4 w-4 text-emerald-400" />;
      case "SYNC_FAILED":
        return <AlertTriangle className="h-4 w-4 text-rose-500" />;
      case "WEBHOOK_RECEIVED":
        return <Terminal className="h-4 w-4 text-slate-500" />;
      default:
        return <Terminal className="h-4 w-4 text-slate-400" />;
    }
  };

  // Importance Badge mapping helper
  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case "LOW":
        return "border-slate-800 text-slate-400 bg-slate-900/40";
      case "NORMAL":
        return "border-blue-500/20 text-blue-400 bg-blue-950/20";
      case "HIGH":
        return "border-amber-500/20 text-amber-400 bg-amber-950/20";
      case "CRITICAL":
        return "border-rose-500/20 text-rose-400 bg-rose-950/20";
      default:
        return "border-slate-800 text-slate-450";
    }
  };

  // Source Badge mapping helper
  const getSourceBadge = (source: string) => {
    switch (source) {
      case "WEBHOOK":
        return "bg-emerald-950/30 border-emerald-800/20 text-emerald-400";
      case "SYNC":
        return "bg-blue-950/30 border-blue-800/20 text-blue-400";
      case "MANUAL":
        return "bg-purple-950/30 border-purple-800/20 text-purple-400";
      case "SYSTEM":
        return "bg-slate-900/60 border-slate-800 text-slate-400";
      default:
        return "bg-slate-900 text-slate-450";
    }
  };

  // Format relative time
  const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters panel */}
      <div className="rounded-2xl border border-slate-850 bg-slate-900/35 p-5 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Text Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by title, description, actor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Quick timing filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 p-1 rounded-xl w-max">
            <button
              onClick={() => setTimeRange("all")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                timeRange === "all" ? "bg-slate-900 text-white" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange("today")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                timeRange === "today" ? "bg-slate-900 text-white" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange("24h")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                timeRange === "24h" ? "bg-slate-900 text-white" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              24 Hours
            </button>
            <button
              onClick={() => setTimeRange("7d")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                timeRange === "7d" ? "bg-slate-900 text-white" : "text-slate-450 hover:text-slate-200"
              }`}
            >
              7 Days
            </button>
          </div>
        </div>

        {/* Type & Importance filters */}
        <div className="border-t border-slate-850/60 pt-4 grid gap-4 md:grid-cols-2">
          {/* Types Filters */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider block">Event Channels</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { type: "COMMIT_CREATED", label: "Commits" },
                { type: "PR_OPENED", label: "PR Opened" },
                { type: "PR_MERGED", label: "PR Merged" },
                { type: "REVIEW_SUBMITTED", label: "Reviews" },
                { type: "REVIEW_COMMENT", label: "Comments" },
                { type: "BRANCH_CREATED", label: "Branches" },
                { type: "REPOSITORY_SYNCED", label: "Sync Outcomes" },
                { type: "WEBHOOK_RECEIVED", label: "Webhook Logs" },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => toggleTypeFilter(item.type)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                    selectedTypes.includes(item.type)
                      ? "border-indigo-500/50 bg-indigo-950/20 text-indigo-300"
                      : "border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Importance Filters */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-slate-455 uppercase tracking-wider block">Importance</span>
            <div className="flex flex-wrap gap-1.5">
              {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((importance) => (
                <button
                  key={importance}
                  onClick={() => toggleImportanceFilter(importance)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                    selectedImportance.includes(importance)
                      ? "border-indigo-500/50 bg-indigo-950/20 text-indigo-300"
                      : "border-slate-800 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {importance}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chronological Timeline feed */}
      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 text-center text-slate-500">
          <Clock className="h-10 w-10 text-slate-700 mb-2" />
          <h3 className="font-semibold text-white">No Timeline Events Found</h3>
          <p className="text-xs max-w-xs mt-1">Adjust search parameters, or run a manual sync settings loop to record activities.</p>
        </div>
      ) : (
        <div className="relative pl-6 border-l border-slate-850 space-y-6">
          {events.map((event) => {
            const isExpanded = expandedIds.has(event.id);
            const relativeTime = getRelativeTime(event.createdAt);

            return (
              <div key={event.id} className="relative group">
                {/* Dot marker on timeline */}
                <div className="absolute -left-[35px] top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition">
                  {getEventIcon(event.eventType)}
                </div>

                {/* Event Card */}
                <div className="rounded-2xl border border-slate-850 bg-slate-900/35 p-4.5 shadow-md hover:border-slate-800 hover:bg-slate-900/10 transition space-y-3">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h4 className="font-semibold text-slate-200 text-sm flex items-center gap-1.5 flex-wrap">
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {event.actorName}
                        </span>
                        <span>•</span>
                        <span>{relativeTime}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-550">
                          {event.eventType}
                        </span>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                      {/* Importance */}
                      <span className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded border ${getImportanceBadge(event.importance)}`}>
                        {event.importance}
                      </span>
                      {/* Source */}
                      <span className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded border ${getSourceBadge(event.source)}`}>
                        {event.source}
                      </span>
                    </div>
                  </div>

                  {/* Summary / Description */}
                  {event.description && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/20 border-l border-slate-800 pl-2.5 py-0.5 leading-relaxed whitespace-pre-line">
                      {event.description}
                    </p>
                  )}

                  {/* Metadata display toggler */}
                  <div className="pt-1.5 border-t border-slate-850/60 flex justify-between items-center text-xs">
                    <button
                      onClick={() => toggleExpand(event.id)}
                      className="flex items-center gap-1 font-semibold text-slate-450 hover:text-slate-200 transition"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          View Details
                        </>
                      )}
                    </button>
                  </div>

                  {/* Metadata Expansion Dropdown Pane */}
                  {isExpanded && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2 animate-in fade-in duration-200">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Enriched Metadata</span>
                      
                      {event.eventType === "COMMIT_CREATED" && event.metadata && (
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">SHA</span>
                            <span className="text-slate-300 font-bold truncate">{event.metadata.sha?.substring(0, 7)}</span>
                          </div>
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">Branch</span>
                            <span className="text-slate-350">{event.metadata.branch || "main"}</span>
                          </div>
                        </div>
                      )}

                      {event.eventType.startsWith("PR_") && event.metadata && (
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">PR Number</span>
                            <span className="text-indigo-400 font-bold">#{event.metadata.prNumber}</span>
                          </div>
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">State</span>
                            <span className="text-slate-300">{event.metadata.state}</span>
                          </div>
                          {event.metadata.mergeDurationMinutes && (
                            <div className="col-span-2">
                              <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">Merge Duration</span>
                              <span className="text-slate-300 font-bold">{event.metadata.mergeDurationMinutes} minutes</span>
                            </div>
                          )}
                        </div>
                      )}

                      {event.eventType.startsWith("REVIEW_") && event.metadata && (
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">Reviewer</span>
                            <span className="text-slate-300">{event.metadata.reviewer}</span>
                          </div>
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">PR Title</span>
                            <span className="text-slate-305 truncate">{event.metadata.prTitle}</span>
                          </div>
                          {event.metadata.commentsCount !== undefined && (
                            <div>
                              <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">Comments</span>
                              <span className="text-slate-350">{event.metadata.commentsCount} comments</span>
                            </div>
                          )}
                        </div>
                      )}

                      {event.eventType === "REPOSITORY_SYNCED" && event.metadata && (
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400">
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">Duration</span>
                            <span className="text-slate-300">{event.metadata.durationMs}ms</span>
                          </div>
                          <div>
                            <span className="text-slate-550 block text-[10px] uppercase font-semibold font-sans">Throughput</span>
                            <span className="text-slate-300">+{event.metadata.commitsProcessed} commits, +{event.metadata.prsProcessed} PRs</span>
                          </div>
                        </div>
                      )}

                      {/* Fallback JSON view for unrecognized metadata patterns */}
                      {(!event.eventType.startsWith("PR_") && !event.eventType.startsWith("REVIEW_") && event.eventType !== "COMMIT_CREATED" && event.eventType !== "REPOSITORY_SYNCED") && (
                        <pre className="text-[10px] text-indigo-300 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono max-h-36 bg-slate-950 p-2 rounded-lg border border-slate-900">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Load More Button */}
          {nextCursor && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchEvents(false)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-850 px-5 py-2.5 text-xs font-semibold text-slate-300 border border-slate-800 transition disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                Load More Events
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
