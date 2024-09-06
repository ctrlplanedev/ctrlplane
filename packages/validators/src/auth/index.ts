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
