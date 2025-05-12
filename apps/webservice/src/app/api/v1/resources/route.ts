import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR } from "http-status";
import { z } from "zod";

import { and, eq, upsertResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { getAffectedVariables } from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const log = logger.child({ module: "v1/resources" });

const patchBodySchema = schema.createResource
  .omit({ lockedAt: true, providerId: true })
  .extend({
    metadata: z.record(z.string()).optional(),
    variables: z
      .array(
        z.union([
          z.object({
            key: z.string(),
            value: z.union([
              z.string(),
              z.number(),
              z.boolean(),
              z.record(z.any()),
              z.array(z.any()),
            ]),
            sensitive: z.boolean().default(false),
          }),
          z.object({
            key: z.string(),
            defaultValue: z
              .union([
                z.string(),
                z.number(),
                z.boolean(),
                z.record(z.any()),
                z.array(z.any()),
              ])
              .optional(),
            reference: z.string(),
            path: z.array(z.string()),
          }),
        ]),
      )
      .optional()
      .refine(
        (vars) =>
          vars == null || new Set(vars.map((v) => v.key)).size === vars.length,
        "Duplicate variable keys are not allowed",
      ),
  });

export const POST = request()
  .use(authn)
  .use(parseBody(patchBodySchema))
  .use(
    authz(({ can, ctx }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ user: schema.User; body: z.infer<typeof patchBodySchema> }>(
    async (ctx) => {
      try {
        const existingResource = await db.query.resource.findFirst({
          where: and(
            eq(schema.resource.identifier, ctx.body.identifier),
            eq(schema.resource.workspaceId, ctx.body.workspaceId),
          ),
          with: { metadata: true, variables: true },
        });

        const [insertedResource] = await upsertResources(
          db,
          ctx.body.workspaceId,
          [ctx.body],
        );
        if (insertedResource == null)
          return NextResponse.json(
            { error: "Failed to update resources" },
            { status: INTERNAL_SERVER_ERROR },
          );
        const queueChannel =
          existingResource != null
            ? Channel.UpdatedResource
            : Channel.NewResource;

        getQueue(queueChannel).add(insertedResource.id, insertedResource, {
          jobId: insertedResource.id,
        });

        const affectedVariables = getAffectedVariables(
          existingResource?.variables ?? [],
          insertedResource.variables,
        );

        for (const variable of affectedVariables)
          await getQueue(Channel.UpdateResourceVariable).add(
            variable.id,
            variable,
          );

        const resourceWithMeta = {
          ...insertedResource,
          metadata: Object.fromEntries(
            insertedResource.metadata.map((m) => [m.key, m.value]),
          ),
        };

        return NextResponse.json(resourceWithMeta, { status: 200 });
      } catch (err) {
        console.error(err);
        const error = err instanceof Error ? err : new Error(String(err));
        log.error(`Error updating resources: ${error}`);
        return NextResponse.json(
          { error: "Failed to update resources" },
          { status: 500 },
        );
      }
    },
  );
