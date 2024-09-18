export type WorkspaceAttributes = {
  id: string;
  name: string;
  description?: string;
  "auto-apply"?: boolean;
  "terraform-version"?: string;
  "tag-names"?: string[];
  "plan-duration-average"?: number;
  "apply-duration-average"?: number;
  "vcs-repo"?: {
    identifier: string;
    branch: string;
    "ingress-submodules": boolean;
    "repository-http-url": string;
  };
};

export type Workspace = {
  id: string;
  type: "workspaces";
  attributes: WorkspaceAttributes;
  link: URL;
};

export type VariableAttributes = {
  key: string;
  value: string;
  description?: string;
  category: "terraform" | "env";
  hcl: boolean;
  sensitive: boolean;
};

export type Variable = {
  id: string;
  type: "vars";
  attributes: VariableAttributes;
};

export type ApiResponse<DataType> = {
  data: DataType;
  included?: any[];
  meta?: any;
  links?: {
    self: string;
    next?: string;
  };
};

export type ApiError = {
  errors: Array<{
    status: string;
    title: string;
    detail?: string;
  }>;
};
