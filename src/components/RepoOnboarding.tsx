"use client";

import React, { useState, useCallback } from "react";
import {
  Plus,
  Loader2,
  Search,
  ExternalLink,
  ShieldAlert,
  Link2,
  AlertTriangle,
  Star,
  GitFork,
  HardDrive,
  Zap,
  Database,
  X,
  CheckCircle2,
} from "lucide-react";

interface DBRepo {
  id: string;
  githubId: string;
  name: string;
  owner: string;
  fullName: string;
  htmlUrl: string;
  isTracked: boolean;
  webhookEnabled: boolean;
  displayName?: string | null;
  isArchived?: boolean;
  syncStatus?: string;
}

interface GitHubRepo {
  githubId: number;
  name: string;
  owner: string;
  fullName: string;
  htmlUrl: string;
}

interface RepoInfo {
  name: string;
  owner: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  sizeKB: number;
  isLarge: boolean;
  isPrivate: boolean;
  htmlUrl: string;
}

interface RepoOnboardingProps {
  dbRepos: DBRepo[];
  githubRepos: GitHubRepo[];
  selectedRepoId: string | null;
  onSelectRepo: (id: string) => void;
  onTrackRepo: (owner: string, name: string, maxPages?: number) => Promise<void>;
  syncingRepoId: string | null;
}

/** Parses a GitHub URL or owner/name slug into { owner, name } */
function parseGitHubInput(input: string): { owner: string; name: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Full URL: https://github.com/owner/repo or https://github.com/owner/repo.git
  try {
    const url = new URL(trimmed);
    if (url.hostname === "github.com") {
      const parts = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { owner: parts[0], name: parts[1] };
      }
    }
  } catch {
    // Not a URL — try slug format
  }

  // Slug: owner/repo or owner/repo.git
  const slugMatch = trimmed.replace(/\.git$/, "").match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slugMatch) {
    return { owner: slugMatch[1], name: slugMatch[2] };
  }

  return null;
}

