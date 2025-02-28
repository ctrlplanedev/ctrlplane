type WorkspaceParams = {
  workspaceSlug: string;
};

// Base URL builder
const buildUrl = (...segments: string[]) => {
  const path = segments.filter(Boolean).join("/");
  return `/${path}`;
};

// Workspace URL functions
const workspace = (slug: string) => {
  return {
    baseUrl: () => buildUrl(slug),
    systems: () => buildUrl(slug, "systems"),
    system: (systemSlug: string) => system({ workspaceSlug: slug, systemSlug }),
    deployments: () => buildUrl(slug, "deployments"),
    insights: () => buildUrl(slug, "insights"),
    resources: () => buildUrl(slug, "resources"),
    settings: () => buildUrl(slug, "settings"),
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
    environment: (id: string) => buildUrl(...base, "environments", id),
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
