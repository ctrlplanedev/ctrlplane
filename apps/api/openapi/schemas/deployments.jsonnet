local openapi = import '../lib/openapi.libsonnet';

{
  Deployment: {
    type: 'object',
    required: ['id', 'name', 'slug', 'systemId', 'jobAgentConfig'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      systemId: { type: 'string' },
      jobAgentId: { type: 'string' },
      jobAgentConfig: {
        type: 'object',
        additionalProperties: true,
      },
      resourceSelector: openapi.schemaRef('Selector'),
    },
  },
   DeploymentAndSystem: {
    type: 'object',
    required: ['deployment', 'system'],
    properties: {
      deployment: openapi.schemaRef('Deployment'),
      system: openapi.schemaRef('System'),
    },
  },
}