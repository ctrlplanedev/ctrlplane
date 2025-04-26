import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const body = z.object({
  workspaceId: z.string(),
  name: z.string(),
  reference: z.string(),
  relationshipType: z.string(),
  description: z.string().optional(),
  sourceKind: z.string(),
  sourceVersion: z.string(),
  targetKind: z.string(),
  targetVersion: z.string(),

  metadataKeysMatch: z.array(z.string()).optional(),
});

export const POST = request()
  .use(authn)
  .use(parseBody(body))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.SystemUpdate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof body> }>(async ({ db, body }) => {
    const newResourceRelationshipRule = await db.transaction(async (tx) => {
      const rule = await tx
        .insert(schema.resourceRelationshipRule)
        .values({
          workspaceId: body.workspaceId,
          name: body.name,
          reference: body.reference,
          relationshipType: body.relationshipType,
          description: body.description,
          sourceKind: body.sourceKind,
          sourceVersion: body.sourceVersion,
          targetKind: body.targetKind,
          targetVersion: body.targetVersion,
        })
        .returning()
        .then(takeFirstOrNull);

      if (rule == null) return null;

      const metadataKeys = _.uniq(body.metadataKeysMatch ?? []);
      if (metadataKeys.length > 0)
        await tx.insert(schema.resourceRelationshipRuleMetadataMatch).values(
          metadataKeys.map((key) => ({
            resourceRelationshipRuleId: rule.id,
            key,
          })),
        );

      return rule;
    });

    if (newResourceRelationshipRule == null) {
      return NextResponse.json(
        {
          error:
            "Failed to create resource relationship rule. Relationship with rules may already exist.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(newResourceRelationshipRule);
  });
