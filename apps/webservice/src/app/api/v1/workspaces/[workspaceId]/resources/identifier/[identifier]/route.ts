import { NextResponse } from "next/server";

import { and, eq, getResource, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceParents } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { getReferenceVariableValueDb } from "@ctrlplane/rule-engine";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

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

    const resource = await getResource()
      .withProviderMetadataAndVariables()
      .byIdentifierAndWorkspaceId(db, identifier, workspaceId);

    if (resource == null) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );
    }

    const { relationships } = await getResourceParents(db, resource.id);

    const resourceVariablesPromises = resource.variables.map(async (v) => {
      if (v.valueType === "direct") {
        const strval = String(v.value);
        const value = v.sensitive ? variablesAES256().decrypt(strval) : v.value;
        return [v.key, value] as const;
      }

      if (v.valueType === "reference") {
        const resolvedValue = await getReferenceVariableValueDb(
          resource.id,
          v as schema.ReferenceResourceVariable,
        );
        return [v.key, resolvedValue] as const;
      }

      return [v.key, v.defaultValue] as const;
    });
    const resourceVariables = await Promise.all(resourceVariablesPromises);
    const variables = Object.fromEntries(resourceVariables);

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

    await eventDispatcher.dispatchResourceDeleted(resource);

    return NextResponse.json({ success: true });
  });
