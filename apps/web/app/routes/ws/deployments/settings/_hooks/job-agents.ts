import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";

export const useJobAgent = (jobAgentId: string) => {
  const { workspace } = useWorkspace();
  const jobAgentQuery = trpc.jobAgents.get.useQuery({
    workspaceId: workspace.id,
    jobAgentId,
  });

  return { jobAgent: jobAgentQuery.data, isLoading: jobAgentQuery.isLoading };
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
