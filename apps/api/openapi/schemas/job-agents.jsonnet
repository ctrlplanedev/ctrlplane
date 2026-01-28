{
  UpsertJobAgentRequest: {
    type: 'object',
    required: ['name', 'type', 'config'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string' },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      config: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },

  JobAgent: {
    type: 'object',
    required: ['id', 'name', 'type', 'config', 'metadata'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      type: { type: 'string' },
      config: {
        type: 'object',
        additionalProperties: true,
      },
      metadata: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
  },
}