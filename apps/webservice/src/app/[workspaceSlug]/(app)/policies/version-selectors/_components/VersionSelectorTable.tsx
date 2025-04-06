"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Edit, MoreHorizontalIcon, Trash2 } from "lucide-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Switch } from "@ctrlplane/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ctrlplane/ui/tooltip";

import { getTypeColorClass } from "../../_components/rule-themes";

// Define type for the version selector structure
type DeploymentVersionSelector = {
  id: string;
  name: string;
  description: string | null;
  deploymentVersionSelector: any;
};

// Type for the policy with version selector
type PolicyWithVersionSelector = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  deploymentVersionSelector: DeploymentVersionSelector | null;
};

interface VersionSelectorTableProps {
  policies: PolicyWithVersionSelector[];
}

function renderConditionSummary(condition: any): string {
  if (!condition) return "No conditions";

  // If it's a comparison condition (and/or)
  if (condition.type === "comparison") {
    const operator = condition.operator === "and" ? "AND" : "OR";
    if (condition.conditions.length === 0) return "Empty condition";
    return `${operator} (${condition.conditions.length} condition${condition.conditions.length !== 1 ? "s" : ""})`;
  }

  // For tag conditions
  if (condition.type === "tag") {
    const op = condition.operator === "equals" ? "=" : "~";
    return `tag ${op} ${condition.value}`;
  }

  // For metadata conditions
  if (condition.type === "metadata") {
    const op = condition.operator === "equals" ? "=" : "~";
    return `metadata.${condition.key} ${op} ${condition.value}`;
  }

  // For version conditions
  if (condition.type === "version") {
    const op = condition.operator === "equals" ? "=" : "~";
    return `version ${op} ${condition.value}`;
  }

  // For created date conditions
  if (condition.type === "created-at") {
    const op =
      condition.operator === "before"
        ? "<"
        : condition.operator === "after"
          ? ">"
          : condition.operator === "before-or-on"
            ? "<="
            : ">=";
    return `created ${op} ${new Date(condition.value).toLocaleDateString()}`;
  }

  return "Complex condition";
}

export const VersionSelectorTable: React.FC<VersionSelectorTableProps> = ({
  policies,
}) => {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  // Return early if no policies with version selectors
  if (policies.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No version selectors found
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">Policy</TableHead>
          <TableHead>Condition</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {policies.map((policy) => {
          const condition =
            policy.deploymentVersionSelector?.deploymentVersionSelector;

          return (
            <TableRow key={policy.id} className="group hover:bg-muted/50">
              <TableCell>
                <div className="font-medium">{policy.name}</div>
                {policy.description && (
                  <div className="mt-1 line-clamp-2 max-w-md text-sm text-muted-foreground transition-colors group-hover:text-foreground/80">
                    {policy.description}
                  </div>
                )}
              </TableCell>

              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={`pl-2 pr-2 ${getTypeColorClass("version-selector")}`}
                    >
                      {renderConditionSummary(condition)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md">
                    <p className="text-xs">
                      {JSON.stringify(condition, null, 2)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              <TableCell>
                <Switch
                  checked={policy.enabled}
                  className="data-[state=checked]:bg-green-500"
                  disabled
                />
              </TableCell>

              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontalIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/${workspaceSlug}/policies/${policy.id}/edit`}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
