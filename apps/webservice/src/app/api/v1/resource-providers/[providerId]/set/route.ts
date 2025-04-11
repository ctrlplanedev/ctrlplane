import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createResource,
  Resource,
  resourceProvider,
  workspace,
} from "@ctrlplane/db/schema";
import type { ResourceToInsert } from "@ctrlplane/job-dispatch";
import { handleResourceProviderScan } from "@ctrlplane/job-dispatch";
import { partitionForSchemaErrors } from "@ctrlplane/validators/resources";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "../../../body-parser";
import { request } from "../../../middleware";

const bodyResource = createResource
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
  });

type BodyResource = z.infer<typeof bodyResource>;

const bodySchema = z.object({
  resources: z.array(bodyResource),
});

type BodySchema = z.infer<typeof bodySchema>;

export const PATCH = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ can, extra }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "resourceProvider", id: extra.params.providerId })
    ),
  )
  .handle<
    { body: BodySchema },
    { params: { providerId: string } }
  >(async (ctx, { params }) => {
    const { body } = ctx;

    const query = await db
      .select()
      .from(resourceProvider)
      .innerJoin(workspace, eq(workspace.id, resourceProvider.workspaceId))
      .where(eq(resourceProvider.id, params.providerId))
      .then(takeFirstOrNull);

    const provider = query?.resource_provider;
    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }

    const resourcesToInsert = body.resources.map((r) => ({
      ...r,
      providerId: provider.id,
      workspaceId: provider.workspaceId,
    }));

    const { valid, errors } = partitionForSchemaErrors<ResourceToInsert>(
      resourcesToInsert,
    );

    if (valid.length > 0) {
      const resources = await handleResourceProviderScan(
        db,
        valid.map((r) => ({
          ...r,
          variables: r.variables?.map((v) => ({
            ...v,
            value: v.value ?? null,
          })),
        })),
      );

      return NextResponse.json({ resources });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation errors", issues: errors },
        { status: 400 },
      );
    }

    return NextResponse.json([]);
  });
