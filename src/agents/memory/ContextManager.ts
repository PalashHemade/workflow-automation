export interface RawProjectData {
  project?: any;
  knowledge?: any;
  modules?: any[];
  metrics?: any;
  sprints?: any[];
  commits?: any[];
  pullRequests?: any[];
  pipelines?: any[];
  events?: any[];
}

export class ContextManager {
  /**
   * Compresses raw database entities into a tight, focused JSON payload for the LLM.
   * Strips bloated fields, caps array lengths, and extracts summary metrics.
   */
  public compressContext(raw: RawProjectData): Record<string, any> {
    const compact: Record<string, any> = {};

    if (raw.project) {
      compact.projectInfo = {
        id: raw.project.id,
        name: raw.project.name,
        description: raw.project.description,
        primaryBranch: raw.project.primaryBranch,
        syncStatus: raw.project.syncStatus,
      };
    }

    if (raw.knowledge) {
      compact.projectMemory = {
        projectSummary: raw.knowledge.projectSummary,
        architectureSummary: raw.knowledge.architectureSummary,
        riskSummary: raw.knowledge.riskSummary,
        engineeringMemory: raw.knowledge.engineeringMemory,
      };
    }

    if (Array.isArray(raw.modules) && raw.modules.length > 0) {
      compact.topModules = raw.modules.slice(0, 5).map((m) => ({
        name: m.name,
        healthScore: m.healthScore,
        riskScore: m.riskScore,
        coverage: m.coverage,
      }));
    }

    if (raw.metrics) {
      compact.doraMetrics = {
        leadTimeHours: raw.metrics.leadTime,
        cycleTimeHours: raw.metrics.cycleTime,
        deploymentFrequency: raw.metrics.deploymentFrequency,
        changeFailureRatePercent: raw.metrics.changeFailureRate,
        openRiskCount: raw.metrics.openRiskCount,
      };
    }

    if (Array.isArray(raw.sprints) && raw.sprints.length > 0) {
      const activeSprint = raw.sprints[0];
      const stories = activeSprint.stories || [];
      const completed = stories.filter((s: any) => s.status === "DONE" || s.status === "CLOSED").length;

      compact.sprintSummary = {
        name: activeSprint.name,
        state: activeSprint.state,
        totalStories: stories.length,
        completedStories: completed,
        pendingStories: stories.length - completed,
        sampleStories: stories.slice(0, 5).map((s: any) => ({
          key: s.key,
          summary: s.summary,
          status: s.status,
          priority: s.priority,
          linkedCommitsCount: s.storyCommits?.length || 0,
          linkedPRsCount: s.storyPullRequests?.length || 0,
        })),
      };
    }

    if (Array.isArray(raw.commits) && raw.commits.length > 0) {
      compact.recentCommitsCount = raw.commits.length;
      compact.recentCommitsSample = raw.commits.slice(0, 5).map((c) => ({
        sha: c.sha?.substring(0, 7),
        message: c.message?.split("\n")[0],
        author: c.authorName,
        filesChanged: c.files?.length || 0,
      }));
    }

    if (Array.isArray(raw.pullRequests) && raw.pullRequests.length > 0) {
      const openPRs = raw.pullRequests.filter((pr) => pr.state === "open");
      compact.pullRequestsSummary = {
        totalFetched: raw.pullRequests.length,
        openPRsCount: openPRs.length,
        openPRsSample: openPRs.slice(0, 5).map((pr) => ({
          number: pr.number,
          title: pr.title,
          author: pr.authorName,
          createdAt: pr.createdAt,
          reviewCount: pr.reviews?.length || 0,
        })),
      };
    }

    if (Array.isArray(raw.pipelines) && raw.pipelines.length > 0) {
      const failed = raw.pipelines.filter((p) => p.status === "FAILURE");
      compact.pipelinesSummary = {
        recentRunsCount: raw.pipelines.length,
        recentFailuresCount: failed.length,
      };
    }

    return compact;
  }
}
