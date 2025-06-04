import { notFound } from "next/navigation";
import {
  IconFilterSearch,
  IconInfoCircle,
  IconTarget,
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { api } from "~/trpc/server";
import { PolicyOverviewCard } from "./_components/PolicyOverviewCard";
import { PolicyReleaseTargets } from "./_components/PolicyReleaseTargets";
import { PolicyTargetCard } from "./_components/PolicyTargetCard";

export default async function PolicyPage(props: {
  params: Promise<{ workspaceSlug: string; policyId: string }>;
}) {
  const { policyId } = await props.params;
  const policy = await api.policy.byId({ policyId });
  if (policy == null) notFound();

  // Helper to determine if a selector exists and has conditions
  const hasValidSelector = (selector: any) => {
    return (
      selector &&
      selector.type === "comparison" &&
      selector.conditions &&
      selector.conditions.length > 0
    );
  };

  // Check if any policy target has selectors
  const hasFilters = policy.targets.some(
    (target) =>
      hasValidSelector(target.environmentSelector) ||
      hasValidSelector(target.deploymentSelector) ||
      hasValidSelector(target.resourceSelector),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Badge variant={policy.enabled ? "default" : "secondary"}>
            {policy.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Badge variant="outline">Priority: {policy.priority}</Badge>
        </div>
      </div>

      <PolicyOverviewCard policy={policy} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconTarget className="h-5 w-5" />
            Policy Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {policy.targets.length === 0 || !hasFilters ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-muted p-4 text-sm text-muted-foreground">
              <IconInfoCircle className="h-4 w-4" />
              <span>
                This policy applies to all resources (no target filters
                configured)
              </span>
            </div>
          ) : (
            <Tabs defaultValue="filters" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger
                  value="filters"
                  className="flex items-center gap-1"
                >
                  <IconFilterSearch className="h-4 w-4" />
                  Target Filters
                </TabsTrigger>
                <TabsTrigger
                  value="affected"
                  className="flex items-center gap-1"
                >
                  <IconTarget className="h-4 w-4" />
                  Affected Resources
                </TabsTrigger>
              </TabsList>

              <TabsContent value="filters">
                <div className="space-y-4">
                  {policy.targets.map((target, index) => (
                    <PolicyTargetCard
                      key={target.id}
                      target={target}
                      targetOrder={index}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="affected">
                <PolicyReleaseTargets policy={policy} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
