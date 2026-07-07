"use client";

import React, { useState, useEffect } from "react";
import {
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileCode,
  CornerDownRight,
  Eye,
} from "lucide-react";

interface Contributor {
  name: string | null;
  avatarUrl: string | null;
}

interface PRFile {
  id: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

interface PRReviewComment {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  path: string;
  line: number | null;
  body: string;
  diffHunk: string | null;
  createdAt: string;
}

interface PRReview {
  id: string;
  state: string;
  body: string | null;
  submittedAt: string;
  authorName: string;
  authorAvatar: string | null;
  comments: PRReviewComment[];
}

interface PullRequest {
  id: string;
  githubId: string;
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  merged: boolean;
  authorName: string;
  authorAvatar: string | null;
  contributor: Contributor | null;
  files: PRFile[];
}

interface PullRequestListProps {
  repositoryId: string;
}

export default function PullRequestList({ repositoryId }: PullRequestListProps) {
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [stateFilter, setStateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Expanded timeline reviews & comments
  const [reviews, setReviews] = useState<PRReview[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchPulls(1, stateFilter);
  }, [repositoryId, stateFilter]);

  const fetchPulls = async (p: number, state: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pulls?repositoryId=${repositoryId}&page=${p}&limit=10&state=${state}`);
      if (res.ok) {
        const data = await res.json();
        setPulls(data.pulls || []);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      console.error("Error fetching PRs:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (id: string, number: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setReviews([]);
      return;
    }

    setExpandedId(id);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/pulls/${number}/reviews?repositoryId=${repositoryId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.pullRequest?.reviews || []);
      }
    } catch (err) {
      console.error("Error fetching PR reviews:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStateBadge = (pr: PullRequest) => {
    if (pr.merged) {
      return (
        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-950/60 text-purple-400 border border-purple-800/40">
          <GitPullRequest className="h-3 w-3" />
          Merged
        </span>
      );
    }
    if (pr.state === "open") {
      return (
        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
          <Clock className="h-3 w-3" />
          Open
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/40">
        <AlertCircle className="h-3 w-3" />
        Closed
      </span>
    );
  };

  const renderDiffHunk = (hunk: string | null) => {
    if (!hunk) return null;
    return (
      <pre className="text-[10px] font-mono p-2.5 overflow-x-auto bg-slate-950 text-slate-400 rounded-lg leading-tight border border-slate-900 mt-2">
        {hunk}
      </pre>
    );
  };

  if (loading && pulls.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/30">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* State filters */}
      <div className="flex items-center gap-2">
        {["all", "open", "closed", "merged"].map((state) => (
          <button
            key={state}
            onClick={() => {
              setStateFilter(state);
              setPage(1);
            }}
            className={`text-xs px-3.5 py-1.5 rounded-lg border font-semibold capitalize transition
              ${stateFilter === state 
                ? "bg-indigo-600 border-indigo-500 text-white" 
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
          >
            {state} PRs
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-850 bg-slate-900/20 p-5 shadow-lg space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <GitPullRequest className="h-4.5 w-4.5 text-purple-400" />
          Pull Request Registry
        </h3>

        {pulls.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No matching pull requests found.</div>
        ) : (
          <div className="divide-y divide-slate-850">
            {pulls.map((pr) => {
              const isExpanded = pr.id === expandedId;

              return (
                <div key={pr.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src={pr.authorAvatar || "https://github.com/identicons/git.png"}
                        alt={pr.authorName}
                        className="h-9 w-9 rounded-xl border border-slate-700 bg-slate-800 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <p className="font-semibold text-sm text-slate-200 truncate pr-2">
                            {pr.title}
                          </p>
                          {getStateBadge(pr)}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1">
                          <span className="font-semibold text-indigo-400">#{pr.number}</span>
                          <span>by</span>
                          <span className="font-medium text-slate-400">{pr.authorName}</span>
                          <span>•</span>
                          <span>
                            {new Date(pr.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                          {pr.files && pr.files.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-[10px] text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                                {pr.files.length} changed files
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(pr.id, pr.number)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white transition shrink-0
                        ${isExpanded ? "border-purple-500 text-purple-400" : ""}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expanded Timeline & Files */}
                  {isExpanded && (
                    <div className="pl-12 pt-2 border-t border-slate-850/60 mt-3 space-y-4 animate-in fade-in duration-200">
                      {loadingDetails ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                          <Loader2 className="h-4.5 w-4.5 animate-spin text-purple-400" />
                          <span>Loading PR review timeline...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Changed Files list */}
                          {pr.files && pr.files.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <FileCode className="h-3.5 w-3.5" /> Changed Files ({pr.files.length})
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {pr.files.map((file) => (
                                  <div key={file.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 flex items-center justify-between">
                                    <span className="text-xs font-mono text-slate-300 truncate max-w-[200px]" title={file.filename}>
                                      {file.filename.split("/").pop()}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 shrink-0">
                                      <span className="text-emerald-450">+{file.additions}</span>
                                      <span className="text-rose-450">-{file.deletions}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Reviews and Timeline comments */}
                          <div className="space-y-3.5">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" /> Review Timeline ({reviews.length})
                            </p>
                            
                            {reviews.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No formal reviews recorded yet.</p>
                            ) : (
                              <div className="relative border-l-2 border-slate-800 pl-4 space-y-4">
                                {reviews.map((rev) => {
                                  // Determine status badge color
                                  let stateColor = "text-slate-400 bg-slate-900 border-slate-800";
                                  if (rev.state === "APPROVED") stateColor = "text-emerald-450 bg-emerald-950/20 border-emerald-900/30";
                                  else if (rev.state === "CHANGES_REQUESTED") stateColor = "text-rose-450 bg-rose-950/20 border-rose-900/30";

                                  return (
                                    <div key={rev.id} className="relative space-y-2">
                                      {/* Indicator dot */}
                                      <div className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full border
                                        ${rev.state === "APPROVED" ? "bg-emerald-500 border-emerald-400" : 
                                          rev.state === "CHANGES_REQUESTED" ? "bg-rose-500 border-rose-450" : 
                                          "bg-slate-700 border-slate-600"}`} 
                                      />

                                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                          <img
                                            src={rev.authorAvatar || "https://github.com/identicons/git.png"}
                                            alt={rev.authorName}
                                            className="h-6 w-6 rounded-lg bg-slate-800 border border-slate-700 object-cover"
                                          />
                                          <span className="font-semibold text-slate-300">{rev.authorName}</span>
                                          <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold capitalize ${stateColor}`}>
                                            {rev.state.replace("_", " ")}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500">
                                          {new Date(rev.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                        </span>
                                      </div>

                                      {rev.body && (
                                        <p className="text-xs text-slate-400 bg-slate-950/30 border border-slate-850 p-2.5 rounded-xl">
                                          {rev.body}
                                        </p>
                                      )}

                                      {/* Inline Comments on Review */}
                                      {rev.comments && rev.comments.length > 0 && (
                                        <div className="pl-3 space-y-2 mt-2">
                                          {rev.comments.map((comm) => (
                                            <div key={comm.id} className="rounded-xl border border-slate-850 bg-slate-900/10 p-3 space-y-2">
                                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                <span className="flex items-center gap-1 font-semibold text-slate-400">
                                                  <MessageSquare className="h-3 w-3 text-indigo-400" />
                                                  {comm.authorName} commented on <code className="bg-slate-950 text-[10px] px-1 rounded text-slate-300 font-mono">{comm.path.split("/").pop()}</code>
                                                  {comm.line && <span>:L{comm.line}</span>}
                                                </span>
                                                <span>
                                                  {new Date(comm.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                                </span>
                                              </div>

                                              <p className="text-xs text-slate-300">{comm.body}</p>
                                              
                                              {/* Diff hunk */}
                                              {renderDiffHunk(comm.diffHunk)}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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
              onClick={() => fetchPulls(page - 1, stateFilter)}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => fetchPulls(page + 1, stateFilter)}
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
