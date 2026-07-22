"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Layers, ShieldCheck, Activity, Cpu, Code2, Users, FileText } from "lucide-react";

interface KnowledgeViewProps {
  projectId: string;
}

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
      {/* Subsystem Modules */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            Architectural Subsystems & Module Knowledge
          </h3>
          <span className="text-xs text-slate-500">{modules.length} Modules Tracked</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <div key={mod.id} className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{mod.name}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600">
                  Owner: {mod.owner || "Unassigned"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Health Score</span>
                  <span className="text-sm font-extrabold text-emerald-500">{mod.healthScore}%</span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Risk Score</span>
                  <span className="text-sm font-extrabold text-amber-500">{mod.riskScore}</span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Coverage</span>
                  <span className="text-sm font-extrabold text-purple-500">{mod.coverage}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Knowledge & Memory */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-4 w-4 text-purple-500" />
          Project Knowledge Memory Base
        </h3>

        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">Project Summary</span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{knowledge?.projectSummary || "No project summary stored."}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Architecture Summary</span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{knowledge?.architectureSummary || "No architecture summary stored."}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Risk Summary</span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{knowledge?.riskSummary || "No risk summary stored."}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Engineering Memory</span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{knowledge?.engineeringMemory || "No engineering memory stored."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
