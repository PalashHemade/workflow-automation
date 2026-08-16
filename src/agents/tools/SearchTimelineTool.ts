import { BaseTool } from "./BaseTool";
import { EventRepository } from "../repositories/EventRepository";

export interface SearchTimelineArgs {
  projectId: string;
  limit?: number;
}

export class SearchTimelineTool implements BaseTool<SearchTimelineArgs, any> {
  public readonly name = "SearchTimelineTool";
  public readonly description = "Searches system and project events from the event bus timeline.";

  private eventRepo = new EventRepository();

  async execute(args: SearchTimelineArgs): Promise<any> {
    const events = await this.eventRepo.getRecentEvents(args.projectId, args.limit || 15);
    return {
      events,
    };
  }
}
