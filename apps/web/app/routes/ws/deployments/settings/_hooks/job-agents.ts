import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "../../_components/DeploymentProvider";

export const useJobAgent = () => {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const jobAgentQuery = trpc.jobAgents.get.useQuery(
    { workspaceId: workspace.id, jobAgentId: deployment.jobAgentId ?? "" },
    { enabled: deployment.jobAgentId != null },
  );

  return jobAgentQuery.data ?? null;
};

export const useAllJobAgents = () => {
  const { workspace } = useWorkspace();
  const jobAgentsQuery = trpc.jobAgents.list.useQuery({
    workspaceId: workspace.id,
  });
  return jobAgentsQuery.data?.items ?? [];
};

export const useSelectedJobAgent = <
  T extends FieldValues & { jobAgentId: string },
>(
  form: UseFormReturn<T>,
) => {
  const allJobAgents = useAllJobAgents();
  const selectedJobAgentId = form.watch("jobAgentId" as Path<T>) as string;
  const selectedJobAgent = allJobAgents.find(
    ({ id }) => id === selectedJobAgentId,
  );
  return selectedJobAgent ?? null;
};
