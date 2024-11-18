import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { authn } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  fromIdentifier: z.string(),
  toIdentifier: z.string(),
  type: z.enum(["associated_with", "depends_on"]),
});

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .handle<{ body: z.infer<typeof bodySchema> }>(async (ctx) => {
    try {
      const { body, db } = ctx;

      const fromResource = await db
        .select()
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.identifier, body.fromIdentifier),
            eq(SCHEMA.resource.workspaceId, body.workspaceId),
          ),
        )
        .then(takeFirstOrNull);
      if (!fromResource)
        return Response.json(
          { error: `${body.fromIdentifier} not found` },
          { status: 404 },
        );

      const toResource = await db
        .select()
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.identifier, body.toIdentifier),
            eq(SCHEMA.resource.workspaceId, body.workspaceId),
          ),
        )
        .then(takeFirstOrNull);
      if (!toResource)
        return Response.json(
          { error: `${body.toIdentifier} not found` },
          { status: 404 },
        );

      await db.insert(SCHEMA.resourceRelationship).values({
        sourceId: fromResource.id,
        targetId: toResource.id,
        type: body.type,
      });

      return Response.json(
        { message: "Relationship created" },
        { status: 200 },
      );
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: "Failed to create relationship" },
        { status: 500 },
      );
    }
  });
