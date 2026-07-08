"use client";

import React, { useState, useEffect } from "react";
import RepoOnboarding from "./RepoOnboarding";
import MetricCharts from "./MetricCharts";
import CommitList from "./CommitList";
import PullRequestList from "./PullRequestList";
import BranchList from "./BranchList";
import WebhookEventLog from "./WebhookEventLog";
import { ShieldCheck, GitBranch, LogOut, Loader2, BarChart2, GitCommit, GitPullRequest, Terminal, HelpCircle, Settings, History, Clock } from "lucide-react";
import { signOut } from "next-auth/react";
import RepoSettings from "./RepoSettings";
import SyncHistory from "./SyncHistory";
import RepoTimeline from "./RepoTimeline";
import ThemeToggle from "./ThemeToggle";

export default function DashboardOverview() {
  const [dbRepos, setDbRepos] = useState<any[]>([]);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null);
  
  // Navigation tabs: overview | commits | pulls | branches | webhooks | settings | history | timeline
  const [activeTab, setActiveTab] = useState<"overview" | "commits" | "pulls" | "branches" | "webhooks" | "settings" | "history" | "timeline">("overview");

  // Fetch repositories list on mount
  useEffect(() => {
    fetchRepos();
  }, []);

  // Poll repos list every 5 seconds if any repository is currently syncing
  useEffect(() => {
    const hasSyncingRepo = dbRepos.some((repo) => repo.syncStatus === "syncing");
    if (!hasSyncingRepo) return;

    const interval = setInterval(() => {
      fetchRepos();
    }, 5000);

    return () => clearInterval(interval);
  }, [dbRepos]);

  // Fetch metrics whenever selectedRepoId changes
  useEffect(() => {
    if (selectedRepoId) {
      fetchMetrics(selectedRepoId);
    } else {
      setMetricsData(null);
    }
  }, [selectedRepoId]);

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const response = await fetch("/api/repos");
      if (response.ok) {
        const data = await response.json();
        setDbRepos(data.dbRepos || []);
        setGithubRepos(data.githubRepos || []);
        
        // Auto-select first repository if available
        if (data.dbRepos && data.dbRepos.length > 0 && !selectedRepoId) {
          setSelectedRepoId(data.dbRepos[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading repositories:", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchMetrics = async (repoId: string) => {
    setLoadingMetrics(true);
    try {
      const response = await fetch(`/api/metrics?repositoryId=${repoId}`);
      if (response.ok) {
        const data = await response.json();
        setMetricsData(data);
      }
    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleDeleteRepoCallback = (deletedId: string) => {
    fetchRepos();
    setDbRepos((prev) => {
      const remaining = prev.filter((r) => r.id !== deletedId);
      if (remaining.length > 0) {
        setSelectedRepoId(remaining[0].id);
      } else {
        setSelectedRepoId(null);
      }
      return remaining;
    });
    setActiveTab("overview");
  };

  const handleTrackRepo = async (owner: string, name: string, maxPages: number = 3) => {
    try {
      // 1. Register the repository in the database
      const regResponse = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, name }),
      });

      if (!regResponse.ok) {
        const err = await regResponse.json();
        throw new Error(err.error || "Failed to register repository.");
      }

      const regData = await regResponse.json();
      const newRepo = regData.repository;

      // Add to database list locally in status 'syncing'
      setDbRepos((prev) => [...prev, { ...newRepo, isTracked: false }]);
      setSelectedRepoId(newRepo.id);
      setSyncingRepoId(newRepo.id);

      // 2. Trigger the sync engine background process (Phase 2 sync depth is full by default)
      const syncResponse = await fetch("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: newRepo.id, maxPages, syncDepth: "full" }),
      });

      if (!syncResponse.ok) {
        const err = await syncResponse.json();
        throw new Error(err.error || "Sync engine failed.");
      }

      // Re-fetch all repositories to update sync status and webhooks status
      await fetchRepos();
    } catch (error: any) {
      console.error("Tracking process error:", error);
      throw error; // Let RepoOnboarding handle displaying the error
    } finally {
      setSyncingRepoId(null);
    }
  };

  const handleRefreshMetrics = () => {
    if (selectedRepoId) {
      fetchMetrics(selectedRepoId);
    }
  };

  const selectedRepo = dbRepos.find((r) => r.id === selectedRepoId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-slate-900 dark:via-[#020617] dark:to-[#020617] text-slate-900 dark:text-white transition-colors duration-300">
      {/* Navbar Header */}
      <nav className="border-b border-slate-200 dark:border-slate-850 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500">
                <GitBranch className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                GitInsight <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded ml-1.5">v1.1</span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                <span>OAuth Secured</span>
              </div>
              <ThemeToggle />
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 px-3 py-1.5 rounded-lg shadow-sm transition-colors duration-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Section 1: Repo Onboarding */}
        <section className="space-y-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight">Onboard & Management</h1>
            <p className="text-xs text-slate-400">Manage which public and private repositories you are analyzing</p>
          </div>
          
          {loadingRepos ? (
            <div className="flex h-44 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/30">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <RepoOnboarding
              dbRepos={dbRepos}
              githubRepos={githubRepos}
              selectedRepoId={selectedRepoId}
              onSelectRepo={(id) => {
                setSelectedRepoId(id);
                setActiveTab("overview"); // Reset to overview on switch
              }}
              onTrackRepo={handleTrackRepo}
              syncingRepoId={syncingRepoId}
            />
          )}
        </section>

        {/* Section 2: Metrics Dashboard with Tab System */}
        <section className="space-y-4 border-t border-slate-900 pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight">Real-Time Analytics Workspace</h1>
              <p className="text-xs text-slate-400">Explore parsed file diffs, pull request timelines, reviews, and event stream pipelines.</p>
            </div>

            {/* Premium Tab Bar */}
            {selectedRepoId && (
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-850 p-1 rounded-xl w-max self-start sm:self-auto">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "overview" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "timeline" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Timeline
                </button>
                <button
                  onClick={() => setActiveTab("commits")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "commits" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <GitCommit className="h-3.5 w-3.5" />
                  Commits
                </button>
                <button
                  onClick={() => setActiveTab("pulls")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "pulls" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <GitPullRequest className="h-3.5 w-3.5" />
                  Pull Requests
                </button>
                <button
                  onClick={() => setActiveTab("branches")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "branches" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Branches
                </button>
                <button
                  onClick={() => setActiveTab("webhooks")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "webhooks" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Events
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "settings" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition
                    ${activeTab === "history" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              </div>
            )}
          </div>

          {selectedRepoId ? (
            <div className="pt-2 animate-in fade-in duration-350">
              {activeTab === "overview" && metricsData && (
                <MetricCharts
                  data={metricsData}
                  loading={loadingMetrics}
                  onRefresh={handleRefreshMetrics}
                  repositoryId={selectedRepoId}
                />
              )}

              {activeTab === "timeline" && (
                <RepoTimeline repositoryId={selectedRepoId} />
              )}

              {activeTab === "commits" && (
                <CommitList repositoryId={selectedRepoId} />
              )}

              {activeTab === "pulls" && (
                <PullRequestList repositoryId={selectedRepoId} />
              )}

              {activeTab === "branches" && (
                <BranchList repositoryId={selectedRepoId} />
              )}

              {activeTab === "webhooks" && (
                <WebhookEventLog repositoryId={selectedRepoId} />
              )}

              {activeTab === "settings" && (
                <RepoSettings
                  repositoryId={selectedRepoId}
                  onRefreshRepos={fetchRepos}
                  onSelectTab={(tab) => setActiveTab(tab)}
                  onDeleteRepo={handleDeleteRepoCallback}
                />
              )}

              {activeTab === "history" && (
                <SyncHistory />
              )}
            </div>
          ) : (
            <div className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 text-center text-slate-500">
              <GitBranch className="h-10 w-10 text-slate-700 mb-2 animate-bounce" />
              <h3 className="font-semibold text-white">No Analytics Workspace Selected</h3>
              <p className="text-xs max-w-xs mt-1">Select a tracked repository from the sidebar, or onboard a new repository above to view commits frequencies and contributor distributions.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
