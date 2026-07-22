"use client";

import React, { useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Layers, GitCommit, GitPullRequest, Link2, Plus, Sparkles, User, Tag } from "lucide-react";

interface JiraDashboardProps {
  project: any;
  onRefresh: () => void;
}

export default function JiraDashboard({ project, onRefresh }: JiraDashboardProps) {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [manualCommitSha, setManualCommitSha] = useState("");
  const [correlating, setCorrelating] = useState(false);

  const activeSprint = project?.sprints?.find((s: any) => s.state === "ACTIVE") || project?.sprints?.[0];
  const stories = project?.stories || [];
  const tasks = project?.tasks || [];
  const epics = project?.epics || [];

  const handleManualCorrelate = async (storyId: string) => {
    if (!manualCommitSha) return;
    setCorrelating(true);
    try {
      const commit = project?.repository?.commits?.find((c: any) => c.sha.includes(manualCommitSha));
      const res = await fetch(`/api/projects/${project.id}/correlate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          commitId: commit?.id,
          reason: `Manually correlated commit ${manualCommitSha}`,
        }),
      });

      if (res.ok) {
        setManualCommitSha("");
        setSelectedStoryId(null);
        onRefresh();
      }
    } catch (err) {
      console.error("Error linking item:", err);
    } finally {
      setCorrelating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Active Sprint</span>
          <span className="text-lg font-extrabold text-slate-900 dark:text-white block">{activeSprint?.name || "Sprint 1"}</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">State: {activeSprint?.state || "ACTIVE"}</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Stories</span>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 block">{stories.length}</span>
          <span className="text-xs text-slate-500">{stories.filter((s: any) => s.status === "Done").length} completed</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Bugs / Tasks</span>
          <span className="text-2xl font-black text-amber-500 block">{tasks.length}</span>
          <span className="text-xs text-slate-500">Tracked Jira subtasks</span>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Correlation Coverage</span>
          <span className="text-2xl font-black text-purple-600 dark:text-purple-400 block">
            {stories.length > 0
              ? `${Math.round((stories.filter((s: any) => s.storyCommits?.length > 0).length / stories.length) * 100)}%`
              : "100%"}
          </span>
          <span className="text-xs text-slate-500">Stories linked with code</span>
        </div>
      </div>

      {/* Epics List */}
      {epics.length > 0 && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            Jira Epics
          </h3>
          <div className="flex flex-wrap gap-2">
            {epics.map((epic: any) => (
              <div key={epic.id} className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <Tag className="h-3 w-3" />
                <span>[{epic.key}] {epic.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stories Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Jira Stories & Correlated GitHub Code
          </h3>
          <span className="text-xs text-slate-500">{stories.length} Total Stories</span>
        </div>

        {stories.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <Layers className="h-8 w-8 mx-auto text-slate-400 opacity-50" />
            <p>No Jira stories synchronized yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {stories.map((story: any) => (
              <div key={story.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-600 dark:text-purple-400">
                      {story.key}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{story.summary}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      story.status === "Done" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}>
                      {story.status}
                    </span>
                    <button
                      onClick={() => setSelectedStoryId(selectedStoryId === story.id ? null : story.id)}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Link2 className="h-3.5 w-3.5 inline mr-1" />
                      Link Code
                    </button>
                  </div>
                </div>

                {/* Correlated Items */}
                <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-2">
                  {story.storyCommits?.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <GitCommit className="h-3 w-3 text-indigo-500" /> Correlated Commits ({story.storyCommits.length})
                      </span>
                      {story.storyCommits.map((sc: any) => (
                        <div key={sc.id} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">{sc.commit?.sha?.slice(0, 7)} - {sc.commit?.message}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{sc.matchedBy} ({sc.confidence}%)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic block">No linked commits yet</span>
                  )}
                </div>

                {/* Manual correlation input box */}
                {selectedStoryId === story.id && (
                  <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter commit hash SHA to link..."
                      value={manualCommitSha}
                      onChange={(e) => setManualCommitSha(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => handleManualCorrelate(story.id)}
                      disabled={correlating}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                    >
                      {correlating ? "Linking..." : "Confirm Link"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
