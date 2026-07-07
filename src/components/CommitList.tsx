"use client";

import React, { useState, useEffect } from "react";
import { GitCommit, ChevronDown, ChevronUp, Loader2, FileCode, Plus, Minus } from "lucide-react";

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

  // Helper to render diff patch cleanly
  const renderPatch = (patch: string | null) => {
    if (!patch) return <div className="text-slate-500 italic p-3 text-xs">No patch available for this file.</div>;

    return (
      <pre className="text-[11px] font-mono p-4 overflow-x-auto bg-slate-950 text-slate-300 rounded-xl leading-relaxed max-h-[300px]">
        {patch.split("\n").map((line, idx) => {
          let lineClass = "text-slate-400";
          if (line.startsWith("+")) lineClass = "text-emerald-400 bg-emerald-950/20 px-1 border-l-2 border-emerald-500";
          else if (line.startsWith("-")) lineClass = "text-rose-400 bg-rose-950/20 px-1 border-l-2 border-rose-500";
          else if (line.startsWith("@@")) lineClass = "text-indigo-400 font-bold bg-indigo-950/10";
          
          return (
            <div key={idx} className={`${lineClass} select-text whitespace-pre-wrap`}>
              {line}
            </div>
          );
        })}
      </pre>
    );
  };

  if (loading && commits.length === 0) {
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
          <GitCommit className="h-4.5 w-4.5 text-indigo-400" />
          Commit History Log
        </h3>

        {commits.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No commits tracked for this repository.</div>
        ) : (
          <div className="divide-y divide-slate-850">
            {commits.map((commit) => {
              const isExpanded = commit.sha === expandedSha;

              return (
                <div key={commit.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src={commit.authorAvatar || "https://github.com/identicons/git.png"}
                        alt={commit.authorName}
                        className="h-9 w-9 rounded-xl border border-slate-700 bg-slate-800 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-200 truncate pr-2">
                          {commit.message.split("\n")[0]}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1">
                          <span className="font-medium text-slate-400 hover:underline cursor-pointer">
                            {commit.authorName}
                          </span>
                          <span>•</span>
                          <span>{new Date(commit.committedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded text-[10px]">
                            {commit.sha.substring(0, 7)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(commit.sha)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white transition shrink-0
                        ${isExpanded ? "border-indigo-500 text-indigo-400" : ""}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Expanded Commit Details & File Diffs */}
                  {isExpanded && (
                    <div className="pl-12 pt-1 border-t border-slate-850/60 mt-3 space-y-4 animate-in fade-in duration-200">
                      {loadingFiles ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                          <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-400" />
                          <span>Loading file diffs from DB...</span>
                        </div>
                      ) : expandedFiles.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No file modifications recorded for this commit.</p>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Changed Files ({expandedFiles.length})</p>
                          <div className="space-y-2.5">
                            {expandedFiles.map((file) => (
                              <div key={file.id} className="rounded-xl border border-slate-800/80 bg-slate-950/20 overflow-hidden">
                                {/* File Header */}
                                <div className="flex items-center justify-between bg-slate-950/60 px-4 py-2.5 border-b border-slate-800/60">
                                  <div className="flex items-center gap-2 min-w-0 pr-2">
                                    <FileCode className="h-4 w-4 text-slate-400 shrink-0" />
                                    <span className="font-mono text-xs text-slate-200 truncate" title={file.filename}>
                                      {file.filename}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono capitalize shrink-0
                                      ${file.status === "added" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-700/30" : 
                                        file.status === "removed" ? "bg-rose-950/60 text-rose-400 border border-rose-700/30" : 
                                        "bg-slate-900 text-slate-400"}`}
                                    >
                                      {file.status}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                                    <span className="flex items-center gap-0.5 text-emerald-400">
                                      <Plus className="h-3 w-3" />
                                      {file.additions}
                                    </span>
                                    <span className="flex items-center gap-0.5 text-rose-400">
                                      <Minus className="h-3 w-3" />
                                      {file.deletions}
                                    </span>
                                  </div>
                                </div>

                                {/* File Patch/Diff */}
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-850">
            <button
              onClick={() => fetchCommits(page - 1)}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => fetchCommits(page + 1)}
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
