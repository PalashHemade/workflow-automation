"use client";

import React, { useState, useEffect } from "react";
import { Clock, GitCommit, GitPullRequest, Layers, Sparkles, Filter, Cpu, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

interface UnifiedTimelineProps {
  projectId: string;
}

export default function UnifiedTimeline({ projectId }: UnifiedTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");

  useEffect(() => {
    fetchTimeline();
  }, [projectId, selectedProvider]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const url = selectedProvider === "ALL"
        ? `/api/projects/${projectId}/events`
        : `/api/projects/${projectId}/events?provider=${selectedProvider}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Error fetching timeline:", err);
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "GITHUB":
        return <GitCommit className="h-4 w-4 text-indigo-500" />;
      case "JIRA":
        return <Layers className="h-4 w-4 text-purple-500" />;
      case "JENKINS":
        return <Cpu className="h-4 w-4 text-amber-500" />;
      case "AI":
        return <Sparkles className="h-4 w-4 text-emerald-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter className="h-4 w-4 text-indigo-500" />
          Filter Event Source:
        </div>
        <div className="flex items-center gap-2">
          {["ALL", "GITHUB", "JIRA", "JENKINS", "SYSTEM"].map((prov) => (
            <button
              key={prov}
              onClick={() => setSelectedProvider(prov)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                selectedProvider === prov
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {prov}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading unified event bus timeline...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No events recorded for this project timeline yet.</div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {events.map((evt) => (
              <div key={evt.id} className="relative group">
                <div className="absolute -left-6 top-1.5 h-5 w-5 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center shadow-sm">
                  {getProviderIcon(evt.provider)}
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-950/70 rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-1.5 transition-colors group-hover:border-indigo-500/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {evt.provider}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{evt.title}</h4>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">{new Date(evt.timestamp).toLocaleString()}</span>
                  </div>
                  {evt.description && <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{evt.description}</p>}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>Actor: <strong className="text-slate-700 dark:text-slate-300">{evt.actorName}</strong></span>
                    <span>•</span>
                    <span>Type: {evt.entityType}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
