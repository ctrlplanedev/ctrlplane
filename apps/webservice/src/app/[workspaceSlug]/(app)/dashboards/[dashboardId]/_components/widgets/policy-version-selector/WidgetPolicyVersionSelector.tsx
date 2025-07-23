import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { useState } from "react";
import { IconFilter } from "@tabler/icons-react";
import _ from "lodash";

import { Button } from "@ctrlplane/ui/button";
import {
  defaultCondition,
  isValidDeploymentVersionCondition,
} from "@ctrlplane/validators/releases";

import type { Widget } from "../../DashboardWidget";
import type { PolicyVersionSelectorConfig } from "./types";
import { WidgetVersionConditionRender } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/WidgetVersionConditionRender";
import { api } from "~/trpc/react";
import { DeleteButton } from "../../buttons/DeleteButton";
import { EditButton } from "../../buttons/EditButton";
import { MoveButton } from "../../MoveButton";
import { Edit } from "./Edit";
import { getIsValidConfig } from "./types";

const useSaveSelector = (policyId: string, isNewRule: boolean) => {
  const utils = api.useUtils();
  const invalidate = () =>
    utils.policy.versionSelector.byPolicyId.invalidate(policyId);

  const createMutation = api.policy.versionSelector.create.useMutation();
  const updateMutation = api.policy.versionSelector.update.useMutation();

  const onSave = (versionSelector: DeploymentVersionCondition) => {
    if (isNewRule) {
      createMutation
        .mutateAsync({ policyId, versionSelector })
        .then(invalidate);

      return;
    }

    updateMutation.mutateAsync({ policyId, versionSelector }).then(invalidate);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return { onSave, isSaving };
};

const ConditionEditor: React.FC<{
  policyId: string;
  ctaText: string;
  isLoading: boolean;
  initialCondition: DeploymentVersionCondition | null;
}> = ({ policyId, ctaText, isLoading, initialCondition }) => {
  const [condition, setCondition] = useState<DeploymentVersionCondition>(
    initialCondition ?? defaultCondition,
  );

  const isRuleValid = isValidDeploymentVersionCondition(condition);

  const { onSave, isSaving } = useSaveSelector(
    policyId,
    initialCondition == null,
  );

  const isUnchanged = _.isEqual(condition, initialCondition);
  return (
    <WidgetVersionConditionRender
      condition={condition}
      onChange={setCondition}
      onRemove={() => setCondition(defaultCondition)}
      cta={
        <Button
          onClick={() => onSave(condition)}
          disabled={isSaving || isLoading || !isRuleValid || isUnchanged}
          size="sm"
        >
          {ctaText}
        </Button>
      }
    />
  );
};

export const WidgetPolicyVersionSelector: Widget<PolicyVersionSelectorConfig> =
  {
    displayName: "Policy Version Selector",
    description: "A widget to update a policy version selector",
    Icon: () => <IconFilter className="h-10 w-10 stroke-1" />,
    Component: ({
      config,
      isEditMode,
      setIsEditing,
      isEditing,
      onDelete,
      updateConfig,
    }) => {
      const isValid = getIsValidConfig(config);

      const { data: versionSelectorRule, isLoading } =
        api.policy.versionSelector.byPolicyId.useQuery(config.policyId, {
          enabled: isValid,
        });

      return (
        <>
          <div className="scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800 flex h-full w-full flex-col gap-4 overflow-auto rounded-md border p-2 text-sm">
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="flex-grow font-medium">
                {config.name ?? versionSelectorRule?.name ?? "Version Selector"}
              </span>
              {isEditMode && (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <DeleteButton onClick={onDelete} />
                  <EditButton onClick={() => setIsEditing(!isEditing)} />
                  <MoveButton />
                </div>
              )}
            </div>
            {!isValid && (
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Invalid config</p>
              </div>
            )}
            {isValid && !isLoading && (
              <ConditionEditor
                policyId={config.policyId}
                ctaText={config.ctaText ?? "Save"}
                isLoading={isLoading}
                initialCondition={
                  versionSelectorRule?.deploymentVersionSelector ?? null
                }
              />
            )}
          </div>
          <Edit
            config={config}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            updateConfig={updateConfig}
          />
        </>
      );
    },
  };
