import type * as schema from "@ctrlplane/db/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

import { insertResources, updateResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createResource } from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { groupResourcesByHook } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

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

      const toUpdateWithMetadataAndVariables = toUpdate.map((r) => {
        const rt = ctx.body.resources.find(
          (ri) => ri.identifier === r.identifier,
        );
        if (rt == null) throw new Error(`Resource ${r.identifier} not found`);
        return { ...r, ...rt };
      });

      const [insertedResources, updatedResources] = await Promise.all([
        insertResources(db, toInsert),
        updateResources(db, toUpdateWithMetadataAndVariables),
      ]);
      const insertJobs = insertedResources.map((r) => ({
        name: r.id,
        data: r,
      }));
      const updateJobs = updatedResources
        .filter((r) => r.isChanged)
        .map((r) => ({ name: r.resource.id, data: r.resource }));

      await Promise.all([
        getQueue(Channel.NewResource).addBulk(insertJobs),
        getQueue(Channel.UpdatedResource).addBulk(updateJobs),
      ]);

      const count = insertedResources.length + updatedResources.length;
      return NextResponse.json({ count });
    },
  );
