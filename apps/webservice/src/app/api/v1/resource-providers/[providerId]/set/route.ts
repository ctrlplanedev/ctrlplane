import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createResource,
  resourceProvider,
  workspace,
} from "@ctrlplane/db/schema";
import { upsertResources } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "../../../body-parser";
import { request } from "../../../middleware";

const bodySchema = z.object({
  targets: z.array(
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

export const PATCH = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ can, extra }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "resourceProvider", id: extra.params.providerId }),
    ),
  )
  .handle<
    { body: z.infer<typeof bodySchema> },
    { params: { providerId: string } }
  >(async (ctx, { params }) => {
    console.log({ ctx });
    const { body } = ctx;

    const query = await db
      .select()
      .from(resourceProvider)
      .innerJoin(workspace, eq(workspace.id, resourceProvider.workspaceId))
      .where(eq(resourceProvider.id, params.providerId))
      .then(takeFirstOrNull);

    const provider = query?.resource_provider;
    if (!provider)
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );

    const targetsToInsert = body.targets.map((t) => ({
      ...t,
      providerId: provider.id,
      workspaceId: provider.workspaceId,
    }));

    const targets = await upsertResources(
      db,
      targetsToInsert.map((t) => ({
        ...t,
        variables: t.variables?.map((v) => ({
          ...v,
          value: v.value ?? null,
        })),
      })),
    );

    return NextResponse.json({ targets });
  });
