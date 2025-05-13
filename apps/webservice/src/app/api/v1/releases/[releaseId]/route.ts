import { NextResponse } from "next/server";
import httpStatus from "http-status";
import { z } from "zod";

import { buildConflictUpdateColumns, eq, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const patchSchema = SCHEMA.updateDeploymentVersion.and(
  z.object({
    metadata: z.record(z.string()).optional(),
    version: z.string().optional(),
  }),
);

export const PATCH = request()
  .use(authn)
  .use(parseBody(patchSchema))
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.DeploymentVersionUpdate)
        .on({ type: "deploymentVersion", id: params.releaseId }),
    ),
  )
  .handle<
    { body: z.infer<typeof patchSchema> },
    { params: { releaseId: string } }
  >(async (ctx, { params }) => {
    const { releaseId: versionId } = params;
    const { body } = ctx;

    try {
      const tag = body.tag ?? body.version;
      const release = await ctx.db
        .update(SCHEMA.deploymentVersion)
        .set({ ...body, tag })
        .where(eq(SCHEMA.deploymentVersion.id, versionId))
        .returning()
        .then(takeFirst);

      if (Object.keys(body.metadata ?? {}).length > 0)
        await ctx.db
          .insert(SCHEMA.deploymentVersionMetadata)
          .values(
            Object.entries(body.metadata ?? {}).map(([key, value]) => ({
              versionId,
              key,
              value,
            })),
          )
          .onConflictDoUpdate({
            target: [
              SCHEMA.deploymentVersionMetadata.key,
              SCHEMA.deploymentVersionMetadata.versionId,
            ],
            set: buildConflictUpdateColumns(SCHEMA.deploymentVersionMetadata, [
              "value",
            ]),
          });

      return NextResponse.json(release);
    } catch (error) {
      logger.error(error);
      return NextResponse.json(
        { error: "Failed to update version" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });
