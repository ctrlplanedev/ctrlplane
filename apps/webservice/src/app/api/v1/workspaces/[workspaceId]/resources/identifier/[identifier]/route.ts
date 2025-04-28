import { NextResponse } from "next/server";
import { get } from "lodash";

import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceParents } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

/**
 * Retrieves a resource by workspace ID and identifier
 * @param workspaceId - The ID of the workspace
 * @param identifier - The identifier of the resource
 * @returns The resource with its metadata, variables and provider
 */
const getResourceByWorkspaceAndIdentifier = (
  workspaceId: string,
  identifier: string,
) => {
  return db.query.resource.findFirst({
    where: and(
      eq(schema.resource.workspaceId, workspaceId),
      eq(schema.resource.identifier, identifier),
      isNull(schema.resource.deletedAt),
    ),
    with: {
      metadata: true,
      variables: true,
      provider: true,
    },
  });
};

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) => {
      const { workspaceId, identifier } = params;

      // we don't check deletedAt as we may be querying for soft-deleted resources
      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId ?? ""),
          eq(schema.resource.identifier, identifier ?? ""),
        ),
      });

      if (resource == null) return false;
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: resource.id });
    }),
  )
  .handle<
    unknown,
    { params: Promise<{ workspaceId: string; identifier: string }> }
  >(async (_, { params }) => {
    const { workspaceId, identifier } = await params;

    const resource = await getResourceByWorkspaceAndIdentifier(
      workspaceId,
      identifier,
    );

    if (resource == null) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );
    }

    const { relationships, getTargetsWithMetadata } = await getResourceParents(
      db,
      resource.id,
    );
    const relatipnshipTargets = await getTargetsWithMetadata();

    const variables = Object.fromEntries(
      resource.variables.map((v) => {
        if (v.valueType === "direct") {
          const strval = String(v.value);
          const value = v.sensitive
            ? variablesAES256().decrypt(strval)
            : v.value;
          return [v.key, value];
        }

        if (v.valueType === "reference") {
          if (v.path == null) return [v.key, v.defaultValue];
          if (v.reference == null) return [v.key, v.defaultValue];
          const target = relationships[v.reference]?.target.id;
          const targetResource = relatipnshipTargets[target ?? ""];
          if (targetResource == null) return [v.key, v.defaultValue];
          return [v.key, get(targetResource, v.path, v.defaultValue)];
        }

        throw new Error(`Unknown variable value type: ${v.valueType}`);
      }),
    );

    const metadata = Object.fromEntries(
      resource.metadata.map((t) => [t.key, t.value]),
    );
    const output = {
      ...resource,
      variables,
      metadata,
      relationships,
    };

    return NextResponse.json(output);
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) => {
      const { workspaceId, identifier } = params;

      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId ?? ""),
          eq(schema.resource.identifier, identifier ?? ""),
          isNull(schema.resource.deletedAt),
        ),
      });

      if (resource == null) return false;
      return can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: resource.id });
    }),
  )
  .handle<
    unknown,
    { params: Promise<{ workspaceId: string; identifier: string }> }
  >(async (_, { params }) => {
    const { workspaceId, identifier } = await params;
    const resource = await db.query.resource.findFirst({
      where: and(
        eq(schema.resource.workspaceId, workspaceId),
        eq(schema.resource.identifier, identifier),
        isNull(schema.resource.deletedAt),
      ),
    });

    if (resource == null) {
      return NextResponse.json(
        { error: `Resource not found for identifier: ${identifier}` },
        { status: 404 },
      );
    }

    await db
      .update(schema.resource)
      .set({ deletedAt: new Date() })
      .where(eq(schema.resource.id, resource.id));

    await getQueue(Channel.DeleteResource).add(resource.id, resource);

    return NextResponse.json({ success: true });
  });
