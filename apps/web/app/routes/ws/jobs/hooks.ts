import { useSearchParams } from "react-router";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";

export function useResourceId() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resourceId = searchParams.get("resourceId") ?? undefined;

  const setResourceId = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete("resourceId");
      setSearchParams(newParams);
      return;
    }

    newParams.set("resourceId", value);
    setSearchParams(newParams);
  };

  return { resourceId, setResourceId };
}

export function useEnvironmentId() {
  const [searchParams, setSearchParams] = useSearchParams();
  const environmentId = searchParams.get("environmentId") ?? undefined;

  const setEnvironmentId = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete("environmentId");
      setSearchParams(newParams);
      return;
    }

    newParams.set("environmentId", value);
    setSearchParams(newParams);
  };

  return { environmentId, setEnvironmentId };
}

export function useDeploymentId() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deploymentId = searchParams.get("deploymentId") ?? undefined;

  const setDeploymentId = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete("deploymentId");
      setSearchParams(newParams);
      return;
    }

    newParams.set("deploymentId", value);
    setSearchParams(newParams);
  };

  return { deploymentId, setDeploymentId };
}

export function useJobs() {
  const { workspace } = useWorkspace();
  const { resourceId } = useResourceId();
  const { environmentId } = useEnvironmentId();
  const { deploymentId } = useDeploymentId();

  const { data, isLoading } = trpc.jobs.list.useQuery({
    workspaceId: workspace.id,
    resourceId,
    environmentId,
    deploymentId,
  });

  return { jobs: data?.items ?? [], isLoading };
}
