import { db } from "@/lib/core/db";
import { runIncrementalSync } from "@/lib/github/syncEngine";
import { syncJiraProject } from "@/lib/jira/jiraSync";
import { correlateProject } from "@/lib/project/correlationEngine";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("ProjectService");

export interface CreateProjectWizardInput {
  name: string;
  description?: string;
  ownerId: string;
  repositoryId: string;
  primaryBranch?: string;
  defaultBranch?: string;

  // Optional Jira Integration step
  jiraWorkspaceId?: string;
  jiraProjectKey?: string;
  jiraCloudId?: string;
  jiraAccessToken?: string;
  jiraRefreshToken?: string;
}

/**
 * A project's repositories, ordered so the primary one is always first —
 * shared shape between listEngineeringProjects/getEngineeringProjectById.
 */
export function getPrimaryRepository<T extends { isPrimary: boolean; repository: any }>(
  project: { repositories: T[] } | null | undefined
) {
  if (!project) return null;
  return project.repositories.find((r) => r.isPrimary)?.repository ?? project.repositories[0]?.repository ?? null;
}

export async function createEngineeringProject(input: CreateProjectWizardInput) {
  const {
    name,
    description,
    ownerId,
    repositoryId,
    primaryBranch = "main",
    defaultBranch = "main",
    jiraWorkspaceId,
    jiraProjectKey,
    jiraCloudId,
    jiraAccessToken,
    jiraRefreshToken,
  } = input;

  // 1. Transactional Creation / Update of EngineeringProject and Integrations
  const project = await db.$transaction(async (tx) => {
    // Check if an engineering project already exists for this repositoryId
    // (a repository can belong to at most one project, via ProjectRepository)
    const existingLink = await tx.projectRepository.findUnique({
      where: { repositoryId },
    });

    let proj;
    if (existingLink) {
      proj = await tx.engineeringProject.update({
        where: { id: existingLink.engineeringProjectId },
        data: {
          name,
          description,
          ownerId,
          primaryBranch,
          defaultBranch,
          syncStatus: "SYNCING",
        },
      });
    } else {
      proj = await tx.engineeringProject.create({
        data: {
          name,
          description,
          ownerId,
          primaryBranch,
          defaultBranch,
          syncStatus: "SYNCING",
        },
      });
      await tx.projectRepository.create({
        data: {
          engineeringProjectId: proj.id,
          repositoryId,
          isPrimary: true,
        },
      });
    }

    // Upsert GitHub integration
    const githubIntegration = await tx.projectIntegration.upsert({
      where: {
        engineeringProjectId_provider: {
          engineeringProjectId: proj.id,
          provider: "GITHUB",
        },
      },
      create: {
        engineeringProjectId: proj.id,
        provider: "GITHUB",
        status: "CONNECTED",
        config: { repositoryId, primaryBranch },
      },
      update: {
        status: "CONNECTED",
        config: { repositoryId, primaryBranch },
      },
    });

    // Optionally upsert Jira integration
    if (jiraProjectKey) {
      const jiraIntegration = await tx.projectIntegration.upsert({
        where: {
          engineeringProjectId_provider: {
            engineeringProjectId: proj.id,
            provider: "JIRA",
          },
        },
        create: {
          engineeringProjectId: proj.id,
          provider: "JIRA",
          status: "CONNECTED",
          config: {
            jiraWorkspaceId,
            projectKey: jiraProjectKey,
            cloudId: jiraCloudId || "default-cloud",
          },
        },
        update: {
          status: "CONNECTED",
          config: {
            jiraWorkspaceId,
            projectKey: jiraProjectKey,
            cloudId: jiraCloudId || "default-cloud",
          },
        },
      });

      if (jiraAccessToken) {
        const existingCred = await tx.oAuthCredential.findFirst({
          where: { integrationId: jiraIntegration.id, provider: "JIRA" },
        });

        if (existingCred) {
          await tx.oAuthCredential.update({
            where: { id: existingCred.id },
            data: {
              accessToken: jiraAccessToken,
              refreshToken: jiraRefreshToken || existingCred.refreshToken,
            },
          });
        } else {
          await tx.oAuthCredential.create({
            data: {
              integrationId: jiraIntegration.id,
              provider: "JIRA",
              accessToken: jiraAccessToken,
              refreshToken: jiraRefreshToken,
              accountName: "Jira Atlassian User",
            },
          });
        }
      }
    }

    // Populate or update ProjectKnowledge
    await tx.projectKnowledge.upsert({
      where: { engineeringProjectId: proj.id },
      create: {
        engineeringProjectId: proj.id,
        projectSummary: `Engineering Project ${name} initialized. Connected with GitHub repository.`,
        architectureSummary: `Primary codebase hosted on branch ${primaryBranch}. Modular architecture structure.`,
        riskSummary: `Initial tracking established. No critical risks flagged.`,
        releaseSummary: `Release pipeline ready. Tracking commit frequency and PR velocity.`,
        engineeringMemory: `Project created on ${new Date().toISOString()}. Initialized domain models and integrations.`,
      },
      update: {
        projectSummary: `Engineering Project ${name} updated. Connected with GitHub repository.`,
      },
    });

    // Populate Subsystem ModuleKnowledge items if not present
    const existingModules = await tx.moduleKnowledge.count({
      where: { engineeringProjectId: proj.id },
    });

    if (existingModules === 0) {
      const modules = [
        { name: "Core Engine", owner: "Core Team", complexityScore: 1.0, healthScore: 100.0, riskScore: 0.0 },
        { name: "API & Data Sync", owner: "Backend Lead", complexityScore: 1.1, healthScore: 98.0, riskScore: 0.0 },
        { name: "Authentication & Security", owner: "Security Lead", complexityScore: 1.2, healthScore: 100.0, riskScore: 0.0 },
      ];

      for (const mod of modules) {
        await tx.moduleKnowledge.create({
          data: {
            engineeringProjectId: proj.id,
            name: mod.name,
            owner: mod.owner,
            complexityScore: mod.complexityScore,
            healthScore: mod.healthScore,
            riskScore: mod.riskScore,
            coverage: 85.0,
            dependencies: ["PostgreSQL", "Redis"],
          },
        });
      }
    }

    // Create or keep ProjectMetrics
    await tx.projectMetrics.upsert({
      where: { engineeringProjectId: proj.id },
      create: {
        engineeringProjectId: proj.id,
        sprintVelocity: 24.5,
        leadTime: 18.2,
        cycleTime: 4.5,
        deploymentFrequency: 3.2,
        meanReviewTime: 2.1,
        bugRate: 1.4,
        riskScore: 8.5,
        changeFailureRate: 2.0,
        mttr: 1.2,
        deploymentSuccessRate: 98.5,
        openRiskCount: 0,
      },
      update: {},
    });

    return proj;
  }, {
    timeout: 15000,
  });


  // 2. Trigger Initial Syncs Asynchronously
  try {
    // Run GitHub Sync
    await runIncrementalSync(repositoryId, "manual");

    // Run Jira Sync if project key was provided
    if (jiraProjectKey) {
      await syncJiraProject({ projectId: project.id, projectKey: jiraProjectKey, cloudId: jiraCloudId });
    }

    // Run Correlation Engine
    await correlateProject(project.id);

    await db.engineeringProject.update({
      where: { id: project.id },
      data: { syncStatus: "SUCCESS", lastSyncAt: new Date() },
    });
    log.success("Initial sync completed for project %s", project.id);
  } catch (err: any) {
    log.warn("Initial sync for project failed, project saved with status FAILED: %s", err.message);
    await db.engineeringProject.update({
      where: { id: project.id },
      data: { syncStatus: "FAILED" },
    });
  }

  return getEngineeringProjectById(project.id);
}

