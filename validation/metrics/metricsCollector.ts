import * as fs from "fs";
import * as path from "path";

export interface ValidationMetrics {
  historicalSyncTimeMs: number;
  incrementalSyncTimeMs: number;
  webhookLatencyMs: number;
  apiCalls: number;
  databaseRowsCreated: number;
  duplicatesPrevented: number;
  timelineEventsGenerated: number;
  failedAssertions: number;
}

class MetricsCollector {
  private metrics: ValidationMetrics = {
    historicalSyncTimeMs: 0,
    incrementalSyncTimeMs: 0,
    webhookLatencyMs: 0,
    apiCalls: 0,
    databaseRowsCreated: 0,
    duplicatesPrevented: 0,
    timelineEventsGenerated: 0,
    failedAssertions: 0,
  };

  public record(key: keyof ValidationMetrics, value: number) {
    this.metrics[key] = value;
  }

  public increment(key: keyof ValidationMetrics, incrementBy = 1) {
    this.metrics[key] += incrementBy;
  }

  public getMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  public save() {
    const filePath = path.join(process.cwd(), "validation_metrics.json");
    fs.writeFileSync(filePath, JSON.stringify(this.metrics, null, 2), "utf8");
    console.log(`Metrics saved to ${filePath}`);
  }
}

export const metricsCollector = new MetricsCollector();
