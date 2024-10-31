import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { request } from "../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra }) => {
      return can
        .perform(Permission.TargetGet)
        .on({ type: "target", id: extra.params.targetId });
    }),
  )
  .handle(async ({ db }, { params }: { params: { targetId: string } }) => {
    const data = await db.query.target.findFirst({
      where: eq(schema.target.id, params.targetId),
      with: {
        metadata: true,
        variables: true,
        provider: true,
      },
    });

    if (data == null)
      return NextResponse.json({ error: "Target not found" }, { status: 404 });

    const { metadata, ...target } = data;

    return NextResponse.json({
      ...target,
      metadata: Object.fromEntries(metadata.map((t) => [t.key, t.value])),
    });
  });
