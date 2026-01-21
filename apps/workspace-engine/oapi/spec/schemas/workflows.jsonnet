local openapi = import '../lib/openapi.libsonnet';

{
  Parameter: {
    type: 'object',
    required: ['name', 'type', 'required'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['string', 'number', 'boolean', 'object', 'array', 'matrix'] },
      required: { type: 'boolean', default: false },
      default: {},
      source: { 
        type: 'object', 
        required: ['kind'],
        properties: {
          kind: { type: 'string', enum: ['resource', 'environment', 'releaseTarget', 'list'] },
          selector: openapi.schemaRef('Selector'),
        },
      }, 
    },
  },

  Task: {
    type: 'object',
    required: ['name', 'type', 'jobAgentRef', 'config'],
    oneOf: [
      {
        type: 'object',
        required: ['name', 'type', 'jobAgentRef', 'config'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['job'] },
          jobAgentRef: { type: 'string' },
          config: { type: 'object' },
          matrix: { type: 'string' },
        },
      },
    ],
  },

  WorkflowTemplate: {
    type: 'object',
    required: ['id', 'name', 'scope', 'scopeId', 'spec', 'metadata'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      scope: { type: 'string' },
      scopeId: { type: 'string' },
      spec: { 
        type: 'object',
        required: ['parameters', 'tasks'], 
        properties: {
          parameters: { type: 'array', items: openapi.schemaRef('Parameter') },
          tasks: { type: 'array', items: openapi.schemaRef('Task') },
        },
      },
      metadata: { type: 'object' },
    },
  },
}