function formatBytes(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(2)} GB`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function RepoOnboarding({
  dbRepos,
  githubRepos,
  selectedRepoId,
  onSelectRepo,
  onTrackRepo,
  syncingRepoId,
}: RepoOnboardingProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [parsedRepo, setParsedRepo] = useState<{ owner: string; name: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [onboardingExt, setOnboardingExt] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  // Warning modal state: null = no modal, 'show' = showing warning
  const [warningModalRepo, setWarningModalRepo] = useState<RepoInfo | null>(null);

  const handleUrlChange = useCallback((value: string) => {
    setUrlInput(value);
    setInfoError(null);
    setTrackError(null);
    setRepoInfo(null);
    setWarningModalRepo(null);

    if (!value.trim()) {
      setParsedRepo(null);
      setParseError(null);
      return;
    }

    const parsed = parseGitHubInput(value);
    if (parsed) {
      setParsedRepo(parsed);
      setParseError(null);
    } else {
      setParsedRepo(null);
      setParseError("Enter a valid GitHub URL (e.g. https://github.com/owner/repo) or slug (owner/repo)");
    }
  }, []);

  const handleCheckRepo = async () => {
    if (!parsedRepo) return;
    setFetchingInfo(true);
    setInfoError(null);
    setRepoInfo(null);

    try {
      const res = await fetch(
        `/api/repos/info?owner=${encodeURIComponent(parsedRepo.owner)}&name=${encodeURIComponent(parsedRepo.name)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setInfoError(data.error || "Failed to fetch repository info.");
        return;
      }

      setRepoInfo(data as RepoInfo);

      // If large, show the warning modal; otherwise go straight to onboarding
      if (data.isLarge) {
        setWarningModalRepo(data as RepoInfo);
      } else {
        await startTracking(parsedRepo.owner, parsedRepo.name, 3);
      }
    } catch (err: any) {
      setInfoError(err.message || "Network error fetching repository info.");
    } finally {
      setFetchingInfo(false);
    }
  };

  const startTracking = async (owner: string, name: string, maxPages: number) => {
    setWarningModalRepo(null);
    setOnboardingExt(true);
    setTrackError(null);

    try {
      await onTrackRepo(owner, name, maxPages);
      setUrlInput("");
      setParsedRepo(null);
      setRepoInfo(null);
    } catch (err: any) {
      setTrackError(err.message || "Failed to onboard repository.");
    } finally {
      setOnboardingExt(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedRepo || fetchingInfo || onboardingExt) return;
    await handleCheckRepo();
  };

  // Filter owned GitHub repos
  const filteredGitHubRepos = githubRepos.filter((r) => {
    const alreadyRegistered = dbRepos.some(
      (dbR) => String(dbR.githubId) === String(r.githubId)
    );
    if (alreadyRegistered) return false;
    return r.fullName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const isSubmitDisabled = !parsedRepo || !!parseError || fetchingInfo || onboardingExt;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* ─── Column 1: Tracked Repositories ─── */}
      <div className="md:col-span-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
        <h3 className="text-lg font-semibold text-white mb-1">Tracked Repositories</h3>
        <p className="text-xs text-slate-400 mb-4">Select a repository to view analytics</p>

        {dbRepos.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
            <ShieldAlert className="h-8 w-8 mb-2 text-slate-600" />
            <p className="text-xs">No repositories tracked yet.</p>
            <p className="text-[10px] text-slate-600 mt-1">
              Add one from your GitHub list or paste a URL below.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[360px] pr-2">
            {dbRepos.map((repo) => {
              const isSelected = repo.id === selectedRepoId;
              const isSyncing = syncingRepoId === repo.id || repo.syncStatus === "syncing";
              const isFailed = repo.syncStatus === "failed";
              const isArchived = repo.isArchived;

              return (
                <button
                  key={repo.id}
                  onClick={() => onSelectRepo(repo.id)}
                  className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-950/20 text-indigo-200"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold truncate text-sm text-white">
                        {repo.displayName || repo.name}
                      </p>
                      {isArchived && (
                        <span className="shrink-0 text-[9px] uppercase tracking-wider bg-slate-800 border border-slate-750 text-slate-400 px-1 rounded">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{repo.owner}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSyncing && <Loader2 className="h-4 w-4 animate-spin text-indigo-455" />}
                    {!isSyncing && isFailed && (
                      <span className="inline-block h-2 w-2 rounded-full bg-rose-500" title="Last sync failed" />
                    )}
                    {!isSyncing && !isFailed && repo.isTracked && !isArchived && (
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                    {!isSyncing && !isFailed && (!repo.isTracked || isArchived) && (
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Columns 2 & 3: Onboarding panels ─── */}
      <div className="md:col-span-2 flex flex-col gap-6">

        {/* ── URL Input Panel ── */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Link2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white leading-tight">Track Any GitHub Repository</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Paste a full URL or <code className="bg-slate-800 px-1 rounded text-slate-300">owner/repo</code> slug — public or your own.
              </p>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div className="relative">
              <input
                id="repo-url-input"
                type="text"
                placeholder="https://github.com/torvalds/linux  or  torvalds/linux"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={onboardingExt || fetchingInfo}
                className={`w-full rounded-xl border px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition pr-36
                  ${parseError && urlInput
                    ? "border-rose-500/60 bg-rose-950/10 focus:border-rose-500"
                    : parsedRepo
                    ? "border-emerald-500/40 bg-slate-950 focus:border-emerald-400"
                    : "border-slate-800 bg-slate-950 focus:border-indigo-500"
                  }`}
              />
              {/* Live parse preview badge */}
              {parsedRepo && !parseError && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-emerald-950/60 border border-emerald-700/40 px-2.5 py-1 text-[11px] font-mono text-emerald-300 pointer-events-none">
                  <CheckCircle2 className="h-3 w-3" />
                  {parsedRepo.owner}/{parsedRepo.name}
                </span>
              )}
            </div>

            {parseError && urlInput && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {parseError}
              </p>
            )}

            <button
              id="track-repo-btn"
              type="submit"
              disabled={isSubmitDisabled}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {fetchingInfo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking repo…
                </>
              ) : onboardingExt ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Track Repository
                </>
              )}
            </button>

            {(infoError || trackError) && (
              <p className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900 rounded-lg p-2.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {infoError || trackError}
              </p>
            )}
          </form>

          {/* ── Large Repo Warning Modal (inline) ── */}
          {warningModalRepo && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-4 relative animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Close button */}
              <button
                onClick={() => { setWarningModalRepo(null); setRepoInfo(null); }}
                className="absolute top-3 right-3 text-slate-500 hover:text-white transition"
                aria-label="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-300 text-sm">Large Repository Detected</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <strong className="text-white">{warningModalRepo.fullName}</strong> is a very large repo.
                    Syncing will consume GitHub API rate limits (5,000 req/hr for authenticated users).
                  </p>
                </div>
              </div>

              {/* Repo Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Star className="h-3.5 w-3.5 text-yellow-400" />
                    <span className="text-[10px] uppercase tracking-wider">Stars</span>
                  </div>
                  <span className="text-base font-bold text-white">
                    {formatNumber(warningModalRepo.stargazersCount)}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <HardDrive className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-[10px] uppercase tracking-wider">Disk Size</span>
                  </div>
                  <span className="text-base font-bold text-white">
                    {formatBytes(warningModalRepo.sizeKB)}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <GitFork className="h-3.5 w-3.5 text-violet-400" />
                    <span className="text-[10px] uppercase tracking-wider">Forks</span>
                  </div>
                  <span className="text-base font-bold text-white">
                    {formatNumber(warningModalRepo.forksCount)}
                  </span>
                </div>
              </div>

              {warningModalRepo.description && (
                <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-3">
                  {warningModalRepo.description}
                </p>
              )}

              {/* Sync Options */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Choose Sync Depth</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Quick Sync */}
                  <button
                    id="quick-sync-btn"
                    onClick={() => startTracking(warningModalRepo.owner, warningModalRepo.name, 3)}
                    disabled={onboardingExt}
                    className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left hover:border-indigo-500/50 hover:bg-indigo-950/20 transition group disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition">
                      <Zap className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Quick Sync</p>
                      <p className="text-xs text-slate-400 mt-0.5">Last ~300 commits & PRs (3 pages). Fast and safe for rate limits.</p>
                    </div>
                  </button>

                  {/* Deep Sync */}
                  <button
                    id="deep-sync-btn"
                    onClick={() => startTracking(warningModalRepo.owner, warningModalRepo.name, 10)}
                    disabled={onboardingExt}
                    className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-left hover:border-amber-500/50 hover:bg-amber-950/20 transition group disabled:opacity-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 group-hover:bg-amber-500/20 transition">
                      <Database className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Deep Sync</p>
                      <p className="text-xs text-slate-400 mt-0.5">Last ~1,000 commits & PRs (10 pages). Longer — uses more API quota.</p>
                    </div>
                  </button>
                </div>
              </div>

              {trackError && (
                <p className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900 rounded-lg p-2.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {trackError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Your GitHub Repos panel ── */}
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Your GitHub Repositories</h3>
              <p className="text-xs text-slate-400">Quick-start tracking from your personal repository registry</p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition w-full sm:w-56"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[220px] pr-2 space-y-2">
            {filteredGitHubRepos.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                {searchQuery
                  ? "No matching repositories found."
                  : "No untracked repositories remaining."}
              </div>
            ) : (
              filteredGitHubRepos.map((repo) => (
                <div
                  key={repo.githubId}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/20 p-3 hover:border-slate-700 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-200 text-sm truncate">{repo.name}</span>
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-300 transition"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <span className="text-xs text-slate-500">{repo.fullName}</span>
                  </div>

                  <button
                    onClick={() => onTrackRepo(repo.owner, repo.name, 3)}
                    className="flex items-center gap-1 text-xs font-semibold bg-indigo-650/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg px-3 py-1.5 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Track
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
