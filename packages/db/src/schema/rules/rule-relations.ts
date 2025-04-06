import { relations } from "drizzle-orm";

import { policy } from "../policy.js";
import {
  policyRuleAnyApproval,
  policyRuleAnyApprovalRecord,
  policyRuleApprovalOnBehalfOfRole,
  policyRuleApprovalOnBehalfOfTeam,
  policyRuleDenyWindow,
  policyRuleRoleApproval,
  policyRuleRoleApprovalRecord,
  policyRuleTeamApproval,
  policyRuleTeamApprovalRecord,
  policyRuleUserApproval,
  policyRuleUserApprovalRecord,
} from "./index.js";

// Deny window rule relations
export const policyRuleDenyWindowRelations = relations(
  policyRuleDenyWindow,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDenyWindow.policyId],
      references: [policy.id],
    }),
  }),
);

// User approval rule relations
export const policyRuleUserApprovalRelations = relations(
  policyRuleUserApproval,
  ({ one, many }) => ({
    policy: one(policy, {
      fields: [policyRuleUserApproval.policyId],
      references: [policy.id],
    }),
    approvalRecords: many(policyRuleUserApprovalRecord),
  }),
);

// User approval record relations
export const policyRuleUserApprovalRecordRelations = relations(
  policyRuleUserApprovalRecord,
  ({ one, many }) => ({
    rule: one(policyRuleUserApproval, {
      fields: [policyRuleUserApprovalRecord.ruleId],
      references: [policyRuleUserApproval.id],
    }),
    teamApprovals: many(policyRuleApprovalOnBehalfOfTeam, {
      relationName: "userTeamApprovals",
    }),
    roleApprovals: many(policyRuleApprovalOnBehalfOfRole, {
      relationName: "userRoleApprovals",
    }),
  }),
);

// Team approval rule relations
export const policyRuleTeamApprovalRelations = relations(
  policyRuleTeamApproval,
  ({ one, many }) => ({
    policy: one(policy, {
      fields: [policyRuleTeamApproval.policyId],
      references: [policy.id],
    }),
    approvalRecords: many(policyRuleTeamApprovalRecord),
  }),
);

// Team approval record relations
export const policyRuleTeamApprovalRecordRelations = relations(
  policyRuleTeamApprovalRecord,
  ({ one, many }) => ({
    rule: one(policyRuleTeamApproval, {
      fields: [policyRuleTeamApprovalRecord.ruleId],
      references: [policyRuleTeamApproval.id],
    }),
    teamApprovals: many(policyRuleApprovalOnBehalfOfTeam, {
      relationName: "teamTeamApprovals",
    }),
    roleApprovals: many(policyRuleApprovalOnBehalfOfRole, {
      relationName: "teamRoleApprovals",
    }),
  }),
);

// Role approval rule relations
export const policyRuleRoleApprovalRelations = relations(
  policyRuleRoleApproval,
  ({ one, many }) => ({
    policy: one(policy, {
      fields: [policyRuleRoleApproval.policyId],
      references: [policy.id],
    }),
    approvalRecords: many(policyRuleRoleApprovalRecord),
  }),
);

// Role approval record relations
export const policyRuleRoleApprovalRecordRelations = relations(
  policyRuleRoleApprovalRecord,
  ({ one, many }) => ({
    rule: one(policyRuleRoleApproval, {
      fields: [policyRuleRoleApprovalRecord.ruleId],
      references: [policyRuleRoleApproval.id],
    }),
    teamApprovals: many(policyRuleApprovalOnBehalfOfTeam, {
      relationName: "roleTeamApprovals",
    }),
    roleApprovals: many(policyRuleApprovalOnBehalfOfRole, {
      relationName: "roleRoleApprovals",
    }),
  }),
);

// Any approval rule relations
export const policyRuleAnyApprovalRelations = relations(
  policyRuleAnyApproval,
  ({ one, many }) => ({
    policy: one(policy, {
      fields: [policyRuleAnyApproval.policyId],
      references: [policy.id],
    }),
    approvalRecords: many(policyRuleAnyApprovalRecord),
  }),
);

// Any approval record relations
export const policyRuleAnyApprovalRecordRelations = relations(
  policyRuleAnyApprovalRecord,
  ({ one, many }) => ({
    rule: one(policyRuleAnyApproval, {
      fields: [policyRuleAnyApprovalRecord.ruleId],
      references: [policyRuleAnyApproval.id],
    }),
    teamApprovals: many(policyRuleApprovalOnBehalfOfTeam, {
      relationName: "anyTeamApprovals",
    }),
    roleApprovals: many(policyRuleApprovalOnBehalfOfRole, {
      relationName: "anyRoleApprovals",
    }),
  }),
);

// On behalf of team relations
export const policyRuleApprovalOnBehalfOfTeamRelations = relations(
  policyRuleApprovalOnBehalfOfTeam,
  ({ one }) => ({
    userApprovalRecord: one(policyRuleUserApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfTeam.userApprovalRecordId],
      references: [policyRuleUserApprovalRecord.id],
      relationName: "userTeamApprovals",
    }),
    teamApprovalRecord: one(policyRuleTeamApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfTeam.teamApprovalRecordId],
      references: [policyRuleTeamApprovalRecord.id],
      relationName: "teamTeamApprovals",
    }),
    roleApprovalRecord: one(policyRuleRoleApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfTeam.roleApprovalRecordId],
      references: [policyRuleRoleApprovalRecord.id],
      relationName: "roleTeamApprovals",
    }),
    anyApprovalRecord: one(policyRuleAnyApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfTeam.anyApprovalRecordId],
      references: [policyRuleAnyApprovalRecord.id],
      relationName: "anyTeamApprovals",
    }),
  }),
);

// On behalf of role relations
export const policyRuleApprovalOnBehalfOfRoleRelations = relations(
  policyRuleApprovalOnBehalfOfRole,
  ({ one }) => ({
    userApprovalRecord: one(policyRuleUserApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfRole.userApprovalRecordId],
      references: [policyRuleUserApprovalRecord.id],
      relationName: "userRoleApprovals",
    }),
    teamApprovalRecord: one(policyRuleTeamApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfRole.teamApprovalRecordId],
      references: [policyRuleTeamApprovalRecord.id],
      relationName: "teamRoleApprovals",
    }),
    roleApprovalRecord: one(policyRuleRoleApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfRole.roleApprovalRecordId],
      references: [policyRuleRoleApprovalRecord.id],
      relationName: "roleRoleApprovals",
    }),
    anyApprovalRecord: one(policyRuleAnyApprovalRecord, {
      fields: [policyRuleApprovalOnBehalfOfRole.anyApprovalRecordId],
      references: [policyRuleAnyApprovalRecord.id],
      relationName: "anyRoleApprovals",
    }),
  }),
);
