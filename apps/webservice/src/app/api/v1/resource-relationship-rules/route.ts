import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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
  dependencyType: z.string(),
  dependencyDescription: z.string().optional(),
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
        .perform(Permission.WorkspaceUpdate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof body> }>(async ({ db, body }) => {
    const upsertedResourceRelationshipRule = await db.transaction(
      async (tx) => {
        // Check if rule already exists based on workspace, reference, and dependency type
        const existingRule = await tx
          .select()
          .from(schema.resourceRelationshipRule)
          .where(
            and(
              eq(schema.resourceRelationshipRule.workspaceId, body.workspaceId),
              eq(schema.resourceRelationshipRule.reference, body.reference),
              eq(
                schema.resourceRelationshipRule.dependencyType,
                body.dependencyType as any,
              ),
            ),
          )
          .then(takeFirstOrNull);

        let rule;
        if (existingRule != null) {
          // Update existing rule
          rule = await tx
            .update(schema.resourceRelationshipRule)
            .set({
              name: body.name,
              dependencyDescription: body.dependencyDescription,
              description: body.description,
              sourceKind: body.sourceKind,
              sourceVersion: body.sourceVersion,
              targetKind: body.targetKind,
              targetVersion: body.targetVersion,
            })
            .where(eq(schema.resourceRelationshipRule.id, existingRule.id))
            .returning()
            .then(takeFirstOrNull);
        } else {
          // Insert new rule
          rule = await tx
            .insert(schema.resourceRelationshipRule)
            .values({
              workspaceId: body.workspaceId,
              name: body.name,
              reference: body.reference,
              dependencyType: body.dependencyType as any,
              dependencyDescription: body.dependencyDescription,
              description: body.description,
              sourceKind: body.sourceKind,
              sourceVersion: body.sourceVersion,
              targetKind: body.targetKind,
              targetVersion: body.targetVersion,
            })
            .returning()
            .then(takeFirstOrNull);
        }

        if (rule == null) return null;

        // Handle metadata keys - first delete existing ones if updating
        if (existingRule != null) {
          await tx
            .delete(schema.resourceRelationshipRuleMetadataMatch)
            .where(
              eq(
                schema.resourceRelationshipRuleMetadataMatch
                  .resourceRelationshipRuleId,
                rule.id,
              ),
            );
        }

        // Insert new metadata keys
        const metadataKeys = _.uniq(body.metadataKeysMatch ?? []);
        if (metadataKeys.length > 0) {
          await tx.insert(schema.resourceRelationshipRuleMetadataMatch).values(
            metadataKeys.map((key) => ({
              resourceRelationshipRuleId: rule.id,
              key,
            })),
          );
        }

        return rule;
      },
    );

    if (upsertedResourceRelationshipRule == null) {
      return NextResponse.json(
        {
          error: "Failed to upsert resource relationship rule.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(upsertedResourceRelationshipRule);
  });
