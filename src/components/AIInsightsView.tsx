"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, ShieldCheck, Cpu, ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";

interface AIInsightsViewProps {
  projectId: string;
}

export default function AIInsightsView({ projectId }: AIInsightsViewProps) {
  const [insights, setInsights] = useState<any[]>([]);
  const [queryData, setQueryData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
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

  const sampleQueries = [
    { id: "storiesNoCommits", title: "Which stories have no commits?", icon: HelpCircle },
    { id: "prsWaiting", title: "Which PRs are waiting for review?", icon: HelpCircle },
    { id: "bugModules", title: "Which modules generate the most bugs?", icon: HelpCircle },
    { id: "sprintDelay", title: "Why is the current Sprint delayed?", icon: HelpCircle },
  ];

  return (
    <div className="space-y-6">
      {/* AI Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-900 text-white shadow-xl flex items-center justify-between">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-purple-300" />
            <span>AI Readiness Engine</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Project AI Insights & Analytical Memory</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            The database schema normalizes domain objects so AI agents can query sprint delays, developer ownership, unlinked code changes, and subsystem health.
          </p>
        </div>
      </div>

      {/* Active AI Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight) => (
          <div key={insight.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                insight.severity === "HIGH" || insight.severity === "CRITICAL" ? "bg-red-500/10 text-red-600" : "bg-indigo-500/10 text-indigo-600"
              }`}>
                {insight.severity} • {insight.type}
              </span>
              <span className="text-xs text-slate-500 font-semibold">{insight.confidence}% Confidence</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{insight.title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{insight.summary}</p>
          </div>
        ))}
      </div>

      {/* Interactive AI Query Playground */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          Ask AI Agent (Sample Normalized Schema Queries)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {sampleQueries.map((q) => (
            <button
              key={q.id}
              onClick={() => setActiveQuery(q.id)}
              className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                activeQuery === q.id
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {q.title}
            </button>
          ))}
        </div>

        {/* Query Results Box */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <span className="font-bold text-slate-500 uppercase tracking-wider block">Normalized Query Output:</span>
          {activeQuery === "storiesNoCommits" && (
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Stories without linked commits ({queryData?.storiesWithNoCommits?.length || 0}):
              </p>
              {queryData?.storiesWithNoCommits?.map((s: any) => (
                <div key={s.id} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                  <span>[{s.key}] {s.summary}</span>
                  <span className="text-amber-500 font-bold">{s.status}</span>
                </div>
              ))}
            </div>
          )}

          {activeQuery === "prsWaiting" && (
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Pull Requests awaiting review ({queryData?.prsWaitingReview?.length || 0}):
              </p>
              {queryData?.prsWaitingReview?.map((pr: any) => (
                <div key={pr.id} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                  <span>PR #{pr.number}: {pr.title}</span>
                  <span className="text-indigo-500 font-semibold">Author: {pr.author}</span>
                </div>
              ))}
            </div>
          )}

          {activeQuery === "bugModules" && (
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Subsystem Module Bug Density:</p>
              {queryData?.modulesBugDensity?.map((m: any) => (
                <div key={m.name} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                  <span>Module: {m.name} (Owner: {m.owner})</span>
                  <span className="text-red-500 font-bold">Risk Score: {m.riskScore}</span>
                </div>
              ))}
            </div>
          )}

          {activeQuery === "sprintDelay" && (
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Sprint Delay Reason:</p>
              <div className="p-3 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <p className="font-bold text-slate-900 dark:text-white">{queryData?.sprintDelayAnalysis?.sprintName || "Sprint 1"}</p>
                <p className="text-slate-600 dark:text-slate-400 mt-1">{queryData?.sprintDelayAnalysis?.reason || "Work progressing on schedule."}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
