import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { and, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { resourceCondition } from "@ctrlplane/validators/resources";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.ResourceList)
        .on({ type: "workspace", id: params.workspaceId }),
    ),
  )
  .handle<unknown, { params: { workspaceId: string; filter: string } }>(
    async (_, { params }) => {
      const filterJson = JSON.parse(params.filter);
      const parseFilterResult = resourceCondition.safeParse(filterJson);
      if (parseFilterResult.error != null)
        return NextResponse.json(
          { error: parseFilterResult.error.message },
          { status: httpStatus.BAD_REQUEST },
        );

      const { data: filter } = parseFilterResult;

      const resources = await db
        .select()
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.workspaceId, params.workspaceId),
            SCHEMA.resourceMatchesMetadata(db, filter),
          ),
        );

      return NextResponse.json(resources);
    },
  );
