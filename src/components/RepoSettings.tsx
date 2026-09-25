"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
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
  FileCode,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Clock,
  Wifi,
  Activity,
  Heart,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from "@/components/ui/Modal";

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

  const [displayNameInput, setDisplayNameInput] = useState("");
  const [pollingInterval, setPollingInterval] = useState(60);

  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [systemStatus, setSystemStatus] = useState<any | null>(null);
  const [loadingSystem, setLoadingSystem] = useState(true);

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
      <div className="flex h-96 items-center justify-center rounded-xl border border-border bg-secondary/30">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const estSizeKB = Math.round(
    (stats?.totalCommits || 0) * 0.5 + (stats?.totalPrs || 0) * 1.0 + (stats?.openPrsCount || 0) * 0.5 + 20
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Repository Settings</h2>
        <p className="text-sm text-muted-foreground">Configure synchronizations, view stats, and manage repository lifecycle.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          {/* Metadata */}
          <Card className="space-y-4 p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Settings className="h-4.5 w-4.5 text-primary" />
              Repository Metadata
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-3 text-sm">
                <span className="font-medium text-muted-foreground">Full Name</span>
                <span className="col-span-2 truncate font-mono text-foreground">{repo.fullName}</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="font-medium text-muted-foreground">GitHub ID</span>
                <span className="col-span-2 font-mono text-foreground">{repo.githubId}</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="font-medium text-muted-foreground">HTML URL</span>
                <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="col-span-2 inline-flex items-center gap-1 truncate text-primary hover:underline">
                  {repo.htmlUrl}
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Display Label</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={repo.name}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
                />
                <Button variant="secondary" onClick={handleSaveLabel} disabled={savingLabel}>
                  {savingLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
          </Card>

          {/* Sync & polling */}
          <Card className="space-y-4 p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <RefreshCw className="h-4.5 w-4.5 text-emerald-500" />
              Synchronization & Polling
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 rounded-xl border border-border bg-secondary/40 p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sync Method</span>
                <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  {repo.webhookEnabled ? (
                    <>
                      <Wifi className="h-4 w-4 text-emerald-500" /> GitHub Webhook
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4 text-amber-500" /> Scheduled Polling
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1 rounded-xl border border-border bg-secondary/40 p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sync Status</span>
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  {repo.syncStatus === "syncing" && (
                    <span className="flex items-center gap-1.5 text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" /> Syncing...
                    </span>
                  )}
                  {repo.syncStatus === "success" && (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4" /> Success
                    </span>
                  )}
                  {repo.syncStatus === "failed" && (
                    <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="h-4 w-4" /> Failed
                    </span>
                  )}
                  {repo.syncStatus === "idle" && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-4 w-4" /> Idle
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Successful Sync</span>
                <span className="font-medium text-foreground">
                  {repo.lastSuccessfulSyncAt
                    ? new Date(repo.lastSuccessfulSyncAt).toLocaleString()
                    : repo.lastSyncedAt
                    ? new Date(repo.lastSyncedAt).toLocaleString()
                    : "Never"}
                </span>
              </div>

              {repo.lastFailedSyncAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Failed Sync</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">{new Date(repo.lastFailedSyncAt).toLocaleString()}</span>
                </div>
              )}

              {repo.lastSyncError && (
                <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <span className="block text-xs font-semibold text-destructive">Failure Details:</span>
                  <p className="break-words font-mono text-xs text-destructive/90">{repo.lastSyncError}</p>
                </div>
              )}

              {repo.nextAllowedSyncAt && (
                <div className="flex justify-between border-t border-dashed border-border pt-2.5 text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3 animate-pulse text-amber-500" />
                    Backoff Cooldown Active
                  </span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    Allowed after: {new Date(repo.nextAllowedSyncAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {!repo.webhookEnabled && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Polling Interval</span>
                  <span className="text-xs text-muted-foreground">How often background cron polls changes</span>
                </div>
                <div className="flex items-center gap-2">
                  {savingInterval && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <select
                    value={pollingInterval}
                    onChange={(e) => handleSaveInterval(Number(e.target.value))}
                    disabled={savingInterval}
                    className="cursor-pointer rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={120}>2 Hours</option>
                  </select>
                </div>
              </div>
            )}

            <Button className="w-full" onClick={handleSyncNow} disabled={syncing || repo.syncStatus === "syncing"}>
              {syncing || repo.syncStatus === "syncing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" /> Sync Now
                </>
              )}
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Storage stats */}
          <Card className="space-y-4 p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Database className="h-4.5 w-4.5 text-violet-500" />
              Storage & DB Statistics
            </h3>

            {loadingStats ? (
              <div className="flex h-44 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                    <GitCommit className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Commits</p>
                      <p className="text-base font-bold text-foreground">{stats?.totalCommits || 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                    <GitPullRequest className="h-5 w-5 shrink-0 text-violet-500" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PRs</p>
                      <p className="text-base font-bold text-foreground">{stats?.totalPrs || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <GitBranch className="h-4 w-4 text-blue-500" />
                      Active Branches
                    </span>
                    <span className="font-mono font-medium text-foreground">Synced</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <FileCode className="h-4 w-4 text-emerald-500" />
                      Est. DB Storage Usage
                    </span>
                    <span className="font-mono font-semibold text-foreground">~ {estSizeKB} KB</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Cron health */}
          <Card className="space-y-4 p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Heart className="h-4.5 w-4.5 text-rose-500" />
              Stateless Background Cron Health
            </h3>

            {loadingSystem ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Service Health</span>
                  {systemStatus?.health?.status === "healthy" && (
                    <Badge variant="success">
                      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                      Healthy
                    </Badge>
                  )}
                  {systemStatus?.health?.status === "degraded" && <Badge variant="warning">Degraded</Badge>}
                  {systemStatus?.health?.status === "failing" && <Badge variant="danger">Failing</Badge>}
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Active Execution</span>
                  <span className="font-medium text-foreground">
                    {systemStatus?.health?.lastRunAt ? new Date(systemStatus.health.lastRunAt).toLocaleString() : "Never run"}
                  </span>
                </div>

                {systemStatus?.rateLimit?.remaining !== null && (
                  <div className="flex justify-between border-t border-dashed border-border pt-2.5 text-xs">
                    <span className="text-muted-foreground">GitHub API Rate Limit</span>
                    <span className="font-mono text-primary">{systemStatus.rateLimit.remaining} remaining</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Danger zone */}
          <Card className="space-y-4 border-destructive/20 bg-destructive/5 p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-destructive">
              <ShieldAlert className="h-4.5 w-4.5" />
              Danger Zone / Repository Lifecycle
            </h3>

            <p className="text-xs leading-relaxed text-destructive/80">
              Archive repositories to preserve historical logs without updates, toggle active tracking, or permanently delete the
              repository from the database.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
              <Button variant="outline" onClick={handleToggleArchive} disabled={archiving} size="sm">
                <Archive className="h-3.5 w-3.5" />
                {repo.isArchived ? "Unarchive" : "Archive"} Repo
              </Button>
              <Button variant="outline" onClick={handleToggleTrack} disabled={togglingTrack} size="sm">
                <Clock className="h-3.5 w-3.5" />
                {repo.isTracked ? "Stop Polling" : "Resume Polling"}
              </Button>
            </div>

            <div className="border-t border-destructive/20 pt-4">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setConfirmName("");
                  setDeleteError(null);
                  setShowDeleteModal(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Permanently Delete Repository
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Destructive Action Confirmation
            </ModalTitle>
          </ModalHeader>

          <p className="text-xs leading-relaxed text-muted-foreground">
            This action is <strong className="text-foreground">permanent and irreversible</strong>. It will delete:
          </p>

          <ul className="list-disc space-y-1 pl-5 text-xs font-medium text-muted-foreground">
            <li>Repository webhook on GitHub (if active)</li>
            <li>All commits ({stats?.totalCommits || 0}) and commit files</li>
            <li>All pull requests ({stats?.totalPrs || 0}) and reviews/comments</li>
            <li>All active branches and event streams</li>
            <li>All historical analytics data</li>
          </ul>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Type the repository full name <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-foreground">{repo.fullName}</code> to
              confirm:
            </label>
            <input
              type="text"
              placeholder={repo.fullName}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-destructive"
            />
          </div>

          {deleteError && (
            <p className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {deleteError}
            </p>
          )}

          <ModalFooter>
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDeleteRepo}
              disabled={confirmName !== repo.fullName || deleting}
              loading={deleting}
            >
              Confirm Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
