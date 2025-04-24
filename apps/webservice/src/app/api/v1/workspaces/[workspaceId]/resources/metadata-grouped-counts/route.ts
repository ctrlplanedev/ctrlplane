import { NextResponse } from "next/server";
import { z } from "zod";

import { and, eq, inArray, isNull, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { resourceMetadata } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";

const bodySchema = z.object({
  metadataKeys: z.array(z.string()),
  allowNullCombinations: z.boolean(),
});

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(async ({ can, params }) => {
      const { workspaceId } = params;
      return can
        .perform(Permission.ResourceList)
        .on({ type: "workspace", id: workspaceId ?? "" });
    }),
  )
  .handle<
    { body: z.infer<typeof bodySchema> },
    { params: Promise<{ workspaceId: string }> }
  >(async (ctx, { params }) => {
    const { body } = ctx;
    const { workspaceId } = await params;
    const resourceMetadataAggBase = ctx.db
      .select({
        id: schema.resource.id,
        metadata: sql<Record<string, string>>`COALESCE(jsonb_object_agg(
            ${schema.resourceMetadata.key},
            ${schema.resourceMetadata.value}
          ) FILTER (WHERE ${schema.resourceMetadata.key} IS NOT NULL), '{}'::jsonb)`.as(
          "metadata",
        ),
      })
      .from(schema.resource)
      .leftJoin(
        resourceMetadata,
        and(
          eq(schema.resource.id, schema.resourceMetadata.resourceId),
          inArray(schema.resourceMetadata.key, body.metadataKeys),
        ),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, workspaceId),
          isNull(schema.resource.deletedAt),
        ),
      )
      .groupBy(schema.resource.id);

    const resourceMetadataAgg = body.allowNullCombinations
      ? resourceMetadataAggBase.as("resource_metadata_agg")
      : resourceMetadataAggBase
          .having(
            sql<number>`COUNT(DISTINCT ${schema.resourceMetadata.key}) = ${body.metadataKeys.length}`,
          )
          .as("resource_metadata_agg");

    const combinations = await ctx.db
      .with(resourceMetadataAgg)
      .select({
        metadata: resourceMetadataAgg.metadata,
        resources: sql<number>`COUNT(*)`.as("resources"),
      })
      .from(resourceMetadataAgg)
      .groupBy(resourceMetadataAgg.metadata);

    const keysNullObject = Object.fromEntries(
      body.metadataKeys.map((key) => [key, null]),
    );

    return NextResponse.json(
      {
        keys: body.metadataKeys,
        combinations: combinations.map((c) => ({
          metadata: { ...keysNullObject, ...c.metadata },
          resources: Number(c.resources),
        })),
      },
      { status: 200 },
    );
  });
