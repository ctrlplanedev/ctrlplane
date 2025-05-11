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
import { handleResourceProviderScan } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "../../../body-parser";
import { request } from "../../../middleware";

const bodySchema = z.object({
  resources: z.array(
    createResource
      .omit({ lockedAt: true, providerId: true, workspaceId: true })
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
    authz(({ can, params }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "resourceProvider", id: params.providerId ?? "" }),
    ),
  )
  .handle<
    { body: z.infer<typeof bodySchema> },
    { params: Promise<{ providerId: string }> }
  >(async (ctx, { params }) => {
    const { body } = ctx;
    const { providerId } = await params;

    const query = await db
      .select()
      .from(resourceProvider)
      .innerJoin(workspace, eq(workspace.id, resourceProvider.workspaceId))
      .where(eq(resourceProvider.id, providerId))
      .then(takeFirstOrNull);

    const provider = query?.resource_provider;
    if (provider == null)
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );

    const resources = await handleResourceProviderScan(
      db,
      provider.workspaceId,
      provider.id,
      body.resources,
    );

    return NextResponse.json({ resources });
  });
