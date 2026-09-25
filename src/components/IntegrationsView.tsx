"use client";

import React, { useState, useEffect } from "react";
import { GitBranch, Layers, Cpu, MessageSquare, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SimpleTooltip, TooltipProvider } from "@/components/ui/Tooltip";
import { cn } from "@/lib/core/utils";

interface IntegrationsViewProps {
  projectId: string;
}

export default function IntegrationsView({ projectId }: IntegrationsViewProps) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntegrations();
  }, [projectId]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations`);
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (err) {
      console.error("Error fetching integrations:", err);
    } finally {
      setLoading(false);
    }
  };

  const availableProviders = [
    { name: "GITHUB", title: "GitHub Repository", description: "Primary source code host, commits, and pull requests.", icon: GitBranch, connected: integrations.some((i) => i.provider === "GITHUB") },
    { name: "JIRA", title: "Jira Software", description: "Agile project tracking, sprints, epics, stories, and bugs.", icon: Layers, connected: integrations.some((i) => i.provider === "JIRA") },
    { name: "JENKINS", title: "Jenkins CI/CD", description: "Continuous integration and automated build pipeline runs.", icon: Cpu, connected: integrations.some((i) => i.provider === "JENKINS") },
    { name: "SLACK", title: "Slack Workspace", description: "Real-time deployment notifications and team alert channels.", icon: MessageSquare, connected: integrations.some((i) => i.provider === "SLACK") },
    { name: "SONARQUBE", title: "SonarQube Quality", description: "Code quality gates, security vulnerabilities, and coverage metrics.", icon: ShieldCheck, connected: integrations.some((i) => i.provider === "SONARQUBE") },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <Card className="space-y-4 p-6">
          <div>
            <h3 className="text-base font-bold text-foreground">Plug-and-Play Integrations Hub</h3>
            <p className="text-xs text-muted-foreground">Connect third-party developer tool providers directly to this Engineering Project.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {availableProviders.map((prov) => {
              const Icon = prov.icon;
              const existing = integrations.find((i) => i.provider === prov.name);

              return (
                <div
                  key={prov.name}
                  className={cn(
                    "rounded-xl border p-5 transition-all",
                    prov.connected ? "border-primary/30 bg-secondary/40" : "border-border bg-card"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{prov.title}</h4>
                        <p className="text-xs text-muted-foreground">{prov.description}</p>
                      </div>
                    </div>
                    {prov.connected ? (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                      </Badge>
                    ) : (
                      <SimpleTooltip label="Third-party integrations are coming soon">
                        <span>
                          <Button size="sm" disabled>
                            Connect
                          </Button>
                        </span>
                      </SimpleTooltip>
                    )}
                  </div>

                  {existing && (
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
                      <span>
                        Status: <strong className="text-emerald-600 dark:text-emerald-400">{existing.status}</strong>
                      </span>
                      <span>Last Sync: {existing.lastSyncAt ? new Date(existing.lastSyncAt).toLocaleString() : "Never"}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
}
