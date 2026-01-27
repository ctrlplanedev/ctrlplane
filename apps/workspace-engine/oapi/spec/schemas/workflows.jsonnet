local openapi = import '../lib/openapi.libsonnet';

{
  WorkflowStepTemplate: {
    type: 'object',
    required: ['id', 'name', 'jobAgent'],
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

  WorkflowStringInput: {
    type: 'object',
    required: ['name', 'type', 'default'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['string'] },
      default: { type: 'string' },
    },
  },

  WorkflowNumberInput: {
    type: 'object',
    required: ['name', 'type', 'default'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['number'] },
      default: { type: 'number' },
    },
  },

  WorkflowBooleanInput: {
    type: 'object',
    required: ['name', 'type', 'default'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['boolean'] },
      default: { type: 'boolean' },
    },
  },

  WorkflowInput: {
    oneOf: [
      openapi.schemaRef('WorkflowStringInput'),
      openapi.schemaRef('WorkflowNumberInput'),
      openapi.schemaRef('WorkflowBooleanInput'),
    ],
  },

  WorkflowTemplate: {
    type: 'object',
    required: ['id', 'name', 'inputs', 'steps'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      steps: {
        type: 'array',
        items: openapi.schemaRef('WorkflowStepTemplate'),
      },
    },
  },

  Workflow: {
    type: 'object',
    required: ['id', 'workflowTemplateId', 'inputs'],
    properties: {
      id: { type: 'string' },
      workflowTemplateId: { type: 'string' },
      inputs: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },

  WorkflowStep: {
    type: 'object',
    required: ['id', 'workflowId', 'workflowStepTemplateId'],
    properties: {
      id: { type: 'string' },
      workflowId: { type: 'string' },
      workflowStepTemplateId: { type: 'string' },
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
}
