import type { Metadata } from "next";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { capitalCase } from "change-case";
import _ from "lodash";
import { TbFilter } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { ScrollArea } from "@ctrlplane/ui/scroll-area";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/_components/JobTableStatusIcon";
import { ReactFlowProvider } from "~/app/[workspaceSlug]/_components/reactflow/ReactFlowProvider";
import { api } from "~/trpc/server";
import { FlowDiagram } from "./FlowDiagram";
import { PolicyApprovalRow } from "./PolicyApprovalRow";

export const metadata: Metadata = {
  title: "Release",
};

export default async function ReleasePage({
  params,
}: {
  params: {
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    versionId: string;
  };
}) {
  const release = await api.release.byId(params.versionId);

  if (release == null) notFound();

  const system = await api.system.bySlug(params);
  const environments = await api.environment.bySystemId(system.id);
  const policies = await api.environment.policy.bySystemId(system.id);
  const policyDeployments = await api.environment.policy.deployment.bySystemId(
    system.id,
  );

  const jobConfigs = await api.job.config.byReleaseId(release.id);

  const pendingApprovals = await api.environment.policy.approval.byReleaseId({
    releaseId: release.id,
    status: "pending",
  });

  return (
    <div className="flex h-[calc(100vh-53px)] flex-col">
      <div className="shrink-0 border-b p-4 text-lg text-muted-foreground">
        Release{" "}
        <span className="font-semibold text-white">{release.version}</span>
      </div>

      <ScrollArea>
        <div className="h-[250px] shrink-0 border-b">
          <ReactFlowProvider>
            <FlowDiagram
              release={release}
              envs={environments}
              systemId={system.id}
              policies={policies}
              policyDeployments={policyDeployments}
            />
          </ReactFlowProvider>
        </div>

        {pendingApprovals.length > 0 && (
          <div className="shrink-0 space-y-4 border-b p-6">
            <div>Pending Approvals</div>
            <div className="space-y-2">
              {pendingApprovals.map((approval) => (
                <PolicyApprovalRow
                  key={approval.id}
                  approval={approval}
                  environments={environments.filter(
                    (env) => env.policyId === approval.policyId,
                  )}
                />
              ))}
            </div>
          </div>
        )}

        <div className="shrink-0 border-b p-1">
          <Button variant="ghost" size="sm" className="flex gap-1">
            <TbFilter /> Filter
          </Button>
        </div>

        <Table>
          <TableBody>
            {_.chain(jobConfigs)
              .groupBy((r) => r.environmentId)
              .entries()
              .map(([envId, jobs]) => (
                <Fragment key={envId}>
                  <TableRow className={cn("sticky bg-neutral-800/40")}>
                    <TableCell colSpan={3}>
                      {jobs[0]?.environment != null && (
                        <div className="flex items-center gap-4">
                          <div className="flex-grow">
                            {jobs[0].environment.name}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {jobs.map((job, idx) => (
                    <TableRow
                      key={job.id}
                      className={cn(
                        idx !== jobs.length - 1 && "border-b-neutral-800/50",
                      )}
                    >
                      <TableCell>{job.target?.name}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        <JobTableStatusIcon status={job.jobExecution?.status} />
                        {capitalCase(job.jobExecution?.status ?? "scheduled")}
                      </TableCell>
                      <TableCell>{job.type}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))
              .value()}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
