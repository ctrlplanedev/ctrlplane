local securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Session-based authentication using Better Auth',
  },
  apiKeyAuth: {
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
      url: 'http://localhost:3001',
      description: 'Development server',
    },
  ],
  paths: (import 'paths/workspaces.jsonnet'),
  components: {
    parameters: {},
    securitySchemes: securitySchemes,
    schemas: (import 'schemas/errors.jsonnet') + (import 'schemas/workspace.jsonnet'),
  },
}
