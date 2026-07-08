"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  Database,
  ArrowRight,
  GitCommit,
  GitPullRequest,
  AlertTriangle,
  Play,
  Activity,
  Wifi,
} from "lucide-react";

export default function SyncHistory() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemHealth, setSystemHealth] = useState<any | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/system/status");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.recentLogs || []);
        setSystemHealth(data.health || null);
      }
    } catch (err) {
      console.error("Error fetching sync history:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Synchronization Log Pipeline</h2>
          <p className="text-sm text-slate-400">Review execution details, durations, processing throughput, and errors across the sync channels.</p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl border border-slate-850 bg-slate-900/30 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Repository</th>
                <th className="px-6 py-4">Trigger Channel</th>
                <th className="px-6 py-4">Execution Time</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Throughput</th>
                <th className="px-6 py-4">Status / Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-sm">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <Terminal className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                    No synchronization logs processed yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const repoLabel = log.repo
                    ? log.repo.displayName || log.repo.name
                    : "System / Multiple";

                  return (
                    <tr key={log.id} className="hover:bg-slate-900/20 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-200">
                          {repoLabel}
                        </div>
                        {log.repo && (
                          <div className="text-xs text-slate-550 font-mono">
                            {log.repo.owner}/{log.repo.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          {log.syncType === "manual" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-950 border border-indigo-750/30 px-2 py-0.5 text-indigo-400">
                              <Play className="h-3 w-3 fill-indigo-400" />
                              Manual Run
                            </span>
                          )}
                          {log.syncType === "webhook" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 border border-emerald-750/30 px-2 py-0.5 text-emerald-400">
                              <Wifi className="h-3 w-3" />
                              Webhook Push
                            </span>
                          )}
                          {log.syncType === "scheduled" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 border border-amber-750/30 px-2 py-0.5 text-amber-400">
                              <Activity className="h-3 w-3" />
                              Stateless Polling
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                        {new Date(log.startedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                        {log.durationMs ? formatDuration(log.durationMs) : "Pending"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <GitCommit className="h-3.5 w-3.5 text-indigo-400" />
                            {log.commitsProcessed} commits
                          </span>
                          <span className="flex items-center gap-1">
                            <GitPullRequest className="h-3.5 w-3.5 text-purple-400" />
                            {log.prsProcessed} PRs
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {log.status === "completed" && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              Completed
                            </span>
                          )}
                          {log.status === "failed" && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                Failed
                              </span>
                              {log.errorMsg && (
                                <p className="text-[10px] text-rose-300 font-mono max-w-xs break-words border-l border-rose-800/60 pl-2">
                                  {log.errorMsg}
                                </p>
                              )}
                            </div>
                          )}
                          {log.status === "running" && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-405 animate-pulse">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                              Syncing...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
