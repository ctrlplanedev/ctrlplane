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

  WorkspaceListMembers = "workspace.listMembers",
  WorkspaceUpdate = "workspace.update",
  WorkspaceListIntegrations = "workspace.listIntegrations",

  JobUpdate = "job.update",

  JobAgentList = "jobAgent.list",
  JobAgentCreate = "jobAgent.create",

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

  TargetCreate = "target.create",
  TargetList = "target.list",
  TargetGet = "target.get",
  TargetUpdate = "target.update",
  TargetDelete = "target.delete",

  TargetProviderGet = "targetProvider.get",
  TargetProviderDelete = "targetProvider.delete",
  TargetProviderUpdate = "targetProvider.update",

  TargetViewCreate = "targetView.create",
  TargetViewList = "targetView.list",
  TargetViewGet = "targetView.get",
  TargetViewUpdate = "targetView.update",
  TargetViewDelete = "targetView.delete",

  TargetMetadataGroupList = "targetMetadataGroup.list",
  TargetMetadataGroupGet = "targetMetadataGroup.get",
  TargetMetadataGroupCreate = "targetMetadataGroup.create",
  TargetMetadataGroupUpdate = "targetMetadataGroup.update",
  TargetMetadataGroupDelete = "targetMetadataGroup.delete",

  TargetViewMetadataGroupList = "targetViewMetadataGroup.list",
  TargetViewMetadataGroupGet = "targetViewMetadataGroup.get",
  TargetViewMetadataGroupCreate = "targetViewMetadataGroup.create",
  TargetViewMetadataGroupUpdate = "targetViewMetadataGroup.update",
  TargetViewMetadataGroupDelete = "targetViewMetadataGroup.delete",

  DeploymentCreate = "deployment.create",
  DeploymentUpdate = "deployment.update",
  DeploymentGet = "deployment.get",
  DeploymentDelete = "deployment.delete",
  DeploymentList = "deployment.list",

  DeploymentVariableCreate = "deploymentVariable.create",
  DeploymentVariableUpdate = "deploymentVariable.update",
  DeploymentVariableDelete = "deploymentVariable.delete",

  ReleaseCreate = "release.create",
  ReleaseGet = "release.get",
  ReleaseList = "release.list",

  RunbookTrigger = "runbook.trigger",
  RunbookDelete = "runbook.delete",
  RunbookCreate = "runbook.create",
  RunbookGet = "runbook.get",
  RunbookList = "runbook.list",
  RunbookUpdate = "runbook.update",
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
