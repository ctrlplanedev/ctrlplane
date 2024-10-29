import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";
import { parseBody } from "../../../../body-parser";

export const bodySchema = z.object({
  target: schema.createTarget.extend({
    metadata: z.record(z.string()).optional(),
    variables: z
      .array(
        z.object({
          key: z.string(),
          value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
          sensitive: z.boolean(),
        }),
      )
      .optional()
      .refine(
        (vars) =>
          vars == null || new Set(vars.map((v) => v.key)).size === vars.length,
        "Duplicate variable keys are not allowed",
      ),
  }),
});

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ can, extra }) => {
      return can
        .perform(Permission.TargetCreate)
        .on({ type: "target", id: extra.params.targetId });
    }),
  )
  .handle<
    { body: z.infer<typeof bodySchema> },
    { params: { targetId: string; workspaceId: string } }
  >(async (ctx, { params }) => {
    const { body } = ctx;

    const targetData = {
      ...body.target,
      workspaceId: params.workspaceId,
      variables: body.target.variables?.map((v) => ({
        ...v,
        value: v.value ?? null,
      })),
    };

    const target = await upsertTargets(db, [targetData]);

    return NextResponse.json(target);
  });
