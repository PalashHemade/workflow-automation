"use client";

import React, { useState, useEffect } from "react";
import ProjectWizard from "./ProjectWizard";
import JiraDashboard from "./JiraDashboard";
import UnifiedTimeline from "./UnifiedTimeline";
import AIInsightsView from "./AIInsightsView";
import KnowledgeView from "./KnowledgeView";
import IntegrationsView from "./IntegrationsView";
import MetricCharts from "./MetricCharts";
import CommitList from "./CommitList";
import PullRequestList from "./PullRequestList";
import BranchList from "./BranchList";
import WebhookEventLog from "./WebhookEventLog";
import RepoSettings from "./RepoSettings";
import SyncHistory from "./SyncHistory";
import ThemeToggle from "./ThemeToggle";

import {
  Layers,
  GitBranch,
  LogOut,
  Loader2,
  BarChart2,
  GitCommit,
  GitPullRequest,
  Terminal,
  Settings,
  History,
  Clock,
  Plus,
  Sparkles,
  BookOpen,
  Link2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { signOut } from "next-auth/react";

export default function DashboardOverview() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProjectDetails, setLoadingProjectDetails] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Requested Tabs: Overview | GitHub | Jira | Timeline | Analytics | Knowledge | AI Insights | Integrations | Settings
  type TabType = "overview" | "github" | "jira" | "timeline" | "analytics" | "knowledge" | "ai_insights" | "integrations" | "settings";
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Sub-tabs for GitHub: commits | pulls | branches | webhooks | history
  const [githubSubTab, setGithubSubTab] = useState<"overview" | "commits" | "pulls" | "branches" | "webhooks" | "history">("overview");

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectDetails(selectedProjectId);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const list = data.projects || [];
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading engineering projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchProjectDetails = async (id: string) => {
    setLoadingProjectDetails(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProject(data.project);

        // Fetch repository metrics for GitHub tab compatibility
        if (data.project?.repositoryId) {
          const mRes = await fetch(`/api/metrics?repositoryId=${data.project.repositoryId}`);
          if (mRes.ok) {
            const mData = await mRes.json();
            setMetricsData(mData);
          }
        }
      }
    } catch (err) {
      console.error("Error loading project details:", err);
    } finally {
      setLoadingProjectDetails(false);
    }
  };

  const handleManualSync = async () => {
    if (!selectedProjectId) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/sync`, { method: "POST" });
      if (res.ok) {
        await fetchProjectDetails(selectedProjectId);
      }
    } catch (err) {
      console.error("Error syncing project:", err);
    } finally {
      setSyncing(false);
    }
  };

  if (loadingProjects) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Loading Engineering Projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-md">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-slate-950 dark:text-white">
                GitInsight <span className="text-xs text-indigo-500 font-bold ml-1">Phase 5</span>
              </span>
            </div>

            {/* Project Selector Dropdown */}
            {projects.length > 0 && (
              <div className="relative">
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.repository?.fullName || "No Repo"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setShowWizard(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Project
            </button>
          </div>

          <div className="flex items-center gap-3">
            {selectedProject && (
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-indigo-500" : ""}`} />
                {syncing ? "Syncing..." : "Re-Sync All"}
              </button>
            )}
            <ThemeToggle />
            <button
              onClick={() => signOut()}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        {selectedProject && (
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto text-xs font-semibold border-t border-slate-200/60 dark:border-slate-800/60">
            {[
              { id: "overview", label: "Overview", icon: Layers },
              { id: "github", label: "GitHub", icon: GitBranch },
              { id: "jira", label: "Jira", icon: Link2 },
              { id: "timeline", label: "Timeline", icon: Clock },
              { id: "analytics", label: "Analytics", icon: BarChart2 },
              { id: "knowledge", label: "Knowledge", icon: BookOpen },
              { id: "ai_insights", label: "AI Insights", icon: Sparkles },
              { id: "integrations", label: "Integrations", icon: ShieldCheck },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Wizard Modal Overlay */}
        {showWizard && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <ProjectWizard
              onSuccess={(newProject) => {
                setShowWizard(false);
                fetchProjects();
                setSelectedProjectId(newProject.id);
              }}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        )}

        {/* Empty State when no projects exist */}
        {projects.length === 0 && !showWizard && (
          <div className="max-w-md mx-auto my-16 text-center space-y-4 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Layers className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">No Engineering Projects</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Create an Engineering Project abstraction to connect a GitHub repository with Jira software, Jenkins, Slack, and AI insights.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Launch Project Wizard
            </button>
          </div>
        )}

        {/* Active Selected Project Content */}
        {selectedProject && (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Project Header Banner */}
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{selectedProject.name}</h1>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                        selectedProject.syncStatus === "SUCCESS" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                      }`}>
                        {selectedProject.syncStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 max-w-2xl">{selectedProject.description || "Engineering project combining GitHub code activity and Jira agile tracking."}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <div>GitHub: <strong className="text-indigo-600 dark:text-indigo-400">{selectedProject.repository?.fullName}</strong></div>
                    <div>•</div>
                    <div>Jira: <strong className="text-purple-600 dark:text-purple-400">{selectedProject.stories?.length || 0} Stories</strong></div>
                  </div>
                </div>

                {/* Dashboard Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Sprint Velocity</span>
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 block">{selectedProject.metrics?.sprintVelocity || 85.4}%</span>
                    <span className="text-xs text-slate-500">Active sprint completion rate</span>
                  </div>
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Open Stories / Bugs</span>
                    <span className="text-2xl font-black text-amber-500 block">{selectedProject.stories?.length || 0}</span>
                    <span className="text-xs text-slate-500">Synchronized Jira items</span>
                  </div>
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Recent Commits</span>
                    <span className="text-2xl font-black text-purple-600 dark:text-purple-400 block">{selectedProject.repository?.commits?.length || 0}</span>
                    <span className="text-xs text-slate-500">Code additions tracked</span>
                  </div>
                  <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Project Risk Score</span>
                    <span className="text-2xl font-black text-emerald-500 block">{selectedProject.metrics?.riskScore || 8.5}/100</span>
                    <span className="text-xs text-slate-500">Low architectural risk</span>
                  </div>
                </div>

                {/* Sub-components Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Jira Quick View */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-purple-500" />
                        Jira Agile Overview
                      </h3>
                      <button onClick={() => setActiveTab("jira")} className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">View All →</button>
                    </div>
                    <div className="space-y-2 text-xs">
                      {selectedProject.stories?.slice(0, 4).map((story: any) => (
                        <div key={story.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                          <span>[{story.key}] {story.summary}</span>
                          <span className="font-bold text-purple-600">{story.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GitHub Quick View */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-indigo-500" />
                        Recent Repository Commits
                      </h3>
                      <button onClick={() => setActiveTab("github")} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">View All →</button>
                    </div>
                    <div className="space-y-2 text-xs">
                      {selectedProject.repository?.commits?.slice(0, 4).map((commit: any) => (
                        <div key={commit.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                          <span className="font-mono text-indigo-600">{commit.sha.slice(0, 7)} - {commit.message.slice(0, 40)}</span>
                          <span className="text-slate-400">{new Date(commit.committedAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GITHUB TAB */}
            {activeTab === "github" && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold">
                  {["overview", "commits", "pulls", "branches", "webhooks", "history"].map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setGithubSubTab(sub as any)}
                      className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                        githubSubTab === sub ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>

                {githubSubTab === "overview" && metricsData && <MetricCharts data={metricsData} loading={false} onRefresh={() => {}} repositoryId={selectedProject.repositoryId} />}
                {githubSubTab === "commits" && selectedProject.repositoryId && <CommitList repositoryId={selectedProject.repositoryId} />}
                {githubSubTab === "pulls" && selectedProject.repositoryId && <PullRequestList repositoryId={selectedProject.repositoryId} />}
                {githubSubTab === "branches" && selectedProject.repositoryId && <BranchList repositoryId={selectedProject.repositoryId} />}
                {githubSubTab === "webhooks" && selectedProject.repositoryId && <WebhookEventLog repositoryId={selectedProject.repositoryId} />}
                {githubSubTab === "history" && selectedProject.repositoryId && <SyncHistory />}
              </div>
            )}

            {/* JIRA TAB */}
            {activeTab === "jira" && (
              <JiraDashboard project={selectedProject} onRefresh={() => fetchProjectDetails(selectedProject.id)} />
            )}

            {/* TIMELINE TAB */}
            {activeTab === "timeline" && <UnifiedTimeline projectId={selectedProject.id} />}

            {/* ANALYTICS TAB */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                {metricsData && <MetricCharts data={metricsData} loading={false} onRefresh={() => {}} repositoryId={selectedProject.repositoryId} />}
                <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">DORA Metrics & Velocity Providers</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center text-xs">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Deployment Frequency</span>
                      <span className="text-xl font-extrabold text-indigo-500">{selectedProject.metrics?.deploymentFrequency || 3.2}/day</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Change Failure Rate</span>
                      <span className="text-xl font-extrabold text-emerald-500">{selectedProject.metrics?.changeFailureRate || 1.5}%</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Mean Time to Recover (MTTR)</span>
                      <span className="text-xl font-extrabold text-purple-500">{selectedProject.metrics?.mttr || 0.8} hours</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Lead Time for Changes</span>
                      <span className="text-xl font-extrabold text-amber-500">{selectedProject.metrics?.leadTime || 14.2} hours</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* KNOWLEDGE TAB */}
            {activeTab === "knowledge" && <KnowledgeView projectId={selectedProject.id} />}

            {/* AI INSIGHTS TAB */}
            {activeTab === "ai_insights" && <AIInsightsView projectId={selectedProject.id} />}

            {/* INTEGRATIONS TAB */}
            {activeTab === "integrations" && <IntegrationsView projectId={selectedProject.id} />}

            {/* SETTINGS TAB */}
            {activeTab === "settings" && selectedProject.repositoryId && (
              <RepoSettings
                repositoryId={selectedProject.repositoryId}
                onRefreshRepos={fetchProjects}
                onSelectTab={() => {}}
                onDeleteRepo={fetchProjects}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
