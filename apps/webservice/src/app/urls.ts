type WorkspaceParams = {
  workspaceSlug: string;
};

// Base URL builder
const buildUrl = (...segments: string[]) => {
  const path = segments.filter(Boolean).join("/");
  return `/${path}`;
};

const workspaceSettings = (slug: string) => {
  const base = [slug, "settings", "workspace"];
  return {
    baseUrl: () => buildUrl(...base),
    overview: () => buildUrl(...base, "overview"),
    members: () => buildUrl(...base, "members"),
    general: () => buildUrl(...base, "general"),
    integrations: () => workspaceSettingsIntegrations(slug),
    account: () => ({
      profile: () => buildUrl(...base, "account", "profile"),
      api: () => buildUrl(...base, "account", "api"),
    }),
  };
};

const workspaceSettingsIntegrations = (slug: string) => {
  const base = [slug, "settings", "workspace", "integrations"];
  return {
    baseUrl: () => buildUrl(...base),
    aws: () => buildUrl(...base, "aws"),
    azure: () => buildUrl(...base, "azure"),
    google: () => buildUrl(...base, "google"),
    github: () => buildUrl(...base, "github"),
  };
};

const workspacePolicies = (slug: string) => {
  const base = [slug, "policies"];
  return {
    baseUrl: () => buildUrl(...base),
    analytics: () => buildUrl(...base, "analytics"),
    settings: () => buildUrl(...base, "settings"),
    denyWindows: () => buildUrl(...base, "deny-windows"),
    approvalGates: () => buildUrl(...base, "approval-gates"),
    versionConditions: () => buildUrl(...base, "version-conditions"),
    edit: (policyId: string) => workspacePolicyEdit(slug, policyId),
    byId: (policyId: string) => buildUrl(...base, policyId),
  };
};

const workspacePolicyEdit = (slug: string, policyId: string) => {
  const base = [slug, "policies", policyId, "edit"];
  return {
    baseUrl: () => buildUrl(...base),
    configuration: () => buildUrl(...base, "configuration"),
    timeWindows: () => buildUrl(...base, "time-windows"),
    deploymentFlow: () => buildUrl(...base, "deployment-flow"),
    qualitySecurity: () => buildUrl(...base, "quality-security"),
    approvalGates: () => buildUrl(...base, "approval-gates"),
  };
};

// Workspace URL functions
const workspace = (slug: string) => {
  return {
    baseUrl: () => buildUrl(slug),
    systems: () => buildUrl(slug, "systems"),
    system: (systemSlug: string) => system({ workspaceSlug: slug, systemSlug }),
    deployments: () => buildUrl(slug, "deployments"),
    agents: () => workspaceJobAgents(slug),
    insights: () => buildUrl(slug, "insights"),
    resources: () => resources(slug),
    resource: (resourceId: string) => resource(slug, resourceId),
    policies: () => workspacePolicies(slug),
    settings: () => workspaceSettings(slug),
  };
};

const workspaceJobAgents = (slug: string) => {
  const base = [slug, "job-agents"];
  return {
    baseUrl: () => buildUrl(...base),
    integrations: () => workspaceSettingsIntegrations(slug),
  };
};

const resources = (workspaceSlug: string) => ({
  baseUrl: () => buildUrl(workspaceSlug, "resources"),
  list: () => buildUrl(workspaceSlug, "resources", "list"),
  providers: () => providers(workspaceSlug),
  groupings: () => buildUrl(workspaceSlug, "resources", "groupings"),
  schemas: () => buildUrl(workspaceSlug, "resources", "schemas"),
  views: () => buildUrl(workspaceSlug, "resources", "views"),
  relationshipRules: () =>
    buildUrl(workspaceSlug, "resources", "relationship-rules"),
});

const resource = (workspaceSlug: string, resourceId: string) => {
  const base = [workspaceSlug, "resources", resourceId];
  return {
    baseUrl: () => buildUrl(...base),
    deployments: () => buildUrl(...base, "deployments"),
    variables: () => buildUrl(...base, "variables"),
    properties: () => buildUrl(...base, "properties"),
    visualize: () => buildUrl(...base, "visualize"),
  };
};

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
    policies: () => buildUrl(...base, "policies"),
    runbooks: () => runbooks(params),
  };
};

const runbooks = (params: SystemParams) => {
  const { workspaceSlug, systemSlug } = params;
  const base = [workspaceSlug, "systems", systemSlug, "runbooks"];

  return {
    baseUrl: () => buildUrl(...base),
    create: () => buildUrl(...base, "create"),
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
    overview: () => buildUrl(...base, "overview"),
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
    jobs: () => buildUrl(...base, "jobs"),
    checks: () => buildUrl(...base, "checks"),
  };
};

export const urls = { workspace };
