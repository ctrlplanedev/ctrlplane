import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { request } from "../../middleware";

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
      const { policyId } = await params;

      const result = await db
        .delete(SCHEMA.policy)
        .where(eq(SCHEMA.policy.id, policyId));

      return NextResponse.json({ success: true, count: result.rowCount });
    },
  );
