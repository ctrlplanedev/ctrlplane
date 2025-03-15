"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBolt, IconCheck, IconRocket } from "@tabler/icons-react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";
import { ComposedChart, Line, ResponsiveContainer, XAxis } from "recharts";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Input } from "@ctrlplane/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { api } from "~/trpc/react";
import { useJobStats } from "./_hooks/useJobStats";

const EditableCardTitle: React.FC<{ agent: SCHEMA.JobAgent }> = ({ agent }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [agentName, setAgentName] = useState(agent.name);
  const router = useRouter();

  const updateJobAgent = api.job.agent.update.useMutation();

  const handleInputSubmit = () =>
    updateJobAgent
      .mutateAsync({
        id: agent.id,
        data: { name: agentName },
      })
      .then(() => router.refresh());

  if (!isEditing)
    return (
      <CardTitle
        className="max-w-80 cursor-pointer truncate rounded-md px-1 text-lg font-semibold hover:bg-secondary/80"
        onClick={() => setIsEditing(true)}
      >
        {agent.name}
      </CardTitle>
    );

  return (
    <div className="relative">
      <Input
        value={agentName}
        onChange={(e) => setAgentName(e.target.value)}
        className="h-7 w-72"
        disabled={updateJobAgent.isPending}
        autoFocus
        onBlur={() => {
          setAgentName(agent.name);
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setAgentName(agent.name);
            setIsEditing(false);
          }

          if (e.key === "Enter") {
            handleInputSubmit();
            setIsEditing(false);
          }
        }}
      />

      <Button
        className="absolute right-1 top-1 h-5 w-5"
        size="icon"
        variant="ghost"
        onClick={handleInputSubmit}
      >
        <IconCheck className="h-4 w-4" />
      </Button>
    </div>
  );
};

type AgentCardProps = {
  agent: SCHEMA.JobAgent;
  className?: string;
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent, className }) => {
  const { stats, history, isStatsLoading, isHistoryLoading } = useJobStats(
    agent.id,
  );

  const maxLineTickDomain = _.maxBy(history, "count")?.count ?? 0;

  return (
    <Card
      className={cn("h-full w-full rounded-none border-b-0 p-4", className)}
    >
      <CardHeader className="mb-4 p-0">
        <div className="relative flex w-full flex-row items-start justify-between">
          <EditableCardTitle agent={agent} />

          <div className="absolute right-0 top-0 h-[70px] w-[150px]">
            {!isHistoryLoading && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} dataKey="count">
                  <defs>
                    <linearGradient
                      id="lineGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={colors.purple[400]} />
                      <stop offset="100%" stopColor={colors.purple[800]} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={false}
                  />

                  <Line
                    dataKey="count"
                    stroke={
                      maxLineTickDomain > 0
                        ? "url(#lineGradient)"
                        : colors.purple[800]
                    }
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex items-center justify-between p-0">
        <div className="flex items-center gap-6 pl-1">
          <div className="text-xs font-medium text-muted-foreground">
            Github App
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <IconRocket className="h-4 w-4" />
                  {isStatsLoading ? "-" : stats.deployments}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm text-muted-foreground">
                  Deployments using this agent
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <IconBolt className="h-4 w-4" />
                  {isStatsLoading
                    ? "-"
                    : Intl.NumberFormat("en", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(stats.jobs)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm text-muted-foreground">
                  Total jobs triggered
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {!isStatsLoading && stats.lastActive != null && (
            <div className="text-xs font-medium text-muted-foreground">
              Last active{" "}
              {formatDistanceToNowStrict(stats.lastActive, {
                addSuffix: true,
              })}
            </div>
          )}

          {!isStatsLoading && stats.lastActive == null && (
            <div className="text-xs font-medium text-muted-foreground">
              No jobs triggered
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
