import { and, eq, inArray, isNotNull } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";

export class EnvironmentBuilder {
  private readonly _queryBuilder;
  constructor(
    private readonly tx: Tx,
    private readonly environments: SCHEMA.Environment[],
  ) {
    this._queryBuilder = new QueryBuilder(tx);
  }

  private deleteExistingComputedResources(tx: Tx) {
    return tx
      .delete(SCHEMA.computedEnvironmentResource)
      .where(
        inArray(
          SCHEMA.computedEnvironmentResource.environmentId,
          this.environmentIds,
        ),
      );
  }

  private get environmentIds() {
    return this.environments.map((e) => e.id);
  }

  private async findMatchingResourcesForEnvironments(tx: Tx) {
    const envs = await tx.query.environment.findMany({
      where: and(
        inArray(SCHEMA.environment.id, this.environmentIds),
        isNotNull(SCHEMA.environment.resourceSelector),
      ),
      with: { system: true },
    });

    const promises = envs.map(async (env) => {
      const environmentId = env.id;
      const { system } = env;
      const { workspaceId } = system;
      if (env.resourceSelector == null) return [];
      const resources = await this.tx.query.resource.findMany({
        where: and(
          eq(SCHEMA.resource.workspaceId, workspaceId),
          this._queryBuilder.resources().where(env.resourceSelector).sql(),
        ),
      });
      return resources.map((r) => ({ environmentId, resourceId: r.id }));
    });

    const fulfilled = await Promise.all(promises);
    return fulfilled.flat();
  }

  resourceSelectors() {
    return this.tx.transaction(async (tx) => {
      await this.deleteExistingComputedResources(tx);
      const vals = await this.findMatchingResourcesForEnvironments(tx);

      if (vals.length === 0) return [];

      const results = await tx
        .insert(SCHEMA.computedEnvironmentResource)
        .values(vals)
        .onConflictDoNothing()
        .returning();

      return results;
    });
  }
}

export class WorkspaceEnvironmentBuilder {
  private readonly _queryBuilder;
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {
    this._queryBuilder = new QueryBuilder(tx);
  }

  private async getEnvironmentsWithSelectors(tx: Tx) {
    return tx
      .select({ environment: SCHEMA.environment })
      .from(SCHEMA.environment)
      .innerJoin(
        SCHEMA.system,
        eq(SCHEMA.environment.systemId, SCHEMA.system.id),
      )
      .where(
        and(
          eq(SCHEMA.system.workspaceId, this.workspaceId),
          isNotNull(SCHEMA.environment.resourceSelector),
        ),
      )
      .then((m) => m.map((e) => e.environment));
  }

  private async deleteExistingComputedResources(tx: Tx) {
    const envs = await this.getEnvironmentsWithSelectors(tx);
    await tx.delete(SCHEMA.computedEnvironmentResource).where(
      inArray(
        SCHEMA.computedEnvironmentResource.environmentId,
        envs.map((e) => e.id),
      ),
    );
  }

  private async findMatchingResourcesForEnvironments(tx: Tx) {
    const envs = await this.getEnvironmentsWithSelectors(tx);
    const promises = envs.map(async (env) => {
      if (env.resourceSelector == null) return [];
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
  }

  resourceSelectors() {
    return this.tx.transaction(async (tx) => {
      await this.deleteExistingComputedResources(tx);
      const vals = await this.findMatchingResourcesForEnvironments(tx);

      if (vals.length === 0) return [];

      const results = await tx
        .insert(SCHEMA.computedEnvironmentResource)
        .values(vals)
        .onConflictDoNothing()
        .returning();

      return results;
    });
  }
}
