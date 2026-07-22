import { db } from "@/lib/db";
import { runIncrementalSync } from "@/lib/syncEngine";
import { syncJiraProject } from "@/lib/jiraSync";
import { correlateProject } from "@/lib/correlationEngine";

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
    const existing = await tx.engineeringProject.findUnique({
      where: { repositoryId },
    });

    let proj;
    if (existing) {
      proj = await tx.engineeringProject.update({
        where: { id: existing.id },
        data: {
          name,
          description: description || existing.description,
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
          repositoryId,
          primaryBranch,
          defaultBranch,
          syncStatus: "SYNCING",
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
        { name: "Authentication", owner: "Security Lead", complexityScore: 1.2, healthScore: 98.0, riskScore: 5.0 },
        { name: "Payments & Billing", owner: "Finance Lead", complexityScore: 1.5, healthScore: 95.0, riskScore: 12.0 },
        { name: "Notifications Engine", owner: "Core Team", complexityScore: 1.0, healthScore: 100.0, riskScore: 2.0 },
        { name: "User Management", owner: "Product Team", complexityScore: 1.1, healthScore: 99.0, riskScore: 3.0 },
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
  } catch (err: any) {
    console.warn("Initial sync for project failed, project saved with status FAILED:", err.message);
    await db.engineeringProject.update({
      where: { id: project.id },
      data: { syncStatus: "FAILED" },
    });
  }

  return getEngineeringProjectById(project.id);
}

export async function listEngineeringProjects(userId: string) {
  return db.engineeringProject.findMany({
    where: { ownerId: userId },
    include: {
      repository: true,
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
      repository: {
        include: {
          commits: { take: 20, orderBy: { committedAt: "desc" } },
          pullRequests: { take: 20, orderBy: { createdAt: "desc" } },
          branches: true,
        },
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
