import type * as schema from "@ctrlplane/db/schema";
import type { Swagger } from "atlassian-openapi";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@ctrlplane/db/client";
import { createTarget } from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const patchBodySchema = z.object({
  workspaceId: z.string().uuid(),
  targets: z.array(
    createTarget
      .omit({ lockedAt: true, providerId: true, workspaceId: true })
      .extend({
        metadata: z.record(z.string()).optional(),
        variables: z
          .array(
            z.object({
              key: z.string(),
              value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
              sensitive: z.boolean(),
            }),
          )
          .optional()
          .refine(
            (vars) =>
              vars == null ||
              new Set(vars.map((v) => v.key)).size === vars.length,
            "Duplicate variable keys are not allowed",
          ),
      }),
  ),
});

export const POST = request()
  .use(authn)
  .use(parseBody(patchBodySchema))
  .use(
    authz(({ can, ctx }) =>
      can
        .perform(Permission.TargetUpdate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ user: schema.User; body: z.infer<typeof patchBodySchema> }>(
    async (ctx) => {
      if (ctx.body.targets.length === 0)
        return NextResponse.json(
          { error: "No targets provided" },
          { status: 400 },
        );

      const targets = await upsertTargets(
        db,
        ctx.body.targets.map((t) => ({
          ...t,
          workspaceId: ctx.body.workspaceId,
        })),
      );

      return NextResponse.json({ count: targets.length });
    },
  );

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.1.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/targets": {
      post: {
        summary: "Create or update multiple targets",
        operationId: "upsertTargets",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "targets"],
                properties: {
                  workspaceId: {
                    type: "string",
                    format: "uuid",
                  },
                  targets: {
                    type: "array",
                    items: {
                      type: "object",
                      required: [
                        "name",
                        "kind",
                        "identifier",
                        "version",
                        "config",
                      ],
                      properties: {
                        name: {
                          type: "string",
                        },
                        kind: {
                          type: "string",
                        },
                        identifier: {
                          type: "string",
                        },
                        version: {
                          type: "string",
                        },
                        config: {
                          type: "object",
                        },
                        metadata: {
                          type: "object",
                          additionalProperties: {
                            type: "string",
                          },
                        },
                        variables: {
                          type: "array",
                          items: {
                            type: "object",
                            required: ["key", "value"],
                            properties: {
                              key: {
                                type: "string",
                              },
                              value: {
                                type: "string",
                                enum: ["string", "number", "boolean"],
                              },
                              sensitive: {
                                type: "boolean",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "All of the cats",
          },
        },
      },
    },
  },
};
