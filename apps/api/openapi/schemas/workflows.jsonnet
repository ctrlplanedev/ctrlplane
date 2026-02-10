local openapi = import '../lib/openapi.libsonnet';

local openapi = import '../lib/openapi.libsonnet';

{
  WorkflowJobAgentConfig: {
    type: 'object',
    required: ['id', 'config'],
    properties: {
      id: { type: 'string' },
      config: { type: 'object', additionalProperties: true },
    },
  },

  WorkflowJobMatrix: {
    type: 'object',
    additionalProperties: {
      oneOf: [
        { type: 'array', items: { type: 'object', additionalProperties: true } },
        { type: 'string' },
      ],
    },
  },

  WorkflowJobTemplate: {
    type: 'object',
    required: ['id', 'name', 'ref', 'config'],
    properties: {
      name: { type: 'string' },
      id: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
      matrix: openapi.schemaRef('WorkflowJobMatrix'),
    },
  },

  WorkflowStringInput: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['string'] },
      default: { type: 'string' },
    },
  },

  WorkflowNumberInput: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['number'] },
      default: { type: 'number' },
    },
  },

  WorkflowBooleanInput: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['boolean'] },
      default: { type: 'boolean' },
    },
  },

  WorkflowManualArrayInput: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['array'] },
      default: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  },

  WorkflowSelectorArrayInput: {
    type: 'object',
    required: ['name', 'type', 'selector'],
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['array'] },
      selector: {
        type: 'object',
        required: ['entityType'],
        properties: {
          entityType: { type: 'string', enum: ['resource', 'environment', 'deployment'] },
          default: openapi.schemaRef('Selector'),
        },
      },
    },
  },

  WorkflowArrayInput: {
    oneOf: [
      openapi.schemaRef('WorkflowManualArrayInput'),
      openapi.schemaRef('WorkflowSelectorArrayInput'),
    ],
  },

  WorkflowInput: {
    oneOf: [
      openapi.schemaRef('WorkflowStringInput'),
      openapi.schemaRef('WorkflowNumberInput'),
      openapi.schemaRef('WorkflowBooleanInput'),
      openapi.schemaRef('WorkflowArrayInput'),
    ],
  },

  CreateWorkflowJobTemplate: {
    type: 'object',
    required: ['name', 'ref', 'config'],
    properties: {
      name: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
      matrix: openapi.schemaRef('WorkflowJobMatrix'),
    },
  },

  CreateWorkflowTemplate: {
    type: 'object',
    required: ['name', 'inputs', 'jobs'],
    properties: {
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobs: {
        type: 'array',
        items: openapi.schemaRef('CreateWorkflowJobTemplate'),
      },
    },
  },

  UpdateWorkflowTemplate: {
    type: 'object',
    required: ['name', 'inputs', 'jobs'],
    properties: {
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobs: {
        type: 'array',
        items: openapi.schemaRef('CreateWorkflowJobTemplate'),
      },
    },
  },

  WorkflowTemplate: {
    type: 'object',
    required: ['id', 'name', 'inputs', 'jobs'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowJobTemplate'),
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

  WorkflowJob: {
    type: 'object',
    required: ['id', 'workflowId', 'index', 'ref', 'config'],
    properties: {
      id: { type: 'string' },
      index: { type: 'integer' },
      workflowId: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
    },
  },
}
