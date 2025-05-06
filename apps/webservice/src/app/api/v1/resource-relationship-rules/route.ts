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
            eq(schema.resourceRelationshipRule.reference, body.reference),
            eq(
              schema.resourceRelationshipRule.dependencyType,
              body.dependencyType,
            ),
          ),
        });

        if (existingRule != null)
          return NextResponse.json(
            {
              error: `Resource relationship with reference ${body.reference} and dependency type ${body.dependencyType} already exists in workspace ${body.workspaceId}`,
            },
            { status: CONFLICT },
          );

        const rule = await db.transaction(async (tx) => {
          const rule = await tx
            .insert(schema.resourceRelationshipRule)
            .values(body)
            .returning()
            .then(takeFirst);

          const metadataKeysMatch = _.uniq(body.metadataKeysMatch ?? []);
          if (metadataKeysMatch.length > 0)
            await tx
              .insert(schema.resourceRelationshipRuleMetadataMatch)
              .values(
                metadataKeysMatch.map((key) => ({
                  resourceRelationshipRuleId: rule.id,
                  key,
                })),
              );

          const metadataKeysEquals = _.uniqBy(
            body.metadataKeysEquals ?? [],
            (m) => m.key,
          );
          if (metadataKeysEquals.length > 0)
            await tx
              .insert(schema.resourceRelationshipTargetRuleMetadataEquals)
              .values(
                metadataKeysEquals.map((m) => ({
                  resourceRelationshipRuleId: rule.id,
                  key: m.key,
                  value: m.value,
                })),
              );

          return { ...rule, metadataKeysMatch, metadataKeysEquals };
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
