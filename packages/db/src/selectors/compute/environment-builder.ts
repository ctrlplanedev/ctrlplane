import { and, eq, inArray, isNotNull } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";
import { ReplaceBuilder } from "./replace-builder.js";

export class EnvironmentBuilder {
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
      SCHEMA.computedEnvironmentResource,
      async (tx) => {
        await tx
          .delete(SCHEMA.computedEnvironmentResource)
          .where(
            inArray(SCHEMA.computedEnvironmentResource.environmentId, this.ids),
          );
      },
      async (tx) => {
        const envs = await tx.query.environment.findMany({
          where: inArray(SCHEMA.environment.id, this.ids),
          with: { system: true },
        });

        const promises = envs.map(async (env) => {
          const { system } = env;
          const { workspaceId } = system;

          const resources = await this.tx.query.resource.findMany({
            where: and(
              eq(SCHEMA.resource.workspaceId, workspaceId),
              this._queryBuilder.resources().where(env.resourceSelector).sql(),
            ),
          });

          return resources.map((r) => ({
            environmentId: env.id,
            resourceId: r.id,
          }));
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }
}

const getEnvsInWorkspace = async (tx: Tx, workspaceId: string) => {
  const workspace = await tx.query.workspace.findFirst({
    where: eq(SCHEMA.workspace.id, workspaceId),
    with: {
      systems: {
        with: {
          environments: {
            where: isNotNull(SCHEMA.environment.resourceSelector),
          },
        },
      },
    },
  });
  if (workspace == null) throw new Error(`Workspace not found: ${workspaceId}`);
  return workspace.systems.flatMap((s) => s.environments);
};

export class WorkspaceEnvironmentBuilder {
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
      SCHEMA.computedEnvironmentResource,
      async (tx) => {
        const envs = await getEnvsInWorkspace(tx, this.workspaceId);
        await tx.delete(SCHEMA.computedEnvironmentResource).where(
          inArray(
            SCHEMA.computedEnvironmentResource.environmentId,
            envs.map((e) => e.id),
          ),
        );
      },
      async (tx) => {
        const envs = await getEnvsInWorkspace(tx, this.workspaceId);
        const promises = envs.map(async (env) => {
          const resources = await tx.query.resource.findMany({
            where: and(
              eq(SCHEMA.resource.workspaceId, this.workspaceId),
              this._queryBuilder.resources().where(env.resourceSelector).sql(),
            ),
          });

          return resources.map((r) => ({
            environmentId: env.id,
            resourceId: r.id,
          }));
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }
}
