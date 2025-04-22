import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR } from "http-status";
import { z } from "zod";

import { and, eq, selector, upsertResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
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
          with: {
            metadata: true,
          },
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
        const queue = getQueue(queueChannel);
        selector()
          .compute()
          .allResourceSelectors(ctx.body.workspaceId)
          .then(() => queue.add(insertedResource.id, insertedResource));

        const resourceWithMeta = {
          ...insertedResource,
          metadata: Object.fromEntries(
            insertedResource.metadata.map((m) => [m.key, m.value]),
          ),
        };

        return NextResponse.json(resourceWithMeta, { status: 200 });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error(`Error updating resources: ${error}`);
        return NextResponse.json(
          { error: "Failed to update resources" },
          { status: 500 },
        );
      }
    },
  );