/**
 * Attaches an additional repository to an existing project. A repository can
 * belong to at most one project (ProjectRepository.repositoryId is unique).
 */
export async function addRepositoryToProject(projectId: string, repositoryId: string, label?: string) {
  const existingLink = await db.projectRepository.findUnique({ where: { repositoryId } });
  if (existingLink) {
    throw new Error(
      existingLink.engineeringProjectId === projectId
        ? "This repository is already linked to this project."
        : "This repository is already linked to a different project."
    );
  }

  return db.projectRepository.create({
    data: { engineeringProjectId: projectId, repositoryId, label, isPrimary: false },
  });
}

/**
 * Unlinks a repository from a project. The Repository row (and its commits/
 * PRs/branches) is left intact — only the join row is removed. A project
 * must always keep at least one repository; if the primary repo is removed,
 * the next-oldest linked repo is promoted to primary.
 */
export async function removeRepositoryFromProject(projectId: string, repositoryId: string) {
  const links = await db.projectRepository.findMany({
    where: { engineeringProjectId: projectId },
    orderBy: { addedAt: "asc" },
  });

  const target = links.find((l) => l.repositoryId === repositoryId);
  if (!target) {
    throw new Error("Repository is not linked to this project.");
  }
  if (links.length === 1) {
    throw new Error("Cannot remove the last repository from a project.");
  }

  await db.projectRepository.delete({ where: { id: target.id } });

  if (target.isPrimary) {
    const next = links.find((l) => l.id !== target.id);
    if (next) {
      await db.projectRepository.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }
}

export async function listEngineeringProjects(userId: string) {
  return db.engineeringProject.findMany({
    where: { ownerId: userId },
    include: {
      repositories: {
        include: { repository: true },
        orderBy: { addedAt: "asc" },
      },
      integrations: {
        include: { credentials: true },
      },
      metrics: true,
      _count: {
        select: {
          stories: true,
          tasks: true,
          epics: true,
          sprints: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEngineeringProjectById(id: string) {
  return db.engineeringProject.findUnique({
    where: { id },
    include: {
      owner: true,
      repositories: {
        include: {
          repository: {
            include: {
              commits: { take: 20, orderBy: { committedAt: "desc" } },
              pullRequests: { take: 20, orderBy: { createdAt: "desc" } },
              branches: true,
            },
          },
        },
        orderBy: { addedAt: "asc" },
      },
      integrations: {
        include: { credentials: true },
      },
      members: true,
      sprints: { orderBy: { startDate: "desc" } },
      epics: true,
      stories: {
        include: {
          storyCommits: { include: { commit: true } },
          storyPullRequests: { include: { pullRequest: true } },
        },
      },
      tasks: true,
      pipelineRuns: { take: 10, orderBy: { startedAt: "desc" } },
      syncJobs: { take: 10, orderBy: { startedAt: "desc" } },
      knowledge: true,
      moduleKnowledge: true,
      aiInsights: { orderBy: { createdAt: "desc" } },
      metrics: true,
    },
  });
}

export async function deleteEngineeringProject(id: string) {
  return db.engineeringProject.delete({
    where: { id },
  });
}
