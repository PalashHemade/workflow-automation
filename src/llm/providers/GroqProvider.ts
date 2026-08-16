import Groq from "groq-sdk";
import { LLMProvider, StructuredGenerateOptions } from "./LLMProvider";

export class GroqProvider implements LLMProvider {
  public readonly name = "GroqProvider";
  private groqClient: Groq | null = null;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";
    
    if (apiKey) {
      this.groqClient = new Groq({ apiKey });
    }
  }

  async generate(systemPrompt: string, userPrompt: string, temperature = 0.2): Promise<string> {
    if (!this.groqClient) {
      throw new Error("GROQ_API_KEY is not configured in environment variables.");
    }

    const completion = await this.groqClient.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: this.model,
      temperature,
      response_format: { type: "json_object" },
    });

    return completion.choices[0]?.message?.content || "";
  }

  async generateStructured<T>(options: StructuredGenerateOptions<T>): Promise<T> {
    const rawResponse = await this.generate(
      options.systemPrompt,
      options.userPrompt,
      options.temperature ?? 0.2
    );

    let parsedJson: any;
    try {
      // Clean possible markdown code fences if any
      const cleaned = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedJson = JSON.parse(cleaned);
    } catch (err: any) {
      throw new Error(`Failed to parse LLM response as JSON: ${err.message}. Raw output: ${rawResponse}`);
    }

    if (options.validator) {
      return options.validator(parsedJson);
    }

    return parsedJson as T;
  }

  async healthCheck(): Promise<boolean> {
    if (!process.env.GROQ_API_KEY) {
      return false;
    }
    try {
      const result = await this.generate(
        "You are a health check assistant.",
        "Reply with a JSON object {\"status\": \"ok\"}"
      );
      return result.includes("ok");
    } catch {
      return false;
    }
  }
}
