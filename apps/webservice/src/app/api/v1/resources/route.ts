import type * as schema from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

import { selector, upsertResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createResource } from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { groupResourcesByHook } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const log = logger.child({ module: "v1/resources" });

const patchBodySchema = z.object({
  workspaceId: z.string().uuid(),
  resources: z.array(
    createResource
      .omit({ lockedAt: true, providerId: true, workspaceId: true })
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
              vars == null ||
              new Set(vars.map((v) => v.key)).size === vars.length,
            "Duplicate variable keys are not allowed",
          ),
      }),
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
        if (ctx.body.resources.length === 0)
          return NextResponse.json(
            { error: "No resources provided" },
            { status: 400 },
          );

        // since this endpoint is not scoped to a provider, we will ignore deleted resources
        // as someone may be calling this endpoint to do a pure upsert
        const { workspaceId } = ctx.body;
        const { toInsert, toUpdate } = await groupResourcesByHook(
          db,
          ctx.body.resources.map((r) => ({ ...r, workspaceId })),
        );

        const [insertedResources, updatedResources] = await Promise.all([
          upsertResources(db, toInsert),
          upsertResources(db, toUpdate),
        ]);
        const insertJobs = insertedResources.map((r) => ({
          name: r.id,
          data: r,
        }));
        const updateJobs = updatedResources.map((r) => ({
          name: r.id,
          data: r,
        }));

        selector()
          .compute()
          .allResourceSelectors(workspaceId)
          .then(() => {
            getQueue(Channel.NewResource).addBulk(insertJobs);
            getQueue(Channel.UpdatedResource).addBulk(updateJobs);
          });

        const count = insertedResources.length + updatedResources.length;
        return NextResponse.json({ count });
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
