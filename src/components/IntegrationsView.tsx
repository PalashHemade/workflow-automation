"use client";

import React, { useState, useEffect } from "react";
import { GitBranch, Layers, Cpu, MessageSquare, ShieldCheck, Plus, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";

interface IntegrationsViewProps {
  projectId: string;
}

export default function IntegrationsView({ projectId }: IntegrationsViewProps) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntegrations();
  }, [projectId]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations`);
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (err) {
      console.error("Error fetching integrations:", err);
    } finally {
      setLoading(false);
    }
  };

  const availableProviders = [
    { name: "GITHUB", title: "GitHub Repository", description: "Primary source code host, commits, and pull requests.", icon: GitBranch, connected: integrations.some((i) => i.provider === "GITHUB") },
    { name: "JIRA", title: "Jira Software", description: "Agile project tracking, sprints, epics, stories, and bugs.", icon: Layers, connected: integrations.some((i) => i.provider === "JIRA") },
    { name: "JENKINS", title: "Jenkins CI/CD", description: "Continuous integration and automated build pipeline runs.", icon: Cpu, connected: integrations.some((i) => i.provider === "JENKINS") },
    { name: "SLACK", title: "Slack Workspace", description: "Real-time deployment notifications and team alert channels.", icon: MessageSquare, connected: integrations.some((i) => i.provider === "SLACK") },
    { name: "SONARQUBE", title: "SonarQube Quality", description: "Code quality gates, security vulnerabilities, and coverage metrics.", icon: ShieldCheck, connected: integrations.some((i) => i.provider === "SONARQUBE") },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Plug-and-Play Integrations Hub</h3>
            <p className="text-xs text-slate-500">Connect third-party developer tool providers directly to this Engineering Project.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableProviders.map((prov) => {
            const Icon = prov.icon;
            const existing = integrations.find((i) => i.provider === prov.name);

            return (
              <div
                key={prov.name}
                className={`p-5 rounded-xl border transition-all ${
                  prov.connected
                    ? "bg-slate-50/80 dark:bg-slate-950/80 border-indigo-500/30"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{prov.title}</h4>
                      <p className="text-xs text-slate-500">{prov.description}</p>
                    </div>
                  </div>
                  {prov.connected ? (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                    </span>
                  ) : (
                    <button className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold">
                      Connect
                    </button>
                  )}
                </div>

                {existing && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Status: <strong className="text-emerald-500">{existing.status}</strong></span>
                    <span>Last Sync: {existing.lastSyncAt ? new Date(existing.lastSyncAt).toLocaleString() : "Never"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
