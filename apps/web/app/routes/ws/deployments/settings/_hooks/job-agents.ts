import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

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

const _formSchema = z.object({
  jobAgentId: z.string(),
  jobAgentConfig: z.record(z.any()),
});

type Form = UseFormReturn<z.infer<typeof _formSchema>>;

export const useSelectedJobAgent = (form: Form) => {
  const allJobAgents = useAllJobAgents();
  const selectedJobAgentId = form.watch("jobAgentId");
  const selectedJobAgent = allJobAgents.find(
    ({ id }) => id === selectedJobAgentId,
  );
  return selectedJobAgent ?? null;
};
