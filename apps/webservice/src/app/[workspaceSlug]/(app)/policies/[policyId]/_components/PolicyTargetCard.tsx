"use client";

import type * as schema from "@ctrlplane/db/schema";
import React from "react";

import { isValidDeploymentCondition } from "@ctrlplane/validators/deployments";
import { isValidEnvironmentCondition } from "@ctrlplane/validators/environments";
import { isValidResourceCondition } from "@ctrlplane/validators/resources";

import { DeploymentConditionRender } from "~/app/[workspaceSlug]/(app)/_components/deployments/condition/DeploymentConditionRender";
import { EnvironmentConditionRender } from "~/app/[workspaceSlug]/(app)/_components/environment/condition/EnvironmentConditionRender";
import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionRender";

export const PolicyTargetCard: React.FC<{
  target: schema.PolicyTarget;
  targetOrder: number;
}> = ({ target, targetOrder }) => {
  const { deploymentSelector, environmentSelector, resourceSelector } = target;

  const hasEnvironmentSelector =
    environmentSelector != null &&
    isValidEnvironmentCondition(environmentSelector);
  const hasDeploymentSelector =
    deploymentSelector != null &&
    isValidDeploymentCondition(deploymentSelector);
  const hasResourceSelector =
    resourceSelector != null && isValidResourceCondition(resourceSelector);

  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">Target #{targetOrder + 1}</h3>

      {hasEnvironmentSelector && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Environment Filter:
          </h4>

          <EnvironmentConditionRender
            condition={environmentSelector}
            onChange={() => {}}
          />
        </div>
      )}

      {hasDeploymentSelector && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Deployment Filter:
          </h4>

          <DeploymentConditionRender
            condition={deploymentSelector}
            onChange={() => {}}
          />
        </div>
      )}

      {hasResourceSelector && (
        <div className="mb-4">
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Resource Filter:
          </h4>

          <ResourceConditionRender
            condition={resourceSelector}
            onChange={() => {}}
          />
        </div>
      )}
    </div>
  );
};
