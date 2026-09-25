"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, GitBranch, Loader2, Search, AlertCircle } from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { cn } from "@/lib/core/utils";

interface AddRepositoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onAdded: () => void;
}

export default function AddRepositoryModal({ open, onOpenChange, projectId, onAdded }: AddRepositoryModalProps) {
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [dbRepos, setDbRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSearch("");
      fetchRepositories();
    }
  }, [open]);

  const fetchRepositories = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/repos");
      if (res.ok) {
        const data = await res.json();
        setDbRepos(data.dbRepos || []);
        setGithubRepos(data.githubRepos || []);
      }
    } catch (err) {
      console.error("Error fetching repositories:", err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handlePick = async (ghRepo: { githubId: number; owner: string; name: string; fullName: string }) => {
    setAddingId(ghRepo.githubId);
    setError(null);
    try {
      let repositoryId: string;
      const existing = dbRepos.find((r) => String(r.githubId) === String(ghRepo.githubId));

      if (existing) {
        repositoryId = existing.id;
      } else {
        const res = await fetch("/api/repos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner: ghRepo.owner, name: ghRepo.name, createNewOnGitHub: false }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to register repository");
        }
        const repoData = await res.json();
        repositoryId = repoData.repository.id;
      }

      const linkRes = await fetch(`/api/projects/${projectId}/repositories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId }),
      });
      if (!linkRes.ok) {
        const errData = await linkRes.json();
        throw new Error(errData.error || "Failed to add repository to project");
      }

      onAdded();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to add repository");
    } finally {
      setAddingId(null);
    }
  };

  const filteredRepos = githubRepos.filter(
    (r) => search === "" || r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> Add a Repository
          </ModalTitle>
          <ModalDescription>
            Link another GitHub repository to this project — useful when work is deliberately split across repos
            (e.g. an isolated prototype) but still belongs to the same team and sprints.
          </ModalDescription>
        </ModalHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingRepos ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your GitHub repositories...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Search your ${githubRepos.length} repositories...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid max-h-64 gap-1.5 overflow-y-auto pr-1">
              {filteredRepos.map((repo) => {
                const existingDbRepo = dbRepos.find((d) => String(d.githubId) === String(repo.githubId));
                const isAdding = addingId === repo.githubId;
                return (
                  <button
                    key={repo.githubId}
                    type="button"
                    onClick={() => handlePick(repo)}
                    disabled={addingId !== null}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{repo.fullName}</span>
                      {existingDbRepo && (
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Already tracked</span>
                      )}
                    </div>
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-transparent" />
                    )}
                  </button>
                );
              })}
              {filteredRepos.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">No matching repositories found.</p>
              )}
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
