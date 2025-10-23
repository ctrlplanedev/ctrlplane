import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .min(1, "Email is required")
    .email("Invalid email"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .min(8, "Password must be more than 8 characters")
    .max(32, "Password must be less than 32 characters"),
});

export const signUpSchema = signInSchema.extend({
  name: z.string().min(1, "Name is required"),
});

export enum Permission {
  IamSetPolicy = "iam.setIamPolicy",

  WorkspaceGet = "workspace.get",
  WorkspaceListMembers = "workspace.listMembers",
  WorkspaceUpdate = "workspace.update",
  WorkspaceListIntegrations = "workspace.listIntegrations",

  JobUpdate = "job.update",
  JobGet = "job.get",
  JobList = "job.list",

  JobAgentList = "jobAgent.list",
  JobAgentCreate = "jobAgent.create",
  JobAgentGet = "jobAgent.get",
  JobAgentUpdate = "jobAgent.update",

  RoleCreate = "role.create",
  RoleDelete = "role.delete",
  RoleGet = "role.get",
  RoleList = "role.list",
  RoleUpdate = "role.update",

  SystemCreate = "system.create",
  SystemUpdate = "system.update",
  SystemGet = "system.get",
  SystemList = "system.list",
  SystemDelete = "system.delete",

  ResourceCreate = "resource.create",
  ResourceList = "resource.list",
  ResourceGet = "resource.get",
  ResourceUpdate = "resource.update",
  ResourceDelete = "resource.delete",

  ResourceProviderGet = "resourceProvider.get",
  ResourceProviderDelete = "resourceProvider.delete",
  ResourceProviderUpdate = "resourceProvider.update",
  ResourceProviderCreate = "resourceProvider.create",

  ResourceViewCreate = "resourceView.create",
  ResourceViewList = "resourceView.list",
  ResourceViewGet = "resourceView.get",
  ResourceViewUpdate = "resourceView.update",
  ResourceViewDelete = "resourceView.delete",

  ResourceMetadataGroupList = "resourceMetadataGroup.list",
  ResourceMetadataGroupGet = "resourceMetadataGroup.get",
  ResourceMetadataGroupCreate = "resourceMetadataGroup.create",
  ResourceMetadataGroupUpdate = "resourceMetadataGroup.update",
  ResourceMetadataGroupDelete = "resourceMetadataGroup.delete",

  ResourceRelationshipRuleCreate = "resourceRelationshipRule.create",
  ResourceRelationshipRuleUpdate = "resourceRelationshipRule.update",
  ResourceRelationshipRuleDelete = "resourceRelationshipRule.delete",
  ResourceRelationshipRuleList = "resourceRelationshipRule.list",

  DeploymentCreate = "deployment.create",
  DeploymentUpdate = "deployment.update",
  DeploymentGet = "deployment.get",
  DeploymentDelete = "deployment.delete",
  DeploymentList = "deployment.list",

  DeploymentVariableCreate = "deploymentVariable.create",
  DeploymentVariableUpdate = "deploymentVariable.update",
  DeploymentVariableDelete = "deploymentVariable.delete",

  DeploymentVariableValueCreate = "deploymentVariableValue.create",
  DeploymentVariableValueUpdate = "deploymentVariableValue.update",
  DeploymentVariableValueDelete = "deploymentVariableValue.delete",

  EnvironmentCreate = "environment.create",
  EnvironmentGet = "environment.get",
  EnvironmentUpdate = "environment.update",
  EnvironmentList = "environment.list",

  DeploymentVersionCreate = "deploymentVersion.create",
  DeploymentVersionGet = "deploymentVersion.get",
  DeploymentVersionUpdate = "deploymentVersion.update",
  DeploymentVersionList = "deploymentVersion.list",

  RunbookTrigger = "runbook.trigger",
  RunbookDelete = "runbook.delete",
  RunbookCreate = "runbook.create",
  RunbookGet = "runbook.get",
  RunbookList = "runbook.list",
  RunbookUpdate = "runbook.update",

  HookCreate = "hook.create",
  HookGet = "hook.get",
  HookList = "hook.list",
  HookUpdate = "hook.update",
  HookDelete = "hook.delete",

  PolicyGet = "policy.get",
  PolicyList = "policy.list",
  PolicyCreate = "policy.create",
  PolicyUpdate = "policy.update",
  PolicyDelete = "policy.delete",

  ReleaseTargetGet = "releaseTarget.get",

  EventList = "event.list",
}

export const permission = z.nativeEnum(Permission);

export const predefinedRoles = {
  viewer: {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Viewer",
    permissions: Object.values(Permission).filter(
      (a) => a.includes(".list") || a.includes(".get"),
    ),
  },
  admin: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Admin",
    permissions: Object.values(Permission),
  },
  noAccess: {
    id: "00000000-0000-0000-0000-000000000002",
    name: "No Access",
    description:
      "This role grants no permissions by default. It's ideal for initially inviting users to a workspace, allowing for subsequent assignment of specific, scoped permissions to particular resources.",
    permissions: [],
  },
};
