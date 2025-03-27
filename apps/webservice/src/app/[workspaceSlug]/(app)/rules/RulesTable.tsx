"use client";

import { useState } from "react";
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

import type { Rule, RuleConfiguration } from "./mock-data";
import { EditRuleDialog } from "./EditRuleDialog";
import {
  getRuleTypeIcon,
  getRuleTypeLabel,
  getTypeColorClass,
} from "./rule-theme";
import { RuleDetailsDialog } from "./RuleDetailsDialog";

interface RulesTableProps {
  rules: Rule[];
}

export function RulesTable({ rules }: RulesTableProps) {
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  // Function to get configurations from a rule (legacy or new format)
  const getRuleConfigurations = (rule: Rule): RuleConfiguration[] => {
    if (rule.configurations && rule.configurations.length > 0) {
      return rule.configurations;
    } else if (rule.type && rule.configuration) {
      return [
        {
          type: rule.type,
          enabled: rule.enabled,
          config: rule.configuration,
        },
      ];
    }
    return [];
  };

  const handleDetailsClick = (rule: Rule) => {
    setSelectedRule(rule);
    setIsDetailsDialogOpen(true);
  };

  const handleEditClick = (rule: Rule) => {
    setSelectedRule(rule);
    setIsEditDialogOpen(true);
  };

  const handleStatusChange = (rule: Rule, enabled: boolean) => {
    // In a real application, we would update the rule's status on the server
    console.log(
      `Changing status of rule ${rule.id} to ${enabled ? "enabled" : "disabled"}`,
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const getRuleScopeInfo = (rule: Rule) => {
    // Default values for global scope
    let scopeType: "global" | "specific" | "combined" = "global";
    let deploymentCount = "All";
    let environmentCount = "All";

    if (rule.targetType === "both") {
      scopeType = "combined";

      // Count deployment selectors
      if (
        rule.conditions.deploymentSelectors &&
        rule.conditions.deploymentSelectors.length > 0
      ) {
        deploymentCount = rule.conditions.deploymentSelectors.length.toString();
      }

      // Count environment selectors
      if (
        rule.conditions.environmentSelectors &&
        rule.conditions.environmentSelectors.length > 0
      ) {
        environmentCount =
          rule.conditions.environmentSelectors.length.toString();
      }
    }
    if (rule.targetType === "deployment") {
      if (
        rule.conditions.deploymentSelectors &&
        rule.conditions.deploymentSelectors.length > 0
      ) {
        scopeType = "specific";
        deploymentCount = rule.conditions.deploymentSelectors.length.toString();
      } else if (
        rule.conditions.selectors &&
        rule.conditions.selectors.length > 0
      ) {
        scopeType = "specific";
        deploymentCount = rule.conditions.selectors.length.toString();
      }
    }
    if (rule.targetType === "environment") {
      if (
        rule.conditions.environmentSelectors &&
        rule.conditions.environmentSelectors.length > 0
      ) {
        scopeType = "specific";
        environmentCount =
          rule.conditions.environmentSelectors.length.toString();
      } else if (
        rule.conditions.selectors &&
        rule.conditions.selectors.length > 0
      ) {
        scopeType = "specific";
        environmentCount = rule.conditions.selectors.length.toString();
      }
    }

    return { scopeType, deploymentCount, environmentCount };
  };

  // Return early if no rules to display
  if (rules.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No rules found</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        {/* Table Header */}
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Targets</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>

        {/* Table Body */}
        <TableBody>
          {rules.map((rule) => {
            // Get configuration and scope data early
            const configurations = getRuleConfigurations(rule);
            const { scopeType, deploymentCount, environmentCount } =
              getRuleScopeInfo(rule);

            return (
              <TableRow
                key={rule.id}
                className="group cursor-pointer hover:bg-muted/50"
                onClick={() => handleDetailsClick(rule)}
              >
                {/* Name column */}
                <TableCell>
                  <div className="font-medium">{rule.name}</div>
                  {rule.description && (
                    <div className="mt-1 line-clamp-2 max-w-md pr-4 text-sm text-muted-foreground transition-colors group-hover:text-foreground/80">
                      {rule.description}
                    </div>
                  )}
                </TableCell>

                {/* Type column */}
                <TableCell className="min-w-[200px]">
                  <div className="flex flex-wrap gap-1.5">
                    {configurations.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No configurations
                      </div>
                    ) : (
                      configurations.map((config, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={`pl-1.5 pr-2 text-xs ${getTypeColorClass(config.type)}`}
                        >
                          {getRuleTypeIcon(config.type)}
                          <span className="ml-1">
                            {getRuleTypeLabel(config.type)}
                          </span>
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>

                {/* Target column */}
                <TableCell>
                  {scopeType === "global" && (
                    <Badge
                      variant="default"
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      Global
                    </Badge>
                  )}
                  {scopeType === "combined" && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          D: {deploymentCount}
                        </Badge>
                        <span className="text-xs text-muted-foreground">×</span>
                        <Badge variant="outline" className="text-xs">
                          E: {environmentCount}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Specific Combinations
                      </div>
                    </div>
                  )}
                  {scopeType === "specific" &&
                    rule.targetType === "deployment" && (
                      <Badge variant="secondary">
                        {deploymentCount} Deployment
                        {deploymentCount !== "1" && "s"}
                      </Badge>
                    )}
                  {scopeType === "specific" &&
                    rule.targetType === "environment" && (
                      <Badge variant="outline">
                        {environmentCount} Environment
                        {environmentCount !== "1" && "s"}
                      </Badge>
                    )}
                </TableCell>

                {/* Priority column */}
                <TableCell>
                  <Badge variant="outline">{rule.priority}</Badge>
                </TableCell>

                {/* Created date column */}
                <TableCell>{formatDate(rule.createdAt)}</TableCell>

                {/* Status column */}
                <TableCell>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => {
                      handleStatusChange(rule, checked);
                      // Prevent the row click event from firing
                      event?.stopPropagation();
                    }}
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
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(rule);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Implement delete functionality
                          console.log(`Delete rule: ${rule.id}`);
                        }}
                      >
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
      {selectedRule && (
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
      )}
    </>
  );
}
