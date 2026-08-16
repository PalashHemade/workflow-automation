export const summaryTaskPrompt = `
Objective: Analyze the provided project engineering context and generate a comprehensive architectural summary, technical risks, and recommendations.

Context JSON:
{{CONTEXT_JSON}}

Output Schema:
Return a JSON object matching this exact schema:
{
  "summary": "High-level summary of current engineering state",
  "architecture": "Overview of key modules and dependency health",
  "risks": ["Risk item 1", "Risk item 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "confidence": 0.95
}
`;
