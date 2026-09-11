import { db } from "@/lib/db";
import { CorrelationMethod } from "@prisma/client";

export interface CorrelationResult {
  storyId: string;
  issueKey: string;
  matchedBy: CorrelationMethod;
  confidence: number;
  reason: string;
}

/**
 * Parses all unique Jira issue keys (e.g. AUTH-123, PAY-42) from a text string.
 */
export function extractJiraIssueKeys(text: string | null | undefined): string[] {
  if (!text) return [];
  const regex = /([A-Z][A-Z0-9]+-\d+)/g;
  const matches = text.match(regex);
  if (!matches) return [];
  // Return unique uppercase issue keys
  return Array.from(new Set(matches.map((m) => m.toUpperCase())));
}

/**
 * Correlates commits and pull requests for a given EngineeringProject.
 */
export async function correlateProject(projectId: string) {
  const project = await db.engineeringProject.findUnique({
    where: { id: projectId },
    include: {
      repository: {
        include: {
          commits: true,
          pullRequests: true,
          branches: true,
        },
      },
      stories: true,
      tasks: true,
    },
  });

  if (!project || !project.repository) {
    return { correlatedCommits: 0, correlatedPullRequests: 0 };
  }

  const storiesByKey = new Map<string, string>();
  for (const story of project.stories) {
    storiesByKey.set(story.key.toUpperCase(), story.id);
  }

  let correlatedCommitsCount = 0;
  let correlatedPRsCount = 0;

  // 1. Correlate Commits
  for (const commit of project.repository.commits) {
    const keys = extractJiraIssueKeys(commit.message);
    for (const key of keys) {
      const storyId = storiesByKey.get(key);
      if (storyId) {
        await db.storyCommit.upsert({
          where: {
            storyId_commitId: { storyId, commitId: commit.id },
          },
          create: {
            storyId,
            commitId: commit.id,
            confidence: 100.0,
            matchedBy: "COMMIT",
            reason: `Matched issue key ${key} from commit message: "${commit.message.slice(0, 60)}"`,
          },
          update: {
            confidence: 100.0,
            matchedBy: "COMMIT",
            reason: `Matched issue key ${key} from commit message`,
          },
        });
        correlatedCommitsCount++;
      }
    }
  }

  // 2. Correlate Branches (matches branch names to commits/PRs)
  for (const branch of project.repository.branches) {
    const keys = extractJiraIssueKeys(branch.name);
    for (const key of keys) {
      const storyId = storiesByKey.get(key);
      if (storyId) {
        // Find latest commit on this branch or correlate branch commits
        const branchCommit = project.repository.commits.find((c) => c.sha === branch.sha);
        if (branchCommit) {
          await db.storyCommit.upsert({
            where: { storyId_commitId: { storyId, commitId: branchCommit.id } },
            create: {
              storyId,
              commitId: branchCommit.id,
              confidence: 95.0,
              matchedBy: "BRANCH",
              reason: `Matched issue key ${key} from branch name: ${branch.name}`,
            },
            update: {
              confidence: 95.0,
              matchedBy: "BRANCH",
            },
          });
        }
      }
    }
  }

  // 3. Correlate Pull Requests (title & description)
  for (const pr of project.repository.pullRequests) {
    const titleKeys = extractJiraIssueKeys(pr.title);
    const descKeys = extractJiraIssueKeys(pr.title + " " + (pr.title || "")); // Check title and desc

    const allKeys = Array.from(new Set([...titleKeys, ...descKeys]));
    for (const key of allKeys) {
      const storyId = storiesByKey.get(key);
      if (storyId) {
        const isTitleMatch = titleKeys.includes(key);
        const matchedBy: CorrelationMethod = isTitleMatch ? "PR_TITLE" : "PR_DESCRIPTION";
        const confidence = isTitleMatch ? 95.0 : 85.0;

        await db.storyPullRequest.upsert({
          where: {
            storyId_pullRequestId: { storyId, pullRequestId: pr.id },
          },
          create: {
            storyId,
            pullRequestId: pr.id,
            confidence,
            matchedBy,
            reason: `Matched issue key ${key} from PR #${pr.number} ${isTitleMatch ? "title" : "description"}`,
          },
          update: {
            confidence,
            matchedBy,
          },
        });
        correlatedPRsCount++;
      }
    }
  }

  return {
    correlatedCommits: correlatedCommitsCount,
    correlatedPullRequests: correlatedPRsCount,
  };
}

/**
 * Manually links a commit or pull request to a story.
 */
export async function manuallyCorrelateItem(options: {
  storyId: string;
  commitId?: string;
  pullRequestId?: string;
  reason?: string;
}) {
  const { storyId, commitId, pullRequestId, reason } = options;

  if (commitId) {
    await db.storyCommit.upsert({
      where: { storyId_commitId: { storyId, commitId } },
      create: {
        storyId,
        commitId,
        confidence: 100.0,
        matchedBy: "MANUAL",
        reason: reason || "Manually correlated by user",
      },
      update: {
        matchedBy: "MANUAL",
        reason: reason || "Manually correlated by user",
      },
    });
  }

  if (pullRequestId) {
    await db.storyPullRequest.upsert({
      where: { storyId_pullRequestId: { storyId, pullRequestId } },
      create: {
        storyId,
        pullRequestId,
        confidence: 100.0,
        matchedBy: "MANUAL",
        reason: reason || "Manually correlated by user",
      },
      update: {
        matchedBy: "MANUAL",
        reason: reason || "Manually correlated by user",
      },
    });
  }

  return { success: true };
}
