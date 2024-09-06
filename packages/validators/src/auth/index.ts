import { z } from "zod";

export enum Permission {
  RolesCrate = "role.create",
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
    permissions: [
      Permission.SystemGet,
      Permission.SystemList,

      Permission.TargetGet,
      Permission.TargetList,

      Permission.ReleaseGet,
      Permission.ReleaseList,

      Permission.RoleGet,
      Permission.RoleList,
    ],
  },
  editor: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Editor",
    description:
      "All viewer permissions, plus permissions for actions that modify state, " +
      "such as changing existing resources.",
    permissions: [],
  },
  admin: {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Admin",
    permissions: [],
  },
  developer: {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Application Developer",
    permissions: [
      Permission.SystemList,

      Permission.ReleaseCreate,
      Permission.ReleaseGet,

      Permission.DeploymentUpdate,
      Permission.DeploymentGet,
    ],
  },
};
