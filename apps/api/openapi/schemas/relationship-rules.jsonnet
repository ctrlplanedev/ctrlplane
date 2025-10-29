local openapi = import '../lib/openapi.libsonnet';

{
  RelatableEntityType: {
    type: 'string',
    enum: ['deployment', 'environment', 'resource'],
  },

  CelMatcher: {
    type: 'object',
    required: ['cel'],
    properties: {
      cel: { type: 'string' },
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

  UpsertRelationshipRuleRequest: {
    type: 'object',
    required: [
      'name',
      'reference',
      'fromType',
      'toType',
      'matcher',
      'relationshipType',
      'metadata',
    ],
    properties: {
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
        ],
      },
      relationshipType: { type: 'string' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },

  CreateRelationshipRuleRequest: {
    type: 'object',
    required: [
      'name',
      'reference',
      'fromType',
      'toType',
      'matcher',
      'relationshipType',
      'metadata',
    ],
    properties: {
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
        ],
      },
      relationshipType: { type: 'string' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },
}
