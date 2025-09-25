import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import {
  and,
  eq,
  getResource,
  isNull,
  isResourceChanged,
  upsertResources,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import {
  getAffectedVariables,
  getReferenceVariableValueDb,
} from "@ctrlplane/rule-engine";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const log = logger.child({ module: "v1/resources/[resourceId]" });

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) => {
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: params.resourceId ?? "" });
    }),
  )
  .handle<unknown, { params: Promise<{ resourceId: string }> }>(
    async (_, { params }) => {
      // we don't check deletedAt as we may be querying for soft-deleted resources
      const { resourceId } = await params;
      const data = await getResource()
        .withProviderMetadataAndVariables()
        .byId(db, resourceId);

      if (data == null)
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );

      const { metadata, ...resource } = data;
      const variablesPromises = data.variables.map(async (v) => {
        if (v.valueType === "direct") {
          const strval = String(v.value);
          const value = v.sensitive
            ? variablesAES256().decrypt(strval)
            : v.value;
          return [v.key, value] as const;
        }

        if (v.valueType === "reference") {
          const resolvedValue = await getReferenceVariableValueDb(
            resourceId,
            v as schema.ReferenceResourceVariable,
          );
          return [v.key, resolvedValue] as const;
        }

        return [v.key, v.defaultValue] as const;
      });

      const variables = Object.fromEntries(
        await Promise.all(variablesPromises),
      );

      return NextResponse.json({
        ...resource,
        variables,
        metadata: Object.fromEntries(metadata.map((t) => [t.key, t.value])),
      });
    },
  );

const patchSchema = z.object({
  name: z.string().optional().optional(),
  version: z.string().optional().optional(),
  kind: z.string().optional().optional(),
  identifier: z.string().optional().optional(),
  workspaceId: z.string().optional().optional(),
  metadata: z.record(z.string()).optional(),
  variables: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
        sensitive: z.boolean().default(false),
      }),
    )
    .optional(),
});

export const PATCH = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "resource", id: params.resourceId ?? "" }),
    ),
  )
  .use(parseBody(patchSchema))
  .handle<
    { body: z.infer<typeof patchSchema> },
    { params: Promise<{ resourceId: string }> }
  >(async ({ db, body }, { params }) => {
    try {
      const { resourceId } = await params;
      const isResource = eq(schema.resource.id, resourceId);
      const isNotDeleted = isNull(schema.resource.deletedAt);
      const where = and(isResource, isNotDeleted);
      const resource = await db.query.resource.findFirst({
        where,
        with: {
          metadata: true,
          variables: true,
        },
      });

      if (resource == null)
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );

      // make a separate call to variables because we use the base resource
      // in the merge below
      const prevVariables = await db.query.resourceVariable.findMany({
        where: eq(schema.resourceVariable.resourceId, resource.id),
      });

      const resourceCopy = _.cloneDeep(resource);
      const resourceCopyWithMetadata = {
        ...resourceCopy,
        metadata: Object.fromEntries(
          resourceCopy.metadata.map((m) => [m.key, m.value]),
        ),
      };
      const all = await upsertResources(db, resource.workspaceId, [
        _.merge(resourceCopyWithMetadata, body),
      ]);
      const res = all.at(0);

      if (res == null) throw new Error("Failed to update resource");

      const resourceWithMeta = {
        ...res,
        metadata: Object.fromEntries(res.metadata.map((m) => [m.key, m.value])),
      };

      const isChanged = isResourceChanged(resource, res);
      if (isChanged)
        await eventDispatcher.dispatchResourceUpdated(resource, res);

      const affectedVariables = getAffectedVariables(
        prevVariables,
        res.variables,
      );

      for (const variable of affectedVariables)
        await eventDispatcher.dispatchResourceVariableUpdated(
          variable,
          variable,
        );

      const isConfigChanged = !_.isEqual(resource.config, res.config);
      if (isConfigChanged) {
        const releaseTargets = await db.query.releaseTarget.findMany({
          where: eq(schema.releaseTarget.resourceId, res.id),
        });
        await Promise.all(
          releaseTargets.map((rt) =>
            eventDispatcher.dispatchEvaluateReleaseTarget(rt, {
              skipDuplicateCheck: true,
            }),
          ),
        );
      }

      return NextResponse.json(resourceWithMeta);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error(`Error updating resource: ${error}`);
      return NextResponse.json(
        { error: "Failed to update resource" },
        { status: 500 },
      );
    }
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: params.resourceId ?? "" }),
    ),
  )
  .handle(
    async ({ db }, { params }: { params: Promise<{ resourceId: string }> }) => {
      const { resourceId } = await params;
      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.id, resourceId),
          isNull(schema.resource.deletedAt),
        ),
      });

      if (resource == null)
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );

      await eventDispatcher.dispatchResourceDeleted(resource);
      return NextResponse.json({ success: true });
    },
  );
