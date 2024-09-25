import Link from "next/link";
import { notFound } from "next/navigation";
import { capitalCase } from "change-case";
import { TbEdit, TbInfoCircle, TbLink } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { api } from "~/trpc/server";
import { EditAgentConfigDialog } from "../../_components/EditAgentConfigDialog";
import { ReleaseTable } from "../TableRelease";
import { DistroBarChart } from "./DistroBarChart";
import { JobAgentMissingAlert } from "./JobAgentMissingAlert";

export default async function DeploymentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string; deploymentSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const system = await api.system.bySlug(params);
  const environments = await api.environment.bySystemId(system.id);
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();
  const jobAgents = await api.job.agent.byWorkspaceId(workspace.id);

  const showPreviousReleaseDistro = 30;

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="min-w-[950px]">
        <div className="container mx-auto pt-8">
          <Card>
            <div className="p-6 pb-0 text-sm text-muted-foreground">
              Distrubtion of the last {showPreviousReleaseDistro} releases
              across all targets
            </div>
            <DistroBarChart
              deploymentId={deployment.id}
              showPreviousReleaseDistro={showPreviousReleaseDistro}
            />
          </Card>
        </div>

        <div className="container mx-auto p-8">
          <ReleaseTable deployment={deployment} environments={environments} />
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="min-w-[250px]">
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

            {deployment.agent == null ? (
              <JobAgentMissingAlert
                workspaceSlug={params.workspaceSlug}
                systemSlug={system.slug}
                deploymentSlug={deployment.slug}
              />
            ) : (
              <>
                <table width="100%" style={{ tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td className="w-[100px] p-1 pr-2 text-muted-foreground">
                        Type
                      </td>
                      <td className="px-1">
                        {capitalCase(deployment.agent.type)}
                      </td>
                    </tr>
                    <tr>
                      <td className="w-[100px] p-1 pr-2 text-muted-foreground">
                        Name
                      </td>
                      <td className="px-1">{deployment.agent.name}</td>
                    </tr>
                  </tbody>
                </table>
                {deployment.agent.type === "github-app" && (
                  <div className="mt-2">
                    <EditAgentConfigDialog
                      jobAgent={deployment.agent}
                      value={deployment.jobAgentConfig}
                      jobAgents={jobAgents}
                      workspace={workspace}
                      onSubmit={async (data) => {
                        "use server";
                        await api.deployment.update({
                          id: deployment.id,
                          data: {
                            jobAgentId: data.jobAgentId,
                            jobAgentConfig: data.config,
                          },
                        });
                      }}
                    >
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <TbEdit size={16} /> Edit
                      </Button>
                    </EditAgentConfigDialog>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
