import { notFound } from "next/navigation";
import {
  IconAlertCircle,
  IconCheck,
  IconFilterSearch,
  IconInfoCircle,
  IconTarget,
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { api } from "~/trpc/server";
import { PolicyReleaseTargets } from "./_components/PolicyReleaseTargets";

export default async function PolicyPage(props: {
  params: Promise<{ workspaceSlug: string; policyId: string }>;
}) {
  const { policyId } = await props.params;
  const policy = await api.policy.byId({ policyId });
  if (policy == null) notFound();

  const getRuleTypes = () => {
    const rules = [];
    if (policy.denyWindows.length > 0) rules.push("deny-window");
    if (
      policy.versionAnyApprovals != null ||
      policy.versionUserApprovals.length > 0 ||
      policy.versionRoleApprovals.length > 0
    ) {
      rules.push("approval-gate");
    }
    if (policy.deploymentVersionSelector != null) {
      rules.push("deployment-version-selector");
    }
    return rules;
  };

  const rules = getRuleTypes();

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

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Policy Rules
              </h3>
              {rules.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconInfoCircle className="h-4 w-4" />
                  <span>No rules configured</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rules.includes("approval-gate") && (
                    <Badge
                      variant="outline"
                      className="border-blue-500 text-blue-500"
                    >
                      Approval Gate
                    </Badge>
                  )}
                  {rules.includes("deny-window") && (
                    <Badge
                      variant="outline"
                      className="border-red-500 text-red-500"
                    >
                      Deny Window
                    </Badge>
                  )}
                  {rules.includes("deployment-version-selector") && (
                    <Badge
                      variant="outline"
                      className="border-purple-500 text-purple-500"
                    >
                      Version Conditions
                    </Badge>
                  )}
                  {rules.includes("concurrency") && (
                    <Badge
                      variant="outline"
                      className="border-yellow-500 text-yellow-500"
                    >
                      Concurrency
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Status
              </h3>
              <div className="flex items-center gap-2">
                {policy.enabled ? (
                  <div className="flex items-center gap-2 text-green-500">
                    <IconCheck className="h-4 w-4" />
                    <span>Active and enforcing rules</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-500">
                    <IconAlertCircle className="h-4 w-4" />
                    <span>Policy disabled - not enforcing rules</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    <div
                      key={target.id || index}
                      className="rounded-md border border-border p-4"
                    >
                      <h3 className="mb-3 text-sm font-medium">
                        Target #{index + 1}
                      </h3>

                      {hasValidSelector(target.environmentSelector) && (
                        <div className="mb-4">
                          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                            Environment Filter:
                          </h4>
                          <div className="rounded-md bg-muted p-3">
                            <pre className="overflow-x-auto text-xs">
                              {JSON.stringify(
                                target.environmentSelector,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        </div>
                      )}

                      {hasValidSelector(target.deploymentSelector) && (
                        <div className="mb-4">
                          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                            Deployment Filter:
                          </h4>
                          <div className="rounded-md bg-muted p-3">
                            <pre className="overflow-x-auto text-xs">
                              {JSON.stringify(
                                target.deploymentSelector,
                                null,
                                2,
                              )}
                            </pre>
                          </div>
                        </div>
                      )}

                      {hasValidSelector(target.resourceSelector) && (
                        <div className="mb-4">
                          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                            Resource Filter:
                          </h4>
                          <div className="rounded-md bg-muted p-3">
                            <pre className="overflow-x-auto text-xs">
                              {JSON.stringify(target.resourceSelector, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
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
