import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

function transformMetadata(
  metadata: Array<{ key: string; value: string }>,
): Record<string, string> {
  return metadata.reduce<Record<string, string>>((acc, m) => {
    acc[m.key] = m.value;
    return acc;
  }, {});
}

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
    const { targetId } = params;

    const target = await db.query.target.findFirst({
      where: eq(schema.target.id, targetId),
      with: {
        metadata: true,
        variables: true,
        provider: true,
      },
    });

    if (!target)
      return NextResponse.json({ error: "Target not found" }, { status: 404 });

    const metadata = transformMetadata(target.metadata);

    return NextResponse.json({
      ...target,
      metadata,
    });
  });
