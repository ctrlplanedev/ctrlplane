local securitySchemes = {
  BearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Session-based authentication using Better Auth',
  },
  ApiKeyAuth: {
    type: 'apiKey',
    'in': 'header',
    name: 'X-API-Key',
    description: 'API key authentication using X-API-Key header',
  },
};

{
  openapi: '3.0.0',
  info: {
    title: 'Ctrlplane API',
    version: '1.0.0',
    description: 'OpenAPI schemas for Ctrlplane API',
  },
  servers: [
    {
      url: 'http://localhost:3001/api',
      description: 'Development server',
    },
  ],
  security: [
    {
      ApiKeyAuth: [],
    },
    {
      BearerAuth: [],
    },
  ],
  paths: (import 'paths/workspaces.jsonnet') +
         (import 'paths/resource-providers.jsonnet') +
         (import 'paths/resources.jsonnet') +
         (import 'paths/systems.jsonnet') +
         (import 'paths/deployments.jsonnet') +
         (import 'paths/deploymentversions.jsonnet') +
         (import 'paths/deploymentvariables.jsonnet') +
         (import 'paths/environments.jsonnet') +
         (import 'paths/policies.jsonnet') +
         (import 'paths/userapprovalrecords.jsonnet') +
         (import 'paths/relationship-rules.jsonnet') +
         (import 'paths/jobs.jsonnet') +
         (import 'paths/release-targets.jsonnet') +
         (import 'paths/release.jsonnet') +
         (import 'paths/job-agents.jsonnet') +
         (import 'paths/workflows.jsonnet'),
  components: {
    parameters: {},
    securitySchemes: securitySchemes,
    schemas:
      (import 'schemas/core.jsonnet') +
      (import 'schemas/errors.jsonnet') +
      (import 'schemas/workspace.jsonnet') +
      (import 'schemas/resources.jsonnet') +
      (import 'schemas/deployments.jsonnet') +
      (import 'schemas/deploymentversions.jsonnet') +
      (import 'schemas/deploymentvariables.jsonnet') +
      (import 'schemas/environments.jsonnet') +
      (import 'schemas/systems.jsonnet') +
      (import 'schemas/policies.jsonnet') +
      (import 'schemas/jobs.jsonnet') +
      (import 'schemas/userapprovalrecord.jsonnet') +
      (import 'schemas/resource-provider.jsonnet') +
      (import 'schemas/relationship-rules.jsonnet') +
      (import 'schemas/release.jsonnet') +
      (import 'schemas/job-agents.jsonnet') +
      (import 'schemas/verifications.jsonnet') +
      (import 'schemas/workflows.jsonnet'),
  },
}
