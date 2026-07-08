"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  GitCommit,
  GitPullRequest,
  Clock,
  Activity,
  Wifi,
  RefreshCw,
  Eye,
  CheckCircle,
  FileCode,
  TrendingUp,
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface CommitFrequency {
  date: string;
  count: number;
}

interface TopContributor {
  name: string;
  avatar: string | null;
  commits: number;
}

interface MetricsData {
  repositoryName: string;
  fullName: string;
  webhookEnabled: boolean;
  isArchived: boolean;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  pollingInterval: number;
  totalCommits: number;
  totalPrs: number;
  openPrsCount: number;
  averagePrMergeTimeHours: number;
  commitFrequency: CommitFrequency[];
  topContributors: TopContributor[];
}

interface MetricChartsProps {
  data: MetricsData;
  loading: boolean;
  onRefresh: () => void;
  repositoryId: string;
}

interface FileChurnItem {
  filename: string;
  filepath: string;
  additions: number;
  deletions: number;
  changes: number;
}

interface WeeklyChurnItem {
  week: string;
  additions: number;
  deletions: number;
}

interface ExtendedAnalytics {
  avgReviewCycleHours: number;
  approvalRate: number;
  fileChurn: FileChurnItem[];
  weeklyChurn: WeeklyChurnItem[];
  prStateSummary: {
    open: number;
    closed: number;
    merged: number;
  };
}

