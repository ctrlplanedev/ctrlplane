import type { z } from "zod";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { CONFLICT, INTERNAL_SERVER_ERROR } from "http-status";
import _ from "lodash";

import { takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const log = logger.child({ route: "/v1/resource-relationship-rules" });

export const POST = request()
  .use(authn)
  .use(parseBody(schema.createResourceRelationshipRule))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.ResourceRelationshipRuleCreate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof schema.createResourceRelationshipRule> }>(
    async ({ db, body }) => {
      try {
        const existingRule = await db.query.resourceRelationshipRule.findFirst({
          where: and(
            eq(schema.resourceRelationshipRule.workspaceId, body.workspaceId),
            eq(schema.resourceRelationshipRule.sourceKind, body.sourceKind),
            eq(
              schema.resourceRelationshipRule.sourceVersion,
              body.sourceVersion,
            ),
            eq(schema.resourceRelationshipRule.reference, body.reference),
          ),
        });

        if (existingRule != null)
          return NextResponse.json(
            {
              error: `Resource relationship rule with reference ${body.reference} for source kind ${body.sourceKind} and version ${body.sourceVersion} already exists in workspace ${body.workspaceId}`,
            },
            { status: CONFLICT },
          );

        const rule = await db.transaction(async (tx) => {
          const rule = await tx
            .insert(schema.resourceRelationshipRule)
            .values(body)
            .returning()
            .then(takeFirst);

          const metadataKeysMatches = _.uniq(body.metadataKeysMatches ?? []);
          if (metadataKeysMatches.length > 0)
            await tx
              .insert(schema.resourceRelationshipRuleMetadataMatch)
              .values(
                metadataKeysMatches.map((key) => ({
                  resourceRelationshipRuleId: rule.id,
                  sourceKey: key.sourceKey,
                  targetKey: key.targetKey,
                })),
              );

          const sourceMetadataEquals = _.uniqBy(
            body.sourceMetadataEquals ?? [],
            (m) => m.key,
          );
          if (sourceMetadataEquals.length > 0)
            await tx
              .insert(schema.resourceRelationshipSourceRuleMetadataEquals)
              .values(
                sourceMetadataEquals.map((m) => ({
                  resourceRelationshipRuleId: rule.id,
                  key: m.key,
                  value: m.value,
                })),
              );

          const targetMetadataEquals = _.uniqBy(
            body.targetMetadataEquals ?? [],
            (m) => m.key,
          );
          if (targetMetadataEquals.length > 0)
            await tx
              .insert(schema.resourceRelationshipTargetRuleMetadataEquals)
              .values(
                targetMetadataEquals.map((m) => ({
                  resourceRelationshipRuleId: rule.id,
                  key: m.key,
                  value: m.value,
                })),
              );

          return {
            ...rule,
            metadataKeysMatches,
            targetMetadataEquals,
            sourceMetadataEquals,
          };
        });

        return NextResponse.json(rule);
      } catch (error) {
        log.error(error);
        return NextResponse.json(
          { error: "Failed to create resource relationship rule." },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
