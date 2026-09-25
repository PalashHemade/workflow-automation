"use client";

import React, { useState, useEffect } from "react";
import { GitCommit, ChevronDown, ChevronUp, Loader2, FileCode, Plus, Minus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/core/utils";

interface Contributor {
  name: string | null;
  avatarUrl: string | null;
}

interface Commit {
  id: string;
  sha: string;
  message: string;
  url: string;
  committedAt: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string | null;
  contributor: Contributor | null;
}

interface CommitFile {
  id: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

interface CommitListProps {
  repositoryId: string;
}

export default function CommitList({ repositoryId }: CommitListProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedSha, setExpandedSha] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<CommitFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    fetchCommits(1);
  }, [repositoryId]);

  const fetchCommits = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/commits?repositoryId=${repositoryId}&page=${p}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setCommits(data.commits || []);
        setPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      console.error("Error fetching commits:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (sha: string) => {
    if (expandedSha === sha) {
      setExpandedSha(null);
      setExpandedFiles([]);
      return;
    }

    setExpandedSha(sha);
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/commits/${sha}/files?repositoryId=${repositoryId}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Error fetching commit files:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const renderPatch = (patch: string | null) => {
    if (!patch) return <div className="p-3 text-xs italic text-muted-foreground">No patch available for this file.</div>;

    return (
      <pre className="max-h-[300px] overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-300">
        {patch.split("\n").map((line, idx) => {
          let lineClass = "text-slate-400";
          if (line.startsWith("+")) lineClass = "text-emerald-400 bg-emerald-950/20 px-1 border-l-2 border-emerald-500";
          else if (line.startsWith("-")) lineClass = "text-rose-400 bg-rose-950/20 px-1 border-l-2 border-rose-500";
          else if (line.startsWith("@@")) lineClass = "text-indigo-400 font-bold bg-indigo-950/10";

          return (
            <div key={idx} className={cn(lineClass, "select-text whitespace-pre-wrap")}>
              {line}
            </div>
          );
        })}
      </pre>
    );
  };

  if (loading && commits.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-secondary/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <GitCommit className="h-4.5 w-4.5 text-primary" />
        Commit History Log
      </h3>

      {commits.length === 0 ? (
        <EmptyState
          icon={GitCommit}
          title="No commits tracked"
          description="Commits will appear here once this repository has synced."
        />
      ) : (
        <div className="divide-y divide-border">
          {commits.map((commit) => {
            const isExpanded = commit.sha === expandedSha;

            return (
              <div key={commit.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar src={commit.authorAvatar} name={commit.authorName} size="md" className="mt-0.5" />
                    <div className="min-w-0">
                      <p className="truncate pr-2 text-sm font-semibold text-foreground">
                        {commit.message.split("\n")[0]}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium">{commit.authorName}</span>
                        <span>•</span>
                        <span>
                          {new Date(commit.committedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>•</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                          {commit.sha.substring(0, 7)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <IconButton
                    aria-label={isExpanded ? "Collapse commit" : "Expand commit"}
                    variant="solid"
                    onClick={() => toggleExpand(commit.sha)}
                    className={cn("shrink-0", isExpanded && "border-primary text-primary")}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </IconButton>
                </div>

                {isExpanded && (
                  <div className="ml-12 mt-3 animate-in fade-in space-y-4 border-t border-border pt-3 duration-200">
                    {loadingFiles ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                        <span>Loading file diffs...</span>
                      </div>
                    ) : expandedFiles.length === 0 ? (
                      <p className="text-xs italic text-muted-foreground">No file modifications recorded for this commit.</p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Changed Files ({expandedFiles.length})
                        </p>
                        <div className="space-y-2.5">
                          {expandedFiles.map((file) => (
                            <div key={file.id} className="overflow-hidden rounded-xl border border-border">
                              <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2.5">
                                <div className="flex min-w-0 items-center gap-2 pr-2">
                                  <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <span className="truncate font-mono text-xs text-foreground" title={file.filename}>
                                    {file.filename}
                                  </span>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] capitalize",
                                      file.status === "added"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : file.status === "removed"
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                        : "bg-secondary text-muted-foreground"
                                    )}
                                  >
                                    {file.status}
                                  </span>
                                </div>

                                <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
                                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                    <Plus className="h-3 w-3" />
                                    {file.additions}
                                  </span>
                                  <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                                    <Minus className="h-3 w-3" />
                                    {file.deletions}
                                  </span>
                                </div>
                              </div>

                              {renderPatch(file.patch)}
                            </div>
                          ))}
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
          <Button variant="outline" size="sm" onClick={() => fetchCommits(page - 1)} disabled={page === 1 || loading}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => fetchCommits(page + 1)} disabled={page === totalPages || loading}>
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}
