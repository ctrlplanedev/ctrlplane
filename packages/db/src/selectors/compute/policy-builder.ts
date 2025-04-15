import { and, eq, inArray } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";
import { ReplaceBuilder } from "./replace-builder.js";

export class PolicyBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly ids: string[],
  ) {}

  environmentSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyEnvironment,
      async (tx) => {
        await tx
          .delete(SCHEMA.computedPolicyEnvironment)
          .where(inArray(SCHEMA.computedPolicyEnvironment.policyId, this.ids));
      },
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: inArray(SCHEMA.policy.id, this.ids),
          with: { targets: true },
        });

        const promises = policies.map(async (p) => {
          const { targets, workspaceId } = p;
          const targetPromises = targets.map(async (t) => {
            const { environmentSelector } = t;
            if (environmentSelector == null) return [];

            const envQuery = new QueryBuilder(tx)
              .environments()
              .where(environmentSelector)
              .sql();

            const rows = await tx
              .select()
              .from(SCHEMA.environment)
              .innerJoin(
                SCHEMA.system,
                eq(SCHEMA.environment.systemId, SCHEMA.system.id),
              )
              .where(and(eq(SCHEMA.system.workspaceId, workspaceId), envQuery));

            return rows.map((row) => ({
              policyId: p.id,
              environmentId: row.environment.id,
            }));
          });

          const fulfilled = await Promise.all(targetPromises);
          return fulfilled.flat();
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }

  deploymentSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyDeployment,
      async (tx) => {
        await tx
          .delete(SCHEMA.computedPolicyDeployment)
          .where(inArray(SCHEMA.computedPolicyDeployment.policyId, this.ids));
      },
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: inArray(SCHEMA.policy.id, this.ids),
          with: { targets: true },
        });

        const promises = policies.map(async (p) => {
          const { targets, workspaceId } = p;
          const targetPromises = targets.map(async (t) => {
            const { deploymentSelector } = t;
            if (deploymentSelector == null) return [];

            const depQuery = new QueryBuilder(tx)
              .deployments()
              .where(deploymentSelector)
              .sql();

            const rows = await tx
              .select()
              .from(SCHEMA.deployment)
              .innerJoin(
                SCHEMA.system,
                eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
              )
              .where(and(eq(SCHEMA.system.workspaceId, workspaceId), depQuery));

            return rows.map((row) => ({
              policyId: p.id,
              deploymentId: row.deployment.id,
            }));
          });

          const fulfilled = await Promise.all(targetPromises);
          return fulfilled.flat();
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }

  resourceSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyResource,
      async (tx) => {
        await tx
          .delete(SCHEMA.computedPolicyResource)
          .where(inArray(SCHEMA.computedPolicyResource.policyId, this.ids));
      },
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: inArray(SCHEMA.policy.id, this.ids),
          with: { targets: true },
        });

        const promises = policies.map(async (p) => {
          const { targets, workspaceId } = p;
          const targetPromises = targets.map(async (t) => {
            const { resourceSelector } = t;
            if (resourceSelector == null) return [];

            const resQuery = new QueryBuilder(tx)
              .resources()
              .where(resourceSelector)
              .sql();

            const rows = await tx
              .select()
              .from(SCHEMA.resource)
              .where(
                and(eq(SCHEMA.resource.workspaceId, workspaceId), resQuery),
              );

            return rows.map((row) => ({
              policyId: p.id,
              resourceId: row.id,
            }));
          });

          const fulfilled = await Promise.all(targetPromises);
          return fulfilled.flat();
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }
}

export class WorkspacePolicyBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {}

  environmentSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyEnvironment,
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: eq(SCHEMA.policy.workspaceId, this.workspaceId),
        });
        const policyIds = policies.map((p) => p.id);
        await tx
          .delete(SCHEMA.computedPolicyEnvironment)
          .where(inArray(SCHEMA.computedPolicyEnvironment.policyId, policyIds));
      },
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: eq(SCHEMA.policy.workspaceId, this.workspaceId),
          with: { targets: true },
        });

        const promises = policies.map(async (p) => {
          const { targets, workspaceId } = p;
          const targetPromises = targets.map(async (t) => {
            const { environmentSelector } = t;
            if (environmentSelector == null) return [];

            const envQuery = new QueryBuilder(tx)
              .environments()
              .where(environmentSelector)
              .sql();

            const rows = await tx
              .select()
              .from(SCHEMA.environment)
              .innerJoin(
                SCHEMA.system,
                eq(SCHEMA.environment.systemId, SCHEMA.system.id),
              )
              .where(and(eq(SCHEMA.system.workspaceId, workspaceId), envQuery));

            return rows.map((row) => ({
              policyId: p.id,
              environmentId: row.environment.id,
            }));
          });

          const fulfilled = await Promise.all(targetPromises);
          return fulfilled.flat();
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }

  deploymentSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyDeployment,
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: eq(SCHEMA.policy.workspaceId, this.workspaceId),
        });
        const policyIds = policies.map((p) => p.id);
        await tx
          .delete(SCHEMA.computedPolicyDeployment)
          .where(inArray(SCHEMA.computedPolicyDeployment.policyId, policyIds));
      },
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: eq(SCHEMA.policy.workspaceId, this.workspaceId),
          with: { targets: true },
        });

        const promises = policies.map(async (p) => {
          const { targets, workspaceId } = p;
          const targetPromises = targets.map(async (t) => {
            const { deploymentSelector } = t;
            if (deploymentSelector == null) return [];

            const depQuery = new QueryBuilder(tx)
              .deployments()
              .where(deploymentSelector)
              .sql();

            const rows = await tx
              .select()
              .from(SCHEMA.deployment)
              .innerJoin(
                SCHEMA.system,
                eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
              )
              .where(and(eq(SCHEMA.system.workspaceId, workspaceId), depQuery));

            return rows.map((row) => ({
              policyId: p.id,
              deploymentId: row.deployment.id,
            }));
          });

          const fulfilled = await Promise.all(targetPromises);
          return fulfilled.flat();
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }

  resourceSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyResource,
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: eq(SCHEMA.policy.workspaceId, this.workspaceId),
        });
        const policyIds = policies.map((p) => p.id);
        await tx
          .delete(SCHEMA.computedPolicyResource)
          .where(inArray(SCHEMA.computedPolicyResource.policyId, policyIds));
      },
      async (tx) => {
        const policies = await tx.query.policy.findMany({
          where: eq(SCHEMA.policy.workspaceId, this.workspaceId),
          with: { targets: true },
        });

        const promises = policies.map(async (p) => {
          const { targets, workspaceId } = p;
          const targetPromises = targets.map(async (t) => {
            const { resourceSelector } = t;
            if (resourceSelector == null) return [];

            const resQuery = new QueryBuilder(tx)
              .resources()
              .where(resourceSelector)
              .sql();

            const rows = await tx
              .select()
              .from(SCHEMA.resource)
              .where(
                and(eq(SCHEMA.resource.workspaceId, workspaceId), resQuery),
              );

            return rows.map((row) => ({
              policyId: p.id,
              resourceId: row.id,
            }));
          });

          const fulfilled = await Promise.all(targetPromises);
          return fulfilled.flat();
        });

        const fulfilled = await Promise.all(promises);
        return fulfilled.flat();
      },
    );
  }
}
