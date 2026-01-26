local openapi = import '../lib/openapi.libsonnet';

{
  WorkflowTaskTemplate: {
    type: 'object',
    required: ['name', 'jobAgent'],
    properties: {
      name: { type: 'string' },
      jobAgent: { 
        type: 'object',
        required: ['id', 'config'],
        properties: {
          id: { type: 'string' },
          config: { type: 'object', additionalProperties: true },
        },
      },
    },
  },

  WorkflowStringParameter: {
    type: 'object',
    required: ['name', 'type', 'default'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['string'] },
      default: { type: 'string' },
    },
  },
  
  WorkflowNumberParameter: {
    type: 'object',
    required: ['name', 'type', 'default'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['number'] },
      default: { type: 'number' },
    },
  },

  WorkflowBooleanParameter: {
    type: 'object',
    required: ['name', 'type', 'default'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['boolean'] },
      default: { type: 'boolean' },
    },
  },
  
  WorkflowMatrixParameter: {
    type: 'object',
    required: ['name', 'type', 'source'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['matrix'] },
      source: {
        type: 'object',
        required: ['kind', 'selector'],
        properties: {
          kind: { type: 'string', enum: ['resource', 'environment', 'deployment'] },
          selector: openapi.schemaRef('Selector'),
        },
      },
    },
  },
  
  WorkflowParameter: {
    oneOf: [
      openapi.schemaRef('WorkflowStringParameter'),
      openapi.schemaRef('WorkflowNumberParameter'),
      openapi.schemaRef('WorkflowBooleanParameter'),
      openapi.schemaRef('WorkflowMatrixParameter'),
    ],
  },

  WorkflowTemplate: {
    type: 'object',
    required: ['id', 'name', 'parameters', 'tasks'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      parameters: { 
        type: 'array',
        items: openapi.schemaRef('WorkflowParameter'),
      },
      tasks: {
        type: 'array',
        items: openapi.schemaRef('WorkflowTaskTemplate'),
      },
    },
  },
}