export default function MetricCharts({ data, loading, onRefresh, repositoryId }: MetricChartsProps) {
  const [analytics, setAnalytics] = useState<ExtendedAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    fetchExtendedAnalytics();
  }, [repositoryId]);

  const fetchExtendedAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/analytics?repositoryId=${repositoryId}`);
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json);
      }
    } catch (err) {
      console.error("Error loading extended analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleFullRefresh = () => {
    onRefresh();
    fetchExtendedAnalytics();
  };

  if (loading || loadingAnalytics) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-slate-400 text-sm animate-pulse">Fetching analytics database...</p>
        </div>
      </div>
    );
  }

  // Format duration helper
  const formatDuration = (hours: number) => {
    if (hours === 0) return "N/A";
    if (hours < 24) {
      return `${hours} hrs`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#10b981", "#3b82f6", "#f59e0b"];

  // PR summary totals
  const prOpen = analytics?.prStateSummary.open ?? 0;
  const prMerged = analytics?.prStateSummary.merged ?? 0;
  const prClosed = analytics?.prStateSummary.closed ?? 0;
  const prTotal = prOpen + prMerged + prClosed;

  return (
    <div className="space-y-6">
      {/* Repository Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight text-white">{data.repositoryName}</h2>
            {data.isArchived && (
              <span className="inline-flex items-center rounded-full bg-slate-950 border border-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-400">
                Archived
              </span>
            )}
            {data.syncStatus === "syncing" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-950 border border-indigo-700/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing...
              </span>
            )}
            {data.syncStatus === "failed" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-955/20 border border-rose-900/40 px-2.5 py-0.5 text-xs font-semibold text-rose-450" title={data.lastSyncError || ""}>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                Sync Failed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{data.fullName}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Badge */}
          <div className="flex flex-col text-right">
            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium w-max ml-auto">
              {data.webhookEnabled ? (
                <>
                  <Wifi className="h-4 w-4 text-emerald-500 animate-pulse" />
                  <span className="text-emerald-400">Webhook Sync (Real-Time)</span>
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-400">Polling Sync (every {data.pollingInterval}m)</span>
                </>
              )}
            </div>
            {data.lastSyncedAt && (
              <span className="text-[10px] text-slate-500 mt-1 block">
                Last synced: {new Date(data.lastSyncedAt).toLocaleString()}
              </span>
            )}
          </div>

          <button
            onClick={handleFullRefresh}
            disabled={data.syncStatus === "syncing"}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3.5 py-1.5 text-sm font-medium text-white transition"
          >
            <RefreshCw className={`h-4 w-4 ${data.syncStatus === "syncing" ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid gap-4 md:grid-cols-4 sm:grid-cols-2">
        {/* Total Commits */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-850 bg-slate-900/40 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Total Commits</span>
            <GitCommit className="h-4.5 w-4.5 text-indigo-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold tracking-tight text-white">{data.totalCommits}</span>
            <p className="mt-1 text-xs text-slate-500">Historical & Webhook syncs</p>
          </div>
        </div>

        {/* Avg PR Merge Time */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-850 bg-slate-900/40 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Avg PR Merge Time</span>
            <Clock className="h-4.5 w-4.5 text-pink-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold tracking-tight text-white">
              {formatDuration(data.averagePrMergeTimeHours)}
            </span>
            <p className="mt-1 text-xs text-slate-500">From creation to merge</p>
          </div>
        </div>

        {/* PR Review Cycle Time */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-850 bg-slate-900/40 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Review Cycle Time</span>
            <Eye className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold tracking-tight text-white">
              {analytics ? formatDuration(analytics.avgReviewCycleHours) : "N/A"}
            </span>
            <p className="mt-1 text-xs text-slate-500">Time to first review submit</p>
          </div>
        </div>

        {/* Review Approval Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-850 bg-slate-900/40 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Review Approval Rate</span>
            <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold tracking-tight text-white">
              {analytics ? `${analytics.approvalRate}%` : "0%"}
            </span>
            <p className="mt-1 text-xs text-slate-500">Approved review ratio</p>
          </div>
        </div>
      </div>

      {/* Main Charts & Leadboards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Line Chart: Commit Frequency (2/3 width) */}
        <div className="md:col-span-2 rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Commit Frequency</h3>
            <p className="text-xs text-slate-450">Total commits pushed per day over the last 30 days</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.commitFrequency} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(str) => {
                    const parts = str.split("-");
                    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : str;
                  }}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                  itemStyle={{ color: "#818cf8" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Commits"
                  stroke="#6366f1"
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                  dot={{ r: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Top Contributors (1/3 width) */}
        <div className="rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Top Contributors</h3>
            <p className="text-xs text-slate-455">Total commit count breakdown per developer</p>
          </div>
          {data.topContributors.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              No contributor data available
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topContributors}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }}
                    itemStyle={{ color: "#a78bfa" }}
                  />
                  <Bar dataKey="commits" name="Commits" radius={[0, 4, 4, 0]} barSize={12}>
                    {data.topContributors.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Extended Analytics (Phase 5 - PR state bar & weekly additions/deletions churn & file churn leaderboard) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Weekly Churn (Area Chart additions vs deletions) (2/3 width) */}
        <div className="md:col-span-2 rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
              Code Churn Frequency
            </h3>
            <p className="text-xs text-slate-450">Weekly code line additions vs deletions over the last 4 weeks</p>
          </div>

          {!analytics || analytics.weeklyChurn.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-xs text-slate-500 italic">
              No code churn data parsed yet. Sync the repo in full mode.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.weeklyChurn} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }}
                    labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="additions"
                    name="Additions"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="deletions"
                    name="Deletions"
                    stroke="#f43f5e"
                    fill="#f43f5e"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* PR States Progression & File Churn Leaderboard (1/3 width) */}
        <div className="rounded-2xl border border-slate-850 bg-slate-900/30 p-6 shadow-xl space-y-5">
          {/* PR progression bar */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <GitPullRequest className="h-4 w-4 text-purple-400" />
              Pull Request State Ratio
            </h4>
            <div className="h-2.5 w-full rounded-full bg-slate-950 flex overflow-hidden border border-slate-800">
              {prTotal === 0 ? (
                <div className="w-full bg-slate-800" />
              ) : (
                <>
                  <div
                    style={{ width: `${(prMerged / prTotal) * 100}%` }}
                    className="bg-purple-500"
                    title={`Merged: ${prMerged}`}
                  />
                  <div
                    style={{ width: `${(prOpen / prTotal) * 100}%` }}
                    className="bg-emerald-500"
                    title={`Open: ${prOpen}`}
                  />
                  <div
                    style={{ width: `${(prClosed / prTotal) * 100}%` }}
                    className="bg-rose-500"
                    title={`Closed: ${prClosed}`}
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                {prMerged} Merged
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {prOpen} Open
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                {prClosed} Closed
              </span>
            </div>
          </div>

          {/* File Churn table */}
          <div className="space-y-3 pt-2 border-t border-slate-850">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <FileCode className="h-4 w-4 text-indigo-400" />
              File Churn Leaderboard
            </h4>
            {!analytics || analytics.fileChurn.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No files modified yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                {analytics.fileChurn.slice(0, 4).map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs gap-3">
                    <span className="font-mono text-slate-300 truncate" title={file.filepath}>
                      {file.filename}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                      <span className="flex items-center text-emerald-450">
                        <Plus className="h-2.5 w-2.5" />
                        {file.additions}
                      </span>
                      <span className="flex items-center text-rose-450">
                        <Minus className="h-2.5 w-2.5" />
                        {file.deletions}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
