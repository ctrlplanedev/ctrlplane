import type { InferSelectModel } from "drizzle-orm";
import {
  customType,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const secretProviderTypeEnum = pgEnum("secret_provider_type", [
  "aws_secrets_manager",
  "doppler",
  "env",
]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const secretProvider = pgTable(
  "secret_provider",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    type: secretProviderTypeEnum("type").notNull(),

    config: bytea("config").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("secret_provider_workspace_name_uniq").on(
      table.workspaceId,
      table.name,
    ),
  ],
);

export type SecretProvider = InferSelectModel<typeof secretProvider>;
