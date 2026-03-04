import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const relationshipRule = pgTable(
  "relationship_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    cel: text("cel").notNull(),
    metadata: jsonb("metadata").default("{}").$type<Record<string, string>>(),
  },
  (table) => [
    index().on(table.workspaceId, table.reference),
    index().on(table.workspaceId),
  ],
);

export const computedEntityRelationship = pgTable(
  "computed_entity_relationship",
  {
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => relationshipRule.id, { onDelete: "cascade" }),
    fromEntityType: text("from_entity_type").notNull(),
    fromEntityId: uuid("from_entity_id").notNull(),
    toEntityType: text("to_entity_type").notNull(),
    toEntityId: uuid("to_entity_id").notNull(),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.ruleId,
        table.fromEntityType,
        table.fromEntityId,
        table.toEntityType,
        table.toEntityId,
      ],
    }),
  ],
);
