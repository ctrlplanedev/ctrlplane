import type { PermissionChecker } from "@ctrlplane/auth/utils";
import type { User } from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const body = schema.createEnvironment.extend({
  expiresAt: z.coerce
    .date()
    .min(new Date(), "Expires at must be in the future")
    .optional(),
});

export const POST = request()
  .use(authn)
  .use(parseBody(body))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.SystemUpdate)
        .on({ type: "system", id: ctx.body.systemId }),
    ),
  )
  .handle<{ user: User; can: PermissionChecker; body: z.infer<typeof body> }>(
    async (ctx) =>
      ctx.db
        .insert(schema.environment)
        .values({
          ...ctx.body,
          expiresAt: isPresent(ctx.body.expiresAt)
            ? new Date(ctx.body.expiresAt)
            : undefined,
        })
        .returning()
        .then(takeFirst)
        .then((environment) => NextResponse.json({ environment }))
        .catch(() =>
          NextResponse.json(
            { error: "Failed to create environment" },
            { status: 500 },
          ),
        ),
  );
