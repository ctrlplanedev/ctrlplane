{
  RelationshipRule: {
    type: 'object',
    required: [
      'id',
      'name',
      'reference',
      'cel',
      'metadata',
      'workspaceId',
    ],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      cel: { type: 'string' },
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
      'cel',
      'metadata',
    ],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      cel: { type: 'string' },
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
      'cel',
      'metadata',
    ],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      reference: { type: 'string' },
      cel: { type: 'string' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },
}
