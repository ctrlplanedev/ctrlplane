import { IconTopologyComplex } from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import type { Widget } from "../../DashboardWidget";
import type { SystemResourceDeploymentsConfig } from "./types";
import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { api } from "~/trpc/react";
import { DeleteButton } from "../../buttons/DeleteButton";
import { EditButton } from "../../buttons/EditButton";
import { MoveButton } from "../../MoveButton";
import { DeploymentCard } from "./DeploymentCard";
import { EditSystemResourceDeployments } from "./Edit";
import { getIsValidConfig } from "./types";

const WidgetHeader: React.FC<{
  systemName: string;
  resource: {
    name: string;
    kind: string;
    version: string;
  };
}> = ({ systemName, resource }) => (
  <>
    <span className="text-lg font-medium">{systemName}</span>
    <div className="flex items-center gap-2 text-lg font-medium">
      <ResourceIcon
        version={resource.version}
        kind={resource.kind}
        className="h-5 w-5"
      />
      {resource.name}
    </div>
  </>
);

const SkeletonHeader: React.FC = () => (
  <div className="flex flex-grow items-center justify-between px-2 py-1">
    <Skeleton className="h-5 w-20" />
    <Skeleton className="h-5 w-20" />
  </div>
);

const SkeletonCard: React.FC = () => (
  <Card className="h-[112px] w-60 rounded-md">
    <CardHeader className="p-4">
      <CardTitle>
        <Skeleton className="h-4 w-20" />
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-grow flex-col gap-0.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const WidgetSystemResourceDeployments: Widget<SystemResourceDeploymentsConfig> =
  {
    displayName: "System Resource Deployments",
    description:
      "A widget to view the status of a system's deployments to a resource",
    Icon: () => <IconTopologyComplex className="h-10 w-10 stroke-1" />,
    Component: ({
      config,
      updateConfig,
      isEditMode,
      isEditing,
      setIsEditing,
      isUpdating,
      onDelete,
    }) => {
      const isValidConfig = getIsValidConfig(config);

      const { data, isLoading } =
        api.dashboard.widget.data.systemResourceDeployments.useQuery(config, {
          enabled: isValidConfig,
          refetchInterval: 5_000,
        });

      const deployments = data?.deployments ?? [];

      return (
        <>
          <div className="flex h-full w-full flex-col gap-4 overflow-auto rounded-md border p-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-grow items-center justify-between px-2 py-1">
                {data != null && (
                  <WidgetHeader
                    systemName={data.name}
                    resource={data.resource}
                  />
                )}
                {isLoading && <SkeletonHeader />}
              </div>

              {isEditMode && (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <DeleteButton onClick={onDelete} />
                  <EditButton onClick={() => setIsEditing(!isEditing)} />
                  <MoveButton />
                </div>
              )}
            </div>
            <div className="flex h-full w-full flex-wrap content-start gap-4 overflow-y-auto px-2">
              {isLoading && <SkeletonCard />}
              {data != null && (
                <>
                  {deployments.map((deployment) => (
                    <DeploymentCard
                      key={deployment.id}
                      deployment={deployment}
                      systemSlug={data.slug}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
          <EditSystemResourceDeployments
            config={config}
            updateConfig={updateConfig}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            isUpdating={isUpdating}
          />
        </>
      );
    },
  };
