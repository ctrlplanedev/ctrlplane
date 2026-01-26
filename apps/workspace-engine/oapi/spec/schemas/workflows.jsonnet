local openapi = import '../lib/openapi.libsonnet';

{
  WorkflowTaskTemplate: {
    type: 'object',
    required: ['name', 'jobAgent'],
    properties: {
      name: { type: 'string' },
      id: { type: 'string' },
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

  WorkflowParameter: {
    oneOf: [
      openapi.schemaRef('WorkflowStringParameter'),
      openapi.schemaRef('WorkflowNumberParameter'),
      openapi.schemaRef('WorkflowBooleanParameter'),
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

  Workflow: {
    type: 'object',
    required: ['id', 'workflowTemplateId', 'parameters', 'status'],
    properties: {
      id: { type: 'string' },
      workflowTemplateId: { type: 'string' },
      parameters: {
        type: 'array',
        items: openapi.schemaRef('LiteralValue'),
      },
      status: openapi.schemaRef('JobStatus'),
      startedAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time' },
    },
  },

  Task: {
    type: 'object',
    required: ['id', 'workflowId', 'taskName', 'jobIds', 'status'],
    properties: {
      id: { type: 'string' },
      workflowId: { type: 'string' },
      taskName: { type: 'string' },
      jobIds: { type: 'array', items: { type: 'string' } },
      status: openapi.schemaRef('JobStatus'),
      startedAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time' },
    },
  },
}
