import React from "react";
import {
  IconEye,
  IconLoader2,
  IconPencil,
  IconRocket,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import type { Widget } from "../../DashboardWidget";
import type { ReleaseTargetModuleConfig } from "./schema";
import { api } from "~/trpc/react";
import { MoveButton } from "../../MoveButton";
import { EditReleaseTargetModule } from "./Edit";
import { ExpandedReleaseTargetModule } from "./ExpandedModule";
import { ReleaseTargetTile } from "./ReleaseTargetTile";
import { getIsValidConfig } from "./schema";

export const WidgetReleaseTargetModule: Widget<ReleaseTargetModuleConfig> = {
  displayName: "Resource Deployment",
  description: "A module to summarize and deploy to a resource",
  dimensions: {
    suggestedHeight: 4,
    suggestedWidth: 6,
  },
  Icon: () => <IconRocket className="h-10 w-10 stroke-1" />,
  Component: ({
    config,
    updateConfig,
    isExpanded,
    setIsExpanded,
    isEditMode,
    isEditing,
    setIsEditing,
    isUpdating,
    onDelete,
  }) => {
    const isValidConfig = getIsValidConfig(config);

    const { data, isLoading } =
      api.dashboard.widget.data.releaseTargetModule.summary.useQuery(
        config.releaseTargetId,
        { enabled: isValidConfig, refetchInterval: 10_000 },
      );

    if (isLoading)
      return (
        <div className="flex h-full w-full items-center justify-center">
          <IconLoader2 className="h-4 w-4 animate-spin" />
        </div>
      );

    return (
      <>
        <div className="flex h-full w-full flex-col gap-4 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {data != null
                ? `Deploy ${data.deployment.name} to ${data.resource.name}`
                : "Select a deployment to deploy"}
            </span>
            {isEditMode && (
              <div className="flex flex-shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  disabled={!isEditMode}
                  className="h-6 w-6"
                >
                  <IconTrash className="h-4 w-4 text-red-500 hover:text-red-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={!isEditMode}
                  className="h-6 w-6"
                >
                  <IconPencil className="h-4 w-4" />
                </Button>
                <MoveButton />
              </div>
            )}
            {!isEditMode && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(true)}
                className="h-6 w-6"
              >
                <IconEye className="h-4 w-4" />
              </Button>
            )}
          </div>

          {data != null && (
            <ReleaseTargetTile
              releaseTarget={data}
              setIsExpanded={setIsExpanded}
            />
          )}
          {data == null ||
            (!isValidConfig && (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                Invalid config
              </div>
            ))}
        </div>
        <EditReleaseTargetModule
          config={config}
          updateConfig={updateConfig}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          isUpdating={isUpdating}
        />
        {data != null && (
          <ExpandedReleaseTargetModule
            releaseTarget={data}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
          />
        )}
      </>
    );
  },
};
