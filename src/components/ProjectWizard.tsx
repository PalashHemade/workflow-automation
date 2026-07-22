"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, GitBranch, Layers, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Link2, Shield, AlertCircle } from "lucide-react";

interface ProjectWizardProps {
  onSuccess: (project: any) => void;
  onCancel?: () => void;
}

export default function ProjectWizard({ onSuccess, onCancel }: ProjectWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Project Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: GitHub Repo
  const [repoMode, setRepoMode] = useState<"select" | "create">("select");
  const [dbRepos, setDbRepos] = useState<any[]>([]);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
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
          setSelectedRepoId(repoData.id);
          setDbRepos((prev) => [repoData, ...prev]);
        } catch (err: any) {
          setError(err.message || "Failed to create repository on GitHub");
          setCreatingRepo(false);
          return;
        } finally {
          setCreatingRepo(false);
        }
      } else {
        if (!selectedRepoId) {
          setError("Please select a repository");
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
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
      {/* Wizard Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold shadow-md">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Engineering Project</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Step {step} of 4: {step === 1 ? "Project Info" : step === 2 ? "Connect GitHub" : step === 3 ? "Connect Jira" : "Review & Deploy"}</p>
          </div>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            Cancel
          </button>
        )}
      </div>

      {/* Step Indicators */}
      <div className="px-6 py-3 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-medium text-slate-500">
        <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-indigo-600 dark:text-indigo-400 font-semibold" : ""}`}>
          <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800"}`}>1</span>
          Project Details
        </div>
        <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-800" />
        <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-indigo-600 dark:text-indigo-400 font-semibold" : ""}`}>
          <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800"}`}>2</span>
          GitHub Repo
        </div>
        <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-800" />
        <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-indigo-600 dark:text-indigo-400 font-semibold" : ""}`}>
          <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800"}`}>3</span>
          Jira Integration
        </div>
        <div className="h-0.5 w-8 bg-slate-200 dark:bg-slate-800" />
        <div className={`flex items-center gap-1.5 ${step >= 4 ? "text-indigo-600 dark:text-indigo-400 font-semibold" : ""}`}>
          <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800"}`}>4</span>
          Review
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Project Name *</label>
              <input
                type="text"
                placeholder="e.g. Core Authentication Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="High-level engineering project goals and domain scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-indigo-500" />
                GitHub Repository Setup
              </h3>

              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRepoMode("select")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    repoMode === "select"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Select Existing Repo
                </button>
                <button
                  type="button"
                  onClick={() => setRepoMode("create")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    repoMode === "create"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Create New on GitHub
                </button>
              </div>
            </div>

            {repoMode === "select" ? (
              loadingRepos ? (
                <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your GitHub repositories...
                </div>
              ) : dbRepos.length === 0 ? (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-xs">
                  No tracked repositories found in database yet. Switch to "Create New on GitHub" above to create one instantly!
                </div>
              ) : (
                <div className="grid gap-3 max-h-64 overflow-y-auto pr-1">
                  {dbRepos.map((repo) => (
                    <label
                      key={repo.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        selectedRepoId === repo.id
                          ? "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/20"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="repository"
                          checked={selectedRepoId === repo.id}
                          onChange={() => setSelectedRepoId(repo.id)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white block">{repo.fullName}</span>
                          <span className="text-xs text-slate-500">ID: {repo.id} • {repo.htmlUrl}</span>
                        </div>
                      </div>
                      {selectedRepoId === repo.id && <CheckCircle2 className="h-4 w-4 text-indigo-500" />}
                    </label>
                  ))}
                </div>
              )
            ) : (
              <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 space-y-4">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Enter a repository name below. We will automatically call the GitHub API to create a brand new repository on your GitHub account, initialize it, and link it to this Engineering Project.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GitHub Repository Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. auth-microservice"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Repository Description</label>
                  <input
                    type="text"
                    placeholder="Optional repository description..."
                    value={newRepoDesc}
                    onChange={(e) => setNewRepoDesc(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRepoPrivate}
                    onChange={(e) => setNewRepoPrivate(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
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
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-purple-500" />
                Connect Jira Project (Optional)
              </h3>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={jiraConnected}
                  onChange={(e) => setJiraConnected(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                Enable Jira Integration
              </label>
            </div>

            {jiraConnected && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Jira Cloud Workspace</label>
                  <select
                    value={selectedCloudId}
                    onChange={(e) => setSelectedCloudId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.url})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Jira Project Key</label>
                  <select
                    value={selectedProjectKey}
                    onChange={(e) => setSelectedProjectKey(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {workspaces[0]?.projects?.map((p: any) => (
                      <option key={p.key} value={p.key}>
                        {p.key} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs flex items-center justify-between">
                  <span>Authorize Atlassian Cloud via OAuth 2.0</span>
                  <a
                    href="/api/auth/jira/authorize"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors"
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
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Review Engineering Project Configuration</h3>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-slate-500">Project Name:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-slate-500">GitHub Repository:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{dbRepos.find((r) => r.id === selectedRepoId)?.fullName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-slate-500">Jira Integration:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{jiraConnected ? `Connected (${selectedProjectKey})` : "Not Connected"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Auto-Correlation Engine:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Enabled (Issue Keys, PR Titles, Branches)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => (s - 1) as any)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        ) : (
          <div />
        )}

        {step < 4 ? (
          <button
            onClick={handleNextStep}
            disabled={creatingRepo}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {creatingRepo ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating Repo on GitHub...
              </>
            ) : (
              <>
                Next Step <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2"
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
          </button>
        )}
      </div>
    </div>
  );
}
