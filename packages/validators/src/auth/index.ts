import { z } from "zod";

export enum Permission {
  WorkspaceInvite = "workspace.invite",

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
  TargetDelete = "target.delete",

  TargetProviderGet = "targetProvider.get",
  TargetProviderDelete = "targetProvider.delete",
  TargetProviderUpdate = "targetProvider.update",

  DeploymentCreate = "deployment.create",
  DeploymentUpdate = "deployment.update",
  DeploymentGet = "deployment.get",
  DeploymentDelete = "deployment.delete",

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
