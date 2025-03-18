"use client";

import Link from "next/link";
import {
  IconAdjustments,
  IconArrowUpRight,
  IconClock,
  IconHelpCircle,
  IconInfoCircle,
  IconShield,
  IconShieldCheck,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import prettyMs from "pretty-ms";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

// PoliciesTabContent component for the Policies tab
export const PoliciesPageContent: React.FC<{ environmentId: string }> = ({
  environmentId,
}) => {
  const hasParentPolicy = true;
  // Sample static policy data
  const environmentPolicy = {
    id: "env-pol-1",
    name: "Production Environment Policy",
    description: "Policy settings for the production environment",
    environmentId: environmentId,
    approvalRequirement: "manual",
    successType: "all",
    successMinimum: 0,
    concurrencyLimit: 2,
    rolloutDuration: 1800000, // 30 minutes in ms
    minimumReleaseInterval: 86400000, // 24 hours in ms
    releaseSequencing: "wait",
    versionChannels: [
      { id: "channel-1", name: "stable", deploymentId: "deploy-1" },
      { id: "channel-2", name: "beta", deploymentId: "deploy-2" },
    ],
    releaseWindows: [
      {
        id: "window-1",
        recurrence: "weekly",
        startTime: new Date("2025-03-18T09:00:00"),
        endTime: new Date("2025-03-18T17:00:00"),
      },
    ],
  };

  const formatDurationText = (ms: number) => {
    if (ms === 0) return "None";
    return prettyMs(ms, { compact: true, verbose: false });
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Environment Policies</CardTitle>
          <CardDescription>
            Policies control how and when deployments can occur in this
            environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasParentPolicy && (
            <Alert
              variant="warning"
              className="mb-6 flex items-center bg-orange-500/5"
            >
              <IconInfoCircle className="h-4 w-4 " />
              <div className="mt-1.5 flex-1">
                <AlertTitle className="">Inherited Parent Policies</AlertTitle>
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <p className="">
                      These policies are inherited from a parent configuration.
                      You can override specific settings at the environment
                      level while maintaining the parent policy structure.
                    </p>
                  </div>
                </AlertDescription>
              </div>

              <div>
                <Button variant="ghost" size="sm" className="shrink-0" asChild>
                  <Link
                    href="/parent-policy"
                    className="flex items-center gap-1"
                  >
                    View parent policy
                    <IconArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Approval & Governance */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconShieldCheck className="h-5 w-5 text-blue-400" />
                    Approval & Governance
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls who can approve deployments and what
                            validation criteria must be met before a deployment
                            can proceed to this environment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-neutral-400">
                    Approval Required
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconInfoCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Approval required for deployments to this
                            environment.{" "}
                            <Link
                              href="https://docs.ctrlplane.com/environments/approval-policies"
                              className="text-blue-400 hover:underline"
                            >
                              Learn more
                            </Link>
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="text-right font-medium">
                    <Badge
                      variant={
                        environmentPolicy.approvalRequirement === "manual"
                          ? "default"
                          : "secondary"
                      }
                      className="font-normal"
                    >
                      {environmentPolicy.approvalRequirement === "manual"
                        ? "Yes"
                        : "No"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-neutral-400">
                    Success Criteria
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Defines the success requirements for deployments.
                            Can be set to require all resources to succeed, a
                            minimum number of resources, or no validation.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Deployment Control */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconAdjustments className="h-5 w-5 text-indigo-400" />
                    Deployment Control
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Settings that control how deployments are executed
                            and managed in this environment, including
                            concurrency and resource limits.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-neutral-400">Concurrency Limit</div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.concurrencyLimit
                      ? `Max ${environmentPolicy.concurrencyLimit} jobs`
                      : "Unlimited"}
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Release Management */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconSwitchHorizontal className="h-5 w-5 text-emerald-400" />
                    Release Management
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls how releases are managed, including how new
                            versions are handled and how deployments are
                            sequenced in this environment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1 text-neutral-400">
                    Job Sequencing
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls what happens to pending jobs when a new
                            version is created. You can either keep pending jobs
                            in the queue or cancel them in favor of the new
                            version.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.releaseSequencing === "wait"
                      ? "Keep pending jobs"
                      : "Cancel pending jobs"}
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Deployment Version Channels */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconShield className="h-5 w-5 text-amber-400" />
                    Version Channels
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Manages which version channels are available and how
                            versions flow through different stages in this
                            environment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1 text-neutral-400">
                    Channels Configured
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Deployment version channels let you establish a
                            consistent flow of versions. For example, versions
                            might flow from beta → stable.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.versionChannels.length}
                  </div>

                  {environmentPolicy.versionChannels.length > 0 && (
                    <>
                      <div className="flex items-center gap-1 text-neutral-400">
                        Assigned Channels
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[350px]">
                              <p>
                                Channels assigned to this environment control
                                which versions can be deployed. Only versions
                                published to these channels will be deployed
                                here.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-right">
                        <div className="space-x-1">
                          {environmentPolicy.versionChannels.map((channel) => (
                            <Badge
                              key={channel.id}
                              variant="outline"
                              className="bg-amber-950/20 text-amber-300"
                            >
                              {channel.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Rollout & Timing */}
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900/50">
              <div className="border-b border-neutral-800 p-4 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-100">
                    <IconClock className="h-5 w-5 text-rose-400" />
                    Rollout & Timing
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Controls the timing aspects of deployments,
                            including rollout duration, release intervals, and
                            deployment windows.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </h3>
                </div>
              </div>
              <div className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1 text-neutral-400">
                    Rollout Duration
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            The time over which deployments will be gradually
                            rolled out to this environment. A longer duration
                            provides more time to monitor and catch issues
                            during deployment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {formatDurationText(environmentPolicy.rolloutDuration)}
                  </div>

                  <div className="flex items-center gap-1 text-neutral-400">
                    Release Interval
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <IconHelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[350px]">
                          <p>
                            Minimum time that must pass between active releases
                            to this environment. This "cooling period" helps
                            ensure stability between deployments.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-right font-medium text-neutral-100">
                    {environmentPolicy.releaseWindows.length}
                  </div>
                </div>
              </div>
              <div className="mt-auto border-t border-neutral-800 bg-neutral-900/60 p-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Configure <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
