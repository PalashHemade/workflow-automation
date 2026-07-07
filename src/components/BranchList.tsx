"use client";

import React, { useState, useEffect } from "react";
import { GitBranch, ShieldAlert, ShieldCheck, Key, Loader2 } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
}

interface BranchListProps {
  repositoryId: string;
}

export default function BranchList({ repositoryId }: BranchListProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, [repositoryId]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/branches?repositoryId=${repositoryId}`);
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      }
    } catch (err) {
      console.error("Error fetching branches:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/30">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-850 bg-slate-900/20 p-5 shadow-lg space-y-4">
      <h3 className="text-base font-semibold text-white flex items-center gap-2">
        <GitBranch className="h-4.5 w-4.5 text-indigo-400" />
        Repository Branches
      </h3>

      {branches.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs">No active branches found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-3 pr-4">Branch Name</th>
                <th className="pb-3 px-4">Protection</th>
                <th className="pb-3 pl-4">Commit Ref (SHA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-900/10">
                  <td className="py-3.5 pr-4 flex items-center gap-2 font-medium text-slate-200">
                    <GitBranch className="h-4 w-4 text-slate-500" />
                    {b.name}
                    {b.isDefault && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/40 text-indigo-400">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {b.isProtected ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-450 font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Protected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        None
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pl-4 font-mono text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded w-max border border-slate-900">
                      <Key className="h-3 w-3 text-slate-650" />
                      {b.sha}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
