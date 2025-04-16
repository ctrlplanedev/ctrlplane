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

  releaseTargetSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyTargetReleaseTarget,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .where(inArray(SCHEMA.policyTarget.policyId, this.ids));

        await tx.delete(SCHEMA.computedPolicyTargetReleaseTarget).where(
          inArray(
            SCHEMA.computedPolicyTargetReleaseTarget.policyTargetId,
            targets.map((t) => t.id),
          ),
        );
      },
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .where(inArray(SCHEMA.policyTarget.policyId, this.ids));

        const qb = new QueryBuilder(tx);
        const targetPromises = targets.map(async (t) => {
          if (
            t.resourceSelector == null &&
            t.deploymentSelector == null &&
            t.environmentSelector == null
          )
            return [];
          const releaseTargets = await tx
            .select()
            .from(SCHEMA.releaseTarget)
            .innerJoin(
              SCHEMA.resource,
              eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
            )
            .innerJoin(
              SCHEMA.deployment,
              eq(SCHEMA.releaseTarget.deploymentId, SCHEMA.deployment.id),
            )
            .innerJoin(
              SCHEMA.environment,
              eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
            )
            .where(
              and(
                qb.resources().where(t.resourceSelector).sql(),
                qb.deployments().where(t.deploymentSelector).sql(),
                qb.environments().where(t.environmentSelector).sql(),
              ),
            );

          return releaseTargets.map((rt) => ({
            policyTargetId: t.id,
            releaseTargetId: rt.release_target.id,
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

  releaseTargetSelectors() {
    return new ReplaceBuilder(
      this.tx,
      SCHEMA.computedPolicyTargetReleaseTarget,
      async (tx) => {
        const targets = await tx
          .select()
          .from(SCHEMA.policyTarget)
          .innerJoin(
            SCHEMA.policy,
            eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
          )
          .where(eq(SCHEMA.policy.workspaceId, this.workspaceId));

        await tx.delete(SCHEMA.computedPolicyTargetReleaseTarget).where(
          inArray(
            SCHEMA.computedPolicyTargetReleaseTarget.policyTargetId,
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
          .where(eq(SCHEMA.policy.workspaceId, this.workspaceId));
        const targets = rows.map((r) => r.policy_target);

        const qb = new QueryBuilder(tx);
        const targetPromises = targets.map(async (t) => {
          const releaseTargets = await tx
            .select()
            .from(SCHEMA.releaseTarget)
            .innerJoin(
              SCHEMA.resource,
              eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
            )
            .innerJoin(
              SCHEMA.deployment,
              eq(SCHEMA.releaseTarget.deploymentId, SCHEMA.deployment.id),
            )
            .innerJoin(
              SCHEMA.environment,
              eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
            )
            .where(
              and(
                qb.resources().where(t.resourceSelector).sql(),
                qb.deployments().where(t.deploymentSelector).sql(),
                qb.environments().where(t.environmentSelector).sql(),
              ),
            );

          return releaseTargets.map((rt) => ({
            policyTargetId: t.id,
            releaseTargetId: rt.release_target.id,
          }));
        });

        const fulfilled = await Promise.all(targetPromises);
        return fulfilled.flat();
      },
    );
  }
}
