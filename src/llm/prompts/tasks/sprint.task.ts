export const sprintTaskPrompt = `
Objective: Analyze current sprint data, linked stories, commits, pull requests, and CI/CD pipelines to detect bottlenecks, delayed stories, and deployment risks.

Context JSON:
{{CONTEXT_JSON}}

Output Schema:
Return a JSON object matching this exact schema:
{
  "issues": [
    {
      "title": "Short title of issue",
      "description": "Detailed description of sprint bottleneck or risk",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "affectedComponent": "Module or story key"
    }
  ],
  "risk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "confidence": 0.90
}
`;
