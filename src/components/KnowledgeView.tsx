"use client";

import React, { useState, useEffect } from "react";
import { Layers, FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface KnowledgeViewProps {
  projectId: string;
}

const MEMORY_SECTIONS: { key: string; label: string; empty: string; className: string }[] = [
  { key: "projectSummary", label: "Project Summary", empty: "No project summary stored.", className: "text-primary" },
  { key: "architectureSummary", label: "Architecture Summary", empty: "No architecture summary stored.", className: "text-violet-600 dark:text-violet-400" },
  { key: "riskSummary", label: "Risk Summary", empty: "No risk summary stored.", className: "text-amber-600 dark:text-amber-400" },
  { key: "engineeringMemory", label: "Engineering Memory", empty: "No engineering memory stored.", className: "text-emerald-600 dark:text-emerald-400" },
];

export default function KnowledgeView({ projectId }: KnowledgeViewProps) {
  const [knowledge, setKnowledge] = useState<any | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKnowledge();
  }, [projectId]);

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/knowledge`);
      if (res.ok) {
        const data = await res.json();
        setKnowledge(data.knowledge || null);
        setModules(data.moduleKnowledge || []);
      }
    } catch (err) {
      console.error("Error fetching knowledge:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Layers className="h-4 w-4 text-primary" />
            Architectural Subsystems & Module Knowledge
          </h3>
          <span className="text-xs text-muted-foreground">{modules.length} Modules Tracked</span>
        </div>

        {loading ? null : modules.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Project modules have not been identified yet"
            description="Module knowledge will appear here once the project has been analyzed."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {modules.map((mod) => (
              <div key={mod.id} className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">{mod.name}</h4>
                  <Badge>Owner: {mod.owner || "Unassigned"}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                  <div className="rounded-lg border border-border bg-card p-2">
                    <span className="block text-[10px] font-semibold text-muted-foreground">Health Score</span>
                    <span className="text-sm font-extrabold text-emerald-500">{mod.healthScore}%</span>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-2">
                    <span className="block text-[10px] font-semibold text-muted-foreground">Risk Score</span>
                    <span className="text-sm font-extrabold text-amber-500">{mod.riskScore}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-2">
                    <span className="block text-[10px] font-semibold text-muted-foreground">Coverage</span>
                    <span className="text-sm font-extrabold text-violet-500">{mod.coverage}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <FileText className="h-4 w-4 text-violet-500" />
          Project Knowledge Memory Base
        </h3>

        <div className="space-y-4 text-xs">
          {MEMORY_SECTIONS.map((section) => (
            <div key={section.key} className="space-y-1 rounded-xl border border-border bg-secondary/30 p-4">
              <span className={`block font-bold uppercase tracking-wider ${section.className}`}>{section.label}</span>
              <p className="leading-relaxed text-foreground">{knowledge?.[section.key] || section.empty}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
