"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Edit2,
  Save,
  CheckCircle,
  AlertTriangle,
  Database,
  Archive,
  Trash2,
  RefreshCw,
  GitBranch,
  GitCommit,
  GitPullRequest,
  MessageSquare,
  Eye,
  FileCode,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Clock,
  Wifi,
  Activity,
  Heart,
} from "lucide-react";

interface RepoSettingsProps {
  repositoryId: string;
  onRefreshRepos: () => void;
  onSelectTab: (tab: "overview" | "commits" | "pulls" | "branches" | "webhooks" | "settings") => void;
  onDeleteRepo?: (repoId: string) => void;
}

export default function RepoSettings({
  repositoryId,
  onRefreshRepos,
  onSelectTab,
  onDeleteRepo,
}: RepoSettingsProps) {
  const [repo, setRepo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLabel, setSavingLabel] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [togglingTrack, setTogglingTrack] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Settings Inputs
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [pollingInterval, setPollingInterval] = useState(60);
  
  // DB record stats
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Global Cron health stats
  const [systemStatus, setSystemStatus] = useState<any | null>(null);
  const [loadingSystem, setLoadingSystem] = useState(true);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepoData();
    fetchStats();
    fetchSystemStatus();
  }, [repositoryId]);

  const fetchRepoData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/repos");
      if (res.ok) {
        const data = await res.json();
        const found = data.dbRepos.find((r: any) => r.id === repositoryId);
        if (found) {
          setRepo(found);
          setDisplayNameInput(found.displayName || "");
          setPollingInterval(found.pollingInterval || 60);
        }
      }
    } catch (err) {
      console.error("Error fetching repository data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/metrics?repositoryId=${repositoryId}`);
      if (res.ok) {
        const metrics = await res.json();
        setStats(metrics);
      }
    } catch (err) {
      console.error("Error loading metrics for settings stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchSystemStatus = async () => {
    setLoadingSystem(true);
    try {
      const res = await fetch("/api/system/status");
      if (res.ok) {
        const status = await res.json();
        setSystemStatus(status);
      }
    } catch (err) {
      console.error("Error fetching system status:", err);
    } finally {
      setLoadingSystem(false);
    }
  };

  const handleSaveLabel = async () => {
    setSavingLabel(true);
    try {
      const res = await fetch(`/api/repos/${repositoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayNameInput.trim() || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setRepo(data.repository);
        onRefreshRepos();
      }
    } catch (err) {
      console.error("Error saving display label:", err);
    } finally {
      setSavingLabel(false);
    }
  };

  const handleSaveInterval = async (val: number) => {
    setPollingInterval(val);
    setSavingInterval(true);
    try {
      const res = await fetch(`/api/repos/${repositoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollingInterval: val }),
      });
      if (res.ok) {
        const data = await res.json();
        setRepo(data.repository);
        onRefreshRepos();
      }
    } catch (err) {
      console.error("Error saving polling interval:", err);
    } finally {
      setSavingInterval(false);
    }
  };

  const handleToggleArchive = async () => {
    setArchiving(true);
    const targetState = !repo.isArchived;
    try {
      const res = await fetch(`/api/repos/${repositoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: targetState }),
      });
      if (res.ok) {
        const data = await res.json();
        setRepo(data.repository);
        onRefreshRepos();
      }
    } catch (err) {
      console.error("Error toggling archive status:", err);
    } finally {
      setArchiving(false);
    }
  };

  const handleToggleTrack = async () => {
    setTogglingTrack(true);
    const targetState = !repo.isTracked;
    try {
      const res = await fetch(`/api/repos/${repositoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTracked: targetState }),
      });
      if (res.ok) {
        const data = await res.json();
        setRepo(data.repository);
        onRefreshRepos();
      }
    } catch (err) {
      console.error("Error toggling tracking status:", err);
    } finally {
      setTogglingTrack(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId, syncDepth: "incremental" }),
      });
      if (res.ok) {
        // Start polling repository data to see syncStatus change to success/failed
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const checkRes = await fetch("/api/repos");
          if (checkRes.ok) {
            const data = await checkRes.json();
            const found = data.dbRepos.find((r: any) => r.id === repositoryId);
            if (found && found.syncStatus !== "syncing") {
              setRepo(found);
              setSyncing(false);
              clearInterval(interval);
              fetchStats();
              onRefreshRepos();
            }
          }
          if (attempts > 30) {
            setSyncing(false);
            clearInterval(interval);
          }
        }, 3000);
      } else {
        setSyncing(false);
      }
    } catch (err) {
      console.error("Error triggering manual sync:", err);
      setSyncing(false);
    }
  };

  const handleDeleteRepo = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/repos/${repositoryId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShowDeleteModal(false);
        if (onDeleteRepo) {
          onDeleteRepo(repositoryId);
        } else {
          onRefreshRepos();
        }
      } else {
        const err = await res.json();
        setDeleteError(err.error || "Failed to delete repository.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "Network error occurred.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !repo) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Est. size: commits * 0.5KB + PRs * 1KB + Reviews * 0.5KB + Files * 0.2KB etc.
  const estSizeKB = Math.round(
    (stats?.totalCommits || 0) * 0.5 +
    (stats?.totalPrs || 0) * 1.0 +
    (stats?.openPrsCount || 0) * 0.5 + 20
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Repository Settings</h2>
          <p className="text-sm text-slate-400">Configure synchronizations, view stats, and manage repository lifecycle.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Side Cards */}
        <div className="space-y-6">
          {/* Card 1: Details & Custom Label */}
          <div className="rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-indigo-400" />
              Repository Metadata
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-3 text-sm">
                <span className="text-slate-450 font-medium">FullName</span>
                <span className="col-span-2 text-slate-200 truncate font-mono">{repo.fullName}</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="text-slate-450 font-medium">GitHub ID</span>
                <span className="col-span-2 text-slate-200 font-mono">{repo.githubId}</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="text-slate-450 font-medium">HTML URL</span>
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-2 text-indigo-400 hover:underline inline-flex items-center gap-1 truncate"
                >
                  {repo.htmlUrl}
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="border-t border-slate-850 pt-4 space-y-2">
              <label className="text-xs font-semibold text-slate-350 uppercase tracking-wider block">Custom Display Label</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={repo.name}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                />
                <button
                  onClick={handleSaveLabel}
                  disabled={savingLabel}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  {savingLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Sync Status & Control */}
          <div className="rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <RefreshCw className="h-4.5 w-4.5 text-emerald-400" />
              Synchronization & Polling
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-850 bg-slate-900/50 p-4 space-y-1">
                <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider">Sync Method</span>
                <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                  {repo.webhookEnabled ? (
                    <>
                      <Wifi className="h-4 w-4 text-emerald-500" />
                      GitHub Webhook
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4 text-amber-500" />
                      Scheduled Polling
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-850 bg-slate-900/50 p-4 space-y-1">
                <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider">Sync Status</span>
                <div className="flex items-center gap-1.5 font-bold text-sm text-white">
                  {repo.syncStatus === "syncing" && (
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Syncing...
                    </span>
                  )}
                  {repo.syncStatus === "success" && (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle className="h-4 w-4" /> Success
                    </span>
                  )}
                  {repo.syncStatus === "failed" && (
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <AlertTriangle className="h-4 w-4" /> Failed
                    </span>
                  )}
                  {repo.syncStatus === "idle" && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="h-4 w-4" /> Idle
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm border-t border-slate-850 pt-4">
              <div className="flex justify-between">
                <span className="text-slate-450">Last Successful Sync</span>
                <span className="text-slate-200 font-medium">
                  {repo.lastSuccessfulSyncAt
                    ? new Date(repo.lastSuccessfulSyncAt).toLocaleString()
                    : repo.lastSyncedAt
                    ? new Date(repo.lastSyncedAt).toLocaleString()
                    : "Never"}
                </span>
              </div>

              {repo.lastFailedSyncAt && (
                <div className="flex justify-between">
                  <span className="text-slate-450">Last Failed Sync</span>
                  <span className="text-rose-400 font-medium">
                    {new Date(repo.lastFailedSyncAt).toLocaleString()}
                  </span>
                </div>
              )}

              {repo.lastSyncError && (
                <div className="rounded-lg bg-rose-950/20 border border-rose-900/60 p-3 space-y-1">
                  <span className="text-xs font-semibold text-rose-300 block">Failure Details:</span>
                  <p className="text-xs text-rose-450 font-mono break-words">{repo.lastSyncError}</p>
                </div>
              )}

              {repo.nextAllowedSyncAt && (
                <div className="flex justify-between text-xs border-t border-dashed border-slate-850 pt-2.5">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-500 animate-pulse" />
                    Backoff Cooldown Active
                  </span>
                  <span className="text-amber-400 font-mono">
                    Allowed after: {new Date(repo.nextAllowedSyncAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* Polling Interval Dropdown */}
            {!repo.webhookEnabled && (
              <div className="border-t border-slate-850 pt-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-350 uppercase tracking-wider block">Polling Interval</span>
                  <span className="text-xs text-slate-500">How often background cron polls changes</span>
                </div>
                <div className="flex items-center gap-2">
                  {savingInterval && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                  <select
                    value={pollingInterval}
                    onChange={(e) => handleSaveInterval(Number(e.target.value))}
                    disabled={savingInterval}
                    className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={120}>2 Hours</option>
                  </select>
                </div>
              </div>
            )}

            {/* Manual Sync Button */}
            <div className="pt-2">
              <button
                onClick={handleSyncNow}
                disabled={syncing || repo.syncStatus === "syncing"}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {syncing || repo.syncStatus === "syncing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Sync Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side Cards */}
        <div className="space-y-6">
          {/* Card 3: Repo Statistics & Storage */}
          <div className="rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Database className="h-4.5 w-4.5 text-violet-400" />
              Storage & DB Statistics
            </h3>

            {loadingStats ? (
              <div className="flex h-44 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="rounded-xl border border-slate-850 bg-slate-900/40 p-3 flex items-center gap-3">
                    <GitCommit className="h-5 w-5 text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Commits</p>
                      <p className="text-base font-bold text-white">{stats?.totalCommits || 0}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-850 bg-slate-900/40 p-3 flex items-center gap-3">
                    <GitPullRequest className="h-5 w-5 text-purple-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">PRs</p>
                      <p className="text-base font-bold text-white">{stats?.totalPrs || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5 border-t border-slate-850 pt-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-450 flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-blue-400" />
                      Active Branches
                    </span>
                    <span className="text-slate-200 font-mono font-medium">Synced</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-450 flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-emerald-400" />
                      Est. DB Storage Usage
                    </span>
                    <span className="text-slate-200 font-mono font-semibold">
                      ~ {estSizeKB} KB
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Global Background Scheduler Health */}
          <div className="rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Heart className="h-4.5 w-4.5 text-rose-500" />
              Stateless Background Cron Health
            </h3>

            {loadingSystem ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-455">Service Health</span>
                  <div className="flex items-center gap-1.5">
                    {systemStatus?.health?.status === "healthy" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 border border-emerald-700/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-450">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Healthy
                      </span>
                    )}
                    {systemStatus?.health?.status === "degraded" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 border border-amber-700/40 px-2.5 py-0.5 text-xs font-semibold text-amber-450">
                        Degraded
                      </span>
                    )}
                    {systemStatus?.health?.status === "failing" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-950 border border-rose-700/40 px-2.5 py-0.5 text-xs font-semibold text-rose-450">
                        Failing
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-450">Last Active Execution</span>
                  <span className="text-slate-200 font-medium">
                    {systemStatus?.health?.lastRunAt
                      ? new Date(systemStatus.health.lastRunAt).toLocaleString()
                      : "Never run"}
                  </span>
                </div>

                {systemStatus?.rateLimit?.remaining !== null && (
                  <div className="flex justify-between border-t border-dashed border-slate-850 pt-2.5 text-xs">
                    <span className="text-slate-400">GitHub API Rate Limit</span>
                    <span className="text-indigo-300 font-mono">
                      {systemStatus.rateLimit.remaining} remaining
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 5: Lifecycle Actions */}
          <div className="rounded-2xl border border-rose-950/20 bg-rose-950/5 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-rose-400 flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5" />
              Danger Zone / Repository Lifecycle
            </h3>

            <p className="text-xs text-rose-300/80 leading-relaxed">
              Archive repositories to preserve historical logs without updates, toggle active tracking, or permanently delete the repository from the database.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Archive Toggle */}
              <button
                onClick={handleToggleArchive}
                disabled={archiving}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 transition"
              >
                <Archive className="h-3.5 w-3.5" />
                {repo.isArchived ? "Unarchive" : "Archive"} Repo
              </button>

              {/* Track Toggle */}
              <button
                onClick={handleToggleTrack}
                disabled={togglingTrack}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 transition"
              >
                <Clock className="h-3.5 w-3.5" />
                {repo.isTracked ? "Stop Polling" : "Resume Polling"}
              </button>
            </div>

            {/* Permanent Delete */}
            <div className="border-t border-rose-950/30 pt-4">
              <button
                onClick={() => {
                  setConfirmName("");
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-650/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white px-4 py-2.5 text-sm font-semibold transition"
              >
                <Trash2 className="h-4 w-4" />
                Permanently Delete Repository
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-rose-900 bg-slate-950 p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h4 className="text-lg font-bold text-rose-450 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Destructive Action Confirmation
            </h4>

            <p className="text-xs text-slate-400 leading-relaxed">
              This action is <strong className="text-white">permanent and irreversible</strong>. It will delete:
            </p>

            <ul className="text-xs text-rose-300/80 list-disc pl-5 space-y-1 font-medium">
              <li>Repository webhook on GitHub (if active)</li>
              <li>All commits ({stats?.totalCommits || 0}) and commit files</li>
              <li>All pull requests ({stats?.totalPrs || 0}) and reviews/comments</li>
              <li>All active branches and event streams</li>
              <li>All historical analytics data</li>
            </ul>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-450 uppercase tracking-wider block">
                Type the repository full name <code className="bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded font-mono">{repo.fullName}</code> to confirm:
              </label>
              <input
                type="text"
                placeholder={repo.fullName}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="w-full rounded-xl border border-rose-950/60 bg-rose-950/5 px-3.5 py-2.5 text-sm text-white placeholder-slate-650 outline-none focus:border-rose-500 transition"
              />
            </div>

            {deleteError && (
              <p className="text-xs text-rose-455 font-semibold bg-rose-950/30 border border-rose-900 rounded-lg p-2.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {deleteError}
              </p>
            )}

            <div className="flex gap-3 pt-2.5">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-350 hover:bg-slate-850 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRepo}
                disabled={confirmName !== repo.fullName || deleting}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 disabled:cursor-not-allowed px-4 py-2.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
