import { useState } from "react";
import { useDebounce } from "react-use";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { useWorkspace } from "~/components/WorkspaceProvider";
import CelExpressionInput from "../_components/CelExpiressionInput";
import { DeploymentPageHeader } from "./_components/DeploymentPageHeader";
import { useDeployment } from "./_components/DeploymentProvider";

export function meta() {
  return [
    { title: "Resources - Deployment Details - Ctrlplane" },
    { name: "description", content: "View all deployment resources" },
  ];
}

const useResources = (selector: string) => {
  const { workspace } = useWorkspace();

  const resourcesQuery = trpc.resource.list.useQuery({
    workspaceId: workspace.id,
    selector: { cel: selector },
    limit: 200,
    offset: 0,
  });

  return resourcesQuery.data?.items ?? [];
};

function SelectorWithResources() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const [selector, setSelector] = useState(
    deployment.resourceSelector?.cel ?? "true",
  );

  const [selectorDebounced, setSelectorDebounced] = useState(selector);
  useDebounce(() => setSelectorDebounced(selector), 1_000, [selector]);

  const resources = useResources(selectorDebounced);

  const updateDeployment = trpc.deployment.update.useMutation();
  const onResourceSelectorChange = async (selector: string) => {
    setSelector(selector);
    console.log("selector", selector);
    await updateDeployment.mutateAsync({
      workspaceId: workspace.id,
      deploymentId: deployment.id,
      data: { resourceSelectorCel: selector },
    });
  };
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b p-2">
        <div className="flex-1 rounded-md border border-input p-0.5">
          <CelExpressionInput
            height="2.5rem"
            value={selector}
            onChange={(v) => setSelector(v ?? "true")}
          />
        </div>
        <Button
          className="h-[2.5rem]"
          onClick={() =>
            onResourceSelectorChange(selector).then(() =>
              toast.success(
                "Deployment resource selector updated successfully.",
              ),
            )
          }
        >
          Save
        </Button>
      </div>
    </>
  );
}

export default function DeploymentResources() {
  return (
    <>
      <DeploymentPageHeader />
      <SelectorWithResources />
    </>
  );
}
