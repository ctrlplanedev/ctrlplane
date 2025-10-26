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
    }
  ],
  paths: (import 'paths/workspaces.jsonnet') +
         (import 'paths/resource-providers.jsonnet') +
         (import 'paths/resources.jsonnet') +
         (import 'paths/deployments.jsonnet') +
         (import 'paths/deploymentversions.jsonnet') +
         (import 'paths/policies.jsonnet'),
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
             (import 'schemas/systems.jsonnet') +
             (import 'schemas/policies.jsonnet') +
             (import 'schemas/jobs.jsonnet'),
  },
}
