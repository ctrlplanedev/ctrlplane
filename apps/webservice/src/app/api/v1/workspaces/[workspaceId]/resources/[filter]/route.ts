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
  .handle<unknown, { params: { workspaceId: string; selector: string } }>(
    async (_, { params }) => {
      try {
        const selectorJson = JSON.parse(params.selector);
        const parseSelectorResult = resourceCondition.safeParse(selectorJson);
        if (parseSelectorResult.error != null)
          return NextResponse.json(
            { error: parseSelectorResult.error.message },
            { status: httpStatus.BAD_REQUEST },
          );

        const { data: selector } = parseSelectorResult;

        const resources = await db
          .select()
          .from(SCHEMA.resource)
          .where(
            and(
              eq(SCHEMA.resource.workspaceId, params.workspaceId),
              SCHEMA.resourceMatchesMetadata(db, selector),
            ),
          )
          .limit(100);

        return NextResponse.json(resources);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: httpStatus.BAD_REQUEST },
        );
      }
    },
  );
