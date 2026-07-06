"use client";

import React, { useState, useEffect } from "react";
import RepoOnboarding from "./RepoOnboarding";
import MetricCharts from "./MetricCharts";
import { ShieldCheck, GitBranch, LogOut, Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";

export default function DashboardOverview() {
  const [dbRepos, setDbRepos] = useState<any[]>([]);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null);

  // Fetch repositories list on mount
  useEffect(() => {
    fetchRepos();
  }, []);

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

      // 2. Trigger the sync engine background process
      const syncResponse = await fetch("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: newRepo.id, maxPages }),
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

  return (
    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617] text-white">
      {/* Navbar Header */}
      <nav className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-md sticky top-0 z-55">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500">
                <GitBranch className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-200 via-white to-violet-200 bg-clip-text text-transparent">
                GitInsight <span className="text-xs font-semibold text-indigo-400 border border-indigo-500/20 bg-indigo-950/30 px-1.5 py-0.5 rounded ml-1.5">v1.0</span>
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-indigo-450" />
                <span>OAuth Secured</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition bg-slate-900 border border-slate-800 hover:bg-slate-850 px-3 py-1.5 rounded-lg"
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
              onSelectRepo={setSelectedRepoId}
              onTrackRepo={handleTrackRepo}
              syncingRepoId={syncingRepoId}
            />
          )}
        </section>

        {/* Section 2: Metrics Dashboard */}
        <section className="space-y-3 border-t border-slate-900 pt-8">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight">Real-Time Analytics</h1>
            <p className="text-xs text-slate-400">Aggregated insights derived from commits, cycles and webhook pipelines</p>
          </div>

          {selectedRepoId && metricsData ? (
            <MetricCharts
              data={metricsData}
              loading={loadingMetrics}
              onRefresh={handleRefreshMetrics}
            />
          ) : (
            <div className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/10 text-center text-slate-500">
              <GitBranch className="h-10 w-10 text-slate-700 mb-2 animate-bounce" />
              <h3 className="font-semibold text-white">No Analytics Selected</h3>
              <p className="text-xs max-w-xs mt-1">Select a tracked repository from the sidebar, or onboard a new repository above to view commits frequencies and contributor distributions.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
