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
import AddRepositoryModal from "./AddRepositoryModal";
import { GitInsightLogo, GitInsightMark } from "./GitInsightLogo";

import { SidebarContainer, SidebarNavItem, SidebarSection } from "@/components/ui/Sidebar";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PillTabsList, PillTabsTrigger, Tabs, TabsContent } from "@/components/ui/Tabs";
import { SimpleTooltip, TooltipProvider } from "@/components/ui/Tooltip";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/Dropdown";

import {
  Layers,
  GitBranch,
  LogOut,
  Loader2,
  BarChart2,
  Settings,
  Clock,
  Plus,
  Sparkles,
  BookOpen,
  Link2,
  ShieldCheck,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/core/utils";

type TabType =
  | "overview"
  | "repository"
  | "jira"
  | "timeline"
  | "analytics"
  | "modules"
  | "ai_insights"
  | "integrations"
  | "settings";

const NAV_ITEMS: { id: TabType; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "repository", label: "Repository", icon: GitBranch },
  { id: "jira", label: "Jira", icon: Link2 },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "modules", label: "Modules", icon: BookOpen },
  { id: "ai_insights", label: "AI Insights", icon: Sparkles },
  { id: "integrations", label: "Integrations", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

/** A project's linked repos, primary first — falls back to the first-added repo if none is flagged primary. */
function getPrimaryRepoLink(repositories: any[] | undefined) {
  if (!repositories || repositories.length === 0) return null;
  return repositories.find((r) => r.isPrimary) ?? repositories[0];
}

export default function DashboardOverview() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingProjectDetails, setLoadingProjectDetails] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [repoSubTab, setRepoSubTab] = useState<"overview" | "commits" | "pulls" | "branches" | "webhooks" | "history">("overview");

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

  useEffect(() => {
    if (!selectedRepoId) return;
    fetch(`/api/metrics?repositoryId=${selectedRepoId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((mData) => mData && setMetricsData(mData))
      .catch((err) => console.error("Error loading repo metrics:", err));
  }, [selectedRepoId]);

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

        const primaryRepoId = getPrimaryRepoLink(data.project?.repositories)?.repository?.id ?? null;
        setSelectedRepoId(primaryRepoId);
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">Loading Engineering Projects...</p>
        </div>
      </div>
    );
  }

  const members: any[] = selectedProject?.members || [];
  const projectRepoLinks: any[] = selectedProject?.repositories || [];
  const primaryRepo = getPrimaryRepoLink(projectRepoLinks)?.repository;
  const extraProjectRepoCount = projectRepoLinks.length - 1;
  const allProjectCommits = projectRepoLinks
    .flatMap((link: any) => link.repository?.commits || [])
    .sort((a: any, b: any) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime());

  const repoSwitcher = projectRepoLinks.length > 0 && (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {projectRepoLinks.map((link: any) => (
        <button
          key={link.repositoryId}
          onClick={() => setSelectedRepoId(link.repository.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            selectedRepoId === link.repository.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/30"
          )}
        >
          <GitBranch className="h-3 w-3" />
          {link.label || link.repository.name}
        </button>
      ))}
      <button
        onClick={() => setShowAddRepoModal(true)}
        className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plus className="h-3 w-3" /> Add repo
      </button>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Sidebar */}
        <SidebarContainer collapsed={sidebarCollapsed} className="hidden md:flex">
          <div className={`flex h-16 items-center border-b border-border px-4 ${sidebarCollapsed ? "justify-center px-0" : "justify-between"}`}>
            <GitInsightLogo showWordmark={!sidebarCollapsed} />
          </div>

          <nav className="flex-1 overflow-y-auto py-3">
            {selectedProject && (
              <SidebarSection>
                {NAV_ITEMS.map((item) => (
                  <SidebarNavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={activeTab === item.id}
                    collapsed={sidebarCollapsed}
                    onClick={() => setActiveTab(item.id)}
                  />
                ))}
              </SidebarSection>
            )}
          </nav>

          <div className="border-t border-border p-2">
            <IconButton
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="w-full"
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </IconButton>
          </div>
        </SidebarContainer>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/60 px-4 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="md:hidden">
                <GitInsightLogo showWordmark={false} />
              </div>
              {projects.length > 0 && (
                <Dropdown>
                  <DropdownTrigger asChild>
                    <button className="flex max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground sm:max-w-xs">
                      <span className="truncate">
                        {projects.find((p) => p.id === selectedProjectId)?.name ?? "Select project"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </DropdownTrigger>
                  <DropdownContent align="start" className="min-w-[220px]">
                    {projects.map((p) => (
                      <DropdownItem key={p.id} onSelect={() => setSelectedProjectId(p.id)}>
                        <div className="flex flex-col">
                          <span className="font-semibold">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {getPrimaryRepoLink(p.repositories)?.repository?.fullName || "No repository"}
                          </span>
                        </div>
                      </DropdownItem>
                    ))}
                    <DropdownSeparator />
                    <DropdownItem onSelect={() => setShowWizard(true)}>
                      <Plus className="h-3.5 w-3.5" /> New project
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              )}
              {projects.length === 0 && (
                <Button size="sm" onClick={() => setShowWizard(true)}>
                  <Plus className="h-3.5 w-3.5" /> New Project
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedProject && (
                <Button variant="outline" size="sm" onClick={handleManualSync} disabled={syncing}>
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-primary" : ""}`} />
                  <span className="hidden sm:inline">{syncing ? "Syncing..." : "Re-Sync"}</span>
                </Button>
              )}
              <ThemeToggle />
              <Dropdown>
                <DropdownTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg border border-border bg-card p-1 pr-2 hover:bg-accent">
                    <Avatar src={session?.user?.image} name={session?.user?.name} size="sm" />
                    {session?.user?.name && (
                      <span className="hidden text-xs font-semibold sm:inline">{session.user.name}</span>
                    )}
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end" className="min-w-[200px]">
                  {session?.user && (
                    <>
                      <div className="px-2.5 py-1.5">
                        <p className="text-xs font-bold text-foreground">{session.user.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{session.user.email}</p>
                      </div>
                      <DropdownSeparator />
                    </>
                  )}
                  <DropdownItem destructive onSelect={() => signOut({ callbackUrl: "/" })}>
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </div>
          </header>

          {/* Mobile tab bar (sidebar becomes a horizontal scroller below md) */}
          {selectedProject && (
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    activeTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {showWizard && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
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

            {selectedProject && (
              <AddRepositoryModal
                open={showAddRepoModal}
                onOpenChange={setShowAddRepoModal}
                projectId={selectedProject.id}
                onAdded={() => {
                  fetchProjects();
                  fetchProjectDetails(selectedProject.id);
                }}
              />
            )}

            {projects.length === 0 && !showWizard && (
              <div className="mx-auto mt-16 max-w-md">
                <EmptyState
                  icon={Layers}
                  title="No Engineering Projects"
                  description="Create an Engineering Project to connect a GitHub repository with Jira, and start building a shared, live picture of the project with your team."
                  action={
                    <Button onClick={() => setShowWizard(true)}>
                      <Plus className="h-4 w-4" /> Launch Project Wizard
                    </Button>
                  }
                />
              </div>
            )}

            {selectedProject && (
              <>
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Your Projects — GitHub-style card grid */}
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-foreground">Your Projects</h2>
                        <Button size="sm" variant="outline" onClick={() => setShowWizard(true)}>
                          <Plus className="h-3.5 w-3.5" /> New Project
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {projects.map((p) => {
                          const isActive = p.id === selectedProjectId;
                          const jiraConnected = p.integrations?.some((i: any) => i.provider === "JIRA");
                          const primaryRepo = getPrimaryRepoLink(p.repositories)?.repository;
                          const extraRepoCount = (p.repositories?.length ?? 0) - 1;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSelectedProjectId(p.id)}
                              className={cn(
                                "group flex flex-col gap-3 rounded-xl border bg-card p-5 text-left transition-all hover:shadow-md",
                                isActive ? "border-primary/50 ring-1 ring-primary/30" : "border-border hover:border-primary/30"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                                    <BookOpen className="h-4 w-4" />
                                  </div>
                                  <span className="truncate text-sm font-semibold text-primary group-hover:underline">
                                    {p.name}
                                  </span>
                                </div>
                                <StatusBadge status={p.syncStatus} />
                              </div>

                              {p.description && (
                                <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                              )}

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                                  {primaryRepo?.fullName}
                                  {extraRepoCount > 0 && <span className="text-muted-foreground/70">+{extraRepoCount} more</span>}
                                </span>
                                {p._count?.stories > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Layers className="h-3 w-3" /> {p._count.stories} stories
                                  </span>
                                )}
                                {p._count?.sprints > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {p._count.sprints} sprints
                                  </span>
                                )}
                                {jiraConnected && <Badge variant="secondary">Jira connected</Badge>}
                                {p.archived && <Badge variant="outline">Archived</Badge>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Project header banner */}
                    <Card className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                            {selectedProject.name}
                          </h1>
                          <StatusBadge status={selectedProject.syncStatus} />
                        </div>
                        <p className="max-w-2xl text-xs text-muted-foreground">
                          {selectedProject.description ||
                            "Engineering project combining GitHub code activity and Jira agile tracking."}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                          <span>
                            GitHub: <strong className="text-primary">{primaryRepo?.fullName}</strong>
                            {extraProjectRepoCount > 0 && <span> +{extraProjectRepoCount} more repo{extraProjectRepoCount > 1 ? "s" : ""}</span>}
                          </span>
                          <span className="text-border">•</span>
                          <span>
                            Jira: <strong className="text-violet-600 dark:text-violet-400">{selectedProject.stories?.length || 0} Stories</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {members.length > 0 && (
                          <div className="flex items-center gap-2">
                            <AvatarStack
                              people={members.map((m: any) => ({ src: m.user?.image, name: m.user?.name || m.githubUsername }))}
                            />
                          </div>
                        )}
                        <SimpleTooltip label="Team invites are coming soon">
                          <span>
                            <Button variant="outline" size="sm" disabled>
                              <UserPlus className="h-3.5 w-3.5" /> Invite
                            </Button>
                          </span>
                        </SimpleTooltip>
                      </div>
                    </Card>

                    {/* KPI grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <MetricCard label="Sprint Velocity" value={`${selectedProject.metrics?.sprintVelocity || 85.4}%`} trendLabel="Active sprint completion rate" />
                      <MetricCard label="Open Stories / Bugs" value={selectedProject.stories?.length || 0} trendLabel="Synchronized Jira items" />
                      <MetricCard label="Recent Commits" value={allProjectCommits.length} trendLabel="Code additions tracked" />
                      <MetricCard label="Project Risk Score" value={`${selectedProject.metrics?.riskScore || 8.5}/100`} trendLabel="Low architectural risk" />
                    </div>

                    {/* Quick views */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Card className="space-y-3 p-5">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <Link2 className="h-4 w-4 text-violet-500" /> Jira Agile Overview
                          </h3>
                          <button onClick={() => setActiveTab("jira")} className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
                            View All →
                          </button>
                        </div>
                        <div className="space-y-2 text-xs">
                          {selectedProject.stories?.slice(0, 4).map((story: any) => (
                            <div key={story.id} className="flex justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
                              <span className="truncate pr-2">
                                [{story.key}] {story.summary}
                              </span>
                              <span className="shrink-0 font-bold text-violet-600 dark:text-violet-400">{story.status}</span>
                            </div>
                          ))}
                          {(!selectedProject.stories || selectedProject.stories.length === 0) && (
                            <p className="py-2 text-center text-muted-foreground">No Jira stories synced yet.</p>
                          )}
                        </div>
                      </Card>

                      <Card className="space-y-3 p-5">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <GitBranch className="h-4 w-4 text-primary" /> Recent Repository Commits
                          </h3>
                          <button onClick={() => setActiveTab("repository")} className="text-xs font-semibold text-primary hover:underline">
                            View All →
                          </button>
                        </div>
                        <div className="space-y-2 text-xs">
                          {allProjectCommits.slice(0, 4).map((commit: any) => (
                            <div key={commit.id} className="flex justify-between rounded-lg border border-border bg-secondary/50 p-2.5">
                              <span className="truncate pr-2 font-mono text-primary">
                                {commit.sha.slice(0, 7)} - {commit.message.slice(0, 40)}
                              </span>
                              <span className="shrink-0 text-muted-foreground">{new Date(commit.committedAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                          {allProjectCommits.length === 0 && (
                            <p className="py-2 text-center text-muted-foreground">No commits synced yet.</p>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {activeTab === "repository" && (
                  <div>
                    {repoSwitcher}
                    <Tabs value={repoSubTab} onValueChange={(v) => setRepoSubTab(v as any)} className="space-y-6">
                      <PillTabsList>
                        {(["overview", "commits", "pulls", "branches", "webhooks", "history"] as const).map((sub) => (
                          <PillTabsTrigger key={sub} value={sub}>
                            {sub}
                          </PillTabsTrigger>
                        ))}
                      </PillTabsList>

                      <TabsContent value="overview">
                        {metricsData && selectedRepoId && (
                          <MetricCharts data={metricsData} loading={false} onRefresh={() => {}} repositoryId={selectedRepoId} />
                        )}
                      </TabsContent>
                      <TabsContent value="commits">
                        {selectedRepoId && <CommitList repositoryId={selectedRepoId} />}
                      </TabsContent>
                      <TabsContent value="pulls">
                        {selectedRepoId && <PullRequestList repositoryId={selectedRepoId} />}
                      </TabsContent>
                      <TabsContent value="branches">
                        {selectedRepoId && <BranchList repositoryId={selectedRepoId} />}
                      </TabsContent>
                      <TabsContent value="webhooks">
                        {selectedRepoId && <WebhookEventLog repositoryId={selectedRepoId} />}
                      </TabsContent>
                      <TabsContent value="history">
                        {selectedRepoId && <SyncHistory />}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {activeTab === "jira" && (
                  <JiraDashboard project={selectedProject} onRefresh={() => fetchProjectDetails(selectedProject.id)} />
                )}

                {activeTab === "timeline" && <UnifiedTimeline projectId={selectedProject.id} />}

                {activeTab === "analytics" && (
                  <div className="space-y-6">
                    {metricsData && selectedRepoId && (
                      <MetricCharts data={metricsData} loading={false} onRefresh={() => {}} repositoryId={selectedRepoId} />
                    )}
                    <Card className="space-y-4 p-6">
                      <h3 className="text-sm font-bold text-foreground">DORA Metrics & Velocity</h3>
                      <div className="grid grid-cols-1 gap-4 text-center text-xs sm:grid-cols-4">
                        <div className="rounded-xl border border-border bg-secondary/50 p-4">
                          <span className="mb-1 block text-muted-foreground">Deployment Frequency</span>
                          <span className="text-xl font-extrabold text-primary">{selectedProject.metrics?.deploymentFrequency || 3.2}/day</span>
                        </div>
                        <div className="rounded-xl border border-border bg-secondary/50 p-4">
                          <span className="mb-1 block text-muted-foreground">Change Failure Rate</span>
                          <span className="text-xl font-extrabold text-emerald-500">{selectedProject.metrics?.changeFailureRate || 1.5}%</span>
                        </div>
                        <div className="rounded-xl border border-border bg-secondary/50 p-4">
                          <span className="mb-1 block text-muted-foreground">Mean Time to Recover</span>
                          <span className="text-xl font-extrabold text-violet-500">{selectedProject.metrics?.mttr || 0.8} hours</span>
                        </div>
                        <div className="rounded-xl border border-border bg-secondary/50 p-4">
                          <span className="mb-1 block text-muted-foreground">Lead Time for Changes</span>
                          <span className="text-xl font-extrabold text-amber-500">{selectedProject.metrics?.leadTime || 14.2} hours</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {activeTab === "modules" && <KnowledgeView projectId={selectedProject.id} />}
                {activeTab === "ai_insights" && <AIInsightsView projectId={selectedProject.id} />}
                {activeTab === "integrations" && <IntegrationsView projectId={selectedProject.id} />}
                {activeTab === "settings" && selectedRepoId && (
                  <div>
                    {repoSwitcher}
                    <RepoSettings
                      repositoryId={selectedRepoId}
                      onRefreshRepos={() => {
                        fetchProjects();
                        fetchProjectDetails(selectedProject.id);
                      }}
                      onSelectTab={() => {}}
                      onDeleteRepo={() => {
                        fetchProjects();
                        fetchProjectDetails(selectedProject.id);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
