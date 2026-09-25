"use client";

import React, { useState } from "react";
import { Layers, GitCommit, Link2, Sparkles, Tag } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";

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

  const coveragePct =
    stories.length > 0
      ? Math.round((stories.filter((s: any) => s.storyCommits?.length > 0).length / stories.length) * 100)
      : 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="space-y-1 p-4">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Sprint</span>
          <span className="block text-lg font-extrabold text-foreground">{activeSprint?.name || "Sprint 1"}</span>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">State: {activeSprint?.state || "ACTIVE"}</span>
        </Card>
        <MetricCard label="Stories" value={stories.length} trendLabel={`${stories.filter((s: any) => s.status === "Done").length} completed`} />
        <MetricCard label="Bugs / Tasks" value={tasks.length} trendLabel="Tracked Jira subtasks" />
        <MetricCard label="Correlation Coverage" value={`${coveragePct}%`} trendLabel="Stories linked with code" />
      </div>

      {epics.length > 0 && (
        <Card className="space-y-3 p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Jira Epics
          </h3>
          <div className="flex flex-wrap gap-2">
            {epics.map((epic: any) => (
              <div key={epic.id} className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                <Tag className="h-3 w-3" />
                <span>
                  [{epic.key}] {epic.summary}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Jira Stories & Correlated GitHub Code
          </h3>
          <span className="text-xs text-muted-foreground">{stories.length} Total Stories</span>
        </div>

        {stories.length === 0 ? (
          <EmptyState icon={Layers} title="No Jira stories synchronized yet" className="rounded-none border-0" />
        ) : (
          <div className="divide-y divide-border">
            {stories.map((story: any) => (
              <div key={story.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="info">{story.key}</Badge>
                    <h4 className="text-sm font-semibold text-foreground">{story.summary}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={story.status === "Done" ? "success" : "warning"}>{story.status}</Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedStoryId(selectedStoryId === story.id ? null : story.id)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Link Code
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-l-2 border-border pl-4">
                  {story.storyCommits?.length > 0 ? (
                    <div className="space-y-1">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                        <GitCommit className="h-3 w-3 text-primary" /> Correlated Commits ({story.storyCommits.length})
                      </span>
                      {story.storyCommits.map((sc: any) => (
                        <div key={sc.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2 text-xs text-foreground">
                          <span className="font-mono text-primary">
                            {sc.commit?.sha?.slice(0, 7)} - {sc.commit?.message}
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {sc.matchedBy} ({sc.confidence}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="block text-[11px] italic text-muted-foreground">No linked commits yet</span>
                  )}
                </div>

                {selectedStoryId === story.id && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <input
                      type="text"
                      placeholder="Enter commit hash SHA to link..."
                      value={manualCommitSha}
                      onChange={(e) => setManualCommitSha(e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                    />
                    <Button size="sm" onClick={() => handleManualCorrelate(story.id)} disabled={correlating}>
                      {correlating ? "Linking..." : "Confirm Link"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
