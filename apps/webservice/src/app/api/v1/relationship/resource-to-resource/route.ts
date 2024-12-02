import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
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

      const inWorkspace = eq(SCHEMA.resource.workspaceId, body.workspaceId);
      const fromResource = await db.query.resource.findFirst({
        where: and(
          inWorkspace,
          eq(SCHEMA.resource.identifier, body.fromIdentifier),
        ),
      });

      const toResource = await db.query.resource.findFirst({
        where: and(
          inWorkspace,
          eq(SCHEMA.resource.identifier, body.toIdentifier),
        ),
      });

      const relationship = await db.insert(SCHEMA.resourceRelationship).values({
        ...body,
        fromIdentifier: fromResource?.identifier ?? body.fromIdentifier,
        toIdentifier: toResource?.identifier ?? body.toIdentifier,
      });

      return Response.json(
        { message: "Relationship created", relationship },
        { status: 200 },
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("duplicate key"))
        return Response.json(
          { error: "Relationship already exists" },
          { status: 409 },
        );
      return Response.json(
        { error: "Failed to create relationship" },
        { status: 500 },
      );
    }
  });
