local openapi = import '../lib/openapi.libsonnet';

{
  entityType: {
    name: 'entityType',
    'in': 'path',
    required: true,
    description: 'Type of the entity (deployment, environment, or resource)',
    schema: openapi.schemaRef('RelatableEntityType'),
  },
}