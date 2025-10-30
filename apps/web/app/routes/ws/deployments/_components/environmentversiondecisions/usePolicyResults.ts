import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";

export const usePolicyResults = (environmentId: string, versionId: string) => {
  const { workspace } = useWorkspace();
  const decisionsQuery = trpc.environmentVersion.policyResults.useQuery({
    workspaceId: workspace.id,
    environmentId,
    versionId,
  });
  return {
    policyResults: decisionsQuery.data,
    isPending: decisionsQuery.isPending,
  };
};
