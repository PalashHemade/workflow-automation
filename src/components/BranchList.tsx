"use client";

import React, { useState, useEffect } from "react";
import { GitBranch, ShieldAlert, ShieldCheck, Key, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";

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
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-secondary/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <GitBranch className="h-4.5 w-4.5 text-primary" />
        Repository Branches
      </h3>

      {branches.length === 0 ? (
        <EmptyState icon={GitBranch} title="No branches found" description="Branches will appear here once this repository has synced." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch Name</TableHead>
              <TableHead>Protection</TableHead>
              <TableHead>Commit Ref (SHA)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    {b.name}
                    {b.isDefault && <Badge>Default</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {b.isProtected ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Protected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      None
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-[11px] text-muted-foreground">
                  <span className="flex w-max items-center gap-1 rounded bg-secondary px-2 py-0.5">
                    <Key className="h-3 w-3" />
                    {b.sha}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
