"use client";

import Link from "next/link";
import { capitalCase } from "change-case";
import _ from "lodash";
import { TbInfoCircle, TbLink } from "react-icons/tb";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { isPresent } from "ts-is-present";

import { Card } from "@ctrlplane/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";
import { ReleaseTable } from "../TableRelease";
import { JobAgentMissingAlert } from "./JobAgentMissingAlert";

export default function DeploymentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const system = api.system.bySlug.useQuery(params.systemSlug);
  const environments = api.environment.bySystemId.useQuery(
    system.data?.id ?? "",
    { enabled: isPresent(system.data) },
  );
  const deployment = api.deployment.bySlug.useQuery(params);
  const releases = api.release.list.useQuery(
    { deploymentId: deployment.data?.id },
    { enabled: isPresent(deployment.data), refetchInterval: 10_000 },
  );
  const jobConfigs = api.job.config.byDeploymentId.useQuery(
    deployment.data?.id ?? "",
    { enabled: isPresent(deployment.data), refetchInterval: 2_000 },
  );

  const distrubtion = api.deployment.distrubtionById.useQuery(
    deployment.data?.id ?? "",
    { enabled: isPresent(deployment.data), refetchInterval: 2_000 },
  );

  const showPreviousReleaseDistro = 30;
  const distro = _.chain(releases.data ?? [])
    .map((r) => ({
      version: r.version,
      count: distrubtion.data?.filter((d) => d.release.id === r.id).length ?? 0,
    }))
    .take(showPreviousReleaseDistro)
    .value();
  const distroPadding = _.range(
    0,
    showPreviousReleaseDistro - distro.length,
  ).map(() => ({ version: "", count: 0 }));
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="min-w-[950px]">
        <div className="container mx-auto pt-8">
          <Card>
            <div className="p-6 pb-0 text-sm text-muted-foreground">
              Distrubtion of the last {showPreviousReleaseDistro} releases
              across all targets
            </div>
            {distrubtion.isLoading || distrubtion.data == null ? (
              <div className="h-[250px] p-6">
                <Skeleton className="h-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={[...distro, ...distroPadding]}
                  margin={{ bottom: -40, top: 30, right: 20, left: -10 }}
                >
                  <XAxis
                    dataKey="version"
                    type="category"
                    interval={0}
                    height={100}
                    style={{ fontSize: "0.75rem" }}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis style={{ fontSize: "0.75rem" }} dataKey="count" />
                  <Bar dataKey="count" fill="#8884d8"></Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {isPresent(deployment.data) && (
          <div className="container mx-auto p-8">
            <ReleaseTable
              deployment={deployment.data}
              jobConfigs={(jobConfigs.data ?? [])
                .filter(
                  (jobConfig) =>
                    isPresent(jobConfig.environmentId) &&
                    isPresent(jobConfig.releaseId) &&
                    isPresent(jobConfig.targetId),
                )
                .map((jobConfig) => ({
                  ...jobConfig,
                  environmentId: jobConfig.environmentId!,
                  target: jobConfig.target!,
                  releaseId: jobConfig.releaseId!,
                }))}
              releases={releases.data ?? []}
              environments={environments.data ?? []}
            />
          </div>
        )}
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <div className="border-b p-6">
          <h3 className="font-semibold">{deployment.data?.name}</h3>
          {deployment.data?.description && (
            <p className="text-sm text-muted-foreground">
              {deployment.data.description}
            </p>
          )}
        </div>

        <div className="space-y-6 p-6 text-sm">
          <div className="space-y-2">
            <div className="text-sm">Properties</div>
            <table width="100%" style={{ tableLayout: "fixed" }}>
              <tbody>
                <tr>
                  <td className="w-[100px] p-1 pr-2 text-muted-foreground">
                    Slug
                  </td>
                  <td className="px-1">{deployment.data?.slug}</td>
                </tr>
                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">System</td>
                  <td>
                    <Link
                      className="inline-flex items-center gap-2 rounded-md px-1 hover:bg-neutral-900"
                      href={`/${params.workspaceSlug}/systems${system.data?.slug}`}
                    >
                      {system.data?.name ?? system.data?.slug}
                      <TbLink className="text-xs text-muted-foreground" />
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-grow">Job Agent</span>{" "}
              <TbInfoCircle className="text-muted-foreground" />
            </div>

            {deployment.data?.jobAgentId == null ? (
              <JobAgentMissingAlert />
            ) : (
              <table width="100%" style={{ tableLayout: "fixed" }}>
                <tbody>
                  <tr>
                    <td className="w-[100px] p-1 pr-2 text-muted-foreground">
                      Type
                    </td>
                    <td className="px-1">
                      {capitalCase(deployment.data.agent?.type ?? "")}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[100px] p-1 pr-2 text-muted-foreground">
                      Name
                    </td>
                    <td className="px-1">{deployment.data.agent?.name}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
