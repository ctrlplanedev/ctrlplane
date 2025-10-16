import type { z } from "zod";
import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.SystemGet)
        .on({ type: "system", id: params.systemId }),
    ),
  )
  .handle<unknown, { params: Promise<{ systemId: string }> }>(
    async (ctx, { params }) => {
      const { systemId } = await params;
      const system = await ctx.db.query.system.findFirst({
        where: eq(schema.system.id, systemId),
        with: { environments: true, deployments: true },
      });
      if (system == null)
        return NextResponse.json(
          { error: "System not found" },
          { status: httpStatus.NOT_FOUND },
        );
      return NextResponse.json(system, { status: httpStatus.OK });
    },
  );

export const PATCH = request()
  .use(authn)
  .use(parseBody(schema.updateSystem))
  .handle<
    { body: z.infer<typeof schema.updateSystem> },
    { params: Promise<{ systemId: string }> }
  >(async ({ db, body }, { params }) => {
    const { systemId } = await params;
    const existingSystem = await db.query.system.findFirst({
      where: eq(schema.system.id, systemId),
    });
    if (existingSystem == null)
      return NextResponse.json(
        { error: "System not found" },
        { status: httpStatus.NOT_FOUND },
      );

    return db
      .update(schema.system)
      .set(body)
      .where(eq(schema.system.id, systemId))
      .returning()
      .then(takeFirst)
      .then(async (system) => {
        await eventDispatcher.dispatchSystemUpdated(system);
        return system;
      })
      .then((system) => NextResponse.json(system, { status: httpStatus.OK }))
      .catch((error) =>
        NextResponse.json(
          { error: error.message },
          { status: httpStatus.INTERNAL_SERVER_ERROR },
        ),
      );
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.SystemDelete)
        .on({ type: "system", id: params.systemId ?? "" }),
    ),
  )
  .handle<unknown, { params: Promise<{ systemId: string }> }>(
    async ({ db }, { params }) => {
      const { systemId } = await params;
      const existingSystem = await db.query.system.findFirst({
        where: eq(schema.system.id, systemId),
      });
      if (existingSystem == null)
        return NextResponse.json(
          { error: "System not found" },
          { status: httpStatus.NOT_FOUND },
        );

      return db
        .delete(schema.system)
        .where(eq(schema.system.id, systemId))
        .returning()
        .then(takeFirst)
        .then(async (system) => {
          await eventDispatcher.dispatchSystemDeleted(system);
          return system;
        })
        .then((system) =>
          NextResponse.json(
            { message: "System deleted", system },
            { status: httpStatus.OK },
          ),
        )
        .catch((error) =>
          NextResponse.json(
            { error: error.message },
            { status: httpStatus.INTERNAL_SERVER_ERROR },
          ),
        );
    },
  );
