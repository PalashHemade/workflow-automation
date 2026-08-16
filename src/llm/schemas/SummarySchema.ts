export interface SummaryOutput {
  summary: string;
  architecture: string;
  risks: string[];
  recommendations: string[];
  confidence: number;
}

export function validateSummaryOutput(data: any): SummaryOutput {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid SummaryOutput: must be an object.");
  }
  if (typeof data.summary !== "string") {
    throw new Error("Invalid SummaryOutput: summary must be a string.");
  }
  if (typeof data.architecture !== "string") {
    throw new Error("Invalid SummaryOutput: architecture must be a string.");
  }
  if (!Array.isArray(data.risks)) {
    throw new Error("Invalid SummaryOutput: risks must be an array.");
  }
  if (!Array.isArray(data.recommendations)) {
    throw new Error("Invalid SummaryOutput: recommendations must be an array.");
  }
  const confidence = typeof data.confidence === "number" ? data.confidence : 0.85;

  return {
    summary: data.summary,
    architecture: data.architecture,
    risks: data.risks.map((r: any) => String(r)),
    recommendations: data.recommendations.map((rec: any) => String(rec)),
    confidence,
  };
}
