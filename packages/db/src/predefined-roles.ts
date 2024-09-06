import { Permission } from "@ctrlplane/validators/auth";

export const predefinedRoles = [
  {
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
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Editor",
    description:
      "All viewer permissions, plus permissions for actions that modify state, " +
      "such as changing existing resources.",
    permissions: [],
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Admin",
    permissions: [],
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Developer",
    permissions: [
      Permission.SystemList,

      Permission.ReleaseCreate,
      Permission.ReleaseGet,

      Permission.DeploymentUpdate,
      Permission.DeploymentGet,
    ],
  },
];
