import { NextResponse } from "next/server";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { resourceSchema } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { request } from "../../middleware";

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) => {
      return can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: params.resourceId ?? "" });
    }),
  )
  .handle<{ params: Promise<{ schemaId: string }> }>(async ({ db, params }) => {
    const { schemaId } = await params;
    const schema = await db
      .select()
      .from(resourceSchema)
      .where(eq(resourceSchema.id, schemaId))
      .then(takeFirstOrNull);

    if (!schema)
      return NextResponse.json({ error: "Schema not found" }, { status: 404 });

    await db.delete(resourceSchema).where(eq(resourceSchema.id, schemaId));

    return NextResponse.json(schema, { status: 204 });
  });
