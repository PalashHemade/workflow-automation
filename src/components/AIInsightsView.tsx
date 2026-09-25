"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ShieldCheck, HelpCircle, Play, Loader2, Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/core/utils";

interface AIInsightsViewProps {
  projectId: string;
}

export default function AIInsightsView({ projectId }: AIInsightsViewProps) {
  const [insights, setInsights] = useState<any[]>([]);
  const [queryData, setQueryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState(false);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [lastAgentResult, setLastAgentResult] = useState<any | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>("storiesNoCommits");

  useEffect(() => {
    fetchInsights();
  }, [projectId]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/insights`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
        setQueryData(data.aiQueryData || null);
      }
    } catch (err) {
      console.error("Error fetching AI insights:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAgents = async (agentsToRun = ["SummaryAgent", "SprintHealthAgent"]) => {
    setRunningAgent(true);
    setAgentLogs([]);
    setLastAgentResult(null);

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, agents: agentsToRun }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastAgentResult(data);
        const allLogs = (data.results || []).flatMap((r: any) => r.logs || []);
        setAgentLogs(allLogs);
        await fetchInsights();
      } else {
        const err = await res.json();
        alert(`Agent Error: ${err.error || "Failed to execute agent"}`);
      }
    } catch (err: any) {
      console.error("Error running AI agents:", err);
      alert(`Agent execution failed: ${err.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const sampleQueries = [
    { id: "storiesNoCommits", title: "Which stories have no commits?", icon: HelpCircle },
    { id: "prsWaiting", title: "Which PRs are waiting for review?", icon: HelpCircle },
    { id: "bugModules", title: "Which modules generate the most bugs?", icon: HelpCircle },
    { id: "sprintDelay", title: "Why is the current Sprint delayed?", icon: HelpCircle },
  ];

  return (
    <div className="space-y-6">
      {/* AI Header */}
      <div className="flex flex-col items-start gap-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-700 to-slate-900 p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
            <span>Agentic AI Framework (Groq + Llama 3.3)</span>
          </div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">Project AI Insights & Autonomous Agents</h2>
          <p className="text-xs leading-relaxed text-white/70">
            Specialized agents execute deterministic multi-stage workflows over normalized database entities, generating
            memory summaries and risk alerts.
          </p>
        </div>

        <Button
          onClick={() => handleRunAgents()}
          disabled={runningAgent}
          className="shrink-0 bg-white text-slate-900 hover:bg-slate-100"
        >
          {runningAgent ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Executing Agents...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" /> Run AI Agent Pipeline
            </>
          )}
        </Button>
      </div>

      {/* Live agent console */}
      {(runningAgent || lastAgentResult) && (
        <Card className="space-y-4 border-border bg-slate-950 p-6 text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <Activity className="h-4 w-4" />
              Agent Execution Lifecycle Console
            </h3>
            {lastAgentResult?.success && <Badge variant="success">Pipeline Completed Successfully</Badge>}
          </div>

          <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-900 p-4 font-mono text-xs">
            {agentLogs.length === 0 && runningAgent && (
              <p className="animate-pulse text-slate-400">Initializing Planner → Retriever → LLM Analyzer → Reflection → Memory...</p>
            )}
            {agentLogs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="font-bold text-violet-400">[{log.stage}]</span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Persisted insights */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Persisted AI Insights ({insights.length})
          </h3>
          <button onClick={() => fetchInsights()} className="text-xs font-semibold text-primary hover:underline">
            Refresh
          </button>
        </div>

        {insights.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No AI insights generated yet"
            description='Click "Run AI Agent Pipeline" above to run agents.'
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.id} className="space-y-2 p-5">
                <div className="flex items-center justify-between">
                  <Badge variant={insight.severity === "HIGH" || insight.severity === "CRITICAL" ? "danger" : "default"}>
                    {insight.severity} • {insight.type}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">{insight.confidence}% Confidence</span>
                </div>
                <h3 className="text-sm font-bold text-foreground">{insight.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{insight.summary}</p>

                {insight.metadata?.recommendations && (
                  <div className="space-y-1 border-t border-border pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recommendations:</span>
                    <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground">
                      {insight.metadata.recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Query playground */}
      <Card className="space-y-4 p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Interactive Schema Explorer & Quick Agent Queries
        </h3>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          {sampleQueries.map((q) => (
            <button
              key={q.id}
              onClick={() => setActiveQuery(q.id)}
              className={cn(
                "rounded-xl border p-3 text-left text-xs font-semibold transition-all",
                activeQuery === q.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/20"
              )}
            >
              {q.title}
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-4 text-xs">
          <span className="block font-bold uppercase tracking-wider text-muted-foreground">Normalized Query Output:</span>

          {activeQuery === "storiesNoCommits" && (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Stories without linked commits ({queryData?.storiesWithNoCommits?.length || 0}):
              </p>
              {queryData?.storiesWithNoCommits?.length === 0 ? (
                <p className="italic text-muted-foreground">No unlinked stories found.</p>
              ) : (
                queryData?.storiesWithNoCommits?.map((s: any) => (
                  <div key={s.id} className="flex justify-between rounded border border-border bg-card p-2">
                    <span>
                      [{s.key}] {s.summary}
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{s.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeQuery === "prsWaiting" && (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Pull Requests awaiting review ({queryData?.prsWaitingReview?.length || 0}):
              </p>
              {queryData?.prsWaitingReview?.length === 0 ? (
                <p className="italic text-muted-foreground">No open PRs awaiting review.</p>
              ) : (
                queryData?.prsWaitingReview?.map((pr: any) => (
                  <div key={pr.id} className="flex justify-between rounded border border-border bg-card p-2">
                    <span>
                      PR #{pr.number}: {pr.title}
                    </span>
                    <span className="font-semibold text-primary">Author: {pr.author}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeQuery === "bugModules" && (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Subsystem Module Bug Density:</p>
              {queryData?.modulesBugDensity?.length === 0 ? (
                <p className="italic text-muted-foreground">No module bug data registered yet.</p>
              ) : (
                queryData?.modulesBugDensity?.map((m: any) => (
                  <div key={m.name} className="flex justify-between rounded border border-border bg-card p-2">
                    <span>
                      Module: {m.name} (Owner: {m.owner})
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">Risk Score: {m.riskScore}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeQuery === "sprintDelay" && (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Sprint Delay Reason:</p>
              <div className="rounded border border-border bg-card p-3">
                <p className="font-bold text-foreground">{queryData?.sprintDelayAnalysis?.sprintName || "Active Sprint"}</p>
                <p className="mt-1 text-muted-foreground">{queryData?.sprintDelayAnalysis?.reason || "Work progressing on schedule."}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
