"use client";

import React, { useState, useEffect } from "react";
import { Clock, GitCommit, Layers, Sparkles, Filter, Cpu } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TimelineItem } from "@/components/ui/TimelineItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, PillTabsList, PillTabsTrigger } from "@/components/ui/Tabs";

interface UnifiedTimelineProps {
  projectId: string;
}

const PROVIDER_ICON: Record<string, any> = {
  GITHUB: GitCommit,
  JIRA: Layers,
  JENKINS: Cpu,
  AI: Sparkles,
};

export default function UnifiedTimeline({ projectId }: UnifiedTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");

  useEffect(() => {
    fetchTimeline();
  }, [projectId, selectedProvider]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const url =
        selectedProvider === "ALL"
          ? `/api/projects/${projectId}/events`
          : `/api/projects/${projectId}/events?provider=${selectedProvider}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Error fetching timeline:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <Filter className="h-4 w-4 text-primary" />
          Filter Event Source:
        </div>
        <Tabs value={selectedProvider} onValueChange={setSelectedProvider}>
          <PillTabsList>
            {["ALL", "GITHUB", "JIRA", "JENKINS", "SYSTEM"].map((prov) => (
              <PillTabsTrigger key={prov} value={prov} className="normal-case">
                {prov}
              </PillTabsTrigger>
            ))}
          </PillTabsList>
        </Tabs>
      </Card>

      <Card className="p-6">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading unified event bus timeline...</div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No activity yet"
            description="Project activity will appear here after your first synchronization."
          />
        ) : (
          <div>
            {events.map((evt, i) => (
              <TimelineItem
                key={evt.id}
                icon={PROVIDER_ICON[evt.provider] ?? Clock}
                isLast={i === events.length - 1}
                timestamp={new Date(evt.timestamp).toLocaleString()}
                title={
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{evt.provider}</Badge>
                    {evt.title}
                  </span>
                }
                description={evt.description}
                footer={
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <span>
                      Actor: <strong className="text-foreground">{evt.actorName}</strong>
                    </span>
                    <span>•</span>
                    <span>Type: {evt.entityType}</span>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
