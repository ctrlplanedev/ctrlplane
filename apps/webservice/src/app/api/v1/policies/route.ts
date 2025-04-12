import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR } from "http-status";
import { z } from "zod";

import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { api } from "~/trpc/server";
import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const log = logger.child({ route: "/api/v1/policies" });

export const POST = request()
  .use(authn)
  .use(parseBody(SCHEMA.createPolicy))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.PolicyCreate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof SCHEMA.createPolicy> }>(({ body }) =>
    api.policy
      .create(body)
      .then((policy) => NextResponse.json(policy))
      .catch((error) => {
        log.error("Failed to create policy", { error });
        return NextResponse.json(
          { error: "Failed to create policy" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }),
  );
