import { db } from "@/lib/db";
import { Commit, PullRequest } from "@prisma/client";

export class CodeRepository {
  async getRecentCommits(repositoryId: string, limit = 30): Promise<Commit[]> {
    return db.commit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "desc" },
      take: limit,
      include: {
        files: true,
      },
    });
  }

  async getRecentPullRequests(repositoryId: string, limit = 20): Promise<PullRequest[]> {
    return db.pullRequest.findMany({
      where: { repositoryId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        files: true,
        reviews: true,
      },
    });
  }
}
