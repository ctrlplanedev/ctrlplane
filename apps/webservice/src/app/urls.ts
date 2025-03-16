type WorkspaceParams = {
  workspaceSlug: string;
};

// Base URL builder
const buildUrl = (...segments: string[]) => {
  const path = segments.filter(Boolean).join("/");
  return `/${path}`;
};

const workspaceSettings = (slug: string) => {
  return {
    baseUrl: () => buildUrl(slug, "settings"),
    members: () => buildUrl(slug, "settings", "members"),
    general: () => buildUrl(slug, "settings", "general"),
    account: () => buildUrl(slug, "settings", "account"),
    integrations: () => buildUrl(slug, "settings", "integrations"),
  };
};

// Workspace URL functions
const workspace = (slug: string) => {
  return {
    baseUrl: () => buildUrl(slug),
    systems: () => buildUrl(slug, "systems"),
    system: (systemSlug: string) => system({ workspaceSlug: slug, systemSlug }),
    deployments: () => buildUrl(slug, "deployments"),
    agents: () => buildUrl(slug, "agents"),
    insights: () => buildUrl(slug, "insights"),
    resources: () => resources(slug),
    settings: () => workspaceSettings(slug),
  };
};

const resources = (workspaceSlug: string) => ({
  baseUrl: () => buildUrl(workspaceSlug, "resources"),
  list: () => buildUrl(workspaceSlug, "resources", "list"),
  providers: () => providers(workspaceSlug),
  groupings: () => buildUrl(workspaceSlug, "resources", "groupings"),
  views: () => buildUrl(workspaceSlug, "resources", "views"),
});

const providers = (workspaceSlug: string) => {
  const providersBase = [workspaceSlug, "resources", "providers"];
  return {
    baseUrl: () => buildUrl(...providersBase),
    integrations: () => {
      const integrationsBase = [...providersBase, "integrations"];
      return {
        baseUrl: () => buildUrl(...integrationsBase),
        azure: () => buildUrl(...integrationsBase, "azure"),
      };
    },
  };
};

type SystemParams = WorkspaceParams & {
  systemSlug: string;
};

// System URL functions
const system = (params: SystemParams) => {
  const { workspaceSlug, systemSlug } = params;
  const base = [workspaceSlug, "systems", systemSlug];

  return {
    baseUrl: () => buildUrl(...base),
    deployments: () => buildUrl(...base, "deployments"),
    deployment: (deploymentSlug: string) =>
      deployment({ ...params, deploymentSlug }),
    environments: () => buildUrl(...base, "environments"),
    environment: (id: string) => environment({ ...params, environmentId: id }),
  };
};

type EnvironmentParams = SystemParams & {
  environmentId: string;
};

const environment = (params: EnvironmentParams) => {
  const { workspaceSlug, systemSlug, environmentId } = params;
  const base = [
    workspaceSlug,
    "systems",
    systemSlug,
    "environments",
    environmentId,
  ];

  return {
    baseUrl: () => buildUrl(...base),
    deployments: () => buildUrl(...base, "deployments"),
    policies: () => buildUrl(...base, "policies"),
    resources: () => buildUrl(...base, "resources"),
    variables: () => buildUrl(...base, "variables"),
    settings: () => buildUrl(...base, "settings"),
  };
};
type DeploymentParams = SystemParams & {
  deploymentSlug: string;
};

// Deployment URL functions
const deployment = (params: DeploymentParams) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = params;
  const base = [
    workspaceSlug,
    "systems",
    systemSlug,
    "deployments",
    deploymentSlug,
  ];

  return {
    baseUrl: () => buildUrl(...base),
    deployments: () => buildUrl(...base),
    properties: () => buildUrl(...base, "properties"),
    workflow: () => buildUrl(...base, "workflow"),
    releases: () => buildUrl(...base),
    release: (releaseId: string) => release({ ...params, releaseId }),
    channels: () => buildUrl(...base, "channels"),
    variables: () => buildUrl(...base, "variables"),
    hooks: () => buildUrl(...base, "hooks"),
  };
};

type ReleaseParams = DeploymentParams & {
  releaseId: string;
};

const release = (params: ReleaseParams) => {
  const { workspaceSlug, systemSlug, deploymentSlug, releaseId } = params;
  const base = [
    workspaceSlug,
    "systems",
    systemSlug,
    "deployments",
    deploymentSlug,
    "releases",
    releaseId,
  ];

  return {
    baseUrl: () => buildUrl(...base),
  };
};

export const urls = { workspace };
