"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { MoreHorizontalIcon, Pencil, Trash2 } from "lucide-react";

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

import type { RuleType } from "./rule-themes";
import {
  getRuleTypeIcon,
  getRuleTypeLabel,
  getTypeColorClass,
} from "./rule-themes";

interface PolicyTableProps {
  policies: RouterOutputs["policy"]["list"];
}

const getRules = (policy: RouterOutputs["policy"]["list"][number]) => {
  const rules: RuleType[] = [];
  if (policy.denyWindows.length > 0) rules.push("deny-window");
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (policy.deploymentVersionSelector) rules.push("version-selector");
  return rules;
};

export const PolicyTable: React.FC<PolicyTableProps> = ({ policies }) => {
  // Return early if no rules to display
  if (policies.length === 0)
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No rules found</p>
      </div>
    );

  return (
    <>
      <Table>
        {/* Table Header */}
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Name</TableHead>
            <TableHead>Rules</TableHead>
            <TableHead>Targets</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>

        {/* Table Body */}
        <TableBody>
          {policies.map((policy) => {
            const environmentCount = 0;
            const deploymentCount = 0;

            const rules = getRules(policy);

            return (
              <TableRow
                key={policy.id}
                className="group cursor-pointer hover:bg-muted/50"
              >
                {/* Name column */}
                <TableCell>
                  <div className="font-medium">{policy.name}</div>
                  {policy.description && (
                    <div className="mt-1 line-clamp-2 max-w-md pr-4 text-sm text-muted-foreground transition-colors group-hover:text-foreground/80">
                      {policy.description}
                    </div>
                  )}
                </TableCell>

                <TableCell className="min-w-[200px]">
                  <div className="flex flex-wrap gap-1.5">
                    {rules.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No rules
                      </div>
                    ) : (
                      rules.map((rule, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={`pl-1.5 pr-2 text-xs ${getTypeColorClass(rule)}`}
                        >
                          {getRuleTypeIcon(rule)}
                          <span className="ml-1">{getRuleTypeLabel(rule)}</span>
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>

                {/* Target column */}
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        D: {deploymentCount}
                      </Badge>

                      <Badge variant="outline" className="text-xs">
                        E: {environmentCount}
                      </Badge>
                    </div>
                  </div>
                </TableCell>

                {/* Priority column */}
                <TableCell>
                  <Badge variant="outline">{policy.priority}</Badge>
                </TableCell>

                {/* Status column */}
                <TableCell>
                  <Switch
                    checked={policy.enabled}
                    className="data-[state=checked]:bg-green-500"
                  />
                </TableCell>

                {/* Actions column */}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
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

      {/* Dialogs */}
      {/* {selectedRule && (
        <>
          <RuleDetailsDialog
            rule={selectedRule}
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
          />
          <EditRuleDialog
            rule={selectedRule}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
          />
        </>
      )} */}
    </>
  );
};
