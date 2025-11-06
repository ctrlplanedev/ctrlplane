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

export function useJobs() {
  const { workspace } = useWorkspace();
  const { resourceId } = useResourceId();

  const { data, isLoading } = trpc.jobs.list.useQuery({
    workspaceId: workspace.id,
    resourceId,
  });

  return { jobs: data?.items ?? [], isLoading };
}
