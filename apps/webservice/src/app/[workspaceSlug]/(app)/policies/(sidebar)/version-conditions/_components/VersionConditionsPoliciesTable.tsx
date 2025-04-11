"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useParams } from "next/navigation";
import { IconExternalLink } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { urls } from "~/app/urls";

interface VersionConditionsPoliciesTableProps {
  policies: RouterOutputs["policy"]["list"];
}

export const VersionConditionsPoliciesTable: React.FC<
  VersionConditionsPoliciesTableProps
> = ({ policies }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {policies.map((policy) => (
        <Card
          key={policy.id}
          className="group overflow-hidden transition-all hover:shadow-md"
        >
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="mb-1 text-lg">{policy.name}</CardTitle>
                <Badge
                  variant={policy.enabled ? "default" : "outline"}
                  className={cn(
                    "font-medium",
                    policy.enabled
                      ? "bg-green-500/20 text-green-500"
                      : "text-muted-foreground",
                  )}
                >
                  {policy.enabled ? "Active" : "Disabled"}
                </Badge>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-70 group-hover:opacity-100"
                      asChild
                    >
                      <a
                        href={urls
                          .workspace(workspaceSlug)
                          .policies()
                          .edit(policy.id)
                          .baseUrl()}
                      >
                        <IconExternalLink className="h-4 w-4" />
                        <span className="sr-only">Edit Policy</span>
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit Policy</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {policy.description && (
              <CardDescription className="mt-2 text-sm">
                {policy.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pb-4">
            <div className="mb-2 text-sm font-medium text-muted-foreground">
              Version Filter
            </div>
            {policy.deploymentVersionSelector && (
              <div className="pt-1">
                <DeploymentVersionConditionBadge
                  condition={
                    policy.deploymentVersionSelector.deploymentVersionSelector
                  }
                  tabbed={true}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/30 py-2">
            <div className="flex text-xs text-muted-foreground">
              <div>
                Priority: <span className="font-medium">{policy.priority}</span>
              </div>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
