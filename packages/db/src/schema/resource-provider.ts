import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { resource } from "./resource.js";
import { workspace } from "./workspace.js";

export const resourceProvider = pgTable(
  "resource_provider",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.name) }),
);

export const resourceProviderRelations = relations(
  resourceProvider,
  ({ many }) => ({
    resources: many(resource),
    google: many(resourceProviderGoogle),
  }),
);

export const createResourceProvider = createInsertSchema(resourceProvider).omit(
  { id: true },
);
export type ResourceProvider = InferSelectModel<typeof resourceProvider>;

export const resourceProviderGoogle = pgTable("resource_provider_google", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceProviderId: uuid("resource_provider_id")
    .notNull()
    .references(() => resourceProvider.id, { onDelete: "cascade" }),

  projectIds: text("project_ids").array().notNull(),

  importGke: boolean("import_gke").notNull().default(false),
  importNamespaces: boolean("import_namespaces").notNull().default(false),
  importVCluster: boolean("import_vcluster").notNull().default(false),
});

export const createResourceProviderGoogle = createInsertSchema(
  resourceProviderGoogle,
  { projectIds: z.array(z.string().min(1)).min(1) },
).omit({ id: true });

export const updateResourceProviderGoogle =
  createResourceProviderGoogle.partial();

export type ResourceProviderGoogle = InferSelectModel<
  typeof resourceProviderGoogle
>;

export const resourceProviderGoogleRelations = relations(
  resourceProviderGoogle,
  ({ one }) => ({
    provider: one(resourceProvider, {
      fields: [resourceProviderGoogle.resourceProviderId],
      references: [resourceProvider.id],
    }),
  }),
);

export const resourceProviderAws = pgTable("resource_provider_aws", {
  id: uuid("id").primaryKey().defaultRandom(),
  resourceProviderId: uuid("resource_provider_id")
    .notNull()
    .references(() => resourceProvider.id, { onDelete: "cascade" }),

  awsRoleArns: text("aws_role_arns").array().notNull(),
});

export const createResourceProviderAws = createInsertSchema(
  resourceProviderAws,
  {
    awsRoleArns: z
      .array(
        z
          .string()
          .regex(
            /^arn:aws:iam::[0-9]{12}:role\/[a-zA-Z0-9+=,.@\-_/]+$/,
            "Invalid AWS Role ARN format. Expected format: arn:aws:iam::<account-id>:role/<role-name>",
          )
          .min(1),
      )
      .min(1),
  },
).omit({ id: true });

export const updateResourceProviderAws = createResourceProviderAws.partial();

export type ResourceProviderAws = InferSelectModel<typeof resourceProviderAws>;

export const resourceProviderAwsRelations = relations(
  resourceProviderAws,
  ({ one }) => ({
    provider: one(resourceProvider, {
      fields: [resourceProviderAws.resourceProviderId],
      references: [resourceProvider.id],
    }),
  }),
);

export const resourceProviderAzure = pgTable(
  "resource_provider_azure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceProviderId: uuid("resource_provider_id")
      .notNull()
      .references(() => resourceProvider.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").notNull(),
    subscriptionIds: text("subscription_ids").array().notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.tenantId) }),
);

export type ResourceProviderAzure = InferSelectModel<
  typeof resourceProviderAzure
>;
