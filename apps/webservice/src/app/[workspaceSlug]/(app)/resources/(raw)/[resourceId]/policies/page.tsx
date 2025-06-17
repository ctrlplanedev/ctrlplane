import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconChevronRight,
  IconInfoCircle,
  IconShield,
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent } from "@ctrlplane/ui/card";

import { urls } from "~/app/urls";
import { api } from "~/trpc/server";
import { PolicyCard, policyCardConfigs } from "./_components/PolicyCard";

export default async function ResourcePoliciesPage(props: {
  params: Promise<{ workspaceSlug: string; resourceId: string }>;
}) {
  const { workspaceSlug, resourceId } = await props.params;

  const resource = await api.resource.byId(resourceId);
  if (resource == null) notFound();

  const policies = await api.policy.byResourceId({ resourceId });

  return (
    <div className="container space-y-4 p-8">
      <div className="space-y-2">
        <div className="text-sm">Policies</div>
        <p className="text-xs text-muted-foreground">
          Policy rules and governance controls that apply to resource "
          {resource.name}"
        </p>
      </div>

      {policies.length === 0 ? (
        <div className="py-8 text-center">
          <IconInfoCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">
            No Matching Policies
          </h3>
          <p className="mx-auto max-w-md text-muted-foreground">
            This resource is not currently targeted by any policies. Policies
            control deployment behavior, approvals, and release gates.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href={urls.workspace(workspaceSlug).policies().baseUrl()}>
                <IconShield className="mr-2 h-4 w-4" />
                View All Policies
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconInfoCircle className="h-4 w-4" />
            <span>
              Found {policies.length}{" "}
              {policies.length === 1 ? "policy" : "policies"} that{" "}
              {policies.length === 1 ? "applies" : "apply"} to this resource
            </span>
          </div>

          <PolicyCard
            policies={policies}
            workspaceSlug={workspaceSlug}
            cardConfigs={policyCardConfigs}
          />

          <div>
            <div className="mb-2 text-sm">Individual Policies</div>
            <div className="space-y-3">
              {policies.map((policy) => {
                const hasDenyWindows = policy.denyWindows.length > 0;
                const hasApprovals =
                  policy.versionAnyApprovals != null ||
                  policy.versionUserApprovals.length > 0 ||
                  policy.versionRoleApprovals.length > 0;
                const hasDeploymentVersionSelector =
                  policy.deploymentVersionSelector != null;
                const hasConcurrency = policy.concurrency != null;

                return (
                  <Card
                    key={policy.id}
                    className="transition-shadow hover:shadow-md"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <IconShield className="h-5 w-5 flex-shrink-0 text-blue-500" />
                            <div className="flex min-w-0 items-center gap-2">
                              <Link
                                href={urls
                                  .workspace(workspaceSlug)
                                  .policies()
                                  .byId(policy.id)}
                                className="truncate font-medium text-foreground transition-colors hover:text-blue-600"
                              >
                                {policy.name}
                              </Link>
                              <div className="flex flex-shrink-0 items-center gap-2">
                                <Badge
                                  variant={
                                    policy.enabled ? "default" : "secondary"
                                  }
                                >
                                  {policy.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                                <Badge variant="outline">
                                  Priority: {policy.priority}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {policy.description && (
                            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                              {policy.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant={hasApprovals ? "default" : "outline"}
                              className={
                                hasApprovals
                                  ? "border-blue-500 bg-blue-500 text-white"
                                  : "border-muted-foreground text-muted-foreground"
                              }
                            >
                              Approval Gate
                            </Badge>
                            <Badge
                              variant={hasDenyWindows ? "default" : "outline"}
                              className={
                                hasDenyWindows
                                  ? "border-red-500 bg-red-500 text-white"
                                  : "border-muted-foreground text-muted-foreground"
                              }
                            >
                              Deny Window
                            </Badge>
                            <Badge
                              variant={
                                hasDeploymentVersionSelector
                                  ? "default"
                                  : "outline"
                              }
                              className={
                                hasDeploymentVersionSelector
                                  ? "border-purple-500 bg-purple-500 text-white"
                                  : "border-muted-foreground text-muted-foreground"
                              }
                            >
                              Version Conditions
                            </Badge>
                            <Badge
                              variant={hasConcurrency ? "default" : "outline"}
                              className={
                                hasConcurrency
                                  ? "border-yellow-500 bg-yellow-500 text-white"
                                  : "border-muted-foreground text-muted-foreground"
                              }
                            >
                              Concurrency
                            </Badge>
                          </div>
                        </div>

                        <div className="ml-4 flex-shrink-0">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={urls
                                .workspace(workspaceSlug)
                                .policies()
                                .byId(policy.id)}
                            >
                              <IconChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
