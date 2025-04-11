import type { z } from "zod";
import { NextResponse } from "next/server";
import { createInsertSchema } from "drizzle-zod";

import { and, eq, takeFirst } from "@ctrlplane/db";
import { resourceSchema } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const createResourceSchemaSchema = createInsertSchema(resourceSchema).omit({
  id: true,
});

export const POST = request()
  .use(authn)
  .use(parseBody(createResourceSchemaSchema))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.ResourceCreate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof createResourceSchemaSchema> }>(
    async ({ db, body }) => {
      try {
        const [schema] = await db
          .insert(resourceSchema)
          .values({
            ...body,
            jsonSchema: body.jsonSchema as any,
          })
          .returning();

        return NextResponse.json(schema, { status: 201 });
      } catch (error: unknown) {
        // Check if error is due to unique constraint violation
        if (
          error instanceof Error &&
          error.message.includes("duplicate key value")
        ) {
          const existingSchema = await db
            .select()
            .from(resourceSchema)
            .where(
              and(
                eq(resourceSchema.workspaceId, body.workspaceId),
                eq(resourceSchema.version, body.version),
                eq(resourceSchema.kind, body.kind),
              ),
            )
            .then(takeFirst);

          return NextResponse.json(
            {
              error: "Schema already exists for this version and kind",
              id: existingSchema.id,
            },
            { status: 409 },
          );
        }

        return NextResponse.json(
          { error: "Failed to create schema" },
          { status: 500 },
        );
      }
    },
  );
