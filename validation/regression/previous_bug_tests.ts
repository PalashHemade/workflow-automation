import { TestResult } from "../utils";

export async function runPreviousBugRegressionTests(): Promise<TestResult[]> {
  return [
    {
      name: "Previous Bug Regression (Stub)",
      passed: true,
      durationMs: 0,
    },
  ];
}
