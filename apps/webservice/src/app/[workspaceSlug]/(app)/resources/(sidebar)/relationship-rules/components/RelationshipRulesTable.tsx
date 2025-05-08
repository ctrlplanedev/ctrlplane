/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
"use client";

import { noCase } from "change-case";

import { Badge } from "@ctrlplane/ui/badge";
import { Card } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";
import { CreateRelationshipDialog } from "./CreateRelationshipDialog";
import { RelationshipRuleDropdown } from "./RelationshipRuleDropdown";

interface RelationshipRulesTableProps {
  workspaceId: string;
}

export const RelationshipRulesTable: React.FC<RelationshipRulesTableProps> = ({
  workspaceId,
}) => {
  const rules = api.resource.relationshipRules.list.useQuery(workspaceId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2>Relationship Rules</h2>
        <CreateRelationshipDialog workspaceId={workspaceId} />
      </div>

      <Card className="relative rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Dependency</TableHead>
              <TableHead>Matching Metadata</TableHead>
              <TableHead>Metadata Equals</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.data?.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>{rule.reference}</TableCell>
                <TableCell>
                  {rule.sourceKind}{" "}
                  <span className="text-muted-foreground">
                    {rule.dependencyDescription || noCase(rule.dependencyType)}
                  </span>{" "}
                  {rule.targetKind}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {rule.metadataMatches.map((match) => (
                      <Badge
                        variant="outline"
                        className="font-mono"
                        key={match.key}
                      >
                        {match.key}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {rule.metadataEquals.map((equals) => (
                      <Badge
                        variant="outline"
                        className="font-mono"
                        key={equals.key}
                      >
                        {equals.key}: {equals.value}
                      </Badge>
                    ))}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex justify-end">
                    <RelationshipRuleDropdown ruleId={rule.id} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
