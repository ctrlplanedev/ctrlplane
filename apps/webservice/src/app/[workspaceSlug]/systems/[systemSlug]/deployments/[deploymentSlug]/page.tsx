import Link from "next/link";
import { notFound } from "next/navigation";
import { capitalCase } from "change-case";
import _ from "lodash";
import { TbInfoCircle, TbLink } from "react-icons/tb";
import { isPresent } from "ts-is-present";

import { Card } from "@ctrlplane/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { api } from "~/trpc/server";
import { ReleaseTable } from "../TableRelease";
import { DistroBarChart } from "./DistroBarChart";
import { JobAgentMissingAlert } from "./JobAgentMissingAlert";

export default async function DeploymentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const system = await api.system.bySlug(params);
  const environments = await api.environment.bySystemId(system.id);
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const releases = await api.release.list({ deploymentId: deployment.id });
  const jobConfigs = await api.job.config.byDeploymentId(deployment.id);
  const distrubtion = await api.deployment.distrubtionById(deployment.id);

  const showPreviousReleaseDistro = 30;

  const distro = _.chain(releases)
    .map((r) => ({
      version: r.version,
      count: distrubtion.filter((d) => d.release.id === r.id).length,
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
            <DistroBarChart distro={distro} distroPadding={distroPadding} />
          </Card>
        </div>

        <div className="container mx-auto p-8">
          <ReleaseTable
            deployment={deployment}
            jobConfigs={jobConfigs
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
            releases={releases}
            environments={environments}
            workspaceSlug={params.workspaceSlug}
            systemSlug={system.slug}
          />
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <div className="border-b p-6">
          <h3 className="font-semibold">{deployment.name}</h3>
          {deployment.description && (
            <p className="text-sm text-muted-foreground">
              {deployment.description}
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
                  <td className="px-1">{deployment.slug}</td>
                </tr>
                <tr>
                  <td className="p-1 pr-2 text-muted-foreground">System</td>
                  <td>
                    <Link
                      className="inline-flex items-center gap-2 rounded-md px-1 hover:bg-neutral-900"
                      href={`/${params.workspaceSlug}/systems/${system.slug}`}
                    >
                      {system.name}
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

            {deployment.jobAgentId == null ? (
              <JobAgentMissingAlert
                workspaceSlug={params.workspaceSlug}
                systemSlug={system.slug}
                deploymentSlug={deployment.slug}
              />
            ) : (
              <table width="100%" style={{ tableLayout: "fixed" }}>
                <tbody>
                  <tr>
                    <td className="w-[100px] p-1 pr-2 text-muted-foreground">
                      Type
                    </td>
                    <td className="px-1">
                      {capitalCase(deployment.agent?.type ?? "")}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[100px] p-1 pr-2 text-muted-foreground">
                      Name
                    </td>
                    <td className="px-1">{deployment.agent?.name}</td>
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
