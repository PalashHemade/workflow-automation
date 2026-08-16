export interface SprintIssue {
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedComponent?: string;
}

export interface SprintOutput {
  issues: SprintIssue[];
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
  confidence: number;
}

export function validateSprintOutput(data: any): SprintOutput {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid SprintOutput: must be an object.");
  }
  if (!Array.isArray(data.issues)) {
    throw new Error("Invalid SprintOutput: issues must be an array.");
  }

  const validSeverities = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  const issues: SprintIssue[] = data.issues.map((item: any) => ({
    title: String(item.title || "Sprint Bottleneck"),
    description: String(item.description || ""),
    severity: validSeverities.has(item.severity) ? item.severity : "MEDIUM",
    affectedComponent: item.affectedComponent ? String(item.affectedComponent) : undefined,
  }));

  const risk = validSeverities.has(data.risk) ? data.risk : "MEDIUM";
  const recommendations = Array.isArray(data.recommendations)
    ? data.recommendations.map((r: any) => String(r))
    : [];
  const confidence = typeof data.confidence === "number" ? data.confidence : 0.85;

  return {
    issues,
    risk,
    recommendations,
    confidence,
  };
}
