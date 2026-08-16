export interface StructuredGenerateOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  validator?: (data: any) => T;
}

export interface LLMProvider {
  name: string;
  
  generate(systemPrompt: string, userPrompt: string, temperature?: number): Promise<string>;
  
  generateStructured<T>(options: StructuredGenerateOptions<T>): Promise<T>;
  
  healthCheck(): Promise<boolean>;
}
