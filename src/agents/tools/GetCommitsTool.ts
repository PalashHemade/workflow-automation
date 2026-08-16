import { BaseTool } from "./BaseTool";
import { CodeRepository } from "../repositories/CodeRepository";

export interface GetCommitsArgs {
  repositoryId: string;
  limit?: number;
}

export class GetCommitsTool implements BaseTool<GetCommitsArgs, any> {
  public readonly name = "GetCommitsTool";
  public readonly description = "Retrieves recent commits and pull requests from Prisma code repository.";

  private codeRepo = new CodeRepository();

  async execute(args: GetCommitsArgs): Promise<any> {
    const limit = args.limit || 20;
    const commits = await this.codeRepo.getRecentCommits(args.repositoryId, limit);
    const pullRequests = await this.codeRepo.getRecentPullRequests(args.repositoryId, limit);

    return {
      commits,
      pullRequests,
    };
  }
}
