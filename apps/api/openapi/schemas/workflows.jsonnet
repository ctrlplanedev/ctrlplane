local openapi = import '../lib/openapi.libsonnet';

{
  WorkflowJobAgent: {
    type: 'object',
    required: ['name', 'ref', 'config', 'selector'],
    properties: {
      name: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
      selector: { type: 'string', description: 'CEL expression to determine if the job agent should dispatch a job' },
    },
  },

  CreateWorkflowJobAgent: {
    type: 'object',
    required: ['name', 'ref', 'config', 'selector'],
    properties: {
      name: { type: 'string' },
      ref: { type: 'string', description: 'Reference to the job agent' },
      config: { type: 'object', additionalProperties: true, description: 'Configuration for the job agent' },
      selector: { type: 'string', description: 'CEL expression to determine if the job agent should dispatch a job' },
    },
  },

  WorkflowStringInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['string'] },
      default: { type: 'string' },
    },
  },

  WorkflowNumberInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['number'] },
      default: { type: 'number' },
    },
  },

  WorkflowBooleanInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['boolean'] },
      default: { type: 'boolean' },
    },
  },

  WorkflowObjectInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['object'] },
      default: { type: 'object', additionalProperties: true },
    },
  },

  WorkflowManualArrayInput: {
    type: 'object',
    required: ['key', 'type'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['array'] },
      default: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  },

  WorkflowSelectorArrayInput: {
    type: 'object',
    required: ['key', 'type', 'selector'],
    properties: {
      key: { type: 'string' },
      type: { type: 'string', enum: ['array'] },
      selector: {
        type: 'object',
        required: ['entityType'],
        properties: {
          entityType: { type: 'string', enum: ['resource', 'environment', 'deployment'] },
          default: {
            type: 'string',
            description: 'CEL expression for the default selector.',
          },
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
      openapi.schemaRef('WorkflowObjectInput'),
    ],
  },

  CreateWorkflow: {
    type: 'object',
    required: ['name', 'inputs', 'jobAgents'],
    properties: {
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobAgents: {
        type: 'array',
        items: openapi.schemaRef('CreateWorkflowJobAgent'),
      },
    },
  },

  UpdateWorkflow: {
    type: 'object',
    required: ['name', 'inputs', 'jobAgents'],
    properties: {
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobAgents: {
        type: 'array',
        items: openapi.schemaRef('CreateWorkflowJobAgent'),
      },
    },
  },

  Workflow: {
    type: 'object',
    required: ['id', 'name', 'inputs', 'jobAgents'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      inputs: {
        type: 'array',
        items: openapi.schemaRef('WorkflowInput'),
      },
      jobAgents: {
        type: 'array',
        items: openapi.schemaRef('WorkflowJobAgent'),
      },
    },
  },

  WorkflowRun: {
    type: 'object',
    required: ['id', 'workflowId', 'inputs'],
    properties: {
      id: { type: 'string' },
      workflowId: { type: 'string' },
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
