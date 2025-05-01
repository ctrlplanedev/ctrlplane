import type { z } from "zod";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { updatePolicyInTx } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const log = logger.child({ route: "/api/v1/policies/[policyId]" });

export const PATCH = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.PolicyUpdate)
        .on({ type: "policy", id: params.policyId ?? "" }),
    ),
  )
  .use(parseBody(schema.updatePolicy))
  .handle<
    { body: z.infer<typeof schema.updatePolicy> },
    { params: Promise<{ policyId: string }> }
  >(async ({ db, body }, { params }) => {
    try {
      const { policyId } = await params;

      const existingPolicy = await db.query.policy.findFirst({
        where: eq(SCHEMA.policy.id, policyId),
      });

      if (!existingPolicy)
        return NextResponse.json(
          { error: "Policy not found" },
          { status: NOT_FOUND },
        );

      const policy = await db.transaction(async (tx) =>
        updatePolicyInTx(tx, policyId, body),
      );
      await getQueue(Channel.UpdatePolicy).add(policy.id, policy);

      return NextResponse.json(policy);
    } catch (error) {
      log.error("Failed to update policy", { error });
      return NextResponse.json(
        { error: "Failed to update policy" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.PolicyDelete)
        .on({ type: "policy", id: params.policyId ?? "" }),
    ),
  )
  .handle<unknown, { params: Promise<{ policyId: string }> }>(
    async ({ db }, { params }) => {
      try {
        const { policyId } = await params;

        const result = await db
          .delete(SCHEMA.policy)
          .where(eq(SCHEMA.policy.id, policyId));

        return NextResponse.json({ success: true, count: result.rowCount });
      } catch (error) {
        log.error("Failed to delete policy", { error });
        return NextResponse.json(
          { error: "Failed to delete policy" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
