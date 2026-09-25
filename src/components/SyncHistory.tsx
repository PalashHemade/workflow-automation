"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  GitCommit,
  GitPullRequest,
  Play,
  Activity,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const SYNC_TYPE_META: Record<string, { label: string; icon: any; className: string }> = {
  manual: { label: "Manual Run", icon: Play, className: "bg-primary/10 text-primary" },
  webhook: { label: "Webhook Push", icon: Wifi, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  scheduled: { label: "Stateless Polling", icon: Activity, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

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
      <div className="flex h-96 items-center justify-center rounded-xl border border-border bg-secondary/30">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Synchronization Log Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Review execution details, durations, processing throughput, and errors across the sync channels.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={fetchHistory} disabled={refreshing} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Pipeline
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {logs.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">
            <Terminal className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            No synchronization logs processed yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead>Trigger Channel</TableHead>
                <TableHead>Execution Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Throughput</TableHead>
                <TableHead>Status / Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const repoLabel = log.repo ? log.repo.displayName || log.repo.name : "System / Multiple";
                const meta = SYNC_TYPE_META[log.syncType];

                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">{repoLabel}</div>
                      {log.repo && (
                        <div className="font-mono text-xs text-muted-foreground">
                          {log.repo.owner}/{log.repo.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {meta && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}>
                          <meta.icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(log.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.durationMs ? formatDuration(log.durationMs) : "Pending"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitCommit className="h-3.5 w-3.5 text-primary" />
                          {log.commitsProcessed} commits
                        </span>
                        <span className="flex items-center gap-1">
                          <GitPullRequest className="h-3.5 w-3.5 text-violet-500" />
                          {log.prsProcessed} PRs
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.status === "completed" && (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </Badge>
                      )}
                      {log.status === "failed" && (
                        <div className="space-y-1">
                          <Badge variant="danger">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </Badge>
                          {log.errorMsg && (
                            <p className="max-w-xs break-words border-l border-destructive/40 pl-2 font-mono text-[10px] text-destructive">
                              {log.errorMsg}
                            </p>
                          )}
                        </div>
                      )}
                      {log.status === "running" && (
                        <Badge variant="warning">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing...
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
