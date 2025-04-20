import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.PolicyGet)
        .on({ type: "policy", id: params.policyId ?? "" }),
    ),
  )
  .handle<unknown, { params: Promise<{ policyId: string }> }>(
    async (ctx, { params }) => {
      const { policyId } = await params;
      const releaseTargetsQuery = ctx.db
        .select()
        .from(schema.releaseTarget)
        .innerJoin(
          schema.computedPolicyTargetReleaseTarget,
          eq(
            schema.releaseTarget.id,
            schema.computedPolicyTargetReleaseTarget.releaseTargetId,
          ),
        )
        .innerJoin(
          schema.policyTarget,
          eq(
            schema.computedPolicyTargetReleaseTarget.policyTargetId,
            schema.policyTarget.id,
          ),
        )
        .innerJoin(
          schema.resource,
          eq(schema.releaseTarget.resourceId, schema.resource.id),
        )
        .innerJoin(
          schema.environment,
          eq(schema.releaseTarget.environmentId, schema.environment.id),
        )
        .innerJoin(
          schema.deployment,
          eq(schema.releaseTarget.deploymentId, schema.deployment.id),
        )
        .where(eq(schema.policyTarget.policyId, policyId))
        .limit(1_000)
        .then((res) =>
          res.map((r) => ({
            ...r.release_target,
            policyTarget: r.policy_target,
            resource: r.resource,
            environment: r.environment,
            deployment: r.deployment,
          })),
        );

      const releaseTargets = await releaseTargetsQuery;

      return NextResponse.json({
        releaseTargets,
        count: releaseTargets.length,
      });
    },
  );
