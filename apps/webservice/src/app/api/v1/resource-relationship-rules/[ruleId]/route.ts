import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import _ from "lodash";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({ route: "/v1/resource-relationship-rules/[ruleId]" });

const replaceMetadataMatchRules = async (
  tx: Tx,
  ruleId: string,
  metadataKeysMatch?: string[],
) => {
  await tx
    .delete(schema.resourceRelationshipRuleMetadataMatch)
    .where(
      eq(
        schema.resourceRelationshipRuleMetadataMatch.resourceRelationshipRuleId,
        ruleId,
      ),
    );

  const metadataKeys = _.uniq(metadataKeysMatch ?? []);
  if (metadataKeys.length > 0)
    await tx.insert(schema.resourceRelationshipRuleMetadataMatch).values(
      metadataKeys.map((key) => ({
        resourceRelationshipRuleId: ruleId,
        key,
      })),
    );

  return metadataKeys;
};

const replaceMetadataEqualsRules = async (
  tx: Tx,
  ruleId: string,
  metadataKeysEquals?: { key: string; value: string }[],
) => {
  await tx
    .delete(schema.resourceRelationshipTargetRuleMetadataEquals)
    .where(
      eq(
        schema.resourceRelationshipTargetRuleMetadataEquals
          .resourceRelationshipRuleId,
        ruleId,
      ),
    );

  const metadataKeys = _.uniqBy(metadataKeysEquals ?? [], (m) => m.key);
  if (metadataKeys.length > 0)
    await tx.insert(schema.resourceRelationshipTargetRuleMetadataEquals).values(
      metadataKeys.map(({ key, value }) => ({
        resourceRelationshipRuleId: ruleId,
        key,
        value,
      })),
    );

  return metadataKeys;
};

export const PATCH = request()
  .use(authn)
  .use(parseBody(schema.updateResourceRelationshipRule))
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.ResourceRelationshipRuleUpdate).on({
        type: "resourceRelationshipRule",
        id: params.ruleId ?? "",
      }),
    ),
  )
  .handle<
    { body: z.infer<typeof schema.updateResourceRelationshipRule> },
    { params: Promise<{ ruleId: string }> }
  >(async ({ db, body }, { params }) => {
    try {
      const { ruleId } = await params;

      const existingRule = await db.query.resourceRelationshipRule.findFirst({
        where: eq(schema.resourceRelationshipRule.id, ruleId),
      });

      if (!existingRule)
        return NextResponse.json(
          { error: "Resource relationship rule not found" },
          { status: NOT_FOUND },
        );

      const rule = await db.transaction(async (tx) => {
        const rule = await tx
          .update(schema.resourceRelationshipRule)
          .set(body)
          .where(eq(schema.resourceRelationshipRule.id, ruleId))
          .returning()
          .then(takeFirst);

        const metadataKeysMatch = await replaceMetadataMatchRules(
          tx,
          ruleId,
          body.metadataKeysMatch,
        );

        const metadataKeysEquals = await replaceMetadataEqualsRules(
          tx,
          ruleId,
          body.metadataKeysEquals,
        );

        return { ...rule, metadataKeysMatch, metadataKeysEquals };
      });

      return NextResponse.json(rule);
    } catch (error) {
      log.error(error);
      return NextResponse.json(
        { error: "Failed to update resource relationship rule" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
