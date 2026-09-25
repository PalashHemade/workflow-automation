"use client";

import React, { useState, useEffect } from "react";
import {
  GitPullRequest,
  AlertCircle,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileCode,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PillTabsList, PillTabsTrigger, Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/core/utils";

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
        <Badge variant="info">
          <GitPullRequest className="h-3 w-3" /> Merged
        </Badge>
      );
    }
    if (pr.state === "open") {
      return (
        <Badge variant="success">
          <Clock className="h-3 w-3" /> Open
        </Badge>
      );
    }
    return (
      <Badge variant="danger">
        <AlertCircle className="h-3 w-3" /> Closed
      </Badge>
    );
  };

  const renderDiffHunk = (hunk: string | null) => {
    if (!hunk) return null;
    return (
      <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-900 bg-slate-950 p-2.5 font-mono text-[10px] leading-tight text-slate-400">
        {hunk}
      </pre>
    );
  };

  if (loading && pulls.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-secondary/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={stateFilter}
        onValueChange={(v) => {
          setStateFilter(v);
          setPage(1);
        }}
      >
        <PillTabsList>
          {["all", "open", "closed", "merged"].map((state) => (
            <PillTabsTrigger key={state} value={state}>
              {state} PRs
            </PillTabsTrigger>
          ))}
        </PillTabsList>
      </Tabs>

      <Card className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <GitPullRequest className="h-4.5 w-4.5 text-violet-500" />
          Pull Request Registry
        </h3>

        {pulls.length === 0 ? (
          <EmptyState
            icon={GitPullRequest}
            title="No pull requests found"
            description="No pull requests found for the selected filter."
          />
        ) : (
          <div className="divide-y divide-border">
            {pulls.map((pr) => {
              const isExpanded = pr.id === expandedId;

              return (
                <div key={pr.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar src={pr.authorAvatar} name={pr.authorName} size="md" className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate pr-2 text-sm font-semibold text-foreground">{pr.title}</p>
                          {getStateBadge(pr)}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary">#{pr.number}</span>
                          <span>by</span>
                          <span className="font-medium">{pr.authorName}</span>
                          <span>•</span>
                          <span>{new Date(pr.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          {pr.files && pr.files.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                                {pr.files.length} changed files
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <IconButton
                      aria-label={isExpanded ? "Collapse pull request" : "Expand pull request"}
                      variant="solid"
                      onClick={() => toggleExpand(pr.id, pr.number)}
                      className={cn("shrink-0", isExpanded && "border-violet-500 text-violet-500")}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </IconButton>
                  </div>

                  {isExpanded && (
                    <div className="ml-12 mt-3 animate-in fade-in space-y-4 border-t border-border pt-3 duration-200">
                      {loadingDetails ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                          <Loader2 className="h-4.5 w-4.5 animate-spin text-violet-500" />
                          <span>Loading PR review timeline...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pr.files && pr.files.length > 0 && (
                            <div className="space-y-2">
                              <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <FileCode className="h-3.5 w-3.5" /> Changed Files ({pr.files.length})
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {pr.files.map((file) => (
                                  <div key={file.id} className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-2.5">
                                    <span className="max-w-[200px] truncate font-mono text-xs text-foreground" title={file.filename}>
                                      {file.filename.split("/").pop()}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] text-muted-foreground">
                                      <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>
                                      <span className="text-rose-600 dark:text-rose-400">-{file.deletions}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-3.5">
                            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              <Eye className="h-3.5 w-3.5" /> Review Timeline ({reviews.length})
                            </p>

                            {reviews.length === 0 ? (
                              <p className="text-xs italic text-muted-foreground">No formal reviews recorded yet.</p>
                            ) : (
                              <div className="relative space-y-4 border-l-2 border-border pl-4">
                                {reviews.map((rev) => {
                                  const isApproved = rev.state === "APPROVED";
                                  const isChangesRequested = rev.state === "CHANGES_REQUESTED";

                                  return (
                                    <div key={rev.id} className="relative space-y-2">
                                      <div
                                        className={cn(
                                          "absolute -left-[21px] top-1 h-2 w-2 rounded-full border",
                                          isApproved
                                            ? "bg-emerald-500 border-emerald-400"
                                            : isChangesRequested
                                            ? "bg-rose-500 border-rose-400"
                                            : "bg-muted-foreground border-border"
                                        )}
                                      />

                                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                          <Avatar src={rev.authorAvatar} name={rev.authorName} size="xs" />
                                          <span className="font-semibold text-foreground">{rev.authorName}</span>
                                          <Badge variant={isApproved ? "success" : isChangesRequested ? "danger" : "secondary"}>
                                            {rev.state.replace("_", " ")}
                                          </Badge>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                          {new Date(rev.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                        </span>
                                      </div>

                                      {rev.body && (
                                        <p className="rounded-xl border border-border bg-secondary/30 p-2.5 text-xs text-foreground">
                                          {rev.body}
                                        </p>
                                      )}

                                      {rev.comments && rev.comments.length > 0 && (
                                        <div className="mt-2 space-y-2 pl-3">
                                          {rev.comments.map((comm) => (
                                            <div key={comm.id} className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
                                              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                                                <span className="flex items-center gap-1 font-semibold">
                                                  <MessageSquare className="h-3 w-3 text-primary" />
                                                  {comm.authorName} commented on{" "}
                                                  <code className="rounded bg-secondary px-1 font-mono text-[10px] text-foreground">
                                                    {comm.path.split("/").pop()}
                                                  </code>
                                                  {comm.line && <span>:L{comm.line}</span>}
                                                </span>
                                                <span>{new Date(comm.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                              </div>

                                              <p className="text-xs text-foreground">{comm.body}</p>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={() => fetchPulls(page - 1, stateFilter)} disabled={page === 1 || loading}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => fetchPulls(page + 1, stateFilter)} disabled={page === totalPages || loading}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
