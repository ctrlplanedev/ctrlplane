import type { InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  integer,
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

export const user = pgTable("user", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("emailVerified", { withTimezone: true }),
  image: varchar("image", { length: 255 }),
  activeWorkspaceId: uuid("active_workspace_id")
    .references(() => workspace.id, { onDelete: "set null" })
    .default(sql`null`),
  passwordHash: text("password_hash").default(sql`null`),
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
    type: varchar("type", { length: 255 })
      .$type<"email" | "oauth" | "oidc" | "webauthn">()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const session = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
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
