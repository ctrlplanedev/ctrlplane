import type { z } from "zod";
import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";
import { bodySchema } from "~/app/api/v1/targets/workspaces/[workspaceId]/route";

export const PATCH = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ can, extra }) => {
      return can
        .perform(Permission.TargetUpdate)
        .on({ type: "target", id: extra.params.targetId });
    }),
  )
  .handle<
    { body: z.infer<typeof bodySchema> },
    { params: { targetId: string } }
  >(async (ctx, { params }) => {
    const { body } = ctx;

    console.log(body);
    console.log(params.targetId);

    const existingTarget = await db.query.target.findFirst({
      where: eq(schema.target.id, params.targetId),
    });

    if (existingTarget == null)
      return NextResponse.json({ error: "Target not found" }, { status: 404 });

    const targetData = {
      ...existingTarget,
      ...body.target,
    };

    const target = await upsertTargets(db, [targetData]);
    return NextResponse.json(target);
  });
