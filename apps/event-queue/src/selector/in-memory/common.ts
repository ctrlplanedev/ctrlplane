import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, isNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { ColumnOperator, DateOperator } from "@ctrlplane/validators/conditions";

import { createSpanWrapper } from "../../traces.js";

export const StringConditionOperatorFn: Record<
  ColumnOperator,
  (entityValue: string, selectorValue: string) => boolean
> = {
  [ColumnOperator.Equals]: (entityValue, selectorValue) =>
    entityValue === selectorValue,
  [ColumnOperator.StartsWith]: (entityValue, selectorValue) =>
    entityValue.startsWith(selectorValue),
  [ColumnOperator.EndsWith]: (entityValue, selectorValue) =>
    entityValue.endsWith(selectorValue),
  [ColumnOperator.Contains]: (entityValue, selectorValue) =>
    entityValue.includes(selectorValue),
};

export const DateConditionOperatorFn: Record<
  DateOperator,
  (entityValue: Date, selectorValue: Date) => boolean
> = {
  [DateOperator.Before]: (entityValue, selectorValue) =>
    entityValue.getTime() < selectorValue.getTime(),
  [DateOperator.After]: (entityValue, selectorValue) =>
    entityValue.getTime() > selectorValue.getTime(),
  [DateOperator.BeforeOrOn]: (entityValue, selectorValue) =>
    entityValue.getTime() <= selectorValue.getTime(),
  [DateOperator.AfterOrOn]: (entityValue, selectorValue) =>
    entityValue.getTime() >= selectorValue.getTime(),
};

export const getFullResources = createSpanWrapper(
  "selector-get-full-resources",
  async (span, workspaceId: string) => {
    const dbResult = await dbClient
      .select()
      .from(schema.resource)
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, workspaceId),
          isNull(schema.resource.deletedAt),
        ),
      );

    const fullResources = _.chain(dbResult)
      .groupBy((row) => row.resource.id)
      .map((group) => {
        const [first] = group;
        if (first == null) return null;
        const { resource } = first;
        const metadata = Object.fromEntries(
          group
            .map((r) => r.resource_metadata)
            .filter(isPresent)
            .map((m) => [m.key, m.value]),
        );
        return { ...resource, metadata };
      })
      .value()
      .filter(isPresent);

    span.setAttributes({ "resource.count": fullResources.length });
    return fullResources;
  },
);
