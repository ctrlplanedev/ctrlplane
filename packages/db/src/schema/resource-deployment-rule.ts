// import { relations } from "drizzle-orm";
// import { pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
// import { createInsertSchema } from "drizzle-zod";
// import { z } from "zod";

// import { deployment } from "./deployment.js";
// import { workspace } from "./workspace.js";

// /**
//  * Enum defining types of resource to deployment relationships.
//  */
// const resourceDeploymentRelationshipType = pgEnum(
//   "resource_deployment_relationship_type",
//   [
//     /**
//      * Deployment manages resource, indicating the deployment is responsible for
//      * creating and maintaining the resource.
//      * @example Deployment "Backend Services" manages database resources.
//      */
//     "manages",

//     /**
//      * Deployment uses resource, indicating the deployment consumes or interfaces with
//      * the resource but does not manage its lifecycle.
//      * @example Deployment "Frontend" uses API resources managed by "Backend Services".
//      */
//     "uses",

//     /**
//      * Deployment requires resource, indicating the resource must be present for the
//      * deployment to function properly.
//      * @example Deployment requires a specific config resource to start.
//      */
//     "requires",

//     /**
//      * Deployment monitors resource, indicating the deployment observes or tracks the
//      * resource's state without directly interfacing with it.
//      * @example Monitoring deployment tracks database health.
//      */
//     "monitors",

//     /**
//      * Deployment extends resource, indicating the deployment builds upon or enhances
//      * an existing resource.
//      * @example Extension deployment adds functionality to core resources.
//      */
//     "extends",
//   ],
// );

// export enum ResourceDeploymentRelationshipType {
//   provisioned = "provisioned",
//   deployed = "deployed",
// }

// export const resourceDeploymentRule = pgTable(
//   "resource_deployment_relationship_rule",
//   {
//     id: uuid("id").primaryKey().defaultRandom(),

//     workspaceId: uuid("workspace_id")
//       .notNull()
//       .references(() => workspace.id, { onDelete: "cascade" }),

//     name: text("name"),
//     reference: text("reference").notNull(),

//     relationshipType:
//       resourceDeploymentRelationshipType("relationship_type").notNull(),
//     relationshipDescription: text("relationship_description"),

//     description: text("description"),

//     resourceKind: text("resource_kind").notNull(),
//     resourceVersion: text("resource_version").notNull(),

//     deploymentSlug: text("deployment_slug"),
//     deploymentSystemId: uuid("deployment_system_id"),
//   },
//   (t) => [
//     uniqueIndex().on(
//       t.workspaceId,
//       t.reference,
//       t.resourceKind,
//       t.resourceVersion,
//     ),
//   ],
// );

// export const resourceDeploymentRuleMetadataEquals = pgTable(
//   "resource_deployment_rule_metadata_equals",
//   {
//     id: uuid("id").primaryKey().defaultRandom(),
//     resourceDeploymentRuleId: uuid("resource_deployment_rule_id")
//       .notNull()
//       .references(() => resourceDeploymentRule.id, {
//         onDelete: "cascade",
//       }),

//     key: text("key").notNull(),
//     value: text("value").notNull(),
//   },
//   (t) => [uniqueIndex().on(t.resourceDeploymentRuleId, t.key)],
// );

// export const resourceDeploymentRuleMetadataMatch = pgTable(
//   "resource_deployment_rule_metadata_match",
//   {
//     id: uuid("id").primaryKey().defaultRandom(),
//     resourceDeploymentRuleId: uuid("resource_deployment_rule_id")
//       .notNull()
//       .references(() => resourceDeploymentRule.id, {
//         onDelete: "cascade",
//       }),

//     key: text("key").notNull(),
//   },
//   (t) => [
//     uniqueIndex("unique_resource_deployment_rule_metadata_match").on(
//       t.resourceDeploymentRuleId,
//       t.key,
//     ),
//   ],
// );

// export const resourceDeploymentRuleRelations = relations(
//   resourceDeploymentRule,
//   ({ many, one }) => ({
//     metadataMatches: many(resourceDeploymentRuleMetadataMatch),
//     metadataEquals: many(resourceDeploymentRuleMetadataEquals),
//     workspace: one(workspace, {
//       fields: [resourceDeploymentRule.workspaceId],
//       references: [workspace.id],
//     }),
//     deployment: one(deployment, {
//       fields: [resourceDeploymentRule.deploymentSystemId],
//       references: [deployment.systemId],
//     }),
//   }),
// );

// export const resourceDeploymentRuleMetadataMatchRelations = relations(
//   resourceDeploymentRuleMetadataMatch,
//   ({ one }) => ({
//     rule: one(resourceDeploymentRule, {
//       fields: [resourceDeploymentRuleMetadataMatch.resourceDeploymentRuleId],
//       references: [resourceDeploymentRule.id],
//     }),
//   }),
// );

// export const resourceDeploymentRuleMetadataEqualsRelations = relations(
//   resourceDeploymentRuleMetadataEquals,
//   ({ one }) => ({
//     rule: one(resourceDeploymentRule, {
//       fields: [resourceDeploymentRuleMetadataEquals.resourceDeploymentRuleId],
//       references: [resourceDeploymentRule.id],
//     }),
//   }),
// );

// export const createResourceDeploymentRule = createInsertSchema(
//   resourceDeploymentRule,
// )
//   .omit({ id: true })
//   .extend({
//     reference: z
//       .string()
//       .min(1)
//       .refine(
//         (val) =>
//           /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val) || // slug case
//           /^[a-z][a-zA-Z0-9]*$/.test(val) || // camel case
//           /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(val), // snake case
//         {
//           message:
//             "Reference must be in slug case (my-reference), camel case (myReference), or snake case (my_reference)",
//         },
//       ),
//     metadataKeysMatch: z
//       .array(
//         z.string().refine((val) => val.trim().length > 0, {
//           message: "Metadata match key cannot be empty",
//         }),
//       )
//       .optional(),
//     targetMetadataEquals: z
//       .array(
//         z.object({
//           key: z.string().refine((val) => val.trim().length > 0, {
//             message: "Key cannot be empty",
//           }),
//           value: z.string().refine((val) => val.trim().length > 0, {
//             message: "Value cannot be empty",
//           }),
//         }),
//       )
//       .optional(),
//   });

// export const updateResourceDeploymentRule =
//   createResourceDeploymentRule.partial();

// export type ResourceDeploymentRule = typeof resourceDeploymentRule.$inferSelect;
// export type ResourceDeploymentRuleMetadataMatch =
//   typeof resourceDeploymentRuleMetadataMatch.$inferSelect;
// export type ResourceDeploymentRuleMetadataEquals =
//   typeof resourceDeploymentRuleMetadataEquals.$inferSelect;
