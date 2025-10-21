import type { InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { workspace } from "./workspace.js";

const userSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  activeWorkspaceId: z.string().uuid().optional(),
});

export const systemRoleEnum = pgEnum("system_role", ["user", "admin"]);

export const user = pgTable("user", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: varchar("image", { length: 255 }),
  activeWorkspaceId: uuid("active_workspace_id")
    .references(() => workspace.id, { onDelete: "set null" })
    .default(sql`null`),
  passwordHash: text("password_hash").default(sql`null`),
  systemRole: systemRoleEnum("system_role")
    .default("user")
    .$type<"user" | "admin">()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = InferSelectModel<typeof user>;

export const createUser = createInsertSchema(user, userSchema.shape).omit({
  id: true,
});
export const updateUser = createUser.partial();

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
}));

export const account = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    providerId: varchar("provider", { length: 255 }).notNull(),
    accountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    accessTokenExpiresAt: integer("expires_at"),
    scope: varchar("scope", { length: 255 }),
    idToken: text("id_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.providerId, account.accountId],
    }),
  }),
);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const session = pgTable("session", {
  token: text("sessionToken").notNull().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const userApiKey = pgTable(
  "user_api_key",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyPreview: text("key_preview").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({ unqi: uniqueIndex().on(t.keyPrefix, t.keyHash) }),
);

export type UserApiKey = Omit<InferSelectModel<typeof userApiKey>, "keyHash">;
