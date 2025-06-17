import { notFound } from "next/navigation";
import Link from "next/link";
import {
  IconInfoCircle,
  IconShield,
  IconTarget,
  IconChevronRight,
  
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Button } from "@ctrlplane/ui/button";


import { api } from "~/trpc/server";
import { urls } from "~/app/urls";
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
          Policy rules and governance controls that apply to resource "{resource.name}"
        </p>
      </div>

      {policies.length === 0 ? (
        <div className="text-center py-8">
          <IconInfoCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Matching Policies
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            This resource is not currently targeted by any policies. Policies control deployment behavior, approvals, and release gates.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href={urls.workspace(workspaceSlug).policies().baseUrl()}>
                <IconShield className="h-4 w-4 mr-2" />
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
              Found {policies.length} {policies.length === 1 ? 'policy' : 'policies'} that {policies.length === 1 ? 'applies' : 'apply'} to this resource
            </span>
          </div>
          
          <PolicyCard policies={policies} workspaceSlug={workspaceSlug} cardConfigs={policyCardConfigs} />
          
          <div>
            <div className="mb-2 text-sm">Individual Policies</div>
            <div className="space-y-3">
              {policies.map((policy) => {
                    const hasDenyWindows = policy.denyWindows.length > 0;
                    const hasApprovals =
                      policy.versionAnyApprovals != null ||
                      policy.versionUserApprovals.length > 0 ||
                      policy.versionRoleApprovals.length > 0;
                    const hasDeploymentVersionSelector = policy.deploymentVersionSelector != null;
                    const hasConcurrency = policy.concurrency != null;

                    return (
                      <Card key={policy.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <IconShield className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                <div className="flex items-center gap-2 min-w-0">
                                  <Link 
                                    href={urls.workspace(workspaceSlug).policies().byId(policy.id)}
                                    className="font-medium text-foreground hover:text-blue-600 transition-colors truncate"
                                  >
                                    {policy.name}
                                  </Link>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant={policy.enabled ? "default" : "secondary"}>
                                      {policy.enabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                    <Badge variant="outline">Priority: {policy.priority}</Badge>
                                  </div>
                                </div>
                              </div>
                              
                              {policy.description && (
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                  {policy.description}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant={hasApprovals ? "default" : "outline"}
                                  className={hasApprovals 
                                    ? "bg-blue-500 text-white border-blue-500" 
                                    : "border-muted-foreground text-muted-foreground"
                                  }
                                >
                                  Approval Gate
                                </Badge>
                                <Badge
                                  variant={hasDenyWindows ? "default" : "outline"}
                                  className={hasDenyWindows 
                                    ? "bg-red-500 text-white border-red-500" 
                                    : "border-muted-foreground text-muted-foreground"
                                  }
                                >
                                  Deny Window
                                </Badge>
                                <Badge
                                  variant={hasDeploymentVersionSelector ? "default" : "outline"}
                                  className={hasDeploymentVersionSelector 
                                    ? "bg-purple-500 text-white border-purple-500" 
                                    : "border-muted-foreground text-muted-foreground"
                                  }
                                >
                                  Version Conditions
                                </Badge>
                                <Badge
                                  variant={hasConcurrency ? "default" : "outline"}
                                  className={hasConcurrency 
                                    ? "bg-yellow-500 text-white border-yellow-500" 
                                    : "border-muted-foreground text-muted-foreground"
                                  }
                                >
                                  Concurrency
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0 ml-4">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={urls.workspace(workspaceSlug).policies().byId(policy.id)}>
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
