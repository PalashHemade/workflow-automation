import { LLMProvider, StructuredGenerateOptions } from "./LLMProvider";
import { GroqProvider } from "./GroqProvider";

class MockLLMProvider implements LLMProvider {
  public readonly name = "MockLLMProvider";

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    if (userPrompt.includes("Analyze current sprint") || userPrompt.includes("sprint data")) {
      return JSON.stringify({
        issues: [
          {
            title: "Delayed Story PR Review",
            description: "PR #42 has been pending review for over 48 hours.",
            severity: "HIGH",
            affectedComponent: "JiraSync",
          },
        ],
        risk: "MEDIUM",
        recommendations: ["Assign explicit reviewer to PR #42"],
        confidence: 0.89,
      });
    }

    return JSON.stringify({
      summary: "Project architecture is operating efficiently with normalized schema models.",
      architecture: "Next.js App Router frontend with Prisma PostgreSQL data layer.",
      risks: ["High churn rate detected in syncEngine module", "3 open PRs awaiting review"],
      recommendations: ["Refactor syncEngine helper functions", "Add integration tests"],
      confidence: 0.92,
    });
  }

  async generateStructured<T>(options: StructuredGenerateOptions<T>): Promise<T> {
    const raw = await this.generate(options.systemPrompt, options.userPrompt);
    const parsed = JSON.parse(raw);
    if (options.validator) {
      return options.validator(parsed);
    }
    return parsed as T;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

export class LLMFactory {
  private static instance: LLMProvider | null = null;

  public static getProvider(providerName?: string): LLMProvider {
    const selectedProvider = (providerName || process.env.LLM_PROVIDER || "groq").toLowerCase();

    if (selectedProvider === "mock") {
      return new MockLLMProvider();
    }

    if (selectedProvider === "groq") {
      // If GROQ_API_KEY is present, return real GroqProvider; otherwise fallback to Mock for offline safety if requested
      if (!process.env.GROQ_API_KEY && process.env.NODE_ENV === "test") {
        return new MockLLMProvider();
      }
      return new GroqProvider();
    }

    throw new Error(`Unsupported LLM Provider: ${selectedProvider}`);
  }

  public static setProviderForTesting(provider: LLMProvider): void {
    LLMFactory.instance = provider;
  }
}
