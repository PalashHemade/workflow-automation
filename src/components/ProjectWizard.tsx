"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, GitBranch, Layers, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Link2, AlertCircle, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/core/utils";

interface ProjectWizardProps {
  onSuccess: (project: any) => void;
  onCancel?: () => void;
}

const STEP_LABELS = ["Project Details", "GitHub Repo", "Jira Integration", "Review"];

export default function ProjectWizard({ onSuccess, onCancel }: ProjectWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Project Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: GitHub Repo
  const [repoMode, setRepoMode] = useState<"pick" | "create">("pick");
  const [dbRepos, setDbRepos] = useState<any[]>([]);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [selectedRepoLabel, setSelectedRepoLabel] = useState<string>("");
  const [repoSearch, setRepoSearch] = useState("");
  const [registeringRepoId, setRegisteringRepoId] = useState<number | null>(null);

  // Create New Repo
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);

  const [creatingRepo, setCreatingRepo] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Step 3: Jira Connection
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedCloudId, setSelectedCloudId] = useState<string>("");
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>("");
  const [jiraConnected, setJiraConnected] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
    fetchJiraWorkspaces();
  }, []);

  const fetchRepositories = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/repos");
      if (res.ok) {
        const data = await res.json();
        setDbRepos(data.dbRepos || []);
        setGithubRepos(data.githubRepos || []);
        if (data.dbRepos && data.dbRepos.length > 0) {
          setSelectedRepoId(data.dbRepos[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching repositories:", err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchJiraWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await fetch("/api/jira/workspaces");
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
        if (data.workspaces && data.workspaces.length > 0) {
          setSelectedCloudId(data.workspaces[0].id);
          if (data.workspaces[0].projects && data.workspaces[0].projects.length > 0) {
            setSelectedProjectKey(data.workspaces[0].projects[0].key);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching Jira workspaces:", err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  /** Registers a GitHub repo into the DB (if not already there) and selects it. */
  const handlePickGithubRepo = async (ghRepo: { githubId: number; owner: string; name: string; fullName: string }) => {
    // Check if already in DB
    const existing = dbRepos.find((r) => String(r.githubId) === String(ghRepo.githubId));
    if (existing) {
      setSelectedRepoId(existing.id);
      setSelectedRepoLabel(existing.fullName);
      return;
    }

    setRegisteringRepoId(ghRepo.githubId);
    setError(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: ghRepo.owner, name: ghRepo.name, createNewOnGitHub: false }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to register repository");
      }
      const repoData = await res.json();
      setDbRepos((prev) => [repoData.repository, ...prev]);
      setSelectedRepoId(repoData.repository.id);
      setSelectedRepoLabel(repoData.repository.fullName);
    } catch (err: any) {
      setError(err.message || "Failed to register repository");
    } finally {
      setRegisteringRepoId(null);
    }
  };

  const handleNextStep = async () => {
    if (step === 1 && !name) {
      setError("Please enter a project name");
      return;
    }

    if (step === 2) {
      if (repoMode === "create") {
        if (!newRepoName) {
          setError("Please enter a name for the new GitHub repository");
          return;
        }
        setCreatingRepo(true);
        setError(null);
        try {
          const res = await fetch("/api/repos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: newRepoName,
              description: newRepoDesc,
              isPrivate: newRepoPrivate,
              createNewOnGitHub: true,
            }),
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to create GitHub repository");
          }
          const repoData = await res.json();
          setSelectedRepoId(repoData.repository.id);
          setSelectedRepoLabel(repoData.repository.fullName || newRepoName);
          setDbRepos((prev) => [repoData.repository, ...prev]);
        } catch (err: any) {
          setError(err.message || "Failed to create repository on GitHub");
          setCreatingRepo(false);
          return;
        } finally {
          setCreatingRepo(false);
        }
      } else {
        // "pick" mode — user must have clicked a repo
        if (!selectedRepoId) {
          setError("Please select one of your GitHub repositories");
          return;
        }
      }
    }

    setError(null);
    setStep((s) => (s + 1) as any);
  };

  const handleSubmit = async () => {
    if (!name || !selectedRepoId) {
      setError("Please provide a project name and select a GitHub repository.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          repositoryId: selectedRepoId,
          jiraProjectKey: jiraConnected ? selectedProjectKey : undefined,
          jiraCloudId: jiraConnected ? selectedCloudId : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create project");
      }

      const data = await res.json();
      onSuccess(data.project);
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-3xl overflow-hidden p-0 shadow-xl">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 font-bold text-white shadow-md">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Create Engineering Project</h2>
            <p className="text-xs text-muted-foreground">
              Step {step} of 4: {STEP_LABELS[step - 1]}
            </p>
          </div>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        )}
      </div>

      {/* Step Indicators */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/20 px-6 py-3 text-xs font-medium text-muted-foreground">
        {STEP_LABELS.map((label, idx) => {
          const n = idx + 1;
          return (
            <React.Fragment key={label}>
              {idx > 0 && <div className="h-0.5 w-4 bg-border sm:w-8" />}
              <div className={cn("flex items-center gap-1.5", step >= n && "font-semibold text-primary")}>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    step >= n ? "bg-primary text-primary-foreground" : "bg-secondary"
                  )}
                >
                  {n}
                </span>
                {label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="space-y-6 p-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Project Name *</label>
              <input
                type="text"
                placeholder="e.g. Core Authentication Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Description</label>
              <textarea
                rows={3}
                placeholder="High-level engineering project goals and domain scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <GitBranch className="h-4 w-4 text-primary" />
                Select a GitHub Repository
              </h3>
              <div className="flex rounded-lg bg-secondary p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRepoMode("pick")}
                  className={cn(
                    "rounded-md px-3 py-1 transition-colors",
                    repoMode === "pick" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Your Repos
                </button>
                <button
                  type="button"
                  onClick={() => setRepoMode("create")}
                  className={cn(
                    "rounded-md px-3 py-1 transition-colors",
                    repoMode === "create" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Create New
                </button>
              </div>
            </div>

            {repoMode === "pick" ? (
              loadingRepos ? (
                <div className="flex items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your GitHub repositories...
                </div>
              ) : githubRepos.length === 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                  No GitHub repositories found. Make sure your GitHub account is connected.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={`Search your ${githubRepos.length} repositories...`}
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-xs text-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Selected indicator */}
                  {selectedRepoId && selectedRepoLabel && (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Selected: {selectedRepoLabel}
                    </div>
                  )}

                  {/* Repo list */}
                  <div className="grid max-h-64 gap-1.5 overflow-y-auto pr-1">
                    {githubRepos
                      .filter((r) => repoSearch === "" || r.fullName.toLowerCase().includes(repoSearch.toLowerCase()))
                      .map((repo) => {
                        const existingDbRepo = dbRepos.find((d) => String(d.githubId) === String(repo.githubId));
                        const isSelected = existingDbRepo ? selectedRepoId === existingDbRepo.id : false;
                        const isRegistering = registeringRepoId === repo.githubId;
                        return (
                          <button
                            key={repo.githubId}
                            type="button"
                            onClick={() => handlePickGithubRepo(repo)}
                            disabled={isRegistering}
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-50",
                              isSelected
                                ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.6)]"
                                : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                            )}
                          >
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">{repo.fullName}</span>
                              {existingDbRepo && (
                                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Already tracked</span>
                              )}
                            </div>
                            <div className="ml-3 shrink-0">
                              {isRegistering ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : isSelected ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="text-xs leading-relaxed text-muted-foreground">
                  Enter a repository name below. We will automatically call the GitHub API to create a brand new repository on your GitHub account, initialize it, and link it to this Engineering Project.
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">GitHub Repository Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. auth-microservice"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Repository Description</label>
                  <input
                    type="text"
                    placeholder="Optional repository description..."
                    value={newRepoDesc}
                    onChange={(e) => setNewRepoDesc(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={newRepoPrivate}
                    onChange={(e) => setNewRepoPrivate(e.target.checked)}
                    className="h-4 w-4 rounded text-primary focus:ring-ring"
                  />
                  Make this GitHub Repository Private
                </label>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Link2 className="h-4 w-4 text-violet-500" />
                Connect Jira Project (Optional)
              </h3>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={jiraConnected}
                  onChange={(e) => setJiraConnected(e.target.checked)}
                  className="h-4 w-4 rounded text-violet-600 focus:ring-violet-500"
                />
                Enable Jira Integration
              </label>
            </div>

            {jiraConnected && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Jira Cloud Workspace</label>
                  <select
                    value={selectedCloudId}
                    onChange={(e) => setSelectedCloudId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.url})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Jira Project Key</label>
                  <select
                    value={selectedProjectKey}
                    onChange={(e) => setSelectedProjectKey(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {workspaces
                      .find((w) => w.id === selectedCloudId)
                      ?.projects?.map((p: any) => (
                        <option key={p.key} value={p.key}>
                          {p.key} - {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-600 dark:text-violet-400">
                  <span>Authorize Atlassian Cloud via OAuth 2.0</span>
                  <a
                    href="/api/auth/jira/authorize"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
                  >
                    OAuth Login
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Review Engineering Project Configuration</h3>
            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4 text-xs">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Project Name:</span>
                <span className="font-semibold text-foreground">{name}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">GitHub Repository:</span>
                <span className="font-semibold text-primary">{repoMode === "pick" ? selectedRepoLabel || "—" : newRepoName || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Jira Integration:</span>
                <span className="font-semibold text-violet-600 dark:text-violet-400">
                  {jiraConnected ? `Connected (${selectedProjectKey})` : "Not Connected"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-Correlation Engine:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Enabled (Issue Keys, PR Titles, Branches)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between border-t border-border bg-secondary/30 p-6">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep((s) => (s - 1) as any)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <Button onClick={handleNextStep} disabled={creatingRepo}>
            {creatingRepo ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying Repository...
              </>
            ) : (
              <>
                Next Step <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating Project...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Create Engineering Project
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
