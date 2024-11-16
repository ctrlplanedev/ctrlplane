import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { authn } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const resourceToResource = z.object({
  workspaceId: z.string().uuid(),
  fromType: z.literal("resource"),
  fromIdentifier: z.string(),
  toType: z.literal("resource"),
  toIdentifier: z.string(),
  type: z.literal("associated_with").or(z.literal("depends_on")),
});

const deploymentToResource = z.object({
  workspaceId: z.string().uuid(),
  deploymentId: z.string().uuid(),
  resourceIdentifier: z.string(),
  type: z.literal("created"),
});

const bodySchema = z.union([resourceToResource, deploymentToResource]);

const resourceToResourceRelationship = async (
  db: Tx,
  body: z.infer<typeof resourceToResource>,
) => {
  return Response.json(
    { error: "Resources must be in the same workspace" },
    { status: 400 },
  );
};

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .handle<{ body: z.infer<typeof bodySchema> }>(async (ctx) => {
    const { body, db } = ctx;

    return Response.json({});
  });
