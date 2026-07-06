"use client";

import React from "react";
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
} from "recharts";
import { GitCommit, GitPullRequest, Clock, Activity, Wifi, RefreshCw } from "lucide-react";

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
  webhookEnabled: boolean;
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
}

export default function MetricCharts({ data, loading, onRefresh }: MetricChartsProps) {
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-slate-400 text-sm animate-pulse">Fetching analytics database...</p>
        </div>
      </div>
    );
  }

  // Format hours into readable format (e.g. 1.2 hrs, or 2 days 4 hrs)
  const formatDuration = (hours: number) => {
    if (hours === 0) return "N/A";
    if (hours < 24) {
      return `${hours} hrs`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  // Color palette for contributors chart
  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#10b981", "#3b82f6", "#f59e0b"];

  return (
    <div className="space-y-6">
      {/* Repository Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{data.repositoryName}</h2>
          <p className="text-sm text-slate-400">Real-time repository insights & analytics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium">
            {data.webhookEnabled ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-500 animate-pulse" />
                <span className="text-emerald-400">Webhooks Active (Real-Time)</span>
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 text-amber-500" />
                <span className="text-amber-400">Polling Sync (Near Real-Time)</span>
              </>
            )}
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Card 1: Total Commits */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Total Commits</span>
            <GitCommit className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-white">{data.totalCommits}</span>
            <p className="mt-1 text-xs text-slate-500">Historical & Webhook syncs</p>
          </div>
        </div>

        {/* Card 2: Total PRs */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Total Pull Requests</span>
            <GitPullRequest className="h-5 w-5 text-purple-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-white">{data.totalPrs}</span>
            <p className="mt-1 text-xs text-purple-400 font-semibold">{data.openPrsCount} open pull requests</p>
          </div>
        </div>

        {/* Card 3: Avg PR Merge Time */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Avg PR Merge Time</span>
            <Clock className="h-5 w-5 text-pink-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-white">
              {formatDuration(data.averagePrMergeTimeHours)}
            </span>
            <p className="mt-1 text-xs text-slate-500">From creation to merge</p>
          </div>
        </div>

        {/* Card 4: Webhook Status summary */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">Webhook Connection</span>
            <Wifi className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold tracking-tight text-white">
              {data.webhookEnabled ? "Active" : "Polling"}
            </span>
            <p className="mt-1 text-xs text-slate-500">
              {data.webhookEnabled ? "Crypto Verified" : "Cron update scheduled"}
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Line Chart: Commit Frequency (2/3 width) */}
        <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Commit Frequency</h3>
            <p className="text-xs text-slate-400">Total commits pushed per day over the last 30 days</p>
          </div>
          <div className="h-80 w-full">
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
                    return `${parts[1]}/${parts[2]}`; // mm/dd format
                  }}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "12px" }}
                  labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                  itemStyle={{ color: "#818cf8" }}
                  labelFormatter={(str) => {
                    const date = new Date(str);
                    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                  }}
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-xl backdrop-blur-md">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Top Contributors</h3>
            <p className="text-xs text-slate-400">Total commit count breakdown per developer</p>
          </div>
          {data.topContributors.length === 0 ? (
            <div className="flex h-80 items-center justify-center text-sm text-slate-500">
              No contributor data available
            </div>
          ) : (
            <div className="h-80 w-full">
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
                  <Bar dataKey="commits" name="Commits" radius={[0, 4, 4, 0]} barSize={14}>
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
    </div>
  );
}
