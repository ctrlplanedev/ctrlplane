import { and, eq, inArray, isNotNull } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";
import { ReplaceBuilder } from "./replace-builder.js";

export class DeploymentBuilder {
  private readonly _queryBuilder;
  constructor(
    private readonly tx: Tx,
    private readonly ids: string[],
  ) {
    this._queryBuilder = new QueryBuilder(tx);
  }

  resourceSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedDeploymentResource,
      async (tx) => {
        await tx
          .delete(SCHEMA.computedDeploymentResource)
          .where(
            inArray(SCHEMA.computedDeploymentResource.deploymentId, this.ids),
          );
      },
      async (tx) => {
        const deployments = await tx.query.deployment.findMany({
          where: inArray(SCHEMA.deployment.id, this.ids),
          with: { system: true },
        });

        const promises = deployments.map(async (d) => {
          const { system } = d;
          const { workspaceId } = system;

          const resources = await tx.query.resource.findMany({
            where: and(
              eq(SCHEMA.resource.workspaceId, workspaceId),
              this._queryBuilder.resources().where(d.resourceSelector).sql(),
            ),
          });

          return resources.map((r) => ({
            deploymentId: d.id,
            resourceId: r.id,
          }));
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }
}

const getDeploymentsInWorkspace = async (tx: Tx, workspaceId: string) => {
  const workspace = await tx.query.workspace.findFirst({
    where: eq(SCHEMA.workspace.id, workspaceId),
    with: {
      systems: {
        with: {
          deployments: {
            where: isNotNull(SCHEMA.deployment.resourceSelector),
          },
        },
      },
    },
  });
  if (workspace == null) throw new Error(`Workspace not found: ${workspaceId}`);
  return workspace.systems.flatMap((s) => s.deployments);
};

export class WorkspaceDeploymentBuilder {
  private readonly _queryBuilder;
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {
    this._queryBuilder = new QueryBuilder(tx);
  }

  resourceSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedDeploymentResource,
      async (tx) => {
        const deployments = await getDeploymentsInWorkspace(
          tx,
          this.workspaceId,
        );
        await tx.delete(SCHEMA.computedDeploymentResource).where(
          inArray(
            SCHEMA.computedDeploymentResource.deploymentId,
            deployments.map((d) => d.id),
          ),
        );
      },
      async (tx) => {
        const deployments = await getDeploymentsInWorkspace(
          tx,
          this.workspaceId,
        );
        const promises = deployments.map(async (d) => {
          const resources = await tx.query.resource.findMany({
            where: and(
              eq(SCHEMA.resource.workspaceId, this.workspaceId),
              this._queryBuilder.resources().where(d.resourceSelector).sql(),
            ),
          });

          return resources.map((r) => ({
            deploymentId: d.id,
            resourceId: r.id,
          }));
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }
}
