import { NextResponse } from "next/server";
import { NOT_FOUND } from "http-status";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { request } from "../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.SystemGet)
        .on({ type: "environment", id: params.environmentId ?? "" }),
    ),
  )
  .handle<unknown, { params: Promise<{ environmentId: string }> }>(
    async (ctx, { params }) => {
      const { environmentId } = await params;
      const environment = await ctx.db.query.environment.findFirst({
        where: eq(schema.environment.id, environmentId),
        with: { policy: true, metadata: true },
      });
      if (environment == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: NOT_FOUND },
        );

      const metadata = Object.fromEntries(
        environment.metadata.map((m) => [m.key, m.value]),
      );
      return NextResponse.json({ ...environment, metadata });
    },
  );

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.SystemDelete)
        .on({ type: "environment", id: params.environmentId ?? "" }),
    ),
  )
  .handle<unknown, { params: Promise<{ environmentId: string }> }>(
    async (ctx, { params }) => {
      const { environmentId } = await params;
      const findEnv = await ctx.db.query.environment.findFirst({
        where: eq(schema.environment.id, environmentId),
      });
      if (findEnv == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: NOT_FOUND },
        );

      await getQueue(Channel.DeleteEnvironment).add(
        environmentId,
        { id: environmentId },
        { deduplication: { id: environmentId } },
      );

      return NextResponse.json(findEnv);
    },
  );
