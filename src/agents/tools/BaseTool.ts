export interface BaseTool<TArgs = any, TOutput = any> {
  readonly name: string;
  readonly description: string;

  execute(args: TArgs): Promise<TOutput>;
}
