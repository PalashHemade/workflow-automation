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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";

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

// Tooltip/grid colors reference CSS custom properties directly, so recharts'
// SVG output (which can't use Tailwind dark: classes) still follows the
// active theme without any JS-side theme detection.
const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  fontSize: "12px",
};
const TOOLTIP_LABEL_STYLE = { color: "hsl(var(--muted-foreground))", fontWeight: 700 };

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
      <div className="flex h-96 items-center justify-center rounded-xl border border-border bg-secondary/30">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="animate-pulse text-sm text-muted-foreground">Fetching analytics database...</p>
        </div>
      </div>
    );
  }

  const formatDuration = (hours: number) => {
    if (hours === 0) return "N/A";
    if (hours < 24) return `${hours} hrs`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#10b981", "#3b82f6", "#f59e0b"];

  const prOpen = analytics?.prStateSummary.open ?? 0;
  const prMerged = analytics?.prStateSummary.merged ?? 0;
  const prClosed = analytics?.prStateSummary.closed ?? 0;
  const prTotal = prOpen + prMerged + prClosed;

  return (
    <div className="space-y-6">
      {/* Repository Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{data.repositoryName}</h2>
            {data.isArchived && <Badge variant="secondary">Archived</Badge>}
            {data.syncStatus === "syncing" && (
              <Badge variant="default">
                <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
              </Badge>
            )}
            {data.syncStatus === "failed" && (
              <Badge variant="danger" title={data.lastSyncError || ""}>
                <AlertTriangle className="h-3.5 w-3.5" /> Sync Failed
              </Badge>
            )}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{data.fullName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col text-right">
            <div className="ml-auto flex w-max items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium">
              {data.webhookEnabled ? (
                <>
                  <Wifi className="h-4 w-4 animate-pulse text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Webhook Sync (Real-Time)</span>
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">Polling Sync (every {data.pollingInterval}m)</span>
                </>
              )}
            </div>
            {data.lastSyncedAt && (
              <span className="mt-1 block text-[10px] text-muted-foreground">
                Last synced: {new Date(data.lastSyncedAt).toLocaleString()}
              </span>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={handleFullRefresh} disabled={data.syncStatus === "syncing"}>
            <RefreshCw className={`h-4 w-4 ${data.syncStatus === "syncing" ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard label="Total Commits" value={data.totalCommits} icon={GitCommit} trendLabel="Historical & Webhook syncs" />
        <MetricCard label="Avg PR Merge Time" value={formatDuration(data.averagePrMergeTimeHours)} icon={Clock} trendLabel="From creation to merge" />
        <MetricCard
          label="Review Cycle Time"
          value={analytics ? formatDuration(analytics.avgReviewCycleHours) : "N/A"}
          icon={Eye}
          trendLabel="Time to first review submit"
        />
        <MetricCard
          label="Review Approval Rate"
          value={analytics ? `${analytics.approvalRate}%` : "0%"}
          icon={CheckCircle}
          trendLabel="Approved review ratio"
        />
      </div>

      {/* Main Charts */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 md:col-span-2">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Commit Frequency</h3>
            <p className="text-xs text-muted-foreground">Total commits pushed per day over the last 30 days</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.commitFrequency} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={AXIS_COLOR}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(str) => {
                    const parts = str.split("-");
                    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : str;
                  }}
                />
                <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={{ color: "#818cf8" }} />
                <Line type="monotone" dataKey="count" name="Commits" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground">Top Contributors</h3>
            <p className="text-xs text-muted-foreground">Total commit count breakdown per developer</p>
          </div>
          {data.topContributors.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No contributor data available</div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topContributors} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                  <XAxis type="number" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: "#a78bfa" }} />
                  <Bar dataKey="commits" name="Commits" radius={[0, 4, 4, 0]} barSize={12}>
                    {data.topContributors.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Extended Analytics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="space-y-4 p-6 md:col-span-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
              Code Churn Frequency
            </h3>
            <p className="text-xs text-muted-foreground">Weekly code line additions vs deletions over the last 4 weeks</p>
          </div>

          {!analytics || analytics.weeklyChurn.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-xs italic text-muted-foreground">
              No code churn data parsed yet. Sync the repo in full mode.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.weeklyChurn} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="week" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  <Area type="monotone" dataKey="additions" name="Additions" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="deletions" name="Deletions" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="space-y-5 p-6">
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <GitPullRequest className="h-4 w-4 text-violet-500" />
              Pull Request State Ratio
            </h4>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-border bg-secondary">
              {prTotal === 0 ? (
                <div className="w-full bg-muted" />
              ) : (
                <>
                  <div style={{ width: `${(prMerged / prTotal) * 100}%` }} className="bg-violet-500" title={`Merged: ${prMerged}`} />
                  <div style={{ width: `${(prOpen / prTotal) * 100}%` }} className="bg-emerald-500" title={`Open: ${prOpen}`} />
                  <div style={{ width: `${(prClosed / prTotal) * 100}%` }} className="bg-rose-500" title={`Closed: ${prClosed}`} />
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
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

          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <FileCode className="h-4 w-4 text-primary" />
              File Churn Leaderboard
            </h4>
            {!analytics || analytics.fileChurn.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No files modified yet.</p>
            ) : (
              <div className="max-h-[160px] space-y-2.5 overflow-y-auto pr-1">
                {analytics.fileChurn.slice(0, 4).map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-foreground" title={file.filepath}>
                      {file.filename}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px]">
                      <span className="flex items-center text-emerald-600 dark:text-emerald-400">
                        <Plus className="h-2.5 w-2.5" />
                        {file.additions}
                      </span>
                      <span className="flex items-center text-rose-600 dark:text-rose-400">
                        <Minus className="h-2.5 w-2.5" />
                        {file.deletions}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
