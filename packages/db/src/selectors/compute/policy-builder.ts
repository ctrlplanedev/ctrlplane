import { and, eq, inArray, isNotNull } from "drizzle-orm/pg-core/expressions";

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
      SCHEMA.computedPolicyTargetEnvironment,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .where(
            and(
              inArray(SCHEMA.policyTarget.policyId, this.ids),
              isNotNull(SCHEMA.policyTarget.environmentSelector),
            ),
          );

        await tx.delete(SCHEMA.computedPolicyTargetEnvironment).where(
          inArray(
            SCHEMA.computedPolicyTargetEnvironment.policyTargetId,
            targets.map((t) => t.id),
          ),
        );
      },
      async (tx) => {
        const rows = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              inArray(SCHEMA.policyTarget.policyId, this.ids),
              isNotNull(SCHEMA.policyTarget.environmentSelector),
            ),
          );

        const targets = rows.map((row) => ({
          ...row.policy_target,
          workspaceId: row.policy.workspaceId,
        }));

        const targetPromises = targets.map(async (t) => {
          const { environmentSelector, workspaceId } = t;
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
            policyTargetId: t.id,
            environmentId: row.environment.id,
          }));
        });

        const fulfilled = await Promise.all(targetPromises);
        return fulfilled.flat();
      },
    );
  }

  deploymentSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyTargetDeployment,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .where(
            and(
              inArray(SCHEMA.policyTarget.policyId, this.ids),
              isNotNull(SCHEMA.policyTarget.deploymentSelector),
            ),
          );

        await tx.delete(SCHEMA.computedPolicyTargetDeployment).where(
          inArray(
            SCHEMA.computedPolicyTargetDeployment.policyTargetId,
            targets.map((t) => t.id),
          ),
        );
      },
      async (tx) => {
        const rows = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              inArray(SCHEMA.policyTarget.policyId, this.ids),
              isNotNull(SCHEMA.policyTarget.deploymentSelector),
            ),
          );

        const targets = rows.map((row) => ({
          ...row.policy_target,
          workspaceId: row.policy.workspaceId,
        }));

        const targetPromises = targets.map(async (t) => {
          const { deploymentSelector, workspaceId } = t;
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
            policyTargetId: t.id,
            deploymentId: row.deployment.id,
          }));
        });

        const fulfilled = await Promise.all(targetPromises);
        return fulfilled.flat();
      },
    );
  }

  resourceSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyTargetResource,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .where(
            and(
              inArray(SCHEMA.policyTarget.policyId, this.ids),
              isNotNull(SCHEMA.policyTarget.resourceSelector),
            ),
          );

        await tx.delete(SCHEMA.computedPolicyTargetResource).where(
          inArray(
            SCHEMA.computedPolicyTargetResource.policyTargetId,
            targets.map((t) => t.id),
          ),
        );
      },
      async (tx) => {
        const rows = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              inArray(SCHEMA.policyTarget.policyId, this.ids),
              isNotNull(SCHEMA.policyTarget.resourceSelector),
            ),
          );

        const targets = rows.map((row) => ({
          ...row.policy_target,
          workspaceId: row.policy.workspaceId,
        }));

        const targetPromises = targets.map(async (t) => {
          const { resourceSelector, workspaceId } = t;
          if (resourceSelector == null) return [];

          const resQuery = new QueryBuilder(tx)
            .resources()
            .where(resourceSelector)
            .sql();

          const rows = await tx
            .select()
            .from(SCHEMA.resource)
            .where(and(eq(SCHEMA.resource.workspaceId, workspaceId), resQuery));

          return rows.map((row) => ({
            policyTargetId: t.id,
            resourceId: row.id,
          }));
        });

        const fulfilled = await Promise.all(targetPromises);
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
      SCHEMA.computedPolicyTargetEnvironment,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              eq(SCHEMA.policy.workspaceId, this.workspaceId),
              isNotNull(SCHEMA.policyTarget.environmentSelector),
            ),
          );

        await tx.delete(SCHEMA.computedPolicyTargetEnvironment).where(
          inArray(
            SCHEMA.computedPolicyTargetEnvironment.policyTargetId,
            targets.map((t) => t.policy_target.id),
          ),
        );
      },
      async (tx) => {
        const rows = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              eq(SCHEMA.policy.workspaceId, this.workspaceId),
              isNotNull(SCHEMA.policyTarget.environmentSelector),
            ),
          );

        const targets = rows.map((row) => ({
          ...row.policy_target,
          workspaceId: row.policy.workspaceId,
        }));

        const targetPromises = targets.map(async (t) => {
          const { environmentSelector, workspaceId } = t;
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
            policyTargetId: t.id,
            environmentId: row.environment.id,
          }));
        });

        const fulfilled = await Promise.all(targetPromises);
        return fulfilled.flat();
      },
    );
  }

  deploymentSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyTargetDeployment,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              eq(SCHEMA.policy.workspaceId, this.workspaceId),
              isNotNull(SCHEMA.policyTarget.deploymentSelector),
            ),
          );

        await tx.delete(SCHEMA.computedPolicyTargetDeployment).where(
          inArray(
            SCHEMA.computedPolicyTargetDeployment.policyTargetId,
            targets.map((t) => t.policy_target.id),
          ),
        );
      },
      async (tx) => {
        const rows = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              eq(SCHEMA.policy.workspaceId, this.workspaceId),
              isNotNull(SCHEMA.policyTarget.deploymentSelector),
            ),
          );

        const targets = rows.map((row) => ({
          ...row.policy_target,
          workspaceId: row.policy.workspaceId,
        }));

        const targetPromises = targets.map(async (t) => {
          const { deploymentSelector, workspaceId } = t;
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
            policyTargetId: t.id,
            deploymentId: row.deployment.id,
          }));
        });

        const fulfilled = await Promise.all(targetPromises);
        return fulfilled.flat();
      },
    );
  }

  resourceSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyTargetResource,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              eq(SCHEMA.policy.workspaceId, this.workspaceId),
              isNotNull(SCHEMA.policyTarget.resourceSelector),
            ),
          );

        await tx.delete(SCHEMA.computedPolicyTargetResource).where(
          inArray(
            SCHEMA.computedPolicyTargetResource.policyTargetId,
            targets.map((t) => t.policy_target.id),
          ),
        );
      },
      async (tx) => {
        const rows = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(
            and(
              eq(SCHEMA.policy.workspaceId, this.workspaceId),
              isNotNull(SCHEMA.policyTarget.resourceSelector),
            ),
          );

        const targets = rows.map((row) => ({
          ...row.policy_target,
          workspaceId: row.policy.workspaceId,
        }));

        const targetPromises = targets.map(async (t) => {
          const { resourceSelector, workspaceId } = t;
          if (resourceSelector == null) return [];

          const resQuery = new QueryBuilder(tx)
            .resources()
            .where(resourceSelector)
            .sql();

          const rows = await tx
            .select()
            .from(SCHEMA.resource)
            .where(and(eq(SCHEMA.resource.workspaceId, workspaceId), resQuery));

          return rows.map((row) => ({
            policyTargetId: t.id,
            resourceId: row.id,
          }));
        });

        const fulfilled = await Promise.all(targetPromises);
        return fulfilled.flat();
      },
    );
  }
}
