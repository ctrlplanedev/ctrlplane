local openapi = import '../lib/openapi.libsonnet';

{
  CelMatcher: {
    type: 'object',
    required: ['cel'],
    properties: {
      cel: { type: 'string' },
    },
  },

  PropertiesMatcher: {
    type: 'object',
    required: ['properties'],
    properties: {
      properties: {
        type: 'array',
        items: openapi.schemaRef('PropertyMatcher'),
      },
    },
  },

  RelationshipRule: {
    type: 'object',
    required: [
      'id',
      'name',
      'reference',
      'fromType',
      'toType',
      'matcher',
      'relationshipType',
      'metadata',
      'workspaceId',
    ],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      fromType: openapi.schemaRef('RelatableEntityType'),
      fromSelector: openapi.schemaRef('Selector'),
      toType: openapi.schemaRef('RelatableEntityType'),
      toSelector: openapi.schemaRef('Selector'),
      matcher: {
        oneOf: [
          openapi.schemaRef('CelMatcher'),
          openapi.schemaRef('PropertiesMatcher'),
        ],
      },
      relationshipType: { type: 'string' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      workspaceId: { type: 'string' },
    },
  },

  RelatedEntityGroup: {
    type: 'object',
    required: ['relationshipRule', 'direction', 'entityType', 'entityId', 'entity'],
    properties: {
      rule: openapi.schemaRef('RelationshipRule'),
      direction: openapi.schemaRef('RelationDirection'),
      entityType: openapi.schemaRef('RelatableEntityType'),
      entityId: {
        type: 'string',
        description: 'ID of the related entity',
      },
      entity: openapi.schemaRef('RelatableEntity'),
    },
  },
}
