import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { authn } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  resourceIdentifier: z.string(),
});

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .handle<{ body: z.infer<typeof bodySchema> }>(async (ctx) => {
    try {
      const { body, db } = ctx;

      const resource = await db
        .select()
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.identifier, body.resourceIdentifier),
            eq(SCHEMA.resource.workspaceId, body.workspaceId),
          ),
        )
        .then(takeFirstOrNull);
      if (!resource)
        return Response.json({ error: "Resource not found" }, { status: 404 });

      const deployment = await db
        .select()
        .from(SCHEMA.deployment)
        .innerJoin(
          SCHEMA.system,
          eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
        )
        .where(
          and(
            eq(SCHEMA.deployment.id, body.deploymentId),
            eq(SCHEMA.system.workspaceId, body.workspaceId),
          ),
        )
        .then(takeFirstOrNull);
      if (!deployment)
        return Response.json(
          { error: "Deployment not found" },
          { status: 404 },
        );

      await db
        .insert(SCHEMA.deploymentResourceRelationship)
        .values(body)
        .returning();

      return Response.json(body);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message.includes("duplicate key"))
        return Response.json(
          { error: "Resource already associated with a deployment" },
          { status: 400 },
        );
      return Response.json(
        { error: "Failed to create relationship" },
        { status: 500 },
      );
    }
  });
